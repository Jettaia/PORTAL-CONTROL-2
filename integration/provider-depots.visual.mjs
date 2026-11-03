// Real DOM/form and production CSS; synthetic HTTP. SQL/auth tested in pc03.integration.mjs.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let selected=[1,3],writes=[],fail=false;
const person={PrestadorId:7,Nome:'Prestador Teste',CPF:'12345678901',Telefone:'',Ativo:true,Versao:1};
const depositos=[{DepositoId:1,Nome:'Floripa',Ativo:true},{DepositoId:2,Nome:'Sumaré',Ativo:true},{DepositoId:3,Nome:'Depósito inativo',Ativo:false}];
app.get('/api/b24a/chapas',(_req,res)=>res.json({adm:true,registros:[person],depositos,vinculos:selected.map(DepositoId=>({PrestadorId:7,DepositoId}))}));
app.put('/api/b24a/chapas/7',(req,res)=>{writes.push(req.body);if(fail)return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});selected=req.body.depositos;Object.assign(person,{Nome:req.body.nome,Versao:person.Versao+1});res.json({resultado:person});});
const styles=[...fs.readFileSync('public/index.html','utf8').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[0]).join('');
app.get('/fixture',(_req,res)=>res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><main id="dashboard"><section class="view-section panel"><h1 id="b24Title">Prestadores</h1><p id="b24Message"></p><section id="pc03Panel"></section></section></main><script src="/pc03.js"></script></body></html>`));
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=async()=>{};window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{pc03:true}}));window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'chapas'}));});
 const panel=page.locator('#pc03Panel'),row=panel.locator('tr').filter({hasText:person.Nome}),cell=row.locator('td').nth(4);
 await row.waitFor();assert.equal(await cell.getByRole('button').count(),0,'Coluna de depósitos deve ser somente leitura');assert.match(await cell.innerText(),/Floripa/);assert.match(await cell.innerText(),/Depósito inativo/);assert.doesNotMatch(await cell.innerText(),/Sumaré/);
 const edit=()=>row.getByRole('button',{name:'Editar',exact:true}).click(),save=()=>panel.getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await edit();const group=panel.getByRole('group',{name:'Depósitos autorizados',exact:true});await group.waitFor();
 assert.equal(await group.getByLabel('Floripa',{exact:true}).isChecked(),true);assert.equal(await group.getByLabel('Sumaré',{exact:true}).isChecked(),false);assert.equal(await group.getByLabel('Depósito inativo (inativo)',{exact:true}).isChecked(),true);
 await group.getByLabel('Floripa',{exact:true}).uncheck();await group.getByLabel('Sumaré',{exact:true}).check();assert.equal(writes.length,0);
 await panel.getByRole('button',{name:'Cancelar edição',exact:true}).click();assert.deepEqual(selected,[1,3]);assert.equal(writes.length,0);
 await edit();assert.equal(await group.getByLabel('Floripa',{exact:true}).isChecked(),true);await group.getByLabel('Floripa',{exact:true}).uncheck();await group.getByLabel('Sumaré',{exact:true}).check();
 // Filtering must not reset the draft.
 await panel.getByLabel('Buscar por nome, CPF ou CNPJ',{exact:true}).fill('Teste');assert.equal(await group.getByLabel('Sumaré',{exact:true}).isChecked(),true);
 fs.mkdirSync('artifacts/provider-depots',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/provider-depots/edit-${width}.png`,fullPage:true});assert.ok(await panel.locator('form').evaluate(e=>e.scrollWidth<=e.clientWidth+2));}
 fail=true;await save();await panel.getByText(/Operação recusada: Outra pessoa alterou/).waitFor();assert.equal(await group.getByLabel('Sumaré',{exact:true}).isChecked(),true);assert.deepEqual(selected,[1,3]);
 fail=false;await save();await panel.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.deepEqual(selected,[2,3]);assert.match(await cell.innerText(),/Sumaré/);assert.doesNotMatch(await cell.innerText(),/Floripa/);
 await panel.locator('label').filter({hasText:'Filtrar depósito'}).locator('select').selectOption('1');assert.equal(await panel.locator('tr').count(),1);await panel.locator('label').filter({hasText:'Filtrar depósito'}).locator('select').selectOption('2');await row.waitFor();
 await edit();await group.getByLabel('Sumaré',{exact:true}).uncheck();await group.getByLabel('Depósito inativo (inativo)',{exact:true}).uncheck();await save();await panel.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.deepEqual(selected,[]);
 await panel.locator('label').filter({hasText:'Filtrar depósito'}).locator('select').selectOption('');assert.equal(await cell.innerText(),'Nenhum depósito vinculado');
 await edit();assert.equal(await group.getByLabel('Depósito inativo (inativo)',{exact:true}).count(),0);
 await panel.getByRole('button',{name:'Cancelar edição',exact:true}).click();assert.equal(await panel.locator('[name=deposito]:checked').count(),0);
 await page.screenshot({path:'artifacts/provider-depots/table-390.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS depósitos UI: tabela, seleção inicial, cancelar, rascunho, erro, salvar/reler, filtro, último vínculo, inativo, 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
