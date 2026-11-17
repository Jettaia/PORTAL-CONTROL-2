import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';

test('PC04: criar e editar com hora digitável preserva layout, payload e bloqueios',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'pt-BR'});page.setDefaultTimeout(4000);
 const errors=[],writes=[],means=[];page.on('pageerror',e=>errors.push(e.message));
 const record={ContratacaoId:2,Numero:2,Prestador:'Prestador de teste',DepositoId:1,Deposito:'Sumaré - Cacau Show',CentroCusto:'CC-15',PrestadorId:1,TipoServicoId:1,Tipo:'Carga e descarga',GestorResponsavelId:1,GestorResponsavel:'Gestor de teste',DataServico:'2026-11-17',InicioPrevisto:'2026-11-17T08:00',FimPrevisto:'2026-11-17T17:00',EntradaReal:null,SaidaReal:null,Valor:'180.00',Status:'ABERTA',Versao:1};
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;let body={registros:[]};
  if(path==='/api/auth/me')body={usuario:{id:1,nome:'Admin',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(path==='/api/mfa/status')body={enabled:false};
  if(path==='/api/pc04/catalogo')body={podeOperar:true,depositos:[{DepositoId:1,Nome:record.Deposito}],tipos:[{TipoServicoId:1,Nome:record.Tipo}],prestadores:[{PrestadorId:1,Nome:record.Prestador,CPF:'00000000000',DepositoId:1}],gestores:[{UsuarioId:1,Nome:record.GestorResponsavel,DepositoId:1}]};
  if(path==='/api/pc04/contratacoes')body={registros:[record],podeOperar:true};
  if(path==='/api/pc04/contratacoes/2')body={registro:record,podeOperar:true,podeRegistrarHorariosDireto:true,eventos:[]};
  if(path==='/api/pc04/media'){means.push(url.searchParams.get('dataServico'));body={media:null,quantidade:0,minimo:5};}
  if(req.method()==='POST'){
   const payload=req.postDataJSON();writes.push({path,payload});
   if(path.endsWith('/previstos')||path==='/api/pc04/contratacoes'){record.InicioPrevisto=payload.inicioPrevisto;record.FimPrevisto=payload.fimPrevisto;}
   if(path.endsWith('/horarios')){record.EntradaReal=payload.entradaReal;record.SaidaReal=payload.saidaReal;}
   body={resultado:{ContratacaoId:2}};
  }
  await route.fulfill({json:body});
 });
 const url=`http://127.0.0.1:${server.address().port}/#contratacoes`;
 await page.goto(url);await page.getByRole('button',{name:'Nova contratação',exact:true}).click();
 const dialog=page.locator('#pc04Dialog');
 const date=label=>page.getByLabel(label+' — Data',{exact:true});
 const hour=label=>page.getByRole('textbox',{name:label+' — Hora',exact:true});
 await hour('Entrada prevista').waitFor(); // Principal red: o controle atual só tem datetime-local.
 const originalHeight=await page.locator('#pc04_depositoId').evaluate(e=>e.getBoundingClientRect().height);
 assert.ok(Math.abs((await dialog.locator('.pc04-datetime-compact').first().boundingBox()).height-originalHeight)<=2);
 await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_gestorId').selectOption('1');
 await page.locator('#pc04_prestadorBusca').fill('Prestador');await page.getByRole('option',{name:/Prestador de teste/}).click();await page.locator('#pc04_valor').fill('180,00');
 await date('Entrada prevista').fill('2026-11-17');await hour('Entrada prevista').fill('24:10');await date('Saída prevista').fill('2026-11-18');await hour('Saída prevista').fill('0600');
 await page.getByRole('button',{name:'Criar contratação',exact:true}).click();assert.equal(writes.length,0);
 await hour('Entrada prevista').fill('2230');await hour('Entrada prevista').press('Tab');assert.equal(await hour('Entrada prevista').inputValue(),'22:30');
 await date('Entrada prevista').fill('');await page.getByRole('button',{name:'Criar contratação',exact:true}).click();assert.equal(writes.length,0);
 await date('Entrada prevista').fill('2026-11-16');await page.waitForFunction(()=>document.querySelector('[data-pc07-comparison]')?.textContent.startsWith('Sem base'));assert.equal(means.at(-1),'2026-11-16');await date('Entrada prevista').fill('2026-11-17');
 fs.mkdirSync('artifacts/pc04-hours',{recursive:true});await page.screenshot({path:'artifacts/pc04-hours/create-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:'artifacts/pc04-hours/create-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Criar contratação',exact:true}).click();await page.getByRole('tab',{name:'Horários',exact:true}).waitFor();
 assert.equal(writes[0].payload.inicioPrevisto,'2026-11-17T22:30');assert.equal(writes[0].payload.fimPrevisto,'2026-11-18T06:00');
 await page.getByRole('tab',{name:'Horários',exact:true}).click();assert.equal(await hour('Entrada prevista').inputValue(),'22:30');assert.equal(await date('Saída prevista').inputValue(),'2026-11-18');
 await hour('Entrada prevista').fill('0830');await page.getByRole('button',{name:'Salvar horários previstos',exact:true}).click();await page.getByText('Horários previstos atualizados.',{exact:true}).waitFor();
 assert.equal(writes.at(-1).path,'/api/pc04/contratacoes/2/previstos');assert.equal(writes.at(-1).payload.inicioPrevisto,'2026-11-17T08:30');
 await date('Entrada real').fill('2026-11-17');await hour('Entrada real').fill('0845');await date('Saída real').fill('2026-11-18');await hour('Saída real').fill('0015');await page.locator('#pc04_motivoHorario').fill('Ajuste conferido.');
 await page.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();await page.getByText('Horários manuais registrados.',{exact:true}).waitFor();assert.equal(writes.at(-1).payload.entradaReal,'2026-11-17T08:45');assert.equal(writes.at(-1).payload.saidaReal,'2026-11-18T00:15');
 await page.screenshot({path:'artifacts/pc04-hours/edit-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await dialog.locator('.pc04-dialog-body').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:'artifacts/pc04-hours/edit-mobile.png'});
 record.Status='LIBERADA';await page.reload();await page.getByRole('tab',{name:'Horários',exact:true}).click();assert.equal(await hour('Entrada prevista').isDisabled(),true);assert.equal(await hour('Entrada real').isDisabled(),true);
 assert.deepEqual(errors,[]);
});
