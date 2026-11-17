import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';

test('Tablet: digitar ou colar nove números permite ativar sem token longo',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 for(const code of ['001234567','001-234-567']){
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let active=false,posted;
  await page.route('**/api/pc05/tablet/**',async route=>{if(route.request().url().endsWith('/habilitar')){posted=route.request().postDataJSON();active=true;}await route.fulfill({status:active?200:401,json:active?{ok:true}:{erro:'AUTORIZACAO_TABLET_INVALIDA'}});});
  await page.goto(`http://127.0.0.1:${server.address().port}/tablet-pc05.html`);await page.locator('#pairForm').waitFor({state:'visible'});await page.locator('#pairCode').fill(code);
  assert.equal(await page.locator('#pairCode').inputValue(),'001-234-567');assert.equal(await page.locator('#pairCode').getAttribute('inputmode'),'numeric');
  fs.mkdirSync('artifacts/tablet-pairing-code',{recursive:true});await page.screenshot({path:'artifacts/tablet-pairing-code/mobile.png'});
  await page.getByRole('button',{name:'Autorizar tablet',exact:true}).click();await page.locator('#operation').waitFor({state:'visible'});assert.deepEqual(posted,{pareamento:'001-234-567'});assert.equal(await page.locator('#pairCode').inputValue(),'');assert.deepEqual(errors,[]);await page.close();
 }
});
