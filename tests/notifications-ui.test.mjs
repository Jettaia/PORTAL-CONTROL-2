import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

test('sininho: leitura, navegação, erro e sessão antiga em desktop/celular',async t=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let read=false,failure=false,hold=false,release;let calls=0;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let body={registros:[],depositos:[],tipos:[],prestadores:[],gestores:[],usuarios:[]};
  if(path==='/api/mfa/status')body={enabled:false};
  if(path==='/api/auth/me')body={usuario:{id:1,nome:'Administrador',perfil:'ADMIN',funcoes:['ADMIN'],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(path==='/api/pc04/contratacoes/7')body={registro:{ContratacaoId:7,Numero:17,Prestador:'João de Oliveira e Albuquerque',Deposito:'Depósito Centro',Status:'ABERTA',Versao:2,Valor:'150.00'},historico:[],solicitacoesHorarios:[{SolicitacaoId:5,Status:'PENDENTE',Solicitante:'Carlos Eduardo',Motivo:'Correção manual'}],podeOperar:false,podeAprovarHorarios:true};
  if(path==='/api/notificacoes'){
   calls++;if(hold)await new Promise(r=>release=r);
   if(failure)return route.fulfill({status:503,json:{erro:'NOTIFICACOES_INDISPONIVEIS'}});
   body={naoLidas:read?0:1,registros:[{Id:'5-SOLICITACAO',ContratacaoId:7,Numero:17,Tipo:'SOLICITACAO',Prestador:'João de Oliveira e Albuquerque',Deposito:'Depósito Centro de Distribuição',Solicitante:'Carlos Eduardo',Status:'PENDENTE',CriadoEmUtc:'2026-11-12T14:00:00.000',Lida:read}],proximaPagina:null};
  }
  if(path.endsWith('/lida')){read=true;body={ok:true};}
  await route.fulfill({json:body});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#notificationsBadge').getByText('1',{exact:true}).waitFor();
 await page.locator('#notificationsToggle').click();await page.getByRole('button',{name:/Carlos Eduardo solicitou/}).waitFor();
 const dir='artifacts/notifications-'+Date.now();fs.mkdirSync(dir,{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);const bounds=await page.locator('#notificationsPanel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);await page.screenshot({path:`${dir}/${width}.png`});}
 await page.getByRole('button',{name:'Atualizar notificações'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.notifications-tools button').disabled);await page.getByRole('button',{name:/Carlos Eduardo solicitou/}).click();
 await page.waitForURL('**/#contratacoes/7/horarios');assert.equal(read,true);assert.equal(await page.locator('#notificationsPanel').isVisible(),false);
 await page.locator('#pc04Pane_horarios').waitFor({state:'visible'});await page.keyboard.press('Escape');
 await page.locator('#notificationsToggle').click();await page.getByText('Nenhuma notificação não lida.').waitFor();
 failure=true;await page.getByRole('button',{name:'Atualizar notificações'}).click();await page.getByText('Não foi possível atualizar as notificações. Tente novamente.').waitFor();
 failure=false;await page.getByRole('button',{name:'Atualizar notificações'}).click();await page.getByText('Nenhuma notificação não lida.').waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.locator('#notificationsPanel').isVisible(),false);
 hold=true;const previous=calls;await page.locator('#notificationsToggle').click();await page.waitForFunction(()=>document.querySelector('#notificationsMessage').textContent.includes('Atualizando'));
 assert.ok(calls>previous);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));release();
 await page.waitForFunction(()=>document.querySelector('#notificationsToggle').hidden);assert.equal(await page.locator('#notificationsList').textContent(),'');
 assert.deepEqual(errors,[]);
 const hashes=Object.fromEntries(['public/index.html','public/notifications.js','public/notifications.css','public/pc04.js'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
 fs.writeFileSync(dir+'/evidence.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes,theme:'light',viewports:[{width:1440,height:900},{width:390,height:900}],data:'real portal shell, synthetic notification via intercepted HTTP',verified:['open','mark read','contract hours tab','retry after error','Escape','logout with response in flight'],errors},null,2));
});
