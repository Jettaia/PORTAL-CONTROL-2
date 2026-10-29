import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPreviewApp} from '../scripts/preview-ui.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('prévia: navegação real sem registros e sem gravação',async()=>{
 const server=createPreviewApp().listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetch(base+'/api/pc01/usuarios',{method})).status,405);
  assert.deepEqual((await (await fetch(base+'/api/pc01/usuarios')).json()).usuarios,[]);
  assert.equal((await fetch(base+'/api/not-available')).status,503);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?page=contratacoes');
  await page.locator('#pc04Page form').first().waitFor({state:'visible'});
  await page.locator('#previewNotice').waitFor({state:'visible'});
  const screens=[['usuarios','#pc01Form'],['filiais','#b24Form'],['servicos','#b24Form'],['chapas','#pc03Panel form'],['contratacoes','#pc04Page form'],['pagamentos','#pc08Page form'],['ajustes','#pc10Page form'],['extratos','#pc11Page form']];
  for(const [name,selector] of screens){
   const button=page.locator(`#mainNav [data-page="${name}"]`);
   if(!await button.isVisible())await button.locator('xpath=ancestor::details[1]/summary').click();
   await button.click();
   await page.locator(selector).first().waitFor({state:'visible'});
   assert.equal(await page.locator(selector).first().isVisible(),true,name);
  }
  await page.goto(base+'/tablet.html');
  await page.locator('#pairCode').waitFor({state:'visible'});
  assert.equal(await page.locator('#pairCode').isVisible(),true);
  await page.getByRole('button',{name:'Ver teclado',exact:true}).click();
  assert.equal(await page.locator('#code').isVisible(),true);
  await page.getByRole('button',{name:'Ver autorização',exact:true}).click();
  assert.equal(await page.locator('#pairCode').isVisible(),true);
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
