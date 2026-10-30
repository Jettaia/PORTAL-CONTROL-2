import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const perfil of ['ADMIN','GESTOR','FINANCEIRO']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{const url=new URL(route.request().url());requests.push(url.pathname);let body={};
   if(url.pathname==='/api/auth/me')body={usuario:{id:1,nome:'QA '+perfil,perfil,pc04:true},mfa:{habilitado:false}};
   else if(url.pathname==='/api/pc04/catalogo')body={podeOperar:false};
   else if(url.pathname==='/api/pc04/contratacoes')body={registros:[]};
   else if(url.pathname==='/api/pc05/status')body={pc05:false};
   else if(url.pathname==='/api/b3/catalogo')body={b33:true};
   else if(url.pathname==='/api/b3/politicas')body={politicas:[],historico:[]};
   else if(url.pathname==='/api/conta')body={pc04:true,pc01:true,pc03:true};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>window.jettaAccount?.pc04&&!document.getElementById('dashboard').hidden).catch(async error=>{console.log({errors,requests,state:await page.evaluate(()=>({account:window.jettaAccount,hidden:document.getElementById('dashboard').hidden}))});throw error;});
  const operation=page.locator('#mainNav details').filter({has:page.locator('summary').filter({hasText:'Operação'})});
  await operation.locator('summary').click();
  assert.deepEqual(await operation.locator('button[data-page]').allTextContents(),['Contratações']);
  await operation.locator('[data-page=contratacoes]').click();
  await page.locator('#pc04Page:not([hidden])').waitFor();
  assert.equal(await page.locator('#pageHeading').textContent(),'Contratações');
  for(const target of ['planejamento','atividades','jornada','apontamentos','confirmacoes','fechamento']){
   await page.evaluate(target=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:target})),target);
   assert.equal(await page.locator('#homePage').isVisible(),true,target+' usa fallback seguro');
  }
  assert.equal(await page.locator('[data-b61-go="planejamento"],[data-b61-go="apontamentos"],[data-b61-go="confirmacoes"],[data-b61-go="fechamento"],#b3PlanPage,#b41Page,#b42Page,#b43Page').count(),0);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'limites'})));
  await page.getByText('Histórico preservado. Sem edição retroativa ou fechamento automático de vigência.',{exact:true}).waitFor();
  await operation.locator('[data-page=contratacoes]').click();
  await page.waitForTimeout(150);
  assert.ok(!requests.some(url=>/^\/api\/(b4|b42|b43)(\/|$)|^\/api\/b3\/atividades/.test(url)));
  assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts/operation-navigation',{recursive:true});
  if(perfil==='ADMIN')await page.locator('#sidebar').screenshot({path:'artifacts/operation-navigation/sidebar.png'});
  await page.close();
 }
 console.log('PASS: ADMIN/GESTOR/FINANCEIRO, Operação somente Contratações, clique real, fallback de destinos retirados, zero erros JS.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
