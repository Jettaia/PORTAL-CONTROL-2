import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('Prestador integrado e tablet com múltiplos depósitos',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050},hasTouch:true});page.setDefaultTimeout(4000);const errors=[],writes=[];let tablets=[];
  page.on('pageerror',e=>errors.push(e.message));
  const depositos=[{DepositoId:1,Nome:'Depósito Norte',CentroCusto:'CC-101'},{DepositoId:2,Nome:'Depósito Sul',CentroCusto:'CC-202'}];
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;let body={registros:[],depositos:[],usuarios:[]};
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'Admin teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc04:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
   else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true};
   else if(p==='/api/pc04/media')body={media:null,quantidade:0,minimo:3};
   else if(p==='/api/pc05/status')body={pc05:true};
   else if(p==='/api/pc04/catalogo')body={podeOperar:true,depositos,tipos:[{TipoServicoId:1,Nome:'Descarga'}],gestores:[{UsuarioId:1,Nome:'Admin teste',DepositoId:1}],prestadores:[{PrestadorId:1,Nome:'Everton Silva',CPF:'12345678901',DepositoId:1},{PrestadorId:2,Nome:'Ana Souza',CPF:'98765432100',DepositoId:1},{PrestadorId:3,Nome:'Outro depósito',CPF:'12345678901',DepositoId:2}]};
   else if(p==='/api/pc04/contratacoes'&&req.method()==='POST'){writes.push(req.postDataJSON());body={ok:true,resultado:{ContratacaoId:1}};}
   else if(p==='/api/pc04/contratacoes/1')body={registro:{ContratacaoId:1,Numero:1,Prestador:'Everton Silva',Status:'ABERTA',Versao:1,Valor:'100.00'},eventos:[],podeOperar:true};
   else if(p==='/api/pc05/tablets'&&req.method()==='POST'||/\/tablets\/1\/cadastro$/.test(p)){
    const b=req.postDataJSON();writes.push(b);tablets=[{TabletId:1,Nome:b.nome,Depositos:depositos.filter(d=>b.depositos.includes(String(d.DepositoId))),Estado:'PENDENTE'}];body={ok:true};
   }else if(p==='/api/pc05/tablets')body={registros:tablets,depositos};
   await route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'})));
  await page.getByRole('button',{name:'Nova contratação',exact:true}).click();
  const search=page.getByRole('combobox',{name:'Prestador',exact:true});await search.waitFor();
  assert.equal(await page.getByText('Buscar prestador por nome ou CPF',{exact:true}).count(),0);
  await search.fill('ever');await page.getByRole('option',{name:/Everton Silva/}).tap();assert.equal(await search.inputValue(),'Everton Silva');
  await search.fill('');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');assert.equal(await search.inputValue(),'Ana Souza');
  await search.fill('inexistente');await page.getByText('Nenhum prestador encontrado.',{exact:true}).waitFor();assert.equal(await page.locator('#pc04_prestadorId').inputValue(),'');
  await search.fill('987.654');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await search.inputValue(),'Ana Souza');assert.equal(await page.locator('#pc04_prestadorId').inputValue(),'2');
  await page.locator('#pc04_depositoId').selectOption('2');assert.equal(await search.inputValue(),'');assert.equal(await page.locator('#pc04_prestadorId').inputValue(),'');
  await search.fill('123.456');await page.getByRole('option',{name:/Outro depósito/}).waitFor();assert.equal(await page.getByRole('option',{name:/Everton/}).count(),0);
  await page.locator('#pc04_depositoId').selectOption('1');await search.fill('ever');await page.getByRole('option',{name:/Everton/}).click();
  await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_gestorId').selectOption('1');
  await page.locator('#pc04_inicioPrevisto').fill('2026-11-12T08:00');await page.locator('#pc04_fimPrevisto').fill('2026-11-12T18:00');await page.locator('#pc04_valor').fill('100');
  fs.mkdirSync('artifacts/tablets-provider',{recursive:true});await search.fill('');await page.screenshot({path:'artifacts/tablets-provider/provider-desktop.png'});
  await search.fill('ever');await page.getByRole('option',{name:/Everton/}).click();await page.getByRole('button',{name:'Criar contratação',exact:true}).click();await page.getByText('Contratação criada.',{exact:true}).waitFor().catch(async e=>{console.log({writes,message:await page.locator('#pc04Message').textContent(),errors,invalid:await page.locator('#pc04Dialog input:invalid,#pc04Dialog select:invalid').evaluateAll(es=>es.map(e=>({id:e.id,value:e.value,message:e.validationMessage})))});throw e;});assert.equal(writes[0].prestadorId,'1');
  await page.getByRole('button',{name:'Fechar contratação',exact:true}).click();await page.getByRole('button',{name:'Nova contratação',exact:true}).click();await page.setViewportSize({width:390,height:844});await search.fill('ever');await page.getByRole('option',{name:/Everton/}).waitFor();await page.screenshot({path:'artifacts/tablets-provider/provider-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Escape');assert.equal(await page.locator('#pc04Dialog').isVisible(),true);await page.keyboard.press('Escape');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'tablets'})));
  await page.getByLabel('Nome do tablet',{exact:true}).fill('Portaria');await page.locator('#tabletsDepot').selectOption(['1','2']);await page.getByRole('button',{name:'Cadastrar e gerar código',exact:true}).click();await page.getByRole('button',{name:'Editar cadastro de Portaria',exact:true}).waitFor();assert.deepEqual(writes.at(-1).depositos,['1','2']);assert.match(await page.locator('#tabletsRows').textContent(),/Depósito Norte.*Depósito Sul/);
  await page.getByRole('button',{name:'Editar cadastro de Portaria',exact:true}).click();assert.deepEqual(await page.locator('#tabletsDepot').evaluate(e=>Array.from(e.selectedOptions,o=>o.value)),['1','2']);await page.locator('#tabletsDepot').selectOption(['2']);await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();await page.getByText('Cadastro salvo. A autorização anterior foi invalidada; gere um novo código para ativar novamente.',{exact:true}).waitFor();assert.deepEqual(writes.at(-1).depositos,['2']);
  await page.screenshot({path:'artifacts/tablets-provider/tablets-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:'artifacts/tablets-provider/tablets-desktop.png'});assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
