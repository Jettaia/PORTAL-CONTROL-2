import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const rows=[
 {ContratacaoId:3,Numero:3,DepositoId:1,Prestador:'João Silva',Deposito:'Sumaré',CentroCusto:'CC-SUM',GestorResponsavel:'Ana',DataServico:'2026-10-30',Valor:'100.00',Status:'ABERTA'},
 {ContratacaoId:2,Numero:2,DepositoId:2,Prestador:'Maria Souza',Deposito:'Santos',CentroCusto:'CC-SAN',GestorResponsavel:'Bruno',DataServico:'2026-10-29',Valor:'200.50',Status:'LIBERADA'},
 {ContratacaoId:1,Numero:1,DepositoId:1,Prestador:'José Lima',Deposito:'Sumaré',CentroCusto:'CC-SUM',GestorResponsavel:'Ana',DataServico:'2026-10-28',Valor:'150.00',Status:'CANCELADA'}
];
const app=express(),queries=[],opened=[];let mutations=0;
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"><link rel="stylesheet" href="/jc-refinado.css"></head><body><main class="panel" id="pc04Page"><section id="pc04Panel"></section></main><script src="/pc04.js"></script></body></html>'));
app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:false,depositosFiltro:[{DepositoId:1,Nome:'Sumaré'},{DepositoId:2,Nome:'Santos'},{DepositoId:3,Nome:'Sem contratações'}]}));
app.get('/api/pc05/status',(_req,res)=>res.json({pc05:false}));
const normalize=x=>String(x).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
app.get('/api/pc04/contratacoes',(req,res)=>{
 const q=req.query;queries.push({...q});
 const filtered=rows.filter(r=>(!q.antes||r.Numero<Number(q.antes))&&(!q.numero||r.Numero===Number(q.numero))&&(!q.prestador||normalize(r.Prestador).includes(normalize(q.prestador)))&&(!q.depositoId||r.DepositoId===Number(q.depositoId))&&(!q.centroCusto||normalize(r.CentroCusto).includes(normalize(q.centroCusto)))&&(!q.gestor||normalize(r.GestorResponsavel).includes(normalize(q.gestor)))&&(!q.dataServico||r.DataServico===q.dataServico)&&(!q.valor||Number(r.Valor)===Number(q.valor.replace(',','.')))&&(!q.situacao||r.Status===q.situacao));
 res.json({registros:filtered.slice(0,2),proximaPagina:filtered.length>2?String(filtered[1].Numero):null});
});
app.get('/api/pc04/contratacoes/:id',(req,res)=>{opened.push(req.params.id);res.json({registro:rows.find(r=>String(r.ContratacaoId)===req.params.id),podeOperar:false,eventos:[]});});
app.use('/api',(_req,res)=>{mutations++;res.sendStatus(405);});app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
 const table=page.locator('.pc04-table table');
 assert.equal(await table.locator('thead input,thead select').count(),8);
 assert.equal(await table.locator('thead th').last().locator('input,select').count(),0);
 const waitRows=async expected=>page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.pc04-table tbody tr[data-contract]')].map(r=>Number(r.dataset.contract)))===JSON.stringify(expected),expected);
 const click=async name=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/pc04/contratacoes');await page.getByRole('button',{name,exact:true}).click();await response;};
 const auto=async(action,expected)=>{const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/pc04/contratacoes');await action();await response;await waitRows(expected);};
 const clear=async()=>{await click('Limpar filtros');await waitRows([3,2]);assert.equal(await page.getByLabel('Filtrar por Depósito',{exact:true}).inputValue(),'');};
 assert.deepEqual(await page.getByLabel('Filtrar por Depósito',{exact:true}).locator('option').allTextContents(),['Todos','Sumaré','Santos','Sem contratações']);
 for(const [name,value,expected] of [['Número','1',[1]],['Prestador','jose',[1]],['Depósito','2',[2]],['Centro de Custo','cc-san',[2]],['Gestor responsável','bruno',[2]],['Data do serviço','2026-10-28',[1]],['Valor (R$)','150,00',[1]],['Situação','CANCELADA',[1]]]){
  const input=page.getByLabel('Filtrar por '+name,{exact:true});await auto(async()=>{if(['Situação','Depósito'].includes(name))await input.selectOption(value);else await input.fill(value);},expected);
  assert.ok(!queries.at(-1).antes);await clear();
 }
 await auto(()=>page.getByLabel('Filtrar por Depósito',{exact:true}).selectOption('1'),[3,1]);await auto(()=>page.getByLabel('Filtrar por Gestor responsável',{exact:true}).fill('Ana'),[3,1]);
 await page.getByLabel('Filtrar por Prestador',{exact:true}).fill('inexistente');await page.getByLabel('Filtrar por Prestador',{exact:true}).press('Enter');await waitRows([]);
 await page.getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();assert.equal(await table.locator('thead input,thead select').count(),8);
 await clear();const beforeTyping=queries.length;await page.getByLabel('Filtrar por Prestador',{exact:true}).focus();await auto(()=>page.getByLabel('Filtrar por Prestador',{exact:true}).pressSequentially('jose',{delay:35}),[1]);assert.equal(queries.length,beforeTyping+1);await page.waitForFunction(()=>document.activeElement?.dataset.pc04Filter==='prestador');assert.equal(await page.getByLabel('Filtrar por Prestador',{exact:true}).evaluate(el=>el.selectionStart),4);await clear();await auto(()=>page.getByLabel('Filtrar por Prestador',{exact:true}).fill('a'),[3,2]);await click('Próxima página');await waitRows([1]);assert.equal(queries.at(-1).prestador,'a');await page.getByLabel('Filtrar por Prestador',{exact:true}).fill('');
 await page.getByLabel('Filtrar por Número',{exact:true}).fill('2');await click('Aplicar filtros');await waitRows([2]);assert.ok(!queries.at(-1).antes);
 await click('Atualizar consulta');await waitRows([2]);assert.equal(await page.getByLabel('Filtrar por Número',{exact:true}).inputValue(),'2');
 await table.locator('tbody tr[data-contract="2"]').getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('heading',{name:'Contratação 2',exact:true}).waitFor();assert.equal(opened.at(-1),'2');
 await clear();await page.getByLabel('Filtrar por Prestador',{exact:true}).fill('pendente');await clear();const afterClear=queries.length;await new Promise(resolve=>setTimeout(resolve,500));assert.equal(queries.length,afterClear,'Limpar cancela debounce pendente');fs.mkdirSync('artifacts/contracts-filters',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.locator('.pc04-table').screenshot({path:`artifacts/contracts-filters/table-${width}.png`});}
 await page.getByLabel('Filtrar por Prestador',{exact:true}).fill('não aplicar após logout');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await waitRows([3,2]);assert.equal(await page.getByLabel('Filtrar por Número',{exact:true}).inputValue(),'');
 assert.deepEqual(errors,[]);assert.equal(mutations,0);console.log('PASS: oito filtros automáticos, debounce, foco/cursor, combinação, busca fora da página, Enter, vazio, limpar, refresh, paginação, Abrir e reset de sessão; desktop/mobile sem escritas.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
