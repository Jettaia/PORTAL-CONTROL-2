import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

test('FIN03 importação: conferir páginas, vínculo manual, seleção, cancelamento e baixa em lote',async()=>{
 const app=express();app.use(express.static('public'));
 app.get('/fixture',(_q,r)=>r.send('<!doctype html><html lang="pt-BR"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/fin01.css"><link rel="stylesheet" href="/pilot-tokens.css"><link rel="stylesheet" href="/pilot-design.css"><link rel="stylesheet" href="/fin03-import.css"><main id="dashboard"><section id="fin01Page" class="panel"></section></main><script src="/fin01.js"></script><script src="/fin03-import.js"></script></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(4000);
  const calls=[],errors=[];let permitted=true,expired=false;
  page.on('pageerror',e=>errors.push(e.message));
  const ready={contratacaoId:'10',numero:'100',reciboId:'90',deposito:'Depósito A',prestador:'José da Silva',valor:'175.25',estado:'PRONTO',baixaAnteriorId:null,origem:'QR'};
  await page.route('**/api/financeiro/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname,body=request.method()==='POST'?request.postDataJSON():null;calls.push({path,method:request.method(),body});
   if(path.endsWith('/catalogo'))return route.fulfill({json:{depositos:[{DepositoId:'1',Nome:'Depósito A'},{DepositoId:'2',Nome:'Depósito B'}],prestadores:[],podeOperar:permitted}});
   if(path.endsWith('/importacao/previa'))return route.fulfill({json:{previa:'test-token',paginas:[{pagina:1,...ready},{pagina:2,...ready},{pagina:3,estado:'NAO_IDENTIFICADO',origem:'OCR'}],expiraEm:'2026-11-10T00:00:00Z',limites:{}}});
   if(path.endsWith('/vincular'))return route.fulfill({json:{item:{...ready,paginas:[3],contratacaoId:'11',numero:'101',reciboId:'91',deposito:'Depósito B',prestador:'<img src=x onerror=alert(1)>',origem:'MANUAL'}}});
   if(path.endsWith('/confirmar'))return route.fulfill(expired?{status:409,json:{erro:'PREVIA_EXPIRADA'}}:{json:{pagos:1,falhas:1,resultados:[{contratacaoId:'10',paginas:[1,2],estado:'PAGO'},{contratacaoId:'11',paginas:[3],estado:'FALHA',erro:'RECIBO_ORIGEM_DIVERGENTE'}]}});
   if(path.includes('/paginas/'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jkP8AAAAASUVORK5CYII=','base64')});
   if(request.method()==='DELETE')return route.fulfill({json:{ok:true}});
   return route.fulfill({json:{registros:[],proximaPagina:null,podeOperar:permitted}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));
  const start=page.getByRole('button',{name:'Importar recibos assinados',exact:true});await start.waitFor({state:'visible'});
  const upload=async()=>{await start.click();await page.getByLabel('PDF com recibos assinados').setInputFiles({name:'assinados.pdf',mimeType:'application/pdf',buffer:Buffer.concat([Buffer.from('%PDF-1.4 synthetic'),Buffer.alloc(12*1024*1024,32)])});await page.getByRole('button',{name:'Analisar PDF',exact:true}).click();await page.getByRole('heading',{name:'Conferir recibos assinados',exact:true}).waitFor();};
  await upload();assert.equal(await page.locator('.fin03-import-select').count(),1);assert.equal(await page.locator('.fin03-import-select:checked').count(),0);assert.ok(await page.getByRole('button',{name:'Confirmar pagamentos selecionados',exact:true}).isDisabled());
  assert.match(await page.locator('#fin03Import').innerText(),/1, 2/);
  await page.getByRole('button',{name:'Descartar importação',exact:true}).click();assert.equal(calls.filter(c=>c.path.endsWith('/confirmar')).length,0);
  await upload();await page.getByLabel('Páginas do recibo').fill('3');await page.getByLabel('Número da contratação para vincular').fill('101');await page.getByLabel('Depósito da contratação para vincular').selectOption('2');await page.getByRole('button',{name:'Vincular páginas',exact:true}).click();
  await page.getByText('Vínculo atualizado. Confira as páginas antes de selecionar.',{exact:true}).waitFor();assert.deepEqual(calls.find(c=>c.path.endsWith('/vincular')).body,{previa:'test-token',paginas:[3],numero:'101',depositoId:'2'});
  await page.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await page.locator('#fin03Import img[src=x]').count(),0);
  await page.getByRole('button',{name:'Conferir páginas 1, 2',exact:true}).click();await page.locator('#fin03ImportViewer img').first().waitFor();
  assert.equal(await page.locator('#fin03ImportViewer img').count(),2);
  fs.mkdirSync('artifacts/fin03-import',{recursive:true});await page.locator('#fin03Import').screenshot({path:'artifacts/fin03-import/desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#fin03Import').screenshot({path:'artifacts/fin03-import/mobile.png'});
  await page.locator('.fin03-import-select').nth(0).check();await page.locator('.fin03-import-select').nth(1).check();
  await page.getByRole('button',{name:'Confirmar pagamentos selecionados',exact:true}).evaluate(b=>{b.click();b.click();});await page.getByText('1 pagamento confirmado; 1 falha.',{exact:true}).waitFor();
  assert.equal(calls.filter(c=>c.path.endsWith('/confirmar')).length,1);assert.deepEqual(calls.find(c=>c.path.endsWith('/confirmar')).body,{previa:'test-token',itens:[{paginas:[1,2],contratacaoId:'10',reciboId:'90',baixaAnteriorId:null},{paginas:[3],contratacaoId:'11',reciboId:'91',baixaAnteriorId:null}]});
  assert.equal(await page.locator('.fin03-import-select:checked').count(),0);
  await page.locator('.fin03-import-select').check();expired=true;await page.getByRole('button',{name:'Confirmar pagamentos selecionados',exact:true}).click();await page.getByText('A prévia expirou. Importe o PDF novamente.',{exact:true}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Confirmar pagamentos selecionados',exact:true}).isDisabled());
  await page.evaluate(()=>window.dispatchEvent(new Event('jetta:auth')));assert.equal(await page.locator('#fin03Import').innerText(),'');assert.equal(await start.isVisible(),false);
  permitted=false;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:fin01')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();assert.equal(await start.isVisible(),false);assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
