import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('CEP nos depósitos: cards, modal, máscara, cadastro e edição preservam original bruto',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 const rows=[{DepositoId:1,Nome:'Depósito existente',CentroCusto:'CC-1',Rua:'Rua Um',Numero:'10',Bairro:'Centro',Cidade:'Campinas',Estado:'SP',CEP:'13178574',Ativo:true}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;let data={};
  if(p==='/api/auth/me')data={usuario:{id:1,nome:'Admin teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true},mfa:{necessarioParaAcoesSensiveis:false}};
  else if(p==='/api/mfa/status')data={enabled:false};
  else if(p.startsWith('/api/b24a/depositos')){
   if(req.method()==='GET')data={registros:rows,podeEditar:true};
   else{const body=req.postDataJSON();writes.push({method:req.method(),body});const row={DepositoId:req.method()==='POST'?2:1,Nome:body.nome,CentroCusto:body.centroCusto,Rua:body.rua,Numero:body.numero,Bairro:body.bairro,Cidade:body.cidade,Estado:body.estado,CEP:body.cep.replace(/\D/g,''),Ativo:body.ativo};if(req.method()==='POST')rows.push(row);else rows[0]=row;data={ok:true,resultado:row};}
  }
  await route.fulfill({json:data});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=depositos]').click();
 const table=page.locator('#b24cDepTable');await table.getByText('Depósito existente',{exact:true}).waitFor();
 assert.equal(await table.locator('.depot-address').filter({hasText:'13178-574'}).count(),1);
 await page.locator('#b24cDepNew').click();
 const cep=page.getByLabel('CEP',{exact:true});
 await cep.fill('13088150');assert.equal(await cep.inputValue(),'13088-150');await cep.fill('13088-150');assert.equal(await cep.inputValue(),'13088-150');
 for(const [id,value]of [['Nome','Depósito novo'],['CentroCusto','CC-2'],['Rua','Rua Dois'],['Numero','20'],['Bairro','Centro'],['Cidade','Campinas'],['Estado','SP']])await page.locator('#b24c'+id).fill(value);
 await page.getByRole('button',{name:'Cadastrar depósito',exact:true}).click();await page.getByText('Depósito cadastrado.',{exact:true}).waitFor();assert.equal(writes[0].body.cep,'13088-150');await table.locator('.depot-address').filter({hasText:'13088-150'}).waitFor();
 await table.locator('.depot-card').filter({hasText:'Depósito existente'}).getByRole('button',{name:'Editar depósito',exact:true}).click();assert.equal(await cep.inputValue(),'13178-574');
 await cep.fill('01001000');assert.equal(await cep.inputValue(),'01001-000');await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.getByText('Depósito atualizado.',{exact:true}).waitFor();
 assert.equal(writes[1].method,'PUT');assert.equal(writes[1].body.cep,'01001-000');assert.equal(writes[1].body.original.cep,'13178574');await table.locator('.depot-address').filter({hasText:'01001-000'}).waitFor();assert.deepEqual(errors,[]);
});
