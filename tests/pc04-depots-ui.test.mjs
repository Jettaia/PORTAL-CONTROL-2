import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';

test('Contratações: seleção múltipla, paginação, exportação e todos em desktop/mobile',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(4000);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;let body={registros:[]};
  if(path==='/api/auth/me')body={usuario:{id:1,nome:'Admin',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(path==='/api/mfa/status')body={enabled:false};
  if(path==='/api/pc04/catalogo')body={pc04:true,podeOperar:true,depositosFiltro:[1,2,3].map(id=>({DepositoId:id,Nome:'Depósito '+id})),depositos:[],tipos:[],prestadores:[],gestores:[]};
  if(path==='/api/pc04/contratacoes'){
   requests.push(url.searchParams.toString());const ids=(url.searchParams.get('depositoIds')||'1,2,3').split(',');
   body={registros:ids.map(id=>({ContratacaoId:Number(id),Numero:id,Prestador:'Pessoa '+id,Deposito:'Depósito '+id,Status:'ABERTA',Valor:'100.00'})),proximaPagina:url.searchParams.has('antes')?null:'1'};
  }
  if(path.endsWith('/exportar.xlsx')){requests.push(url.searchParams.toString());return route.fulfill({body:'test',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers:{'Content-Disposition':'attachment; filename="contratacoes.xlsx"'}});}
  await route.fulfill({json:body});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/#contratacoes`);
 const picker=page.locator('.pc04-depot-picker');await picker.locator('summary').waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});await picker.locator('summary').click();
  await picker.getByRole('checkbox',{name:'Depósito 1',exact:true}).check();await picker.getByRole('checkbox',{name:'Depósito 2',exact:true}).check();
  await picker.getByRole('button',{name:'Aplicar depósitos',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.pc04-depot-picker summary')?.textContent==='2 depósitos selecionados');
  await page.getByRole('region',{name:'Lista de contratações'}).getByText('Pessoa 3',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByRole('region',{name:'Lista de contratações'}).getByText('Pessoa 3',{exact:true}).count(),0);
  assert.match(requests.at(-1),/depositoIds=1%2C2/);
  await page.getByRole('button',{name:'Próxima página',exact:true}).click();await page.getByRole('button',{name:'Primeira página',exact:true}).waitFor();assert.match(requests.at(-1),/depositoIds=1%2C2/);assert.match(requests.at(-1),/antes=1/);
  await picker.locator('summary').click();assert.equal(await picker.getByRole('checkbox',{name:'Depósito 2',exact:true}).isChecked(),true);
  const bounds=await picker.locator('.pc04-depot-options').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  fs.mkdirSync('artifacts/pc04-multiple-depots',{recursive:true});await page.screenshot({path:`artifacts/pc04-multiple-depots/${width}.png`});
  await picker.getByRole('checkbox',{name:'Depósito 1',exact:true}).uncheck();await picker.getByRole('button',{name:'Aplicar depósitos',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pc04-depot-picker summary')?.textContent==='Depósito 2');assert.equal(new URLSearchParams(requests.at(-1)).get('depositoIds'),'2');
  await page.getByLabel('Exportar contratações').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar em Excel',exact:true}).click();await download;assert.equal(new URLSearchParams(requests.at(-1)).get('depositoIds'),'2');
  await picker.locator('summary').click();await picker.getByRole('button',{name:'Todos os depósitos',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pc04-depot-picker summary')?.textContent==='Todos os depósitos');assert.equal(new URLSearchParams(requests.at(-1)).has('depositoIds'),false);await page.getByText('Pessoa 3',{exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);
});
