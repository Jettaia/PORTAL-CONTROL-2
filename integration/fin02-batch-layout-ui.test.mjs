import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import odbc from 'odbc';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {buildAssets} from '../production/build-assets.mjs';
import {printMany,printStyle} from '../src/fin02-batch.js';
import {renderReceipt} from '../src/fin02-document.js';

test('lote usa modelo individual com CSS autenticado na raiz e sob /chapa',async t=>{
 const assets=fs.mkdtempSync(path.join(os.tmpdir(),'jetta-receipt-layout-'));buildAssets(assets);
 const snapshot={Numero:'10',ValorLiberado:'66.00',Deposito:'Depósito sintético',CentroCusto:'CC-19',Rua:'Avenida teste',NumeroEndereco:'410',Bairro:'Centro',Cidade:'Sumaré',Estado:'SP',CEP:'13178574',Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61',Tipo:'Auxiliar de depósito',DataServico:'2026-11-12',Prestador:'Prestador sintético'};
 const receipts=[10,11].map(id=>({ContratacaoId:id,VersaoOrigem:1,DataEmissao:'2026-11-12',Snapshot:{...snapshot,Numero:String(id)}}));
 t.mock.method(odbc,'connect',async()=>({beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{},query:async sql=>{
  if(sql.startsWith('SET '))return [];
  if(sql.includes('FROM Seguranca.Usuario u'))return [{UsuarioId:1,Adm:1}];
  assert.match(sql,/FROM Financeiro.ContratacaoRecibo/);return receipts.map(r=>({...r,SnapshotJson:JSON.stringify(r.Snapshot)}));
 }}));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const prefix of ['/chapa','']){
  const app=express(),router=express.Router();router.use(express.json());
  router.use((_q,r,next)=>{r.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'");next();});
  router.get('/fixture',(_q,r)=>r.send(`<!doctype html><html><link rel="stylesheet" href="${prefix}/fin01.css"><main id="dashboard"><section id="fin01Page"></section></main><script src="${prefix}/fin01.js"></script></html>`));
  let cssReads=0;
  router.get('/api/financeiro/recibos/estilo.css',(q,r)=>{if(!q.headers.cookie?.includes('receiptTest=1'))return r.sendStatus(401);cssReads++;r.type('css').send(printStyle);});
  router.post('/api/financeiro/recibos/impressao',async(q,r)=>{try{const out=await printMany({basePath:prefix},1,q.body);r.set('Content-Security-Policy',out.csp).type('html').send(out.html);}catch(e){r.status(500).send(e.message);}});
  router.get('/individual',(_q,r)=>{const html=renderReceipt(receipts[0]),style=html.match(/<style>([\s\S]*?)<\/style>/)[1],hash=crypto.createHash('sha256').update(style).digest('base64');r.set('Content-Security-Policy',`default-src 'none'; style-src 'sha256-${hash}'`).type('html').send(html);});
  router.get('/api/financeiro/catalogo',(_q,r)=>r.json({depositos:[],prestadores:[],podeOperar:true}));
  router.get('/api/financeiro/recibos/previa',(_q,r)=>r.json({registros:receipts.map(r=>({...r,...r.Snapshot})),quantidade:2,total:'132.00',jaEmitidos:0,previa:'synthetic'}));
  router.post('/api/financeiro/recibos/gerar',(_q,r)=>r.json({resultados:receipts.map(r=>({contratacaoId:String(r.ContratacaoId),numero:String(r.ContratacaoId),estado:'GERADO'})),gerados:2,ignorados:0,falhas:0}));
  router.get('/api/financeiro/contratacoes',(_q,r)=>r.json({registros:[],podeOperar:true}));
  router.use(express.static(prefix?assets:'public'));app.use(prefix||'/',router);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const context=await browser.newContext(),errors=[];await context.addCookies([{name:'receiptTest',value:'1',url:origin+prefix+'/',path:prefix||'/'}].map(({url,...c})=>({...c,domain:'127.0.0.1'})));
  try{
   const page=await context.newPage();page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+prefix+'/fixture');await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
   await page.locator('[name=inicio]').fill('2026-11-01');await page.locator('[name=fim]').fill('2026-11-12');await page.getByRole('button',{name:'Gerar recibos do período',exact:true}).click();await page.getByRole('button',{name:'Confirmar geração',exact:true}).click();
   const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir recibos gerados',exact:true}).click();const popup=await popupPromise;
   await popup.waitForFunction(()=>document.querySelector('h1')&&getComputedStyle(document.querySelector('h1')).textAlign==='center',null,{timeout:4000});assert.equal(cssReads,1);
   assert.equal(await popup.locator('.receipt').count(),2);await popup.emulateMedia({media:'print'});
   const geometry=el=>{const q=s=>{const e=el.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,font:c.fontFamily,size:c.fontSize,align:c.textAlign}};return ['h1','.cost','.receipt-qr svg','.signature .manual','.cpf .manual'].map(q);};
   const actual=await popup.locator('.receipt').first().evaluate(geometry),single=await context.newPage();await single.goto(origin+prefix+'/individual');await single.emulateMedia({media:'print'});assert.deepEqual(actual,await single.locator('.receipt').evaluate(geometry));
   assert.ok(Math.abs(actual[2].width-22*96/25.4)<1,'QR mantém 22mm');
   fs.mkdirSync('artifacts/fin02-batch-layout',{recursive:true});const name=prefix?'prefix':'root',pdf=await popup.pdf({preferCSSPageSize:true,printBackground:true});assert.equal((await PDFDocument.load(pdf)).getPageCount(),2,'cada recibo completo em uma página');fs.writeFileSync(`artifacts/fin02-batch-layout/${name}.pdf`,pdf);await popup.screenshot({path:`artifacts/fin02-batch-layout/${name}.png`,fullPage:true});const individualPdf=await single.pdf({preferCSSPageSize:true,printBackground:true});assert.equal((await PDFDocument.load(individualPdf)).getPageCount(),1);fs.writeFileSync(`artifacts/fin02-batch-layout/${name}-individual.pdf`,individualPdf);assert.deepEqual(errors,[]);
  }finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 }}finally{await browser.close();assert.ok(path.resolve(assets).startsWith(path.resolve(os.tmpdir())+path.sep+'jetta-receipt-layout-'));fs.rmSync(assets,{recursive:true,force:true});}
});
