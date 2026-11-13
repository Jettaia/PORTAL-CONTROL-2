import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('Contratações: somente admin exclui paga e os demais solicitam manualmente',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(5000);const errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  let role='GESTOR',pending=[],removed=false,reject=false;
  const row={ContratacaoId:104,Numero:8,DepositoId:1,Deposito:'Campinas',CentroCusto:'CC-002',Prestador:'Ana Paula Oliveira',Tipo:'Carga e descarga',GestorResponsavel:'Bruno Costa',Valor:'180.00',ValorLiberado:'180.00',DataServico:'2026-11-13',InicioPrevisto:'2026-11-13T08:00',FimPrevisto:'2026-11-13T17:00',Status:'LIBERADA',PagoEmUtc:'2026-11-13T12:00:00',Versao:3};
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;let body={registros:[],naoLidas:0};
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'Teste',perfil:role,funcoes:[role],pc04:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(p==='/api/mfa/status')body={enabled:false};
   else if(p==='/api/pc04/catalogo')body={podeOperar:role!=='FINANCEIRO',depositos:[],depositosFiltro:[],tipos:[],prestadores:[],gestores:[]};
   else if(p==='/api/pc04/contratacoes')body={registros:removed?[]:[row],proximaPagina:null};
   else if(p==='/api/pc04/exclusoes-pendentes')body={podeExcluir:role==='ADMIN',registros:pending};
   else if(p==='/api/pc04/contratacoes/104')body={registro:row,podeOperar:true,eventos:[]};
   else if(req.method()==='POST'&&p.includes('/pc04/contratacoes/104/')){
    const data=req.postDataJSON();writes.push({path:p,...data});
    if(reject)return route.fulfill({status:409,json:{erro:'REGISTRO_ALTERADO_ATUALIZE'}});
    if(p.endsWith('/solicitar-exclusao'))pending=[{...row,SolicitacaoId:9,Solicitante:'Bruno Costa',SolicitantePerfil:role,Motivo:data.motivo}];
    else if(p.endsWith('/recusar'))pending=[];
    else if(p.endsWith('/excluir')){assert.equal(role,'ADMIN');assert.equal(data.confirmar,true);removed=true;pending=[];}
    body={ok:true,resultado:{ContratacaoId:104}};
   }
   await route.fulfill({json:body});
  });
  const open=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}/?testProfile=${role}#contratacoes`);await page.waitForSelector('tr[data-contract="104"]');};
  for(const current of ['GESTOR','COORDENADOR','FINANCEIRO']){
   role=current;await open();assert.equal(await page.getByRole('button',{name:'Excluir',exact:true}).count(),0);await page.getByRole('button',{name:'Solicitar exclusão',exact:true}).click();assert.equal(await page.locator('#pc04ExclusionDialog input[type=checkbox]').count(),0);await page.getByRole('button',{name:'Voltar',exact:true}).click();
  }
  await page.getByRole('button',{name:'Solicitar exclusão',exact:true}).click();await page.locator('#pc04ExclusionReason').fill('Registro financeiro duplicado.');await page.getByRole('button',{name:'Enviar solicitação ao admin',exact:true}).click();await page.getByRole('button',{name:'Exclusão solicitada',exact:true}).waitFor();assert.equal(removed,false);
  role='ADMIN';await open();await page.getByRole('button',{name:'Analisar e excluir',exact:true}).first().click().catch(async e=>{console.log({role,pending,message:await page.locator('#pc04Message').textContent(),buttons:await page.locator('#pc04Panel button').allTextContents(),errors});throw e;});await page.locator('#pc04ExclusionDialog').getByText('Registro financeiro duplicado.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();assert.equal(writes.length,1);
  await page.locator('#pc04ExclusionReason').fill('Validado pelo admin.');await page.locator('#pc04ExclusionConfirm').check();
  fs.mkdirSync('artifacts/contract-exclusion',{recursive:true});await page.screenshot({path:'artifacts/contract-exclusion/admin-paga-desktop.png'});
  reject=true;await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();await page.locator('#pc04ExclusionMessage').filter({hasText:/Outra pessoa alterou/}).waitFor();assert.equal(await page.locator('#pc04ExclusionDialog').isVisible(),true);assert.equal(removed,false);
  reject=false;await page.setViewportSize({width:390,height:844});await page.locator('#pc04ExclusionConfirm').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/contract-exclusion/admin-paga-mobile.png'});assert.ok(await page.locator('#pc04ExclusionDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();await page.locator('#pc04Message').filter({hasText:/registros financeiros vinculados excluídos/}).waitFor();assert.equal(await page.locator('tr[data-contract="104"]').count(),0);assert.equal(removed,true);assert.equal(writes.at(-1).solicitacaoId,'9');assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
