import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

import crypto from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.static('public'));
app.get('/fin02-test',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIN02 teste</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><link rel="stylesheet" href="/final-lab.css"><section id="fin01Page" class="panel"></section><link rel="stylesheet" href="/fin01.css"></html>'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const origin=`http://127.0.0.1:${server.address().port}`;
const row={ContratacaoId:1,Numero:101,Prestador:'Maria Aparecida de Oliveira dos Santos e Silva',Deposito:'Santos',Tipo:'Carga, descarga e organização de mercadorias no depósito',DataServico:'2026-10-29',ValorLiberado:'175.25',LiberadoEmUtc:'2026-10-30T11:00:00',LiberadoPor:'Ana Gestora',GestorResponsavel:'Ana',Cidade:'Santos',Estado:'SP',CentroCusto:'CC-01'};
const receipt={ReciboId:1,ContratacaoId:1,VersaoOrigem:3,DataEmissao:'2026-10-30',EmitidoEmUtc:'2026-10-30T15:00:00',EmitidoPor:1,Snapshot:{...row,Deposito:'Depósito Santos',Rua:'Rua das Flores',NumeroEndereco:'123',Bairro:'Centro',CEP:'11010000',Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61'}};
fs.mkdirSync('artifacts/fin01-receipt-column',{recursive:true});
try{
 for(const perfil of ['ADMIN','FINANCEIRO','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);
  let emitted=false,fail=true,writes=0,empty=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.context().route('**/api/financeiro/**',async route=>{
   const req=route.request(),url=new URL(req.url());let body={},status=200;
   if(req.method()==='POST'){
    writes++;assert.equal(url.pathname,'/api/financeiro/contratacoes/1/recibo');assert.equal(req.headers()['x-jetta-request'],'web');assert.deepEqual(req.postDataJSON(),{});
    if(fail){status=503;body={erro:'FINANCEIRO_INDISPONIVEL'};}else{emitted=true;body={recibo:receipt,podeOperar:true};}
   }else if(url.pathname.endsWith('/impressao')){await route.fulfill({status:200,contentType:'text/html',body:'<h1>Recibo 101</h1>'});return;}
   else if(url.pathname.endsWith('/catalogo'))body={depositos:[],prestadores:[]};
   else if(url.pathname.endsWith('/contratacoes'))body={registros:empty?[]:[{...row,ReciboId:emitted?1:null,Situacao:emitted?'RECIBO_GERADO':'AGUARDANDO_PAGAMENTO'}],proximaPagina:null,podeOperar:perfil!=='GESTOR'};
   else body={registro:{...row,ReciboId:emitted?1:null,DataEmissao:emitted?'2026-10-30':null,Situacao:emitted?'RECIBO_GERADO':'AGUARDANDO_PAGAMENTO'},podeOperar:perfil!=='GESTOR'};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/fin02-test');await page.addScriptTag({url:origin+'/fin01.js'});await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  await page.locator('#fin01Rows tr[data-contract]').waitFor();assert.deepEqual((await page.locator('#fin01Page th').allTextContents()).slice(-2),['Recibo','Detalhes']);
  const table=page.locator('#fin01Rows');
  if(perfil!=='GESTOR'){
   const emit=table.getByRole('button',{name:'Gerar recibo da contratação 101',exact:true});await emit.click();await page.getByText('FINANCEIRO_INDISPONIVEL',{exact:true}).waitFor();assert.equal(await emit.isEnabled(),true);
   fail=false;await emit.dblclick();await table.getByRole('link',{name:'Abrir recibo da contratação 101',exact:true}).waitFor();assert.equal(writes,2);await page.locator('#fin01Detail .fin02-print').waitFor();await page.getByRole('button',{name:'Fechar detalhes',exact:true}).click();
  }else{
   assert.equal(await table.getByRole('button',{name:/Gerar recibo/}).count(),0);assert.equal(writes,0);
   emitted=true;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await table.getByRole('link',{name:'Abrir recibo da contratação 101',exact:true}).waitFor();
  }
  const print=table.getByRole('link',{name:'Abrir recibo da contratação 101',exact:true});const popupPromise=page.waitForEvent('popup');await print.click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(popup.url(),/contratacoes\/1\/recibo\/impressao$/);assert.equal(writes,perfil==='GESTOR'?0:2);await popup.close();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await print.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`artifacts/fin01-receipt-column/${perfil}-${width}.png`,fullPage:true});}
  empty=true;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();assert.equal(await table.locator('td').getAttribute('colspan'),'8');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS coluna Recibo: ADM/Financeiro geram pela linha, erro/repetição, atualização/impressão, gestor leitura, vazio e desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
