import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

test('FIN02 lote: prévia integral, confirmação, falhas, impressão e isolamento de sessão',async()=>{
 const app=express();app.use(express.static('public'));app.get('/fixture',(_q,r)=>r.send('<!doctype html><html lang="pt-BR"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><link rel="stylesheet" href="/fin01.css"><link rel="stylesheet" href="/pilot-tokens.css"><link rel="stylesheet" href="/pilot-design.css"><main id="dashboard"><section id="fin01Page" class="panel"></section></main><script src="/fin01.js"></script></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browserServer,browser;
 try{
  browserServer=await chromium.launchServer({channel:'msedge',headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
  const page=await browser.newPage();page.setDefaultTimeout(4000);const calls=[],errors=[];let permitted=true,empty=false,attempt=0,stale=false,expired=false,forcePartial=false,holdPreview=false,releasePreview;
  const registros=Array.from({length:105},(_,i)=>({ContratacaoId:String(i+1),Numero:String(i+10),Prestador:i===0?'<img src=x onerror=alert(1)>':'Prestador '+i,Deposito:'A',DataServico:'2026-11-09',ValorLiberado:'1.00',Versao:1}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/financeiro/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;calls.push({path:url.pathname,query:Object.fromEntries(url.searchParams),body});
   if(url.pathname.endsWith('/catalogo'))return route.fulfill({json:{depositos:[{DepositoId:'7',Nome:'A'}],prestadores:[{PrestadorId:'8',Nome:'B'}],podeOperar:permitted}});
   if(url.pathname.endsWith('/previa')){if(holdPreview)await new Promise(r=>releasePreview=r);return route.fulfill({json:{registros:empty?[]:registros,quantidade:empty?0:105,total:empty?'0.00':'105.00',jaEmitidos:3,previa:'signed-token',expiraEmUtc:'2026-11-09T23:00:00Z'}}).catch(()=>{});}
   if(url.pathname.endsWith('/gerar')){if(expired)return route.fulfill({status:409,json:{erro:'PREVIA_EXPIRADA'}});if(forcePartial)return route.fulfill({json:{resultados:registros.map((r,i)=>({contratacaoId:r.ContratacaoId,numero:r.Numero,estado:i===104?'FALHA':'JA_EMITIDO',...(i===104?{erro:'Falha temporária'}:{})})),gerados:0,ignorados:104,falhas:1}});if(stale)return route.fulfill({json:{resultados:registros.map(r=>({contratacaoId:r.ContratacaoId,numero:r.Numero,estado:'FALHA',erro:'PREVIA_ALTERADA'})),gerados:0,ignorados:0,falhas:105}});attempt++;return route.fulfill({json:{resultados:registros.map((r,i)=>({contratacaoId:r.ContratacaoId,numero:r.Numero,estado:i===104&&attempt===1?'FALHA':attempt===1?'GERADO':i===104?'GERADO':'JA_EMITIDO',...(i===104&&attempt===1?{erro:'Falha temporária'}:{})})),gerados:attempt===1?104:1,ignorados:attempt===1?0:104,falhas:attempt===1?1:0}});}
   if(url.pathname.endsWith('/impressao'))return route.fulfill({contentType:'text/html',body:'<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><h1>105 recibos conjuntos</h1>'});
   return route.fulfill({json:{registros:registros.slice(0,100),proximaPagina:'cursor',podeOperar:permitted}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);const start=async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();};await start();
  const batch=page.getByRole('button',{name:'Gerar recibos do período',exact:true}),confirm=page.getByRole('button',{name:'Confirmar geração',exact:true});
  await batch.click();await page.getByText('Informe o início e o fim do período.',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.path.endsWith('/previa')).length,0);
  await page.locator('[name=inicio]').fill('2026-11-10');await page.locator('[name=fim]').fill('2026-11-09');await batch.click();await page.getByText('O fim do período deve ser igual ou posterior ao início.',{exact:true}).waitFor();
  await page.locator('[name=inicio]').fill('2026-11-01');await page.locator('[name=depositoId]').selectOption('7');await page.locator('[name=prestadorId]').selectOption('8');await page.locator('[name=numero]').fill('9');await page.locator('[name=situacao]').selectOption('PAGO');
  empty=true;await batch.click();await page.getByText('Nenhuma contratação liberada sem recibo neste período.',{exact:true}).waitFor();assert.equal(await confirm.count(),0);empty=false;
  await batch.click();await confirm.waitFor();assert.match(await page.locator('#fin02Batch').innerText(),/105 contratações/);assert.equal(await page.locator('#fin02Batch tbody tr').count(),105);assert.equal(await page.locator('#fin02Batch img').count(),0);
  fs.mkdirSync('artifacts/fin02-batch',{recursive:true});await page.locator('#fin02Batch').screenshot({path:'artifacts/fin02-batch/previa-desktop.png'});
  assert.deepEqual(calls.filter(c=>c.path.endsWith('/previa')).at(-1).query,{inicio:'2026-11-01',fim:'2026-11-09',depositoId:'7',prestadorId:'8',numero:'9'});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(calls.filter(c=>c.path.endsWith('/gerar')).length,0);
  await batch.click();await confirm.waitFor();await page.locator('[name=numero]').fill('10');assert.equal(await confirm.count(),0);
  stale=true;await batch.click();await confirm.click();await page.getByText('A prévia foi alterada. Gere uma nova prévia do período antes de confirmar.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tentar novamente pendentes',exact:true}).count(),0);stale=false;
  await batch.click();await confirm.waitFor();await confirm.evaluate(button=>{button.click();button.click();});await page.getByText('Falha temporária',{exact:true}).waitFor();assert.equal(await page.locator('#fin02Batch tbody tr').count(),105);
  assert.equal(calls.filter(c=>c.path.endsWith('/gerar')).length,2);
  const firstPopupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir recibos gerados',exact:true}).click();const firstPopup=await firstPopupPromise;await firstPopup.getByRole('heading',{name:'105 recibos conjuntos'}).waitFor();assert.deepEqual(calls.filter(c=>c.path.endsWith('/impressao')).at(-1).body,{contratacaoIds:registros.slice(0,104).map(r=>r.ContratacaoId)});await firstPopup.close();
  await page.getByRole('button',{name:'Tentar novamente pendentes',exact:true}).click();await page.getByText('1 gerados; 104 já emitidos; 0 falhas.',{exact:true}).waitFor();assert.deepEqual(calls.filter(c=>c.path.endsWith('/gerar')).map(c=>c.body),[{previa:'signed-token'},{previa:'signed-token'},{previa:'signed-token'}]);
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir recibos gerados',exact:true}).click();const popup=await popupPromise;await popup.getByRole('heading',{name:'105 recibos conjuntos'}).waitFor();assert.deepEqual(calls.filter(c=>c.path.endsWith('/impressao')).at(-1).body,{contratacaoIds:registros.map(r=>r.ContratacaoId)});await popup.close();
  forcePartial=true;await batch.click();await confirm.click();await page.getByText('Falha temporária',{exact:true}).waitFor();expired=true;await page.getByRole('button',{name:'Tentar novamente pendentes',exact:true}).click();await page.getByText('A prévia expirou. Gere uma nova prévia do período.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Tentar novamente pendentes',exact:true}).count(),0);assert.ok(await page.getByRole('button',{name:'Imprimir recibos gerados',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Gerar nova prévia',exact:true}).isVisible());expired=false;forcePartial=false;
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#fin02Batch').screenshot({path:'artifacts/fin02-batch/resultado-mobile.png'});
  holdPreview=true;const heldRequest=page.waitForRequest(r=>r.url().includes('/recibos/previa'));await batch.click();await heldRequest;
  await page.evaluate(()=>window.dispatchEvent(new Event('jetta:auth')));releasePreview?.();await page.waitForTimeout(100);assert.equal(await page.locator('#fin02Batch').innerText(),'');assert.equal(await batch.isVisible(),false);
  permitted=false;holdPreview=false;await start();assert.equal(await batch.isVisible(),false);assert.deepEqual(errors,[]);
 }finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
