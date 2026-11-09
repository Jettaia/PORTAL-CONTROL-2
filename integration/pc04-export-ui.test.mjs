import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('PC04 exportação: filtros aplicados, todas as páginas e sessão segura',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser,browserServer;
 try{
  browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}}),page=await context.newPage();page.setDefaultTimeout(8000);
  const exports=[],lists=[],downloads=[],errors=[];let mode='ok',release,responded;
  const row={ContratacaoId:23,Numero:23,DepositoId:1,TipoServicoId:1,Prestador:'Ana',Deposito:'Depósito sintético',Tipo:'Descarga',DataServico:'2026-11-09',InicioPrevisto:'2026-11-09T08:00',FimPrevisto:'2026-11-09T18:00',Valor:'100.00',Status:'ABERTA',Versao:1};
  page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname.replace(/^\/chapa/,'');let body={};
   if(/\/exportar\.(xlsx|pdf)$/.test(p)){
    exports.push({url,headers:req.headers()});const format=p.endsWith('.pdf')?'pdf':'xlsx',current=mode;
    if(current==='hold'){await new Promise(r=>release=r);}
    if(current==='error'){await route.fulfill({status:503,json:{erro:'EXPORTACAO_PDF_OCUPADA'}});return;}
    if(current==='limit'){await route.fulfill({status:413,json:{erro:'EXPORTACAO_MUITOS_REGISTROS'}});return;}
    if(current==='invalid'){await route.fulfill({status:200,contentType:'text/html',body:'login'});return;}
    await route.fulfill({status:200,headers:{'content-type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="contratacoes-teste.${format}"`},body:Buffer.from(format==='pdf'?'%PDF-1.4\nfixture':'PK\u0003\u0004fixture')});responded?.();return;
   }
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'ADM sintético',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc04:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true};
   else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
   else if(p==='/api/pc04/catalogo')body={depositos:[{DepositoId:1,Nome:'Depósito sintético'}],tipos:[],prestadores:[],gestores:[],podeOperar:true};
   else if(p==='/api/pc05/status')body={pc05:true};
   else if(p==='/api/pc04/contratacoes'){lists.push(url);body={registros:[row],proximaPagina:url.searchParams.has('antes')?null:'50'};}
   else if(p==='/api/pc04/contratacoes/23')body={registro:row,eventos:[],podeOperar:true,pc05:true};
   else if(p==='/api/pc05/contratacoes/23/tokens')body={codigo:'01234567',versao:1,expiraEmUtc:new Date(Date.now()+3600000).toISOString()};
   await route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
  await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
  const menu=page.locator('.pc04-export'),excel=page.getByRole('button',{name:'Exportar em Excel',exact:true}),pdf=page.getByRole('button',{name:'Exportar em PDF',exact:true});
  await menu.waitFor();
  assert.equal(await page.locator('.pc04-date-range label').first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
  const expected={numero:'23',prestador:'Ana',depositoId:'1',centroCusto:'CC1',gestor:'Maria',inicio:'2026-11-01',fim:'2026-11-09',valor:'100,00',situacao:'ABERTA'};
  // Set one draft transaction, then apply through the real toolbar.
  await page.evaluate(values=>{for(const [key,value]of Object.entries(values)){const input=document.querySelector('[data-pc04-filter="'+key+'"]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}},expected);
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Página atualizada.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-pc04-filter=dataServico]').count(),0);
  const listCount=lists.length;
  await page.evaluate(()=>{const input=document.querySelector('[data-pc04-filter=inicio]');input.value='2026-11-10';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('A data final do filtro deve ser igual ou posterior à data inicial.',{exact:true}).waitFor();assert.equal(lists.length,listCount);assert.equal(await page.locator('[data-pc04-filter=inicio]').inputValue(),'2026-11-10');
  await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByText('Página atualizada.',{exact:true}).waitFor();assert.equal(await page.locator('[data-pc04-filter=inicio]').inputValue(),'');assert.equal(await page.locator('[data-pc04-filter=fim]').inputValue(),'');assert.equal(lists.at(-1).search,'');
  await page.evaluate(values=>{for(const [key,value]of Object.entries(values)){const input=document.querySelector('[data-pc04-filter="'+key+'"]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}},expected);await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Página atualizada.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Próxima página',exact:true}).click();await page.getByRole('button',{name:'Primeira página',exact:true}).waitFor();
  assert.equal(lists.at(-1).searchParams.get('antes'),'50');
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();await page.getByLabel('Token gerado',{exact:true}).waitFor();
  await menu.locator('summary').click();const download=page.waitForEvent('download');await excel.click();assert.equal((await download).suggestedFilename(),'contratacoes-teste.xlsx');
  assert.deepEqual(Object.fromEntries(exports.at(-1).url.searchParams),expected);assert.equal(exports.at(-1).url.searchParams.has('antes'),false);
  await page.getByText('Arquivo Excel exportado.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Token gerado',{exact:true}).inputValue(),'01234567');
  if(!await menu.getAttribute('open'))await menu.locator('summary').click();const pdfDownload=page.waitForEvent('download');await pdf.click();assert.equal((await pdfDownload).suggestedFilename(),'contratacoes-teste.pdf');
  await page.getByText('Arquivo PDF exportado.',{exact:true}).waitFor();
  mode='error';await menu.locator('summary').click();await pdf.click();await page.getByText('Já existe uma exportação PDF em andamento. Tente novamente em instantes.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-pc04-filter=prestador]').inputValue(),'Ana');assert.deepEqual(Object.fromEntries(exports.at(-1).url.searchParams),expected);
  mode='limit';await menu.locator('summary').click();await pdf.click();await page.getByText('Há muitos registros para exportar. Use filtros mais específicos e tente novamente.',{exact:true}).waitFor();assert.equal(downloads.length,2);
  mode='invalid';await menu.locator('summary').click();await excel.click();await page.getByText('O servidor não retornou um arquivo Excel válido.',{exact:true}).waitFor();assert.equal(downloads.length,2);
  // A draft differs from applied filters: the UI must explicitly require applying it.
  await page.evaluate(()=>{const el=document.querySelector('[data-pc04-filter=prestador]');el.value='Outro';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await menu.locator('summary').click();await excel.click();await page.getByText('Aplique os filtros alterados antes de exportar.',{exact:true}).waitFor();assert.equal(exports.length,5);
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Página atualizada.',{exact:true}).waitFor();
  fs.mkdirSync('artifacts/pc04-export',{recursive:true});await menu.locator('summary').click();await page.locator('#pc04Panel').screenshot({path:'artifacts/pc04-export/desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#pc04Panel').screenshot({path:'artifacts/pc04-export/mobile.png'});
  assert.equal(await excel.isVisible(),true);const box=await menu.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  // Lock is synchronous, including programmatic repeated clicks; logout discards the pending binary.
  mode='hold';const count=exports.length;await excel.evaluate(el=>{el.click();el.click();});await page.waitForFunction(()=>document.querySelector('.pc04-export button').disabled);assert.equal(exports.length,count+1);
  await page.evaluate(()=>document.querySelector('#pc04Page').hidden=true);
  const hiddenResponse=new Promise(r=>responded=r);release();await hiddenResponse;await page.waitForTimeout(200);assert.equal(downloads.length,2);
  await page.evaluate(()=>{document.querySelector('#pc04Page').hidden=false;window.dispatchEvent(new Event('jetta:pc04'));});await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  await menu.locator('summary').click();await excel.click();await page.waitForFunction(()=>document.querySelector('.pc04-export button').disabled);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));
  await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  await page.evaluate(()=>document.querySelector('#pc04Message').textContent='Nova sessão');
  const sent=new Promise(r=>responded=r);release();await sent;await page.waitForTimeout(200);
  assert.equal(downloads.length,2);assert.equal(await page.locator('#pc04Message').textContent(),'Nova sessão');assert.deepEqual(errors,[]);
 }finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
