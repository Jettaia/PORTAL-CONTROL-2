import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('Diárias: menu, grupos, seleção do dia, revisão, lote parcial, cópia e limpeza',async()=>{
 const server=express().use(express.static('public')).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const context=await browser.newContext({viewport:{width:1531,height:900},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();page.setDefaultTimeout(3500);
 const errors=[],writes=[],queries=[];page.on('pageerror',e=>errors.push(e.message));let operational=true,failList=false,lateResolve,hold=false;
 const base={DepositoId:1,Deposito:'Depósito de teste',DataServico:'2026-11-12',Status:'ABERTA',Versao:3,Tipo:'Descarga',InicioPrevisto:'2026-11-12T08:00',FimPrevisto:'2026-11-12T17:00'};
 const rows=[{...base,ContratacaoId:9,Numero:9,Prestador:'Anderson Silva'}, {...base,ContratacaoId:8,Numero:8,Prestador:'Carlos Santos',EntradaReal:'2026-11-12T08:02',EntradaTokenUsada:1}, {...base,ContratacaoId:7,Numero:7,Prestador:'Entrada manual',EntradaReal:'2026-11-12T08:00',EntradaTokenUsada:0}, {...base,ContratacaoId:6,Numero:6,Prestador:'Horários pendentes',HorarioPendenteId:12}, {...base,ContratacaoId:5,Numero:5,Prestador:'Liberado',Status:'LIBERADA'}, {...base,ContratacaoId:4,Numero:4,Prestador:'Conflito de versão'}];
 await page.addInitScript(()=>{window.__mfaCalls=0;});
 await page.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;let body={},status=200;
  if(p==='/api/auth/me')body={usuario:{id:1,nome:'Gestora de teste',perfil:operational?'GESTOR':'FINANCEIRO',funcoes:[operational?'GESTOR':'FINANCEIRO'],pc01:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
  else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true,fin01:true};
  else if(p==='/api/pc05/status')body={pc05:true};
  else if(p==='/api/notificacoes')body={registros:[],naoLidas:0,totalNaoLidas:0};
  else if(p==='/api/pc04/catalogo')body={podeOperar:operational,depositos:[{DepositoId:1,Nome:'Depósito de teste'},{DepositoId:2,Nome:'Outro depósito'}],depositosFiltro:[{DepositoId:1,Nome:'Depósito de teste'}],tipos:[],prestadores:[],gestores:[]};
  else if(p==='/api/pc04/contratacoes'){
   queries.push(Object.fromEntries(u.searchParams));
   if(failList){status=503;body={erro:'CONTRATACOES_INDISPONIVEIS'};}
   else if(u.searchParams.get('dataServico')==='2026-11-13'||u.searchParams.get('depositoId')==='2')body={registros:[],proximaPagina:null};
   else body={registros:u.searchParams.has('antes')?rows.slice(4):rows.slice(0,4),proximaPagina:u.searchParams.has('antes')?null:'6'};
  }else if(/^\/api\/pc04\/contratacoes\/\d+$/.test(p)){
   const r=rows.find(r=>String(r.ContratacaoId)===p.split('/').at(-1));body={registro:r,podeOperar:operational,pc05:true,entradaTokenUsada:r.EntradaTokenUsada===1,solicitacoesHorarios:[]};
  }else if(/^\/api\/pc05\/contratacoes\/\d+\/tokens$/.test(p)){
   const id=Number(p.split('/')[4]),posted=req.postDataJSON();writes.push({id,...posted});assert.equal(posted.versao,3);assert.equal(req.headers()['x-jetta-request'],'web');
   if(hold){await new Promise(r=>lateResolve=r);hold=false;}
   if(id===4){status=409;body={erro:'REGISTRO_ALTERADO_ATUALIZE'};}else body={codigo:id===9?'0123':'9876',versao:4,expiraEmUtc:new Date(Date.now()+3600000).toISOString()};
  }
  await route.fulfill({status,json:body});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();
 await page.locator('[data-page=diarias]').click();await page.locator('#diariasDate').fill('2026-11-12');
 const host=page.locator('#diariasPage');await host.getByText('Conflito de versão',{exact:true}).waitFor();
 assert.equal(await page.locator('#pageHeading').textContent(),'Diárias');assert.equal(await page.locator('#breadcrumb').isVisible(),false);assert.equal(await page.locator('#pageDescription').isVisible(),false);
 assert.equal(await host.getByText('Uma data. Um lote.',{exact:true}).count(),0);assert.equal(await host.getByText('PRÉVIA DE CONCEITO · DADOS FICTÍCIOS',{exact:true}).count(),0);assert.equal(await host.getByText('Seleção restrita à data e ao depósito exibidos. Alterar a data limpa o lote.',{exact:true}).count(),0);
 assert.equal(await host.locator('input[type=checkbox]').count(),6);assert.equal(await host.getByLabel('Selecionar Liberado',{exact:true}).isDisabled(),true);
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=async()=>{window.__mfaCalls++;};});
 await host.getByRole('button',{name:'Selecionar abertas do dia',exact:true}).click();assert.equal(await host.locator('input[type=checkbox]:checked').count(),5);
 assert.equal(writes.length,0);await host.getByRole('button',{name:'Gerar tokens em lote',exact:true}).click();
 const modal=page.locator('#diariasDialog');await modal.getByRole('button',{name:'Gerar 3 tokens',exact:true}).waitFor();assert.equal(writes.length,0);
 await modal.getByRole('button',{name:'Só saída',exact:true}).click();await modal.getByRole('button',{name:'Gerar 1 token',exact:true}).waitFor();
 await modal.getByRole('button',{name:'Entrada e saída',exact:true}).click();await modal.getByRole('button',{name:'Gerar 3 tokens',exact:true}).click();
 await modal.getByText('2 tokens gerados',{exact:true}).waitFor();assert.deepEqual(writes,[{id:9,versao:3,tipo:'ENTRADA'},{id:8,versao:3,tipo:'SAIDA'},{id:4,versao:3,tipo:'ENTRADA'}]);assert.ok(await page.evaluate(()=>window.__mfaCalls)>=1);
 assert.match(await modal.textContent(),/Outra pessoa alterou/);assert.equal(await modal.locator('input[readonly]').count(),2);
 await modal.getByRole('button',{name:'Copiar token de Anderson Silva',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Token de entrada: 0123');
 fs.mkdirSync('artifacts/diarias',{recursive:true});await page.screenshot({path:'artifacts/diarias/lote-desktop.png'});
 await modal.getByRole('button',{name:'Concluir',exact:true}).click();assert.equal(await modal.locator('input[readonly]').count(),0);
 await page.locator('#diariasDate').fill('2026-11-13');await host.getByText('Nenhuma contratação neste dia.',{exact:true}).waitFor();assert.equal(await host.getByRole('button',{name:'Gerar tokens em lote',exact:true}).isDisabled(),true);
 await page.locator('#diariasDate').fill('2026-11-12');await host.getByText('Anderson Silva',{exact:true}).waitFor();
 await host.getByLabel('Selecionar Anderson Silva',{exact:true}).check();await page.locator('#diariasDepot').selectOption('2');await host.getByText('Nenhuma contratação neste dia.',{exact:true}).waitFor();
 await page.locator('#diariasDepot').selectOption('1');await host.getByText('Anderson Silva',{exact:true}).waitFor();
 await page.locator('#diariasSearch').fill('Carlos');await host.getByText('Carlos Santos',{exact:true}).waitFor();assert.equal(await host.locator('input[type=checkbox]').count(),1);
 await page.locator('#diariasSearch').fill('');await page.locator('#diariasSearch').blur();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/diarias/tela-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const filterBoxes=await host.locator('.diarias-filters>label,.diarias-filters>button').evaluateAll(nodes=>nodes.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));for(let i=0;i<filterBoxes.length;i++)for(let j=i+1;j<filterBoxes.length;j++){const a=filterBoxes[i],b=filterBoxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'Filtros não se sobrepõem no mobile');}
 await page.setViewportSize({width:1531,height:900});await page.screenshot({path:'artifacts/diarias/tela-desktop.png',fullPage:true});
 // A saída do módulo interrompe o lote após a resposta já enviada; nenhum próximo POST.
 await host.getByRole('button',{name:'Selecionar abertas do dia',exact:true}).click();await host.getByRole('button',{name:'Gerar tokens em lote',exact:true}).click();await modal.getByRole('button',{name:'Gerar 3 tokens',exact:true}).waitFor();hold=true;
 await modal.getByRole('button',{name:'Gerar 3 tokens',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#diariasDialog').textContent.includes('Gerando'));
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'})));const before=writes.length;lateResolve();await page.waitForTimeout(150);assert.equal(writes.length,before);assert.equal(await modal.isVisible(),false);assert.equal(await modal.locator('input[readonly]').count(),0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'diarias'})));await host.getByText('Anderson Silva',{exact:true}).waitFor();
 failList=true;await host.getByRole('button',{name:'Atualizar',exact:true}).click();await host.getByRole('status').filter({hasText:/Não foi possível carregar/}).waitFor();assert.equal(await host.locator('input[type=checkbox]').count(),0);failList=false;
 operational=false;await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('[data-page=diarias]').isVisible(),false);assert.notEqual(await page.locator('#pageHeading').textContent(),'Diárias');
 assert.ok(queries.some(q=>q.antes==='6'&&q.dataServico==='2026-11-12'&&q.depositoId==='1'));assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
