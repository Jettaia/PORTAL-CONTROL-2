import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('FIN01 exportação: filtros aplicados, todas as páginas e sessão segura',async()=>{
 const app=express();app.use(express.static('public'));app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><link rel="stylesheet" href="/fin01.css"><link rel="stylesheet" href="/pilot-tokens.css"><link rel="stylesheet" href="/pilot-design.css"><main id="dashboard"><section id="fin01Page" class="panel"></section></main><script src="/fin01.js"></script></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser,browserServer;
 try{
  browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1100}});page.setDefaultTimeout(5000);
  const exports=[],lists=[],downloads=[],errors=[];let mode='ok',release,responded;
  const row={ContratacaoId:23,Numero:23,Prestador:'Ana',Deposito:'Depósito sintético',Tipo:'Carga',DataServico:'2026-11-09',ValorLiberado:'100.00',LiberadoEmUtc:'2026-11-09T13:00:00',Situacao:'AGUARDANDO_PAGAMENTO'};
  page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));
  await page.route('**/api/financeiro/**',async route=>{const url=new URL(route.request().url()),p=url.pathname;
   if(/\/exportar\.(xlsx|pdf)$/.test(p)){exports.push(url);const format=p.endsWith('.pdf')?'pdf':'xlsx',current=mode;
    if(current==='hold')await new Promise(r=>release=r);
    if(current==='error')return route.fulfill({status:503,json:{erro:'EXPORTACAO_PDF_OCUPADA'}});
    if(current==='limit')return route.fulfill({status:413,json:{erro:'EXPORTACAO_MUITOS_REGISTROS'}});
    if(current==='invalid')return route.fulfill({contentType:'text/html',body:'login'});
    await route.fulfill({headers:{'content-type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="financeiro-teste.'+format+'"'},body:Buffer.from(format==='pdf'?'%PDF-1.4\nfixture':'PKfixture')}).catch(()=>{});responded?.();return;
   }
   if(p.endsWith('/catalogo'))return route.fulfill({json:{depositos:[{DepositoId:7,Nome:'Depósito sintético'}],prestadores:[{PrestadorId:8,Nome:'Ana'}],podeOperar:true}});
   lists.push(url);await route.fulfill({json:{registros:[row],proximaPagina:url.searchParams.has('cursor')?null:'opaque-cursor',podeOperar:true}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  const start=async()=>{await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();};await start();
  const menu=page.locator('.fin01-export'),excel=page.getByRole('button',{name:'Exportar em Excel',exact:true}),pdf=page.getByRole('button',{name:'Exportar em PDF',exact:true});await menu.waitFor();
  const expected={numero:'23',depositoId:'7',prestadorId:'8',inicio:'2026-11-01',fim:'2026-11-09',situacao:'PAGO'};
  for(const [key,value]of Object.entries(expected))await page.locator('[name='+key+']').evaluate((e,v)=>{e.value=v;},value);
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click();await page.getByRole('button',{name:'Carregar mais',exact:true}).waitFor({state:'hidden'});assert.equal(lists.at(-1).searchParams.get('cursor'),'opaque-cursor');
  const click=async button=>{if(await menu.getAttribute('open')===null)await menu.locator('summary').click();await button.click();};
  const d=page.waitForEvent('download');await click(excel);assert.equal((await d).suggestedFilename(),'financeiro-teste.xlsx');await page.getByText('Arquivo Excel exportado.',{exact:true}).waitFor();assert.deepEqual(Object.fromEntries(exports.at(-1).searchParams),expected);
  const p=page.waitForEvent('download');await click(pdf);assert.equal((await p).suggestedFilename(),'financeiro-teste.pdf');await page.getByText('Arquivo PDF exportado.',{exact:true}).waitFor();assert.equal(exports.at(-1).searchParams.has('cursor'),false);
  mode='error';await click(pdf);await page.getByText('Já existe uma exportação PDF em andamento. Tente novamente em instantes.',{exact:true}).waitFor();
  mode='limit';await click(excel);await page.getByText('Há muitos registros para exportar. Use filtros mais específicos e tente novamente.',{exact:true}).waitFor();
  mode='invalid';await click(excel);await page.getByText('O servidor não retornou um arquivo Excel válido.',{exact:true}).waitFor();assert.equal(downloads.length,2);
  await page.locator('[name=numero]').fill('24');await click(excel);await page.getByText('Aplique os filtros alterados antes de exportar.',{exact:true}).waitFor();assert.equal(exports.length,5);
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  if(await menu.getAttribute('open')===null)await menu.locator('summary').click();fs.mkdirSync('artifacts/fin01-export',{recursive:true});await page.locator('#fin01Page').screenshot({path:'artifacts/fin01-export/desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#fin01Page').screenshot({path:'artifacts/fin01-export/mobile.png'});const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);assert.equal(await excel.isVisible(),true);
  mode='hold';const count=exports.length;await excel.evaluate(e=>{e.click();e.click();});await page.waitForFunction(()=>document.querySelector('.fin01-export button').disabled);assert.equal(exports.length,count+1);
  await page.evaluate(()=>{document.querySelector('#fin01Page').hidden=true;});await page.waitForTimeout(30);await page.evaluate(()=>document.querySelector('#fin01Page').hidden=false);const sent=new Promise(r=>responded=r);release();await sent;await page.waitForTimeout(100);assert.equal(downloads.length,2);
  await start();await click(excel);await page.waitForFunction(()=>document.querySelector('.fin01-export button').disabled);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:auth')));await page.evaluate(()=>document.querySelector('#fin01Message').textContent='Nova sessão');const loggedOut=new Promise(r=>responded=r);release();await loggedOut;await page.waitForTimeout(100);assert.equal(downloads.length,2);assert.equal(await page.locator('#fin01Message').textContent(),'Nova sessão');assert.deepEqual(errors,[]);
 }finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
