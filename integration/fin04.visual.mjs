import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../src/server.js';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const cfg={host:'127.0.0.1',port:0,mfaRequired:false,fin01:true,pc01:true,pc02:true,pc03:true,pc04:true,token:'test'};
const server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const perfil of ['ADMIN','FINANCEIRO','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],retired=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(?:api\/(?:pc08|pc09|pc10|pc11|b51|b52|b52a|b52b|b52c|b53f01|b53f03|b61|final-lab)|(?:b5-|b6-|final-lab|pc08|pc09|pc10|pc11))/.test(new URL(r.url()).pathname))retired.push(r.url());});
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let body={};
   if(url.pathname==='/api/auth/me')body={usuario:{id:1,nome:'QA '+perfil,perfil,fin01:true,pc04:true,pc09:true},mfa:{necessarioParaAcoesSensiveis:false}};
   if(url.pathname==='/api/financeiro/catalogo')body={podeOperar:perfil!=='GESTOR',depositos:[],prestadores:[]};
   if(url.pathname==='/api/financeiro/contratacoes')body={registros:[],proximaPagina:null,podeOperar:perfil!=='GESTOR'};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.jettaAccount?.fin01&&!document.getElementById('dashboard').hidden);
  await page.locator('#homePage').getByText('Bem-vindo ao Jetta Control',{exact:true}).waitFor();
  const nav=page.locator('#mainNav details').filter({has:page.locator('summary').filter({hasText:'Financeiro'})});assert.deepEqual(await nav.locator('button').allTextContents(),['Financeiro','Extrato por prestador']);assert.equal(await page.locator('#mainNav a[href*="financeira"]').count(),0);
  for(const alias of ['pagamentos','recibos','ajustes','extratos','autorizacoes','carteira','provisionamentos','pendencias','relatoriosfinanceiros','gestao']){
   await page.evaluate(alias=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:alias})),alias);await page.locator('#fin01Page:not([hidden])').waitFor();assert.equal(await page.locator('#pageHeading').innerText(),'Financeiro');
  }
  await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));fs.mkdirSync('artifacts/fin04',{recursive:true});await page.screenshot({path:`artifacts/fin04/financeiro-${perfil}-${width}.png`,fullPage:true});}
  assert.deepEqual(retired,[]);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS FIN04 UI: ADMIN/FINANCEIRO/GESTOR, única entrada Financeiro, aliases convergem, dashboard não chama legado, zero recursos legados/erros JS, 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

