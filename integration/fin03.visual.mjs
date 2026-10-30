import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.static('public'));
app.get('/fin03-test',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FIN03 teste</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><section id="fin01Page" class="panel"></section><link rel="stylesheet" href="/fin01.css"></html>'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),origin=`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('artifacts/fin03',{recursive:true});
try{
 for(const perfil of ['FINANCEIRO','ADMIN','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);
  let paid=perfil==='GESTOR',attachment=1,lastPaidId=perfil==='GESTOR'?1:null,fail=false,writes=0,history=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const row=()=>({ContratacaoId:1,Numero:101,Prestador:'Maria Aparecida de Oliveira dos Santos e Silva',Deposito:'Santos',Tipo:'Carga e descarga',DataServico:'2026-10-29',ValorLiberado:'175.25',LiberadoEmUtc:'2026-10-30T11:00:00',LiberadoPor:'Ana Gestora',GestorResponsavel:'Ana',Cidade:'Santos',Estado:'SP',CentroCusto:'CC-01',ReciboId:1,DataEmissao:'2026-10-30',ReciboCompativel:1,Situacao:paid?'PAGO':'RECIBO_GERADO'});
  await page.context().route('**/api/financeiro/**',async route=>{
   const req=route.request(),url=new URL(req.url());let body,status=200;
   if(req.method()==='POST'){
    writes++;const posted=req.postDataJSON();assert.equal(req.headers()['x-jetta-request'],'web');
    if(fail){status=503;body={erro:'PAGAMENTO_INDISPONIVEL'};}
    else if(url.pathname.endsWith('/desfazer')){assert.equal(posted.motivo,'Confirmação indevida');assert.equal(posted.anexoId,attachment);paid=false;history.push({Acao:'FIN03_DESFAZER',AtorNome:'Ana Financeiro',CriadoEmUtc:'2026-11-02T15:00:00',Motivo:posted.motivo});}
    else {assert.equal(posted.arquivo.nome,'recibo.pdf');assert.equal(posted.arquivo.tipo,'application/pdf');assert.ok(posted.arquivo.conteudoBase64);if(url.pathname.endsWith('/anexo')){assert.equal(posted.anexoId,attachment);attachment++;}else{assert.equal(posted.reciboId,1);assert.equal(posted.baixaAnteriorId,lastPaidId);paid=true;lastPaidId=1;}history.push({Acao:url.pathname.endsWith('/anexo')?'FIN03_SUBSTITUIR':'FIN03_CONFIRMAR',AtorNome:'Ana Financeiro',CriadoEmUtc:'2026-11-02T14:00:00'});}
    body??={ok:true};
   }else if(url.pathname.endsWith('/catalogo'))body={depositos:[],prestadores:[]};
   else if(url.pathname.endsWith('/contratacoes'))body={registros:[row()],proximaPagina:null};
   else if(url.pathname.endsWith('/pagamento'))body={ultimaBaixaId:lastPaidId,pagamento:paid?{BaixaId:1,AnexoId:attachment,DataPagamento:'2026-10-30',ConfirmadoEmUtc:'2026-11-02T14:00:00',ConfirmadoPor:1,Valor:'175.25'}:null,anexos:paid?[...Array(attachment)].map((_,i)=>({AnexoId:i+1,Nome:'recibo.pdf',Tipo:'application/pdf',Tamanho:100,CriadoEmUtc:'2026-11-02T14:00:00'})):[],historico:history,podeOperar:perfil!=='GESTOR'};
   else body={registro:row(),podeOperar:perfil!=='GESTOR'};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/fin03-test');await page.addScriptTag({url:origin+'/fin01.js'});await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  await page.getByRole('button',{name:'Detalhes da contratação 101',exact:true}).click();
  const file={name:'recibo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nsynthetic receipt\n%%EOF')};
  if(perfil!=='GESTOR'){
   const upload=page.getByLabel('Recibo assinado', {exact:true});await upload.waitFor();
   const confirm=page.getByRole('button',{name:'Confirmar pagamento integral',exact:true});assert.equal(await confirm.isEnabled(),false);
   await upload.setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await confirm.click();await page.getByText('Selecione PDF, PNG ou JPEG de até 5 MiB.',{exact:true}).waitFor();assert.equal(writes,0);
   await upload.setInputFiles(file);fail=true;await confirm.click();await page.getByText('PAGAMENTO_INDISPONIVEL',{exact:true}).waitFor();assert.equal(await confirm.isEnabled(),true);
   fail=false;await confirm.click();await page.locator('#fin01Detail').getByText('Pago',{exact:true}).waitFor();
   await page.getByText('Data do pagamento: 30/10/2026',{exact:true}).waitFor();
   assert.ok(!(await page.locator('#fin01Detail').innerText()).includes('continua pendente'));
   await page.getByLabel('Novo recibo assinado',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Substituir anexo',exact:true}).click();
   await page.getByRole('link',{name:'Baixar recibo.pdf — versão 2',exact:true}).waitFor();
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('#fin01Detail .fin03-payment').screenshot({path:`artifacts/fin03/pago-${perfil}-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
   const undo=page.getByRole('button',{name:'Desfazer baixa',exact:true});assert.equal(await undo.isEnabled(),false);
   await page.getByLabel('Motivo do desfazimento',{exact:true}).fill('Confirmação indevida');await undo.click();await page.locator('#fin01Detail').getByText('Recibo gerado',{exact:true}).waitFor();
   await page.getByText(/Confirmação indevida/).waitFor();assert.equal(writes,4);
   await page.getByLabel('Recibo assinado',{exact:true}).setInputFiles(file);await page.getByRole('button',{name:'Confirmar pagamento integral',exact:true}).click();await page.locator('#fin01Detail').getByText('Pago',{exact:true}).waitFor();assert.equal(writes,5);
  }else{
   await page.getByRole('link',{name:'Baixar recibo.pdf — versão 1',exact:true}).waitFor();assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.getByRole('button',{name:'Desfazer baixa',exact:true}).count(),0);assert.equal(writes,0);
  }
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('#fin01Detail').screenshot({path:`artifacts/fin03/detalhe-${perfil}-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS FIN03 UI: baixa, falha recuperável, troca, desfazimento e gestor somente leitura; desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
