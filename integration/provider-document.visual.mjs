// Real component and native form behavior; synthetic HTTP, SQL proven separately.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let records=[],writes=[];
app.get('/api/b24a/chapas',(_req,res)=>res.json({pc03:true,adm:true,podeEditar:true,registros:records,depositos:[{DepositoId:1,Nome:'Depósito A',Ativo:true}],vinculos:records.map(r=>({PrestadorId:r.PrestadorId,DepositoId:1}))}));
app.post('/api/b24a/chapas',(req,res)=>{writes.push(req.body);const r={PrestadorId:records.length+1,Nome:req.body.nome,CPF:req.body.documento.replace(/\D/g,''),Telefone:req.body.telefone,Ativo:true,Versao:1};records.push(r);res.status(201).json({resultado:r});});
app.put('/api/b24a/chapas/:id',(req,res)=>{writes.push(req.body);const r=records.find(x=>x.PrestadorId===Number(req.params.id));Object.assign(r,{Nome:req.body.nome,CPF:req.body.documento.replace(/\D/g,''),Telefone:req.body.telefone,Ativo:req.body.ativo,Versao:r.Versao+1});res.json({resultado:r});});
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/b24a.css"><link rel="stylesheet" href="/jc-refinado.css"></head><body><main class="panel"><h1 id="b24Title">Prestadores</h1><p id="b24Message"></p><section id="pc03Panel"></section></main><script src="/pc03.js"></script></body></html>'));
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=async()=>{};window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{pc03:true}}));window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'chapas'}));});
 const panel=page.locator('#pc03Panel');await panel.getByText('Nenhum prestador encontrado.',{exact:true}).waitFor();
 assert.equal(await panel.getByLabel('CPF ou CNPJ',{exact:true}).count(),1);assert.equal(await panel.locator('#pc03_cpf,#pc03_cnpj').count(),0);
 const documentInput=panel.getByLabel('CPF ou CNPJ',{exact:true});
 await documentInput.pressSequentially('12345617840');assert.equal(await documentInput.inputValue(),'123.456.178-40');
 await documentInput.pressSequentially('001');assert.equal(await documentInput.inputValue(),'12.345.617/8400-01');
 await documentInput.press('Backspace');assert.equal(await documentInput.inputValue(),'12.345.617/8400-0');
 await documentInput.fill('12345678000199');assert.equal(await documentInput.inputValue(),'12.345.678/0001-99');
 await documentInput.fill('12.345.678/0001-99');assert.equal(await documentInput.inputValue(),'12.345.678/0001-99');
 await documentInput.fill('12345617840');
 await documentInput.evaluate(input=>input.setSelectionRange(4,4));await documentInput.press('Backspace');
 await documentInput.press('Backspace');assert.equal(await documentInput.inputValue(),'124.561.784-0');
 await documentInput.fill('12345678000199');await documentInput.press('End');
 await documentInput.press('7');assert.equal(await documentInput.inputValue(),'12.345.678/0001-99');
 await documentInput.fill('');assert.equal(await documentInput.inputValue(),'');
 const create=async(name,documento)=>{await panel.getByLabel('Nome completo',{exact:true}).fill(name);await panel.getByLabel('CPF ou CNPJ',{exact:true}).fill(documento);await panel.getByRole('button',{name:'Depósitos do cadastro inicial',exact:true}).click();await panel.locator('[name=deposito]').check();await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();await panel.getByText('Prestador cadastrado.',{exact:true}).waitFor();};
 await create('Empresa Teste','12.345.678/0001-90');assert.equal(records[0].CPF,'12345678000190');assert.equal(writes[0].cpf,undefined);assert.equal(writes[0].cnpj,undefined);
 await create('Pessoa Teste','123.456.789-01');assert.equal(records[1].CPF,'12345678901');
 assert.equal(await panel.locator('tr').filter({hasText:'Empresa Teste'}).locator('td').nth(1).innerText(),'12.345.678/0001-90');
 assert.equal(await panel.locator('tr').filter({hasText:'Pessoa Teste'}).locator('td').nth(1).innerText(),'123.456.789-01');
 const row=panel.locator('tr').filter({hasText:'Empresa Teste'});await row.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await panel.getByLabel('CPF ou CNPJ',{exact:true}).inputValue(),'12.345.678/0001-90');
 await panel.getByLabel('Nome completo',{exact:true}).fill('Descartar Nome');await panel.getByRole('button',{name:'Cancelar edição',exact:true}).click();assert.equal(writes.length,2);
 await row.getByRole('button',{name:'Editar',exact:true}).click();await panel.getByLabel('Telefone (opcional)',{exact:true}).fill('11999999999');await panel.getByRole('button',{name:'Salvar alterações',exact:true}).click();await panel.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.equal(records[0].Telefone,'11999999999');
 await panel.getByLabel('Nome completo',{exact:true}).fill('Pessoa Inválida');await panel.getByLabel('CPF ou CNPJ',{exact:true}).fill('123');await panel.getByRole('button',{name:'Depósitos do cadastro inicial',exact:true}).click();await panel.locator('[name=deposito]').check();await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();assert.equal(writes.length,3);
 await panel.getByLabel('CPF ou CNPJ',{exact:true}).fill('');await panel.getByLabel('Buscar por nome, CPF ou CNPJ',{exact:true}).fill('12345678000190');assert.equal(await panel.locator('tr').count(),2);
 fs.mkdirSync('artifacts/provider-document',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/provider-document/provider-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('CPF/CNPJ UI PASS: campo único, criação de ambos, edição/releitura, cancelamento, inválido sem escrita, busca, 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
