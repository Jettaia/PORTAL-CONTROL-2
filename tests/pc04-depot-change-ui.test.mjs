import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';

test('PC04 UI: transferir na aba própria filtra destinos e gestores e atualiza histórico',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(4000);
 const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));let events=[],linked=true;
 const row={ContratacaoId:7,Numero:3,DepositoId:1,Deposito:'Depósito 1',CentroCusto:'CC-1',Prestador:'João',PrestadorId:8,GestorResponsavelId:9,GestorResponsavel:'Gestor origem',TipoServicoId:1,Tipo:'Carga e descarga',DataServico:'2026-11-17',InicioPrevisto:'2026-11-17T08:00',FimPrevisto:'2026-11-17T17:00',Valor:'180.00',Versao:1,Status:'ABERTA'};
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={registros:[]};
  if(path==='/api/auth/me')body={usuario:{id:1,nome:'Admin',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(path==='/api/mfa/status')body={enabled:false};
  if(path==='/api/pc04/catalogo')body={podeOperar:true,depositos:[1,2,3].map(id=>({DepositoId:id,Nome:'Depósito '+id,CentroCusto:'CC-'+id})),prestadores:linked?[{PrestadorId:8,Nome:'João',DepositoId:1},{PrestadorId:8,Nome:'João',DepositoId:2},{PrestadorId:8,Nome:'João',DepositoId:4}]:[],gestores:[{UsuarioId:9,Nome:'Gestor origem',DepositoId:1},{UsuarioId:10,Nome:'Gestor destino',DepositoId:2}],tipos:[]};
  if(path==='/api/pc04/contratacoes')body={registros:[row],podeOperar:true};
  if(path==='/api/pc04/contratacoes/7')body={registro:row,podeOperar:true,eventos:events};
  if(path.endsWith('/deposito')&&req.method()==='POST'){
   const payload=req.postDataJSON();writes.push(payload);const before={...row};Object.assign(row,{DepositoId:2,Deposito:'Depósito 2',CentroCusto:'CC-2',Numero:12,GestorResponsavelId:10,GestorResponsavel:'Gestor destino',Versao:2});events=[{Acao:'DEPOSITO',AtorNome:'Admin',AtorCargo:'ADMIN',AtorIdentificacaoHistorica:true,CriadoEmUtc:'2026-11-17T13:00:00',Motivo:payload.motivo,DetalhesJson:JSON.stringify({antes:before,depositoDepois:{id:2,nome:row.Deposito,centroCusto:row.CentroCusto,numero:12}})}];body={resultado:row};
  }
  await route.fulfill({json:body});
 });
 const url=`http://127.0.0.1:${server.address().port}/#contratacoes/7/resumo`;
 await page.goto(url);const depotTab=page.getByRole('tab',{name:'Depósito',exact:true});await depotTab.click();assert.match(page.url(),/\/deposito$/);await page.locator('#pc04DepotChangeForm').waitFor();await page.reload();await depotTab.waitFor();assert.equal(await depotTab.getAttribute('aria-selected'),'true');
 const form=page.locator('#pc04DepotChangeForm');await form.waitFor();const depot=form.getByRole('combobox',{name:'Novo depósito',exact:true});
 assert.deepEqual(await depot.locator('option').evaluateAll(ns=>ns.map(n=>n.value)),['','2']);await depot.selectOption('2');
 const manager=page.getByLabel('Gestor responsável no destino',{exact:true});assert.deepEqual(await manager.locator('option').evaluateAll(ns=>ns.map(n=>n.value)),['','10']);await manager.selectOption('10');
 await page.getByRole('button',{name:'Salvar alteração de depósito',exact:true}).click();assert.equal(writes.length,0);
 await page.getByLabel('Motivo da alteração de depósito',{exact:true}).fill('Contratação criada no depósito incorreto.');
 await page.getByRole('tab',{name:'Resumo',exact:true}).click();assert.equal(await page.locator('#pc04DepotChangeForm').isVisible(),false);await depotTab.click();assert.equal(await page.getByLabel('Motivo da alteração de depósito',{exact:true}).inputValue(),'Contratação criada no depósito incorreto.');
 fs.mkdirSync('artifacts/pc04-depot-change',{recursive:true});await page.screenshot({path:'artifacts/pc04-depot-change/desktop.png'});await page.setViewportSize({width:390,height:844});await form.scrollIntoViewIfNeeded();assert.equal(await page.locator('.pc04-dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:'artifacts/pc04-depot-change/mobile.png'});
 await page.getByRole('button',{name:'Salvar alteração de depósito',exact:true}).click();await page.getByText('Depósito / centro de custo atualizado.',{exact:true}).waitFor();assert.deepEqual(writes[0],{versao:1,depositoId:'2',gestorId:'10',motivo:'Contratação criada no depósito incorreto.'});await page.getByRole('tab',{name:'Histórico',exact:true}).click();await page.getByText('Depósito / centro de custo alterado',{exact:true}).waitFor();assert.match(await page.locator('#pc04Pane_historico').innerText(),/Depósito 1.*CC-1.*3.*Depósito 2.*CC-2.*12/s);
 row.Status='LIBERADA';await page.reload();await page.getByRole('tab',{name:'Resumo',exact:true}).click();assert.equal(await page.locator('#pc04DepotChangeForm').count(),0);
 row.Status='ABERTA';linked=false;await page.reload();await depotTab.click();await page.getByText('Nenhum outro depósito disponível com acesso permitido e vínculo ativo do prestador.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Salvar alteração de depósito',exact:true}).count(),0);assert.deepEqual(errors,[]);
});
