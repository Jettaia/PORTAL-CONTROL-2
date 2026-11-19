import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('Coordenador emite recibo sem receber controles de correção financeira',async()=>{
 const app=express();app.use(express.static('public'));app.get('/fixture',(_q,res)=>res.send('<!doctype html><main id="dashboard"><section id="fin01Page"></section></main><script src="/fin01.js"></script>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(5000);let emitted=false,writes=0,paid=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const row=()=>({ContratacaoId:1,Numero:1,Prestador:'Prestador Teste',Deposito:'Depósito A',DataServico:'2026-11-01',ValorLiberado:'100.00',Situacao:paid?'PAGO':emitted?'RECIBO_GERADO':'AGUARDANDO_PAGAMENTO',ReciboId:emitted?1:null,ReciboCompativel:true});
  await page.route('**/api/financeiro/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;let body={registros:[],podeOperar:false,podeEmitirRecibo:true};
   if(path.endsWith('/catalogo'))body={...body,depositos:[],prestadores:[]};
   else if(path.endsWith('/recibo')&&req.method()==='POST'){emitted=true;writes++;body={podeOperar:false,podeEmitirRecibo:true,recibo:{ReciboId:1}};}
   else if(path.endsWith('/contratacoes/1'))body={registro:row(),podeOperar:false,podeEmitirRecibo:true};
   else if(path.endsWith('/pagamento')){if(req.method()==='POST'){assert.equal(req.postDataJSON().arquivo.nome,'assinado.pdf');paid=true;}body={pagamento:paid?{BaixaId:1,AnexoId:1,DataPagamento:'2026-11-01',Valor:'100.00'}:null,ultimaBaixaId:null,anexos:[],historico:[],podeOperar:false,podeConfirmarPagamento:true};}
   else if(path.endsWith('/contratacoes'))body={...body,registros:[row()]};
   await route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  await page.getByRole('button',{name:'Gerar recibos do período',exact:true}).waitFor();
  await page.getByRole('button',{name:'Gerar recibo da contratação 1',exact:true}).click();
  await page.getByRole('link',{name:'Abrir recibo para impressão',exact:true}).waitFor();assert.equal(writes,1);
  await page.locator('input[type=file]').setInputFiles({name:'assinado.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 assinado')});
  await page.getByRole('button',{name:'Confirmar pagamento integral',exact:true}).click();
  await page.getByText('Data do pagamento: 01/11/2026',{exact:true}).waitFor();assert.equal(paid,true);
  assert.equal(await page.getByRole('button',{name:'Desfazer baixa',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Substituir anexo',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
