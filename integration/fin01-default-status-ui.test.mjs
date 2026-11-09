import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('FIN01: filtro inicial, seleção manual e reset consultam a situação exibida',async()=>{
 const app=express();app.use(express.static('public'));
 app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><link rel="stylesheet" href="/fin01.css"><section id="fin01Page"></section><script src="/fin01.js"></script></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browserServer,browser;
 try{
  browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
  const page=await browser.newPage();page.setDefaultTimeout(4000);const queries=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const rows=[{ContratacaoId:1,Numero:1,Prestador:'Prestador pendente',Deposito:'Depósito A',Tipo:'Carga',DataServico:'2026-11-09',ValorLiberado:'100.00',Situacao:'AGUARDANDO_PAGAMENTO'},{ContratacaoId:2,Numero:2,Prestador:'Prestador pago',Deposito:'Depósito A',Tipo:'Carga',DataServico:'2026-11-09',ValorLiberado:'200.00',Situacao:'PAGO',ReciboId:2}];
  await page.route('**/api/financeiro/**',async route=>{const url=new URL(route.request().url());assert.equal(route.request().method(),'GET');if(url.pathname.endsWith('/catalogo'))return route.fulfill({json:{depositos:[],prestadores:[]}});queries.push(url.searchParams.get('situacao'));const status=url.searchParams.get('situacao');await route.fulfill({json:{registros:rows.filter(r=>!status||r.Situacao===status),proximaPagina:null,podeOperar:true}});});
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
  await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  const status=page.getByRole('combobox',{name:'Situação',exact:true});
  assert.equal(await status.inputValue(),'AGUARDANDO_PAGAMENTO');assert.equal(queries.at(-1),'AGUARDANDO_PAGAMENTO');
  assert.equal(await page.locator('#fin01Rows tr[data-contract]').count(),1);assert.ok(await page.getByText('Prestador pendente',{exact:true}).isVisible());
  const submit=async value=>{await status.selectOption(value);const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/financeiro/contratacoes');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await response;await page.getByText('Consulta atualizada.',{exact:true}).waitFor();};
  await submit('');assert.equal(queries.at(-1),null);assert.equal(await page.locator('#fin01Rows tr[data-contract]').count(),2);
  await submit('PAGO');assert.equal(queries.at(-1),'PAGO');assert.ok(await page.getByText('Prestador pago',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByText('Prestador pendente',{exact:true}).waitFor();assert.equal(await status.inputValue(),'AGUARDANDO_PAGAMENTO');assert.equal(queries.at(-1),'AGUARDANDO_PAGAMENTO');
  await submit('RECIBO_GERADO');await page.getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{perfil:'FINANCEIRO'}})));assert.equal(await status.inputValue(),'AGUARDANDO_PAGAMENTO');
  await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Prestador pendente',{exact:true}).waitFor();assert.equal(queries.at(-1),'AGUARDANDO_PAGAMENTO');assert.deepEqual(errors,[]);
 }finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
