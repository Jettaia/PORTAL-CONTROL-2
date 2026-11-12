import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createPreviewApp} from '../scripts/preview-ui.mjs';

test('saída no rodapé compartilhado: navegação, scroll, menu recolhido, celular e logout',async()=>{
 const server=createPreviewApp().listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?page=contratacoes`);
  await page.locator('#pc04Page .pc04-filters').first().waitFor({state:'visible'});
  assert.equal(await page.locator('#sidebar #logout').count(),1,'saída deve pertencer à barra lateral');
  const checkPosition=async()=>{
   const side=await page.locator('#sidebar').boundingBox(),button=await page.locator('#logout').boundingBox();
   assert.ok(button&&button.x>=side.x&&button.x+button.width<=side.x+side.width);
   assert.ok(button.y>=side.y&&button.y+button.height<=side.y+side.height);
   assert.ok(side.y+side.height-button.y-button.height<110,'saída deve ficar junto à base');
  };
  for(const name of ['usuarios','depositos','servicos','chapas','contratacoes','pagamentos','extratoprestador']){
   const link=page.locator(`#mainNav [data-page="${name}"]`);
   if(!await link.isVisible())await link.locator('xpath=ancestor::details[1]/summary').click();
   await link.click();await checkPosition();
  }
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await checkPosition();
  fs.mkdirSync('artifacts/sidebar-logout/round-1',{recursive:true});
  await page.screenshot({path:'artifacts/sidebar-logout/round-1/desktop.png'});
  await page.setViewportSize({width:1024,height:600});
  await page.locator('#mainNav details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  await page.locator('#mainNav').evaluate(n=>n.scrollTop=n.scrollHeight);await checkPosition();
  await page.locator('#toggleSide').click();await checkPosition();
  assert.equal(await page.getByRole('button',{name:'Encerrar sessão',exact:true}).isVisible(),true);
  await page.locator('#toggleSide').click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#logout').isVisible(),false);
  await page.locator('#toggleSide').click();
  assert.equal(await page.locator('#logout').isVisible(),true);await checkPosition();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/sidebar-logout/round-1/mobile.png',fullPage:true});
  let logoutCalls=0;
  await page.route('**/api/auth/logout',async route=>{
   assert.equal(route.request().method(),'POST');
   assert.equal(route.request().headers()['x-jetta-request'],'web');
   logoutCalls++;await route.fulfill({json:{ok:true}});
  });
  await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});
  assert.equal(logoutCalls,1);assert.equal(await page.locator('#logout').isVisible(),false);
  assert.equal(await page.locator('#mainNav').isVisible(),false);assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
