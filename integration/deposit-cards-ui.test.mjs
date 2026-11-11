// Real frontend, synthetic HTTP contract; no operational SQL writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';
test('depósitos B: cards, busca, filtros, modal, contratos, permissões e saída',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 let canEdit=true,fail=false,holdWrite=false,releaseWrite;
 const rows=[{DepositoId:1,Nome:'Guarulhos',CentroCusto:'CC-001',Rua:'Avenida Santos Dumont',Numero:'1500',Bairro:'Cumbica',Cidade:'Guarulhos',Estado:'SP',CEP:'07180000',Ativo:true},{DepositoId:2,Nome:'Campinas',CentroCusto:'CC-002',Rua:'Rua dos Transportadores',Numero:'240',Bairro:'Distrito Industrial',Cidade:'Campinas',Estado:'SP',CEP:'13054000',Ativo:true},{DepositoId:3,Nome:'Santos',CentroCusto:'CC-003',Rua:'Avenida Portuária',Numero:'75',Bairro:'Macuco',Cidade:'Santos',Estado:'SP',CEP:'11015000',Ativo:false}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/auth/me')return route.fulfill({json:{usuario:{id:1,nome:'Admin teste',perfil:'ADMIN',funcoes:['ADMIN'],pc03:true},mfa:{necessarioParaAcoesSensiveis:false}}});
  if(p==='/api/mfa/status')return route.fulfill({json:{enabled:false}});
  if(p.startsWith('/api/b24a/depositos')){
   if(req.method()==='GET')return route.fulfill({json:{registros:rows,podeEditar:canEdit}});
   const body=req.postDataJSON();writes.push({method:req.method(),body});
   if(fail)return route.fulfill({status:409,json:{erro:'REGISTRO_ALTERADO_ATUALIZE'}});
   if(holdWrite)await new Promise(r=>releaseWrite=r);
   const id=req.method()==='POST'?4:Number(p.split('/').at(-1));
   const row={DepositoId:id,Nome:body.nome,CentroCusto:body.centroCusto,Rua:body.rua,Numero:body.numero,Bairro:body.bairro,Cidade:body.cidade,Estado:body.estado,CEP:body.cep.replace(/\D/g,''),Ativo:body.ativo};
   const index=rows.findIndex(r=>r.DepositoId===id);if(index<0)rows.push(row);else rows[index]=row;
   return route.fulfill({status:req.method()==='POST'?201:200,json:{resultado:row}});
  }
  return route.fulfill({json:{registros:[],podeEditar:false}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=depositos]').click();
 const cards=page.locator('#b24cDepTable .depot-card'),modal=page.locator('#b24cDepDialog');
 await cards.first().waitFor();assert.equal(await cards.count(),3);assert.equal(await page.locator('#breadcrumb').isVisible(),false);assert.equal(await page.locator('#pageHeading').textContent(),'Depósitos');
 await page.locator('#b24cDepSearch').fill('campinas');assert.equal(await cards.count(),1);
 await page.locator('#b24cDepSearch').fill('');await page.locator('[data-depot-filter=inativos]').click();assert.equal(await cards.count(),1);
 await page.locator('[data-depot-filter=todos]').click();
 await cards.filter({hasText:'Guarulhos'}).getByRole('button',{name:'Editar depósito'}).click();await modal.waitFor();
 assert.equal(await page.locator('#b24cCep').inputValue(),'07180-000');
 await page.locator('#b24cNome').fill('Rascunho descartado');await page.locator('#b24cDepCancel').click();assert.equal(await modal.isVisible(),false);assert.equal(writes.length,0);
 await cards.filter({hasText:'Guarulhos'}).getByRole('button',{name:'Editar depósito'}).click();
 await page.locator('#b24cRua').fill('Rua revisada');fail=true;await page.locator('#b24cDepSave').click();
 await modal.getByText('REGISTRO_ALTERADO_ATUALIZE',{exact:true}).waitFor();assert.equal(await page.locator('#b24cRua').inputValue(),'Rua revisada');
 fail=false;await page.locator('#b24cDepSave').click();await modal.waitFor({state:'hidden'});await page.getByText('Depósito atualizado.',{exact:true}).waitFor();
 assert.equal(writes.at(-1).body.original.cep,'07180000');assert.equal(writes.at(-1).body.cep,'07180-000');assert.equal(writes.at(-1).body.original.rua,'Avenida Santos Dumont');
 await page.locator('#b24cDepNew').click();
 for(const [key,value]of Object.entries({Nome:'Curitiba',CentroCusto:'CC-004',Rua:'Rua Nova',Numero:'10',Bairro:'Centro',Cidade:'Curitiba',Estado:'PR',Cep:'81260000'}))await page.locator('#b24c'+key).fill(value);
 await page.locator('#b24cDepSave').click();await modal.waitFor({state:'hidden'});await page.getByText('Depósito cadastrado.',{exact:true}).waitFor();
 assert.equal(writes.at(-1).method,'POST');assert.equal(writes.at(-1).body.original,undefined);assert.equal(await cards.count(),4);
 fs.mkdirSync('artifacts/deposit-cards',{recursive:true});await page.screenshot({path:'artifacts/deposit-cards/desktop.png',fullPage:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#b24cDepNew').click();await page.screenshot({path:`artifacts/deposit-cards/modal-${width}.png`,fullPage:true});
  assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.keyboard.press('Escape');assert.equal(await modal.isVisible(),false);
 }
 await page.setViewportSize({width:1440,height:1000});canEdit=false;await page.locator('#b24cDepReload').click();await page.locator('#b24cDepNew').waitFor({state:'hidden'});
 await cards.first().waitFor();assert.equal(await cards.getByRole('button',{name:'Editar depósito'}).count(),0);assert.equal(await cards.count(),4);
 canEdit=true;await page.locator('#b24cDepReload').click();await page.locator('#b24cDepNew').waitFor({state:'visible'});
 await cards.first().getByRole('button',{name:'Editar depósito'}).click();await page.locator('#b24cNome').fill('Salvamento pendente');holdWrite=true;
 const before=writes.length;await page.locator('#b24cDepSave').click();
 await page.locator('#b24cDepForm').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 for(let i=0;!releaseWrite&&i<100;i++)await new Promise(r=>setTimeout(r,10));assert.equal(writes.length,before+1);
 await page.evaluate(()=>{document.getElementById('dashboard').hidden=true;window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});
 assert.equal(await modal.isVisible(),false);const pending=page.waitForResponse(r=>r.request().method()==='PUT');releaseWrite();await pending;
 assert.equal(await cards.count(),0);assert.deepEqual(errors,[]);
});
