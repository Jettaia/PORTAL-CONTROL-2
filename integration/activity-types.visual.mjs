// Real portal + browser, synthetic HTTP contract. Does not write SQL.
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';
const app=express();app.use(express.json());
let writable=true,conflict=false,delayedResponse=null,delayNextRead=false;
let rows=[{TipoServicoId:1,Nome:'Carga',Descricao:'Carregamento de mercadorias.',Ativo:true},{TipoServicoId:2,Nome:'Descarga',Descricao:'Retirada de mercadorias.',Ativo:true},{TipoServicoId:3,Nome:'Separação',Descricao:'Separação para expedição.',Ativo:false}];
const writes=[];
app.all('/api/*',(req,res)=>{
  if(req.path==='/api/auth/me')return res.json({usuario:{id:1,nome:'Conta de teste',perfil:'ADMIN',funcoes:['ADMIN'],pc03:true},mfa:{necessarioParaAcoesSensiveis:false}});
  if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
  if(req.path==='/api/b24a/chapas')return res.json({pc03:true,podeEditar:true,adm:true,registros:[],depositos:[],vinculos:[]});
  const match=req.path.match(/^\/api\/b24a\/servicos(?:\/(\d+))?$/);
  if(match){
    if(req.method==='GET'){
      if(delayNextRead){delayNextRead=false;delayedResponse=()=>res.json({registros:rows,podeEditar:writable});return;}
      return res.json({registros:rows,podeEditar:writable});
    }
    if(!writable)return res.status(403).json({erro:'PERMISSAO_NEGADA'});
    writes.push({method:req.method,body:req.body});
    if(conflict)return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});
    const b=req.body,id=match[1]?Number(match[1]):4;
    const row={TipoServicoId:id,Nome:b.nome,Descricao:b.descricao,Ativo:b.ativo??true};
    rows=rows.filter(r=>r.TipoServicoId!==id).concat(row);return res.status(match[1]?200:201).json({resultado:row});
  }
  return res.status(403).json({erro:'Fora do escopo do teste'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(5000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#dashboard').waitFor({state:'visible'});
  await page.locator('[data-page=servicos]').click();
  await page.locator('#activityTypes .activity-row').first().waitFor();
  assert.equal(await page.locator('#activityTypes .activity-row').count(),3);
  assert.equal(await page.locator('#activityTypes .activity-row svg').count(),0);
  const colors=await page.locator('.activity-row').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));
  assert.notEqual(colors[0],colors[1]);assert.equal(colors[0],colors[2]);
  await page.locator('.activity-row').filter({hasText:'Descarga'}).click();
  assert.equal(await page.locator('#activityName').inputValue(),'Descarga');
  await page.locator('#activityDescription').fill('Descrição revisada');
  conflict=true;await page.locator('#activitySave').click();
  await page.locator('#activityMessage').filter({hasText:'REGISTRO_ALTERADO'}).waitFor();
  assert.equal(await page.locator('#activityDescription').inputValue(),'Descrição revisada');
  assert.equal(await page.locator('#activitySave').isEnabled(),true);
  conflict=false;await page.locator('#activitySave').click();
  await page.locator('#activityMessage').filter({hasText:'Alterações salvas'}).waitFor();
  assert.deepEqual(writes.at(-1),{method:'PUT',body:{nome:'Descarga',descricao:'Descrição revisada',ativo:true,original:{nome:'Descarga',descricao:'Retirada de mercadorias.',ativo:true}}});
  await page.locator('#activitySearch').fill('descarga');assert.equal(await page.locator('.activity-row').count(),1);
  assert.equal(await page.locator('.activity-row').evaluate(e=>getComputedStyle(e).backgroundColor),colors[1]);
  await page.locator('#activitySearch').fill('');await page.locator('[data-activity-filter=inativos]').click();
  assert.equal(await page.locator('.activity-row').count(),1);
  await page.locator('[data-activity-filter=todos]').click();
  await page.locator('#activityNew').click();await page.locator('#activityName').fill('Conferência');
  await page.locator('#activityDescription').fill('');await page.locator('#activitySave').click();
  await page.locator('#activityMessage').filter({hasText:'Cadastro realizado'}).waitFor();
  assert.equal(writes.at(-1).method,'POST');assert.equal(rows.find(r=>r.Nome==='Conferência').Descricao,'');
  await page.locator('[data-page=chapas]').click();assert.equal(await page.locator('#activityTypes').isVisible(),false);
  await page.locator('[data-page=servicos]').click();await page.locator('.activity-row').first().waitFor();
  fs.mkdirSync('artifacts/activity-types',{recursive:true});
  await page.screenshot({path:'artifacts/activity-types/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'artifacts/activity-types/mobile.png',fullPage:true});
  writable=false;await page.locator('#activityReload').click();
  await page.locator('#activityNew').waitFor({state:'hidden'});
  assert.equal(await page.locator('#activityForm').isVisible(),false);
  await page.locator('.activity-row').filter({hasText:'Descarga'}).click();
  assert.match(await page.locator('#activityReadOnly').textContent(),/Descrição revisada/);
  delayNextRead=true;await page.locator('#activityReload').click();
  for(let i=0;!delayedResponse&&i<100;i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(delayedResponse);
  await page.evaluate(()=>{document.getElementById('dashboard').hidden=true;window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/b24a/servicos'));delayedResponse();await pending;
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('#activityTypes').isVisible(),false);
  assert.equal(await page.locator('.activity-row').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS activity types: real UI selection, colors, search, filter, POST, PUT, conflict, permissions, navigation, mobile');
}finally{await browser.close();await new Promise(r=>server.close(r));}
