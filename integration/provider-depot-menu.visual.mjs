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
app.post('/api/b24a/chapas',(req,res)=>{writes.push(req.body);if(fail)return res.status(409).json({erro:'CPF_DUPLICADO'});selected=req.body.depositos;res.status(201).json({resultado:{PrestadorId:8}});});
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=async()=>{};window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{pc03:true}}));window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'chapas'}));});
 const panel=page.locator('#pc03Panel'),trigger=panel.getByRole('button',{name:/Depósitos do cadastro inicial/}),group=panel.getByRole('group',{name:'Depósitos do cadastro inicial',exact:true});
 await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();
 assert.equal(await trigger.count(),1,'Cadastro deve apresentar um campo que abre a seleção de depósitos');
 assert.equal(await group.isVisible(),false);assert.match(await trigger.innerText(),/Selecione os depósitos/);
 await trigger.click();await group.waitFor();assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.equal(await group.getByRole('checkbox').count(),2);
 await group.getByLabel('Floripa',{exact:true}).check();await group.getByLabel('Sumaré',{exact:true}).check();assert.equal(writes.length,0);assert.equal(await group.isVisible(),true);
 await panel.getByLabel('Nome completo',{exact:true}).click();assert.equal(await group.isVisible(),false);assert.match(await trigger.innerText(),/Floripa, Sumaré/);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click();assert.equal(await group.getByLabel('Floripa',{exact:true}).isChecked(),true);await group.getByLabel('Floripa',{exact:true}).uncheck();await page.keyboard.press('Escape');assert.equal(await group.isVisible(),false);assert.match(await trigger.innerText(),/Sumaré/);assert.doesNotMatch(await trigger.innerText(),/Floripa/);
 await trigger.focus();await page.keyboard.press('Enter');await group.waitFor();await page.keyboard.press('Escape');assert.equal(await group.isVisible(),false);assert.equal(writes.length,0);
 fs.mkdirSync('artifacts/provider-depot-menu',{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await trigger.click();await group.waitFor();
  const rect=await group.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);assert.ok(rect.y>=0&&rect.y+rect.height<=1001);
  await page.screenshot({path:`artifacts/provider-depot-menu/open-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');await page.screenshot({path:`artifacts/provider-depot-menu/closed-${width}.png`,fullPage:true});
 }
 await panel.getByLabel('Nome completo',{exact:true}).fill('Novo Prestador');await panel.getByLabel('CPF ou CNPJ',{exact:true}).fill('12345678901');
 fail=true;await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();await panel.getByText(/Operação recusada: CPF ou CNPJ já cadastrado/).waitFor();assert.match(await trigger.innerText(),/Sumaré/);assert.deepEqual(writes.at(-1).depositos,[2]);
 fail=false;await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();await panel.getByText('Prestador cadastrado.',{exact:true}).waitFor();assert.match(await trigger.innerText(),/Selecione os depósitos/);assert.equal(await group.isVisible(),false);
 // Transition to inline editing and back must remove the popup and clear draft selection.
 await panel.getByRole('button',{name:'Editar',exact:true}).click();await panel.getByRole('group',{name:'Depósitos autorizados',exact:true}).waitFor();assert.equal(await trigger.isVisible(),false);
 await panel.getByRole('button',{name:'Cancelar edição',exact:true}).click();assert.equal(await trigger.isVisible(),true);assert.equal(await group.isVisible(),false);assert.match(await trigger.innerText(),/Selecione os depósitos/);
 await trigger.click();await panel.getByLabel('Nome completo',{exact:true}).click();assert.equal(await group.isVisible(),false);
 depositos.push(...Array.from({length:35},(_,i)=>({DepositoId:10+i,Nome:'Depósito autorizado com nome extenso '+(i+1),Ativo:true})));
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'chapas'})));await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();
 await trigger.click();await group.waitFor();assert.ok(await group.evaluate(e=>e.scrollHeight>e.clientHeight),'Lista longa deve ter rolagem própria');
 await group.getByLabel('Depósito autorizado com nome extenso 35',{exact:true}).check();await page.keyboard.press('Escape');assert.match(await trigger.innerText(),/Depósito autorizado com nome extenso 35/);
 await page.screenshot({path:'artifacts/provider-depot-menu/long-selection-390.png',fullPage:true});
 await trigger.click();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'servicos'})));assert.equal(await group.isVisible(),false);
 depositos.splice(0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:cadastro',{detail:'chapas'})));await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();assert.equal(await trigger.isDisabled(),true);assert.match(await trigger.innerText(),/Nenhum depósito disponível/);
 assert.deepEqual(errors,[]);console.log('PASS menu depósitos: abrir/seleção múltipla/clique fora/reabrir/desmarcar/Escape/Enter/1440-390/erro/salvar/reset/edição/cancelar.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
