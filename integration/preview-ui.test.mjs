import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createPreviewApp} from '../scripts/preview-ui.mjs';

test('prévia: navegação real sem registros e sem gravação',async()=>{
 const server=createPreviewApp().listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  for(const method of ['POST','PUT','PATCH','DELETE'])for(const endpoint of ['/api/pc01/usuarios','/api/notificacoes/1-SOLICITACAO/lida'])assert.equal((await fetch(base+endpoint,{method})).status,405);
  assert.deepEqual(await (await fetch(base+'/api/notificacoes')).json(),{registros:[],naoLidas:0,proximaPagina:null});
  assert.deepEqual((await (await fetch(base+'/api/pc01/usuarios')).json()).usuarios,[]);
  assert.equal((await fetch(base+'/api/not-available')).status,503);
  assert.deepEqual((await (await fetch(base+'/api/pc04/catalogo')).json()).depositos,[]);
  const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined);
  browser=await chromium.launch({channel,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],apiFailures=[],writes=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&r.status()>=400)apiFailures.push(`${r.status()} ${new URL(r.url()).pathname}`);});
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+new URL(r.url()).pathname);});
  await page.goto(base+'/?page=contratacoes');
  await page.locator('#pc04Page .pc04-filters').first().waitFor({state:'visible'});
  await page.locator('#previewNotice').waitFor({state:'visible'});
  const screens=[['usuarios','#pc01New','#pc01Msg','Nenhuma conta encontrada.'],['depositos','#b24cDepNew','#b24cDepTable .depot-empty','Nenhum depósito encontrado.'],['servicos','#activityForm','#activityHeading','Nova atividade'],['chapas','#pc03New','#pc03Message','Nenhum prestador encontrado.'],['contratacoes','#pc04Page .pc04-filters','#pc04Message',''],['pagamentos','#fin01Filters','#fin01Message','Consulta atualizada.'],['extratoprestador','#fin05Filters','#fin05Message','Extrato atualizado.']];
  for(const [name,selector,status,message] of screens){
   const button=page.locator(`#mainNav [data-page="${name}"]`);
   if(!await button.isVisible())await button.locator('xpath=ancestor::details[1]/summary').click();
   await button.click();
   await page.locator(selector).first().waitFor({state:'visible'});
   assert.equal(await page.locator(selector).first().isVisible(),true,name);
   try{await page.waitForFunction(([selector,text])=>document.querySelector(selector)?.textContent===text,[status,message]);}
   catch(error){throw Error(`${name}: status=${await page.locator(status).allTextContents()}; pageErrors=${JSON.stringify(errors)}; apiFailures=${JSON.stringify(apiFailures)}`,{cause:error});}
  }
  assert.equal(await page.locator('#mainNav [data-page="filiais"],#mainNav [data-page="ajustes"],#mainNav [data-page="extratos"]').count(),0);
  await page.locator('#fin05Filters').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>document.querySelector('#previewFeedback').textContent.includes('nenhum dado foi enviado'));
  await page.goto(base+'/tablet.html');
  await page.locator('#pairCode').waitFor({state:'visible'});
  assert.equal(await page.locator('#pairCode').isVisible(),true);
  await page.getByRole('button',{name:'Ver teclado',exact:true}).click();
  assert.equal(await page.locator('#code').isVisible(),true);
  await page.getByRole('button',{name:'Ver autorização',exact:true}).click();
  assert.equal(await page.locator('#pairCode').isVisible(),true);
  assert.deepEqual(errors,[]);
  assert.deepEqual(apiFailures,[]);assert.deepEqual(writes,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
