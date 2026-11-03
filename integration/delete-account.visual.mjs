// Interaction and geometry of the real frontend with a synthetic HTTP backend.
// This proves UI behavior only, never SQL authorization or persistence.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.JETTA_PLAYWRIGHT_ROOT?path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'):'playwright');
const app=express();app.use(express.json());
const user={id:1,nome:'Administradora de Teste',email:'admin@example.test',perfil:'ADMIN',pc01:true,funcoes:['ADMIN']};
let logged=false,users=[{UsuarioId:2,Nome:'Conta Excluir',Email:'excluir@example.test',Perfil:'GESTOR',Ativo:true,FuncoesJson:'[]',DepositosJson:'[]'},{UsuarioId:1,Nome:user.nome,Email:user.email,Perfil:'ADMIN',Ativo:true,FuncoesJson:'[{"Codigo":"PC01_ADMIN"}]',DepositosJson:'[]'}],failNext=false,writes=[];
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:user});}
 if(req.path==='/api/auth/logout'){logged=false;return res.json({ok:true});}
 if(!logged)return res.status(401).json({erro:'Login necessário'});
 if(req.path==='/api/auth/me')return res.json({usuario:user});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/usuarios'&&req.method==='GET')return res.json({usuarios:users,depositos:[{DepositoId:1,Nome:'Filial Norte',Ativo:true},{DepositoId:2,Nome:'Filial Desativada',Ativo:false}]});
 if(req.method==='DELETE'){writes.push({method:'DELETE',id:req.path.split('/').at(-1)});if(failNext){failNext=false;return res.status(503).json({erro:'ADMINISTRACAO_INDISPONIVEL'});}users=users.filter(u=>String(u.UsuarioId)!==req.path.split('/').at(-1));return res.json({excluido:true});}
 if(req.path==='/api/pc01/solicitacoes')return res.json({solicitacoes:[]});
 if(req.path.startsWith('/api/pc01/usuarios')&&['POST','PUT'].includes(req.method)){
  writes.push(req.body);if(failNext){failNext=false;return res.status(409).json({erro:'EMAIL_DUPLICADO'});}
  const id=req.method==='POST'?2:Number(req.path.split('/').at(-1));
  const account={UsuarioId:id,Nome:req.body.nome,Email:req.body.email,Ativo:req.body.ativo,Perfil:'GESTOR',FuncoesJson:JSON.stringify(req.body.funcoes.map(r=>({Codigo:'PC01_'+r}))),DepositosJson:JSON.stringify(req.body.depositos.map(id=>({DepositoId:id})))};
  users=users.filter(u=>u.UsuarioId!==id).concat(account);return res.status(req.method==='POST'?201:200).json({usuarioId:String(id)});
 }
 return res.status(403).json({erro:'API fora do recorte visual'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:process.env.PC01_BROWSER_CHANNEL||'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#email').fill(user.email);await page.locator('#senha').fill('SenhaTeste!123');await page.locator('#loginForm button').click();await page.locator('[data-page=usuarios]').click();
 const remove=page.getByRole('button',{name:'Excluir Conta Excluir',exact:true});await remove.waitFor();assert.equal(await remove.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(180, 35, 24)');
 assert.equal(await page.getByRole('button',{name:'Excluir '+user.nome,exact:true}).isDisabled(),true);
 page.once('dialog',d=>d.dismiss());await remove.click();assert.equal(writes.length,0);assert.equal(await remove.isVisible(),true);
 await page.getByRole('button',{name:'Editar Conta Excluir',exact:true}).click();assert.equal(await page.locator('#pc01Ativo').isVisible(),true);
 failNext=true;page.once('dialog',d=>d.accept());await remove.click();await page.getByText('Não foi possível excluir a conta. Tente novamente.',{exact:true}).waitFor();assert.equal(await remove.isEnabled(),true);assert.equal(await page.locator('#pc01Nome').inputValue(),'Conta Excluir');
 fs.mkdirSync('artifacts/delete-account',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await remove.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/delete-account/users-${width}.png`,fullPage:true});assert.equal(await remove.isEnabled(),true);assert.ok(await page.locator('#pc01Panel').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));}
 page.once('dialog',d=>d.accept());await remove.click();await page.getByText('Conta excluída. O histórico foi preservado.',{exact:true}).waitFor();assert.equal(await remove.count(),0);assert.equal(await page.locator('#pc01Nome').inputValue(),'');assert.deepEqual(writes,[{method:'DELETE',id:'2'},{method:'DELETE',id:'2'}]);assert.equal(await page.getByRole('button',{name:'Excluir '+user.nome,exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS excluir conta: cancelar, erro/repetir, sucesso, limpar editor, própria conta protegida, desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
