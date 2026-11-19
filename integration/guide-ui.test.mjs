import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('guia A com capturas B: navegação, ampliação, impressão e logout',async()=>{
 const app=express();app.use(express.static('public'));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:1000}});page.setDefaultTimeout(3500);
  const errors=[],writes=[];let logged=true,role='ADMIN',printed=null;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   let body={registros:[],depositos:[],prestadores:[],usuarios:[],solicitacoes:[],perfis:[],vinculos:[],podeEditar:false};
   if(pathname==='/api/auth/me'){
    if(!logged)return route.fulfill({status:401,json:{erro:'SEM_SESSAO'}});
    body={usuario:{id:1,nome:'Usuário de treinamento',perfil:role,funcoes:[role],pc01:true,pc03:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
   }else if(pathname==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
   else if(pathname==='/api/conta')body={pc01:true,pc03:true,pc04:true,pc05:true,fin01:true};
   else if(pathname==='/api/auth/logout'){logged=false;body={ok:true};}
   else if(pathname==='/api/pc05/status')body={pc05:true};
   else if(pathname==='/api/pc04/catalogo')body={depositos:[],tipos:[],gestores:[],prestadores:[],podeOperar:false};
   if(request.method()!=='GET')writes.push(pathname);
   return route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#dashboard').waitFor({state:'visible'});
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.shell').evaluate(element=>getComputedStyle(element).display==='none'),false,'Impressão normal do portal deve continuar disponível');
  await page.emulateMedia({media:'screen'});
  await page.locator('#mainNav summary').filter({hasText:'Ajuda'}).click();
  await page.locator('#mainNav [data-page=guia]').click();
  await page.locator('#guidePage').waitFor({state:'visible'});
  assert.equal(await page.locator('#pageHeading').innerText(),'Guia do Portal');
  assert.equal(await page.locator('#guidePage .guide-index [data-topic]').count(),6);
  assert.equal(await page.locator('.guide-switcher').count(),0);
  for(const topic of ['depositos','prestadores','atividades','tablets','contratacoes','financeiro']){
   await page.locator(`#guidePage .guide-index [data-topic=${topic}]`).click();
   const steps=await page.locator('#guidePage .guide-steps li').count();
   assert.ok(steps>=4);
   assert.equal(await page.locator('#guidePage .guide-shot img').count(),steps,'Cada passo deve ter a captura correspondente');
   assert.equal(await page.locator('#guidePage .guide-shot img').evaluateAll(async images=>{images.forEach(image=>image.loading='eager');await Promise.all(images.map(image=>image.decode()));return images.every(image=>image.naturalWidth>0&&image.alt.length>0);}),true);
   assert.ok(page.url().endsWith('#guia/'+topic));
  }
  const firstImage=page.getByRole('button',{name:'Ampliar captura do passo 1',exact:true});
  await firstImage.click();
  const imageDialog=page.getByRole('dialog',{name:'Captura ampliada do portal',exact:true});
  await imageDialog.waitFor({state:'visible'});
  await page.getByRole('button',{name:'Ampliar detalhes',exact:true}).click();
  assert.equal(await imageDialog.locator('img').evaluate(image=>image.clientWidth===image.naturalWidth),true);
  await page.keyboard.press('Escape');
  assert.equal(await firstImage.evaluate(element=>element===document.activeElement),true);
  await page.locator('#guidePage details').first().locator('summary').click();
  assert.equal(await page.locator('#guidePage details').first().getAttribute('open'),'');
  await page.getByRole('button',{name:'Marcar como lido',exact:true}).click();
  assert.equal(await page.locator('[data-done]').evaluate(element=>element===document.activeElement),true);
  assert.match(await page.locator('.guide-progress').innerText(),/1 de 6/);
  await page.evaluate(()=>{window.guidePrintCalls=0;window.print=()=>{window.guidePrintCalls++;window.guidePrinted={text:document.getElementById('guidePrintContent').innerText,open:[...document.querySelectorAll('#guidePrintContent details')].every(d=>d.open),shellHidden:getComputedStyle(document.querySelector('.shell')).display==='none',images:document.querySelectorAll('#guidePrintContent img').length,imagesReady:[...document.querySelectorAll('#guidePrintContent img')].every(image=>image.complete&&image.naturalWidth>0)};};});
  await page.emulateMedia({media:'print'});
  await page.getByRole('button',{name:'Imprimir tutorial',exact:true}).click();
  await page.waitForFunction(()=>window.guidePrintCalls===1);
  printed=await page.evaluate(()=>window.guidePrinted);assert.match(printed.text,/recibo assinado/i);assert.equal(printed.open,true);assert.equal(printed.shellHidden,true);
  assert.equal(printed.images,5);assert.equal(printed.imagesReady,true);
  assert.equal(await page.locator('#guidePrintContent').count(),0);
  assert.equal(await page.locator('.shell').evaluate(element=>getComputedStyle(element).display==='none'),false);
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Voltar à visão geral',exact:true}).click();
  await page.getByRole('button',{name:'Imprimir guia',exact:true}).click();
  await page.waitForFunction(()=>window.guidePrintCalls===2);
  assert.match((await page.evaluate(()=>window.guidePrinted)).text,/Cadastrar e ativar tablet/);
  assert.equal((await page.evaluate(()=>window.guidePrinted)).images,28);
  for(const [screen,topic]of [['depositos','depositos'],['chapas','prestadores'],['servicos','atividades'],['tablets','tablets'],['contratacoes','contratacoes'],['pagamentos','financeiro']]){
   await page.evaluate(screen=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:screen})),screen);
   await page.getByRole('button',{name:'Como usar esta tela',exact:true}).click();
   assert.ok(page.url().endsWith('#guia/'+topic));
   await page.locator('#guideArticleTitle').waitFor();
  }
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'inicio'})));
  assert.equal(await page.locator('#guidePage').isVisible(),false);
  assert.equal(await page.locator('#guideContextHelp').isVisible(),false);
  for(const width of [768,390]){
   await page.setViewportSize({width,height:1000});
   await page.goto(`http://127.0.0.1:${server.address().port}/#guia/financeiro`);
   await page.locator('#guideArticleTitle').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.ok((await page.locator('.guide-steps li p').first().boundingBox()).width>220);
   if(width===390){await page.getByRole('button',{name:'Ampliar captura do passo 1',exact:true}).click();await page.getByRole('button',{name:'Ver tela inteira',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'Fechar imagem ampliada',exact:true}).click();}
  }
  await page.setViewportSize({width:1536,height:1000});
  await page.locator('[data-done]').click();
  await page.locator('#logout').click();
  await page.locator('#dashboard').waitFor({state:'hidden'});
  assert.equal(await page.locator('#guideContextHelp').isVisible(),false);
  assert.equal(await page.locator('#guidePage').innerText(),'');
  assert.deepEqual(writes,['/api/auth/logout']);
  for(role of ['GESTOR','FINANCEIRO']){
   logged=true;await page.goto(`http://127.0.0.1:${server.address().port}/#guia`);await page.reload();
   await page.locator('#guidePage').waitFor({state:'visible'});
   assert.match(await page.locator('.guide-progress').innerText(),/0 de 6/);
  }
  // A delayed picture must not trigger printing after the reader leaves the guide.
  let releaseImage;const imageGate=new Promise(resolve=>releaseImage=resolve);
  await page.route('**/guide-images/tablets-5.png',async route=>{await imageGate;await route.continue();});
  await page.evaluate(()=>{window.cancelledPrintCalled=false;window.print=()=>window.cancelledPrintCalled=true;});
  const pendingImage=page.waitForRequest('**/guide-images/tablets-5.png');
  await page.getByRole('button',{name:'Imprimir guia',exact:true}).click();await pendingImage;
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'inicio'})));
  assert.equal(await page.locator('#guidePrintContent').count(),0,'Sair do guia deve cancelar e remover imediatamente a impressão em preparo');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.shell').evaluate(element=>getComputedStyle(element).display==='none'),false);
  await page.emulateMedia({media:'screen'});
  const finishedImage=page.waitForResponse('**/guide-images/tablets-5.png');releaseImage();await finishedImage;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#guidePrintContent').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.cancelledPrintCalled),false);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'guia'})));
  await page.locator('.guide-index [data-topic=financeiro]').click();
  await page.getByRole('button',{name:'Ampliar captura do passo 1',exact:true}).click();
  await page.evaluate(()=>{window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));document.getElementById('dashboard').hidden=true;});
  assert.equal(await imageDialog.isVisible(),false);
  assert.equal(await page.locator('#guideImageDialog img').getAttribute('src'),null);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
