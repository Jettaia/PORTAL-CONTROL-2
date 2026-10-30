import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());const writes=[];
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html><body><main id="pc04Page"><section id="pc04Panel"></section></main><script src="/pc04.js"></script></body></html>'));
app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:true,depositos:[1,2,3].map(DepositoId=>({DepositoId,Nome:'Depósito '+DepositoId})),tipos:[{TipoServicoId:1,Nome:'Diária'}],prestadores:[1,2,3].map(DepositoId=>({DepositoId,PrestadorId:1,Nome:'Prestador Teste',CPF:'12345678901'})),gestores:[{UsuarioId:1,Nome:'Admin',DepositoId:1},{UsuarioId:7,Nome:'Guilherme Ribeiro',DepositoId:1},{UsuarioId:7,Nome:'Guilherme Ribeiro',DepositoId:2},{UsuarioId:9,Nome:'Outro Gestor',DepositoId:3}]}));
app.get('/api/pc05/status',(_req,res)=>res.status(404).json({}));app.get('/api/pc04/media',(_req,res)=>res.json({media:null,quantidade:0,minimo:3}));
app.get('/api/pc04/contratacoes',(_req,res)=>res.json({registros:[]}));
app.post('/api/pc04/contratacoes',(req,res)=>{writes.push(req.body);res.status(201).json({resultado:{ContratacaoId:1}});});
app.get('/api/pc04/contratacoes/1',(_req,res)=>res.json({registro:{ContratacaoId:1,Numero:1,Status:'ABERTA'},podeOperar:false,eventos:[]}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 const enter=async user=>{await page.evaluate(user=>{window.dispatchEvent(new CustomEvent('jetta:auth',{detail:user}));window.dispatchEvent(new Event('jetta:pc04'));},user);await page.getByText('Consulta atualizada.',{exact:true}).waitFor();};
 await enter({id:7,nome:'Guilherme Ribeiro',perfil:'GESTOR',funcoes:['GESTOR']});
 const manager=page.locator('#pc04_gestorId'),depot=page.locator('#pc04_depositoId');assert.equal(await manager.inputValue(),'7');assert.equal(await manager.isDisabled(),true);assert.equal(await manager.locator('option:checked').textContent(),'Guilherme Ribeiro');
 await depot.selectOption('2');assert.equal(await manager.inputValue(),'7');await depot.selectOption('3');assert.equal(await manager.inputValue(),'');assert.equal(await manager.locator('option[value="7"]').count(),0);
 await depot.selectOption('1');assert.equal(await manager.inputValue(),'7');await page.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await page.getByText('Consulta atualizada.',{exact:true}).waitFor();assert.equal(await manager.inputValue(),'7');
 await page.locator('#pc04_prestadorId').selectOption('1');await page.locator('#pc04_tipoServicoId').selectOption('1');await page.getByLabel('Data de início do serviço',{exact:true}).fill('2026-11-10');await page.getByLabel('Entrada prevista',{exact:true}).fill('2026-11-10T08:00');await page.getByLabel('Saída prevista',{exact:true}).fill('2026-11-10T12:00');await page.getByLabel('Valor combinado (R$)',{exact:true}).fill('100');await page.getByRole('button',{name:'Criar contratação',exact:true}).click();await page.getByText('Contratação criada.',{exact:true}).waitFor();assert.equal(writes[0].gestorId,'7');
 await enter({id:1,perfil:'ADMIN',funcoes:['ADMIN','GESTOR']});assert.equal(await manager.inputValue(),'');assert.equal(await manager.isEnabled(),true);await manager.selectOption('7');assert.equal(await manager.inputValue(),'7');
 await enter({id:9,perfil:'GESTOR',funcoes:['GESTOR']});assert.equal(await manager.inputValue(),'');await depot.selectOption('3');assert.equal(await manager.inputValue(),'9');
 assert.deepEqual(errors,[]);console.log('Gestor automático PASS: identidade autenticada, depósitos, recarga, payload, ADMIN e troca de usuário.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
