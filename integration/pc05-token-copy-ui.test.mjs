import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('PC05 UI: código CPF permanente, sem geração, tablet sem dados pessoais',async t=>{
 const server=express().use(express.static('public')).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[],posted=[];page.on('pageerror',e=>errors.push(e.message));
 const row={ContratacaoId:7,Numero:8,Prestador:'Pessoa teste',Deposito:'Depósito teste',DataServico:'2026-11-16',InicioPrevisto:'2026-11-16T08:00',FimPrevisto:'2026-11-16T18:00',Status:'ABERTA',Valor:'100.00',Versao:1};
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;let body={registros:[],naoLidas:0};
  if(p==='/api/auth/me')body={usuario:{id:1,nome:'Admin',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(p==='/api/mfa/status')body={enabled:false};
  if(p==='/api/pc04/catalogo')body={podeOperar:true,depositos:[],tipos:[],prestadores:[],gestores:[]};
  if(p==='/api/pc05/status')body={pc05:true};
  if(p==='/api/pc04/contratacoes')body={registros:[row]};
  if(p==='/api/pc04/contratacoes/7')body={registro:row,codigoRegistro:'0123',pc05:true,podeOperar:true,solicitacoesHorarios:[],eventos:[]};
  if(route.request().method()==='POST')posted.push(p);
  await route.fulfill({json:body});
 });
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}/#contratacoes/7/tokens`);
  const code=page.getByRole('textbox',{name:'Código para entrada e saída',exact:true});await code.waitFor();assert.equal(await code.inputValue(),'0123');
  assert.equal(await page.getByRole('button',{name:/Gerar.*entrada|Gerar.*saída/}).count(),0);assert.doesNotMatch(await page.locator('#pc04Pane_tokens').innerText(),/uma hora|substituir|expira/i);
  fs.mkdirSync('artifacts/pc05-fixed-code',{recursive:true});await page.screenshot({path:`artifacts/pc05-fixed-code/internal-${width}.png`});
  await page.getByRole('tab',{name:'Resumo',exact:true}).click();await page.getByRole('tab',{name:'Entrada e saída',exact:true}).click();assert.equal(await code.inputValue(),'0123');
 }
 assert.deepEqual(posted,[]);
 const tablet=await browser.newPage({viewport:{width:390,height:844}});tablet.setDefaultTimeout(5000);tablet.on('pageerror',e=>errors.push(e.message));let fail=true;const submissions=[];
 await tablet.route('**/api/pc05/tablet/**',async route=>{
  if(route.request().url().endsWith('/apontar')){submissions.push(route.request().postDataJSON());if(fail){fail=false;return route.fulfill({status:503,json:{erro:'TOKENS_INDISPONIVEIS'}});}}
  await route.fulfill({json:{ok:true,mensagem:'Token aceito'}});
 });
 await tablet.goto(`http://127.0.0.1:${server.address().port}/tablet-pc05.html`);await tablet.locator('#operation').waitFor({state:'visible'});
 assert.equal(await tablet.locator('#code').getAttribute('maxlength'),'4');
 for(let i=0;i<2;i++){await tablet.locator('#code').fill('0123');await tablet.getByRole('button',{name:'Confirmar código',exact:true}).click();await tablet.getByText(i===0?'Não foi possível confirmar o registro. Consulte o responsável antes de repetir.':'Token aceito',{exact:true}).waitFor();}
 assert.equal(submissions.length,2);assert.match(submissions[0].requisicaoId,/^[a-f0-9-]{36}$/);assert.deepEqual(submissions[0],submissions[1]);assert.equal(await tablet.locator('#code').inputValue(),'');
 assert.doesNotMatch(await tablet.locator('body').innerText(),/Pessoa teste|Depósito teste|Registrar entrada|Registrar saída/);
 await tablet.screenshot({path:'artifacts/pc05-fixed-code/tablet-mobile.png'});assert.deepEqual(errors,[]);
});
