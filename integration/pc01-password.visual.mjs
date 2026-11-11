// Real frontend interactions with a synthetic API; SQL is proved separately.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.JETTA_PLAYWRIGHT_ROOT?path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'):'playwright');
const app=express();app.use(express.json());
let role='ADMIN',logged=true,failNext=false;
const account=()=>({id:role==='ADMIN'?1:2,nome:'Pessoa Teste',email:'pessoa@example.test',perfil:role,pc01:true,funcoes:[role]});
const writes=[];
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/auth/logout'){logged=false;return res.json({ok:true});}
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:account()});}
 if(!logged)return res.status(401).json({erro:'Login necessário'});
 if(req.path==='/api/auth/me')return res.json({usuario:account()});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/usuarios'&&req.method==='GET')return role==='ADMIN'?res.json({usuarios:[{UsuarioId:2,Nome:'Gestora Teste',Email:'gestora@example.test',Perfil:'GESTOR',Ativo:true,FuncoesJson:'[]',DepositosJson:'[]'}],depositos:[]}):res.sendStatus(403);
 if(req.method==='POST'&&['/api/pc01/minha-senha','/api/pc01/usuarios/2/senha'].includes(req.path)){
  writes.push({path:req.path,...req.body});
  if(failNext){failNext=false;return res.status(400).json({erro:'SENHA_ATUAL_INCORRETA'});}
  if(req.path==='/api/pc01/minha-senha')logged=false;
  return res.json({usuarioId:String(account().id),sessoesRevogadas:true});
 }
 return res.status(403).json({erro:'Fora do recorte visual'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let browser;
try{
 browser=await chromium.launch({channel:process.env.PC01_BROWSER_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('[data-page=usuarios]').click();
 const resetButton=page.getByRole('button',{name:'Editar Gestora Teste',exact:true});
 await resetButton.waitFor({timeout:5000});
 assert.equal(await page.locator('#pc01PasswordPanel').isVisible(),false);
 await resetButton.click();
 await page.locator('#pc01PasswordOpen').click();
 assert.equal(await page.locator('#pc01PasswordDialog #pc01PasswordForm').count(),1);
 assert.equal(await page.locator('#pc01Title').textContent(),'Editar usuário');
 assert.equal(await page.locator('#pc01Email').inputValue(),'gestora@example.test');
 assert.equal(await page.locator('#pc01PasswordForm form').count(),0);
 assert.equal(await page.locator('#pc01Form #pc01PasswordForm').count(),0);
 assert.equal(await page.locator('#pc01PasswordDialog').isVisible(),true,'senha abre em popup separado');
 assert.equal(await page.locator('#pc01CurrentPasswordRow').isVisible(),false);
 assert.match(await page.locator('#pc01PasswordTitle').textContent(),/Gestora Teste/);
 fs.mkdirSync('artifacts/pc01-password',{recursive:true});
 await page.locator('#usersPage').screenshot({path:'artifacts/pc01-password/admin-reset.png'});
 await page.locator('#pc01NewPassword').fill('Aa1!bc');
 await page.locator('#pc01ConfirmPassword').fill('Aa1!bd');
 await page.locator('#pc01PasswordSave').click();
 await page.getByText('As senhas não conferem.',{exact:true}).waitFor();
 assert.equal(writes.length,0);
 await page.locator('#pc01PasswordCancel').click();
 assert.equal(await page.locator('#pc01NewPassword').inputValue(),'');
 assert.equal(await page.locator('#pc01CurrentPasswordRow').isVisible(),false);
 await page.locator('#pc01PasswordOpen').click();
 await page.locator('#pc01NewPassword').fill('Aa1!b');
 await page.locator('#pc01ConfirmPassword').fill('Aa1!b');
 await page.locator('#pc01PasswordSave').click();
 assert.equal(writes.length,0);
 await page.locator('#pc01NewPassword').fill('Aa1!bc');
 await page.locator('#pc01ConfirmPassword').fill('Aa1!bc');
 await page.locator('#pc01PasswordSave').click();
 await page.getByText('Senha alterada. As sessões anteriores dessa conta foram encerradas.',{exact:true}).waitFor();
 assert.deepEqual(writes[0],{path:'/api/pc01/usuarios/2/senha',senha:'Aa1!bc',confirmacao:'Aa1!bc'});
 assert.equal(await page.locator('#pc01NewPassword').inputValue(),'');
 assert.equal(await page.locator('#dashboard').isVisible(),true);
 role='GESTOR';await page.reload();
 await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('[data-page=usuarios]').click();
 assert.equal(await page.locator('#pc01Panel').isVisible(),false);
 await page.locator('#pc01PasswordPanel').waitFor({state:'visible'});
 assert.equal(await page.locator('#pc01PasswordPanel').isVisible(),true);
 assert.equal(await page.locator('#pc01Users button').count(),0);
 await page.locator('#pc01CurrentPassword').fill('SenhaAnterior1!');
 await page.locator('#pc01NewPassword').fill('Aa1!bc');
 await page.locator('#pc01ConfirmPassword').fill('Aa1!bc');
 failNext=true;await page.locator('#pc01PasswordSave').click();
 await page.getByText('A senha atual está incorreta.',{exact:true}).waitFor();
 assert.equal(await page.locator('#pc01PasswordSave').isEnabled(),true);
 assert.equal(await page.locator('#pc01CurrentPassword').inputValue(),'');
 assert.equal(await page.locator('#pc01NewPassword').inputValue(),'');
 fs.mkdirSync('artifacts/pc01-password',{recursive:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const box=await page.locator('#pc01PasswordForm').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(box.scroll<=box.width+1,JSON.stringify(box));
  await page.locator('#usersPage').screenshot({path:`artifacts/pc01-password/self-${width}.png`});
 }
 await page.locator('#pc01CurrentPassword').fill('SenhaAnterior1!');
 await page.locator('#pc01NewPassword').fill('Aa1!bc');
 await page.locator('#pc01ConfirmPassword').fill('Aa1!bc');
 await page.locator('#pc01PasswordSave').click();
 await page.locator('#loginBox').waitFor({state:'visible'});
 assert.deepEqual(writes[2],{path:'/api/pc01/minha-senha',senhaAtual:'SenhaAnterior1!',senha:'Aa1!bc',confirmacao:'Aa1!bc'});
 assert.equal(await page.locator('#pc01CurrentPassword').inputValue(),'');
 assert.equal(await page.locator('#pc01ConfirmPassword').inputValue(),'');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',writes:writes.length,viewports:[1440,390],scope:'Frontend real; API sintética. SQL em teste separado.'}));
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
