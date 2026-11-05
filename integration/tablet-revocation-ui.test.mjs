import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createApp} from '../src/server.js';

test('tablet: sem autorrevogação, token funciona e revogação remota retorna à ativação',async t=>{
 const server=createApp({token:'a'.repeat(64),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined);
 const browser=await chromium.launch({channel,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:768,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();let authorized=false;
 await page.route('**/api/pc05/tablet/*',async route=>{
  const action=new URL(route.request().url()).pathname.split('/').pop();
  if(action==='habilitar'){assert.deepEqual(route.request().postDataJSON(),{pareamento:'a'.repeat(64)});authorized=true;}
  else if(action==='apontar')assert.deepEqual(route.request().postDataJSON(),{codigo:'01234567'});
  else assert.equal(action,'status','nenhuma chamada de encerramento');
  await route.fulfill({status:authorized?200:401,json:authorized?{ok:true}:{erro:'AUTORIZACAO_TABLET_INVALIDA'}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/tablet.html`);
 await page.locator('#pairForm').waitFor({state:'visible'});
 await page.locator('#pairCode').fill('a'.repeat(64));await page.getByRole('button',{name:'Autorizar tablet',exact:true}).click();
 await page.locator('#operation').waitFor({state:'visible'});
 assert.equal(await page.getByRole('button',{name:'Encerrar uso deste tablet',exact:true}).count(),0);
 await page.locator('#code').fill('0a12-34');assert.equal(await page.locator('#code').inputValue(),'01234');
 await page.getByRole('button',{name:'Limpar',exact:true}).click();
 for(const digit of '012345678')await page.getByRole('button',{name:digit,exact:true}).click();
 assert.equal(await page.locator('#code').inputValue(),'01234567');
 assert.equal(await page.locator('#code').evaluate(e=>e.type),'text','token deve mostrar os dígitos');
 assert.equal(await page.locator('#code').evaluate(e=>getComputedStyle(e).webkitTextSecurity),'none');
 fs.mkdirSync('artifacts/tablet-revocation',{recursive:true});await page.screenshot({path:'artifacts/tablet-revocation/token-visible.png',fullPage:true});
 await page.getByRole('button',{name:'Confirmar token',exact:true}).click();
 await page.getByText('Token aceito',{exact:true}).waitFor();assert.equal(await page.locator('#code').inputValue(),'');
 fs.mkdirSync('artifacts/tablet-revocation',{recursive:true});await page.screenshot({path:'artifacts/tablet-revocation/tablet.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 authorized=false;await page.clock.fastForward(10001);await page.locator('#pairForm').waitFor({state:'visible'});
 assert.equal(await page.locator('#operation').isVisible(),false);assert.deepEqual(errors,[]);
});
