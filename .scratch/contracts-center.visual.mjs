import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const rows=['ABERTA','LIBERADA','CANCELADA'].map((Status,i)=>({ContratacaoId:i+1,Numero:i+1,Prestador:'Prestador '+(i+1),Deposito:'Sumaré',CentroCusto:i===2?null:'CC-SUM',Tipo:'Diária',GestorResponsavel:'Admin',DataServico:i===1?'2026-03-01':'2026-10-30',Valor:'100.00',Status}));
const app=express();let mutations=0,opened=[];
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/jc-refinado.css"><link rel="stylesheet" href="/b24c.css"><link rel="stylesheet" href="/b24a.css"><link rel="stylesheet" href="/b25.css"><link rel="stylesheet" href="/b25b.css"><link rel="stylesheet" href="/mfa-b2b.css"><link rel="stylesheet" href="/b3.css"><link rel="stylesheet" href="/pc01.css"><link rel="stylesheet" href="/pc04.css"><link rel="stylesheet" href="/fin01.css"><link rel="stylesheet" href="/fin05.css"><link rel="stylesheet" href="/tablets.css"><link rel="stylesheet" href="/pilot-tokens.css"><link rel="stylesheet" href="/pilot-design.css"></head><body><div id="dashboard"><main class="panel view-section" id="pc04Page"><section id="pc04Panel"></section></main></div><script src="/pc04.js"></script></body></html>'));
app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:false}));
app.get('/api/pc05/status',(_req,res)=>res.status(404).json({}));
app.get('/api/pc04/contratacoes',(_req,res)=>res.json({registros:rows}));
app.get('/api/pc04/contratacoes/:id',(req,res)=>{opened.push(req.params.id);res.json({registro:rows.find(r=>String(r.ContratacaoId)===req.params.id),podeOperar:false,eventos:[]});});
app.use('/api',(_req,res)=>{mutations++;res.sendStatus(405);});app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
 const table=page.locator('.pc04-table table');
 assert.ok(await table.locator('th,td').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).textAlign==='center')),'Cabeçalhos e células centralizados na cascata real');
 assert.deepEqual(await table.locator('thead th .pc04-column-title').allTextContents(),['Número','Prestador','Depósito','Centro de Custo','Gestor responsável','Data do serviço','Valor (R$)','Situação','']);
 assert.deepEqual((await table.locator('tbody tr').first().locator('td').allTextContents()).slice(0,8),['1','Prestador 1','Sumaré','CC-SUM','Admin','30/10/2026','100,00','ABERTA']);
 assert.equal(await table.locator('tbody tr').nth(1).locator('td').nth(5).textContent(),'01/03/2026');
 assert.deepEqual(await table.locator('tbody tr td:last-child button').allTextContents(),['Editar','Editar','Editar']);
 assert.equal(await table.locator('tbody tr').nth(2).locator('td').nth(3).textContent(),'—');
 const badges=table.locator('.pc04-status');assert.equal(await badges.count(),3);
 const colors=await badges.evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));assert.equal(new Set(colors).size,3);assert.ok(colors.every(c=>c!=='rgba(0, 0, 0, 0)'));
 await table.locator('tbody tr[data-contract="2"]').getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('heading',{name:'Contratação 2',exact:true}).waitFor();assert.deepEqual(opened,['2']);
 fs.mkdirSync('artifacts/contracts-table',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('#pc04Panel').screenshot({path:`artifacts/contracts-table/table-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Overflow da página '+width);}
 await table.evaluate(t=>{const wrap=t.closest('.pc04-table');wrap.scrollLeft=wrap.scrollWidth;});const actionBox=await table.locator('tbody tr[data-contract="1"]').getByRole('button',{name:'Editar',exact:true}).boundingBox();assert.ok(actionBox.x>=0&&actionBox.x+actionBox.width<=390,'Ação alcançável pela rolagem interna '+JSON.stringify({actionBox,dimensions:await table.evaluate(t=>[t,t.parentElement,t.parentElement.parentElement].map(e=>({tag:e.tagName,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,scrollLeft:e.scrollLeft,clientWidth:e.clientWidth,display:getComputedStyle(e).display})))}));
 await page.locator('.pc04-table').screenshot({path:'artifacts/contracts-table/table-390-status.png'});
 assert.equal(mutations,0);assert.deepEqual(errors,[]);console.log('Tabela de contratações PASS: nove colunas, dd/mm/aaaa, três cores, Editar correto, desktop/mobile e zero escritas.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
