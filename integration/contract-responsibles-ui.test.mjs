import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('ADM escolhe gestor/coordenador e troca depósito sem manter responsável anterior',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(5000);const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  const catalog={podeOperar:true,depositos:[{DepositoId:1,Nome:'Depósito A'},{DepositoId:2,Nome:'Depósito B'}],tipos:[{TipoServicoId:1,Nome:'Diária'}],prestadores:[{PrestadorId:1,Nome:'Prestador Teste',CPF:'12345678901',DepositoId:1}],gestores:[{UsuarioId:1,Nome:'ADM',DepositoId:1},{UsuarioId:2,Nome:'Gestor A',DepositoId:1},{UsuarioId:3,Nome:'Coordenador A',DepositoId:1},{UsuarioId:4,Nome:'Coordenador B',DepositoId:2}]};
  const row={ContratacaoId:104,Numero:8,DepositoId:1,Prestador:'Prestador Teste',Deposito:'Depósito A',Tipo:'Diária',GestorResponsavelId:3,GestorResponsavel:'Coordenador A',DataServico:'2026-11-20',InicioPrevisto:'2026-11-20T08:00',FimPrevisto:'2026-11-20T17:00',Valor:'150.00',Status:'ABERTA',Versao:1};
  await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;let body={registros:[],naoLidas:0};
   if(path==='/api/auth/me')body={usuario:{id:1,nome:'ADM',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(path==='/api/mfa/status')body={enabled:false};
   else if(path==='/api/pc04/catalogo')body=catalog;
   else if(path==='/api/pc04/contratacoes'&&req.method()==='POST'){writes.push(req.postDataJSON());body={resultado:row};}
   else if(path==='/api/pc04/contratacoes')body={registros:writes.length?[row]:[]};
   else if(path==='/api/pc04/contratacoes/104')body={registro:row,podeOperar:true,eventos:[]};
   else if(path==='/api/pc04/media')body={media:null,quantidade:0,minimo:3};
   await route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/#contratacoes`);
  await page.getByRole('button',{name:'Nova contratação',exact:true}).click();
  const manager=page.locator('#pc04_gestorId'),depot=page.locator('#pc04_depositoId');
  assert.deepEqual(await manager.locator('option').allTextContents(),['Selecione','ADM','Gestor A','Coordenador A']);
  await manager.selectOption('3');await depot.selectOption('2');assert.equal(await manager.inputValue(),'');
  assert.deepEqual(await manager.locator('option').allTextContents(),['Selecione','Coordenador B']);
  await depot.selectOption('1');await manager.selectOption('3');
  await page.locator('#pc04_prestadorBusca').fill('Prestador');await page.getByRole('option',{name:/Prestador Teste/}).click();
  await page.locator('#pc04_tipoServicoId').selectOption('1');
  await page.locator('#pc04_inicioPrevisto_date').fill('2026-11-20');await page.locator('#pc04_inicioPrevisto_time').fill('08:00');
  await page.locator('#pc04_fimPrevisto_date').fill('2026-11-20');await page.locator('#pc04_fimPrevisto_time').fill('17:00');
  await page.locator('#pc04_valor').fill('150,00');await page.getByRole('button',{name:'Criar contratação',exact:true}).click();
  await page.getByText('Contratação criada.',{exact:true}).waitFor();assert.equal(writes.length,1);assert.equal(writes[0].gestorId,'3');assert.equal(writes[0].depositoId,'1');assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
