import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {renderReceipt} from '../src/fin02-document.js';

test('FIN02: RECIBO central e contratação no cabeçalho direito, em tela e impressão',async()=>{
 const browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});
 const browser=await chromium.connect(browserServer.wsEndpoint());
 try{
  const page=await browser.newPage({viewport:{width:1000,height:1250}});
  const html=renderReceipt({DataEmissao:'2026-11-09',Snapshot:{Numero:'4',ValorLiberado:'100.00',Deposito:'Floripa',CentroCusto:'CC-20',Rua:'Rua teste',NumeroEndereco:'10',Bairro:'Centro',Cidade:'Florianópolis',Estado:'SC',CEP:'13178574',Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61',Tipo:'Carregamento de caminhão',DataServico:'2026-11-10',Prestador:'Prestador sintético'}});
  await page.setContent(html);
  fs.mkdirSync('artifacts/fin02-header',{recursive:true});
  for(const media of ['screen','print']){
   await page.emulateMedia({media});
   assert.equal(await page.locator('h1').innerText(),'RECIBO');
   assert.equal(await page.title(),'Recibo');
   const title=await page.locator('h1').boundingBox(),depot=await page.locator('.cost').boundingBox(),number=await page.locator('.contract-number').boundingBox();
   assert.ok(number.y+number.height<=depot.y);assert.ok(depot.y+depot.height<=title.y);
   assert.ok(Math.abs(number.x+number.width-depot.x-depot.width)<1);
   assert.equal(await page.locator('h1').evaluate(e=>getComputedStyle(e).textAlign),'center');
   assert.equal(await page.locator('.contract-number').evaluate(e=>getComputedStyle(e).textAlign),'right');
   assert.equal(await page.locator('.contract-number').evaluate(e=>getComputedStyle(e).fontSize),await page.locator('.cost').evaluate(e=>getComputedStyle(e).fontSize));
   assert.equal(await page.locator('header .contract-number + .cost').count(),1);
   assert.ok((await page.locator('body').innerText()).includes('R$ 100,00'));
   assert.equal(await page.locator('.contract-number').innerText(),'Contratação 4');
   await page.screenshot({path:'artifacts/fin02-header/'+media+'.png',fullPage:true});
  }
 }finally{for(const context of browser.contexts())await context.close();await browserServer.kill();}
});
