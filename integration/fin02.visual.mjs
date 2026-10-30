import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.static('public'));
app.get('/fin02-test',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIN02 teste</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><link rel="stylesheet" href="/final-lab.css"><section id="fin01Page" class="panel"></section><link rel="stylesheet" href="/fin01.css"></html>'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const origin=`http://127.0.0.1:${server.address().port}`;
const row={ContratacaoId:1,Numero:101,Prestador:'Maria Aparecida de Oliveira dos Santos e Silva',Deposito:'Santos',Tipo:'Carga, descarga e organização de mercadorias no depósito',DataServico:'2026-10-29',ValorLiberado:'175.25',LiberadoEmUtc:'2026-10-30T11:00:00',LiberadoPor:'Ana Gestora',GestorResponsavel:'Ana',Cidade:'Santos',Estado:'SP',CentroCusto:'CC-01'};
const receipt={ReciboId:1,ContratacaoId:1,VersaoOrigem:3,DataEmissao:'2026-10-30',EmitidoEmUtc:'2026-10-30T15:00:00',EmitidoPor:1,Snapshot:{...row,Deposito:'Depósito Santos',Rua:'Rua das Flores',NumeroEndereco:'123',Bairro:'Centro',CEP:'11010000',Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61'}};
fs.mkdirSync('artifacts/fin02',{recursive:true});
try{
 for(const perfil of ['ADMIN','FINANCEIRO','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);
  let emitted=perfil==='GESTOR',fail=false,writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.context().route('**/api/financeiro/**',async route=>{
   const req=route.request(),url=new URL(req.url());let body={},status=200;
   if(req.method()==='POST'){
    writes++;assert.equal(req.headers()['x-jetta-request'],'web');assert.deepEqual(req.postDataJSON(),{});
    if(fail){status=503;body={erro:'FINANCEIRO_INDISPONIVEL'};}else{emitted=true;body={recibo:receipt,podeOperar:true};}
   }else if(url.pathname.endsWith('/impressao')){
    const {renderReceipt}=await import('../src/fin02-document.js'),html=renderReceipt(receipt),css=html.match(/<style>([\s\S]*?)<\/style>/)[1],hash=crypto.createHash('sha256').update(css).digest('base64');
    await route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':`default-src 'none'; style-src 'sha256-${hash}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`},body:html});return;
   }else if(url.pathname.endsWith('/recibo'))body={recibo:receipt,podeOperar:perfil!=='GESTOR'};
   else if(url.pathname.endsWith('/catalogo'))body={depositos:[],prestadores:[]};
   else if(url.pathname.endsWith('/contratacoes'))body={registros:[{...row,ReciboId:emitted?1:null,DataEmissao:emitted?'2026-10-30':null,ReciboCompativel:1,Situacao:emitted?'RECIBO_GERADO':'AGUARDANDO_PAGAMENTO'}],proximaPagina:null,podeOperar:perfil!=='GESTOR'};
   else body={registro:{...row,ReciboId:emitted?1:null,DataEmissao:emitted?'2026-10-30':null,ReciboCompativel:1,Situacao:emitted?'RECIBO_GERADO':'AGUARDANDO_PAGAMENTO'},podeOperar:perfil!=='GESTOR'};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/fin02-test');
  await page.addScriptTag({url:origin+'/fin01.js'});
  await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  await page.getByRole('button',{name:'Detalhes da contratação 101',exact:true}).click();
  if(perfil!=='GESTOR'){
   const emit=page.getByRole('button',{name:'Gerar recibo',exact:true});await emit.waitFor();
   fail=true;await emit.click();await page.getByText('FINANCEIRO_INDISPONIVEL',{exact:true}).waitFor();assert.equal(await emit.isEnabled(),true);
   fail=false;await emit.click();await page.locator('#fin01Detail').getByText('Recibo gerado',{exact:true}).waitFor();
   assert.match(await page.locator('#fin01Detail').innerText(),/continua pendente/);
   assert.equal(await page.getByRole('button',{name:'Gerar recibo',exact:true}).count(),0);
   assert.equal(writes,2);
  }else{assert.equal(await page.getByRole('button',{name:'Gerar recibo',exact:true}).count(),0);assert.equal(writes,0);}
  const print=page.getByRole('link',{name:'Abrir recibo para impressão',exact:true});await print.waitFor();
  const popupPromise=page.waitForEvent('popup');await print.click();const popup=await popupPromise;await popup.waitForLoadState();
  const text=await popup.locator('body').innerText();for(const content of ['RECIBO','15.387.508/0001-61','175,25','Santos/SP',row.Prestador,row.Tipo,'29/10/2026','30 de outubro de 2026'])assert.ok(text.includes(content),content);
  assert.ok((await popup.locator('.receipt > p').first().innerText()).includes(`${row.Tipo}, realizado na data de 29/10/2026.`),'Atividade e data devem compor o mesmo parágrafo, separadas por vírgula');
  assert.equal(await popup.locator('body').evaluate(n=>getComputedStyle(n).fontSize),'21.3333px','CSP deve permitir o estilo persistido');
  assert.equal(await popup.locator('input').count(),0);assert.equal(await popup.locator('script').count(),0);
  assert.equal(await popup.locator('[data-manual="cpf"]').innerText(),'');
  assert.equal(await popup.locator('[data-manual="extenso"]').count(),0);
  const header=await popup.locator('.cost').innerText();for(const content of ['Depósito Santos','Centro de custo: CC-01','Rua das Flores, 123','Centro','Santos/SP','11010-000'])assert.ok(header.includes(content),content);
  assert.equal(await popup.locator('[data-manual="assinatura"]').innerText(),'');
  if(perfil==='ADMIN'){
   await popup.emulateMedia({media:'print'});await popup.screenshot({path:'artifacts/fin02/recibo.png',fullPage:true});
   await popup.pdf({path:'artifacts/fin02/recibo.pdf',preferCSSPageSize:true});
   assert.match(execFileSync('pdfinfo',['artifacts/fin02/recibo.pdf'],{encoding:'utf8'}),/Pages:\s+1\b/,'Recibo completo em uma página A4');
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`artifacts/fin02/detalhe-${width}.png`,fullPage:true});}
  }
  await popup.close();assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS FIN02 UI: emissão, falha recuperável, estado pendente, impressão, gestor leitura, layout 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
