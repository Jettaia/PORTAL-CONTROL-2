// Browser + production frontend, synthetic HTTP, no operational SQL writes.
import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import fs from 'node:fs';import {chromium} from 'playwright';
test('prestadores C: lateral, popup B, CC, contratos, rascunho, permissões e sessão',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);
 const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));let admin=true,fail=false,hold=false,release;
 const people=[{PrestadorId:1,Nome:'André Ferreira',CPF:'12345678901',Telefone:'11900000001',Ativo:true,Versao:2},{PrestadorId:2,Nome:'Empresa Teste',CPF:'12345678000190',Telefone:'',Ativo:true,Versao:1}];
 const depositos=[{DepositoId:1,Nome:'Guarulhos',CentroCusto:'CC-001',Ativo:true},{DepositoId:2,Nome:'Campinas',CentroCusto:'CC-002',Ativo:true},{DepositoId:3,Nome:'Depósito antigo',CentroCusto:'CC-003',Ativo:false}];let vinculos=[{PrestadorId:1,DepositoId:1},{PrestadorId:1,DepositoId:3}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/auth/me')return route.fulfill({json:{usuario:{id:1,nome:'Teste local',perfil:admin?'ADMIN':'GESTOR',funcoes:[admin?'ADMIN':'GESTOR'],pc03:true},mfa:{necessarioParaAcoesSensiveis:false}}});
  if(p==='/api/mfa/status')return route.fulfill({json:{enabled:false}});
  if(p.startsWith('/api/b24a/chapas')){
   if(req.method()==='GET')return route.fulfill({json:{adm:admin,podeEditar:true,registros:people,depositos,vinculos}});
   const body=req.postDataJSON();writes.push({method:req.method(),body});if(fail)return route.fulfill({status:409,json:{erro:'REGISTRO_ALTERADO_ATUALIZE'}});if(hold)await new Promise(r=>release=r);
   const id=req.method()==='POST'?3:Number(p.split('/').at(-1)),old=people.find(r=>r.PrestadorId===id);
   const row={PrestadorId:id,Nome:body.nome,CPF:body.documento.replace(/\D/g,''),Telefone:body.telefone,Ativo:body.ativo??true,Versao:(old?.Versao||0)+1};if(old)Object.assign(old,row);else people.push(row);
   vinculos=vinculos.filter(v=>v.PrestadorId!==id).concat(body.depositos.map(DepositoId=>({PrestadorId:id,DepositoId})));return route.fulfill({json:{resultado:row}});
  }
  return route.fulfill({json:{registros:[],podeEditar:true}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=chapas]').click();
 const list=page.locator('#pc03List .pc03-row'),edit=page.locator('#pc03Edit form'),modal=page.locator('#pc03NewDialog');await list.first().waitFor();
 assert.equal(await list.count(),2);assert.equal(await edit.getByLabel('Nome completo',{exact:true}).inputValue(),'André Ferreira');
 assert.match(await edit.locator('fieldset').textContent(),/GuarulhosCC-001/);assert.equal(await page.locator('#pc03Panel .pc03-count').count(),0);
 await edit.getByLabel('Telefone (opcional)',{exact:true}).fill('Rascunho');await page.locator('#pc03New').click();await modal.waitFor();
 assert.match(await modal.locator('fieldset').textContent(),/CampinasCC-002/);assert.doesNotMatch(await modal.locator('fieldset').textContent(),/Depósito antigo/);
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await edit.getByLabel('Telefone (opcional)',{exact:true}).inputValue(),'Rascunho');assert.equal(writes.length,0);
 await edit.getByLabel('Telefone (opcional)',{exact:true}).fill('11900000099');await edit.locator('[name=deposito][value="1"]').uncheck();await edit.locator('[name=deposito][value="2"]').check();
 await page.evaluate(()=>{window.pc03PreviousMfa=window.jettaEnsureRecentMfa;window.jettaEnsureRecentMfa=()=>new Promise((resolve,reject)=>{window.pc03RejectMfa=reject;});});
 await edit.getByRole('button',{name:'Salvar alterações'}).click();assert.equal(writes.length,0);
 await page.evaluate(()=>window.pc03RejectMfa(Error('Operação cancelada.')));await page.getByText(/Operação recusada: Operação cancelada/).waitFor();assert.equal(await edit.getByLabel('Telefone (opcional)',{exact:true}).inputValue(),'11900000099');
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=window.pc03PreviousMfa;});
 fail=true;await edit.getByRole('button',{name:'Salvar alterações'}).click();await page.getByText(/Outra pessoa alterou/).waitFor();assert.equal(await edit.getByLabel('Telefone (opcional)',{exact:true}).inputValue(),'11900000099');
 fail=false;await edit.getByRole('button',{name:'Salvar alterações'}).click();await page.getByText('Alterações salvas.',{exact:true}).waitFor();assert.equal(writes.at(-1).body.versao,2);assert.deepEqual(writes.at(-1).body.depositos,[2,3]);
 await page.locator('#pc03Search').fill('12345678000190');assert.equal(await list.count(),1);await list.first().click();assert.equal(await edit.getByLabel('CPF ou CNPJ',{exact:true}).inputValue(),'12.345.678/0001-90');
 await page.locator('#pc03Search').fill('');await page.locator('#pc03New').click();await modal.getByLabel('Nome completo',{exact:true}).fill('Pessoa Nova');await modal.getByLabel('CPF ou CNPJ',{exact:true}).fill('23456789012');await modal.locator('[name=deposito][value="1"]').check();
 await modal.getByRole('button',{name:'Cadastrar prestador'}).click();await modal.waitFor({state:'hidden'});await page.getByText('Prestador cadastrado.',{exact:true}).waitFor();assert.equal(writes.at(-1).method,'POST');assert.deepEqual(writes.at(-1).body.depositos,[1]);assert.equal(writes.at(-1).body.ativo,undefined);
 fs.mkdirSync('artifacts/provider-split',{recursive:true});await page.screenshot({path:'artifacts/provider-split/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#pc03New').click();await page.screenshot({path:'artifacts/provider-split/popup-mobile.png',fullPage:true});assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:1000});admin=false;await page.locator('#pc03Reload').click();await list.first().waitFor();await list.filter({hasText:'André Ferreira'}).click();
 assert.equal(await edit.getByLabel('CPF ou CNPJ',{exact:true}).getAttribute('readonly')!==null,true);assert.equal(await edit.getByLabel('Situação',{exact:true}).isVisible(),false);
 await list.filter({hasText:'Empresa Teste'}).click();assert.equal(await edit.isVisible(),false);
 await list.filter({hasText:'André Ferreira'}).click();hold=true;const before=writes.length;await edit.getByRole('button',{name:'Salvar alterações'}).click();await edit.evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 for(let i=0;!release&&i<100;i++)await new Promise(r=>setTimeout(r,10));assert.equal(writes.length,before+1);
 await page.evaluate(()=>{document.getElementById('dashboard').hidden=true;window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});const pending=page.waitForResponse(r=>r.request().method()==='PUT');release();await pending;
 assert.equal(await modal.isVisible(),false);assert.equal(await list.count(),0);assert.deepEqual(errors,[]);
});
