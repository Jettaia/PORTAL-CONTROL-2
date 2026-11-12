import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('F5 mantém tela, contratação e aba com dados novos; fechamento/logout limpam rota',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(4000);const errors=[],writes=[];let logged=true,denied=false,detailReads=0;
  const user={id:1,nome:'Gestor teste',perfil:'GESTOR',funcoes:['GESTOR'],pc01:true,pc04:true,pc05:true};
  const row={ContratacaoId:999,Numero:1842,DepositoId:1,PrestadorId:1,TipoServicoId:1,Prestador:'Prestador teste',Deposito:'Norte',Tipo:'Descarga',DataServico:'2026-11-12',InicioPrevisto:'2026-11-12T08:00',FimPrevisto:'2026-11-12T17:00',Valor:'100.00',Status:'ABERTA',Versao:1};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;let body={registros:[],depositos:[],usuarios:[]},status=200;
   if(req.method()!=='GET')writes.push(p);
   if(p==='/api/auth/me'){status=logged?200:401;body=logged?{usuario:user,mfa:{necessarioParaAcoesSensiveis:false}}:{erro:'SESSAO_INVALIDA'};}
   else if(p==='/api/auth/logout'){logged=false;body={ok:true};}
   else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true};
   else if(p==='/api/pc05/status')body={pc05:true};
   else if(p==='/api/pc04/catalogo')body={podeOperar:true,depositos:[{DepositoId:1,Nome:'Norte'}],prestadores:[],gestores:[],tipos:[]};
   else if(p==='/api/pc04/contratacoes')body={registros:[row]};
   else if(p==='/api/pc04/contratacoes/999'){detailReads++;status=denied?403:200;body=denied?{erro:'PERMISSAO_NEGADA'}:{registro:row,eventos:[],podeOperar:true,pc05:true,entradaTokenUsada:!!row.EntradaReal};}
   await route.fulfill({status,json:body});
  });
  const go=async name=>page.evaluate(name=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:name})),name);
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
  await go('tablets');await page.getByRole('heading',{name:'Tablets cadastrados',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Tablets cadastrados',exact:true}).waitFor();
  await go('contratacoes');await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('tab',{name:'Tokens',exact:true}).click();
  const readsBefore=detailReads;row.EntradaReal='2026-11-12T08:03:00';row.Versao=2;await page.reload();
  await page.getByRole('heading',{name:'Contratação #1842',exact:true}).waitFor().catch(async e=>{console.log({url:page.url(),errors,detailReads,message:await page.locator('#pc04Message').textContent()});throw e;});assert.equal(await page.getByRole('tab',{name:'Tokens',exact:true}).getAttribute('aria-selected'),'true');assert.ok(detailReads>readsBefore);assert.match(await page.locator('#pc04Pane_tokens').textContent(),/08:03/);
  await page.getByRole('tab',{name:'Histórico',exact:true}).click();await page.reload();assert.equal(await page.getByRole('tab',{name:'Histórico',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Fechar contratação',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Editar',exact:true}).waitFor();assert.equal(await page.locator('#pc04Dialog').isVisible(),false);
  await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('tab',{name:'Tokens',exact:true}).click();denied=true;await page.reload();await page.locator('#pc04Message').filter({hasText:/Seu acesso|permissão|não permite/i}).waitFor();assert.equal(await page.locator('#pc04Dialog').isVisible(),false);const deniedReads=detailReads;await page.reload();await page.getByRole('button',{name:'Editar',exact:true}).waitFor();assert.equal(detailReads,deniedReads);
  denied=false;await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});assert.ok(!page.url().includes('999'));
  logged=true;await page.reload();await page.locator('#homePage').waitFor({state:'visible'});
  await page.goto(`http://127.0.0.1:${server.address().port}/#invalida/999/tokens`);await page.locator('#homePage').waitFor({state:'visible'});user.pc04=false;const readsWithoutFeature=detailReads;await page.goto(`http://127.0.0.1:${server.address().port}/#contratacoes/999/tokens`);await page.locator('#homePage').waitFor({state:'visible'});assert.equal(detailReads,readsWithoutFeature);assert.deepEqual(writes,['/api/auth/logout']);assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
