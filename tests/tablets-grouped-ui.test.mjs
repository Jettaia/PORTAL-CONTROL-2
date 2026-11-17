import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';

test('Tablets C: grupos, filtros, modal, CRUD e autorização mantêm um cadastro compartilhado',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(4000);const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 const depots=[{DepositoId:1,Nome:'Depósito Norte',CentroCusto:'CC-101'},{DepositoId:2,Nome:'Depósito Sul',CentroCusto:'CC-202'},{DepositoId:3,Nome:'Depósito vazio',CentroCusto:'CC-303'}];
 let rows=[{TabletId:1,Nome:'Compartilhado',Depositos:depots.slice(0,2),Estado:'ATIVO'},{TabletId:2,Nome:'Recepção',Depositos:[depots[0]],Estado:'PENDENTE'},{TabletId:3,Nome:'Legado',Estado:'REVOGADO'}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let body={registros:[],depositos:[],usuarios:[]};
  if(path==='/api/auth/me')body={usuario:{id:1,nome:'Admin teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(path==='/api/mfa/status')body={enabled:false};
  if(path==='/api/pc05/tablets')body={registros:rows,depositos:depots};
  if(req.method()==='POST'&&path.startsWith('/api/pc05/tablets')){
   const payload=req.postDataJSON(),id=Number(path.split('/')[4]),action=path.split('/')[5];writes.push({path,payload});let row=rows.find(r=>r.TabletId===id);
   if(!action){row={TabletId:4,Nome:payload.nome,Depositos:depots.filter(d=>payload.depositos.includes(String(d.DepositoId))),Estado:'PENDENTE'};rows.push(row);}
   else if(action==='cadastro')Object.assign(row,{Nome:payload.nome,Depositos:depots.filter(d=>payload.depositos.includes(String(d.DepositoId))),Estado:'CODIGO_EXPIRADO'});
   else if(action==='revogar')row.Estado='REVOGADO';
   else if(action==='excluir')rows=rows.filter(r=>r.TabletId!==id);
   else if(action==='pareamento')row.Estado='PENDENTE';
   body={ok:true,tabletId:row?.TabletId,...(!action||action==='pareamento'?{pareamento:'123-456-789'}:{})};
  }
  await route.fulfill({json:body});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/#tablets`);await page.clock.install();
 const groups=page.locator('#tabletsRows details');await groups.first().waitFor();assert.equal(await groups.count(),4);assert.equal(await page.locator('[data-tablet-id="1"]').count(),2);assert.match(await page.locator('#tabletsCounts').innerText(),/3 tablets/);
 assert.equal(await groups.filter({has:page.getByText('Depósito vazio',{exact:true})}).getAttribute('open'),null);
 await page.getByRole('button',{name:'Autorizados',exact:false}).click();assert.equal(await page.locator('[data-tablet-id="2"]').count(),0);await page.getByRole('button',{name:'Todos',exact:false}).click();
 await page.getByRole('searchbox',{name:'Buscar tablet'}).fill('CC-202');assert.equal(await page.locator('[data-tablet-id="2"]').count(),0);await page.getByRole('searchbox',{name:'Buscar tablet'}).fill('');
 await page.getByRole('button',{name:'Gerenciar Compartilhado em Depósito Sul',exact:true}).click();const dialog=page.locator('#tabletsDialog');await dialog.waitFor({state:'visible'});assert.equal(await page.locator('#tabletsDepot input:checked').count(),2);
 await page.getByLabel('Nome do tablet',{exact:true}).fill('Compartilhado atualizado');await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.getByText('Cadastro salvo. A autorização anterior foi invalidada; gere um novo código para ativar novamente.',{exact:true}).waitFor();assert.deepEqual(writes.at(-1).payload,{nome:'Compartilhado atualizado',depositos:['1','2']});assert.equal(await page.locator('#tabletsRows').getByText('Compartilhado atualizado',{exact:true}).count(),2);
 await page.getByRole('button',{name:'Gerar novo código para Compartilhado atualizado',exact:true}).click();await page.getByText('123-456-789',{exact:true}).waitFor();await page.clock.fastForward(31000);assert.equal(await page.locator('#tabletsSecret').innerText(),'');
 await page.getByRole('button',{name:'Revogar Compartilhado atualizado',exact:true}).click();await page.getByText('Autorização revogada.',{exact:true}).waitFor();assert.equal(rows[0].Estado,'REVOGADO');await page.getByRole('button',{name:'Fechar tablet',exact:true}).click();
 fs.mkdirSync('artifacts/tablets-grouped',{recursive:true});await page.screenshot({path:'artifacts/tablets-grouped/desktop.png'});
 await page.getByRole('button',{name:'Novo tablet',exact:false}).click();await page.getByLabel('Nome do tablet',{exact:true}).fill('Nova portaria');await page.getByRole('button',{name:'Cadastrar e gerar código',exact:true}).click();assert.equal(writes.length,3);await page.locator('#tabletsDepot input[value="2"]').check();await page.getByRole('button',{name:'Cadastrar e gerar código',exact:true}).click();await page.getByText('123-456-789',{exact:true}).waitFor();assert.equal(rows.length,4);
 await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(d=>d.scrollWidth>d.clientWidth),false);await page.screenshot({path:'artifacts/tablets-grouped/mobile-modal.png'});await page.getByRole('button',{name:'Fechar tablet',exact:true}).click();assert.equal(await page.locator('#tabletsSecret').innerText(),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/tablets-grouped/mobile.png'});
 await page.getByRole('button',{name:'Gerenciar Nova portaria em Depósito Sul',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Excluir Nova portaria',exact:true}).click();await page.getByText('Tablet excluído.',{exact:true}).waitFor();assert.equal(await dialog.isVisible(),false);assert.equal(rows.length,3);
 await page.getByRole('button',{name:'Gerenciar Legado em Sem depósito',exact:true}).click();assert.equal(await dialog.isVisible(),true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('#tabletsSecret').innerText(),'');assert.deepEqual(errors,[]);
});

test('Tablets C: resposta tardia de geração não reabre modal nem revela código após sair',async t=>{
 const app=express();app.get('/fixture',(_q,res)=>res.send(fs.readFileSync('public/index.html','utf8').replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g,(full,src)=>src==='/tablets.js'?full:'')));app.use(express.static('public'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 for(const mode of ['navigation','logout']){
  const page=await browser.newPage();page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let release,signal;const started=new Promise(r=>signal=r);
  await page.route('**/api/pc05/tablets**',async route=>{
   if(route.request().method()==='POST'){signal();await new Promise(r=>release=r);await route.fulfill({json:{ok:true,tabletId:1,pareamento:'123-456-789'}});return;}
   await route.fulfill({json:{depositos:[{DepositoId:1,Nome:'Norte'}],registros:[{TabletId:1,Nome:'Portaria',DepositoId:1,Deposito:'Norte',Estado:'ATIVO'}]}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>{document.getElementById('dashboard').hidden=false;document.getElementById('tabletsPage').hidden=false;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{pc05:true,perfil:'ADMIN',funcoes:['ADMIN']}}));window.dispatchEvent(new Event('jetta:tablets'));});
  await page.getByRole('button',{name:'Gerenciar Portaria em Norte',exact:true}).click();await page.getByRole('button',{name:'Gerar novo código para Portaria',exact:true}).click();await started;
  await page.evaluate(mode=>{if(mode==='logout')window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));else document.getElementById('tabletsPage').hidden=true;},mode);
  const response=page.waitForResponse(r=>r.request().method()==='POST');release();await response;assert.equal(await page.locator('#tabletsDialog').isVisible(),false);assert.equal(await page.locator('#tabletsSecret').innerText(),'');assert.deepEqual(errors,[]);await page.close();
 }
});
