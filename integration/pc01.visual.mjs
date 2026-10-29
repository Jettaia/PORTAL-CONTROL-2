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
let logged=false,users=[{UsuarioId:1,Nome:user.nome,Email:user.email,Perfil:'ADMIN',Ativo:true,FuncoesJson:'[{"Codigo":"PC01_ADMIN"}]',FiliaisJson:'[]'}],failNext=false,writes=[];
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:user});}
 if(req.path==='/api/auth/logout'){logged=false;return res.json({ok:true});}
 if(!logged)return res.status(401).json({erro:'Login necessário'});
 if(req.path==='/api/auth/me')return res.json({usuario:user});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/usuarios'&&req.method==='GET')return res.json({usuarios:users,filiais:[{FilialId:1,Nome:'Filial Norte',Ativo:true},{FilialId:2,Nome:'Filial Desativada',Ativo:false}]});
 if(req.path.startsWith('/api/pc01/usuarios')&&['POST','PUT'].includes(req.method)){
  writes.push(req.body);if(failNext){failNext=false;return res.status(409).json({erro:'EMAIL_DUPLICADO'});}
  const id=req.method==='POST'?2:Number(req.path.split('/').at(-1));
  const account={UsuarioId:id,Nome:req.body.nome,Email:req.body.email,Ativo:req.body.ativo,Perfil:'GESTOR',FuncoesJson:JSON.stringify(req.body.funcoes.map(r=>({Codigo:'PC01_'+r}))),FiliaisJson:JSON.stringify(req.body.filiais.map(id=>({FilialId:id})))};
  users=users.filter(u=>u.UsuarioId!==id).concat(account);return res.status(req.method==='POST'?201:200).json({usuarioId:String(id)});
 }
 return res.status(403).json({erro:'API fora do recorte visual'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:process.env.PC01_BROWSER_CHANNEL||'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);fs.mkdirSync('artifacts/pc01',{recursive:true});
 for(const width of [1440,768]){await page.setViewportSize({width,height:1000});await page.locator('#loginBox').screenshot({path:`artifacts/pc01/login-${width}.png`});}await page.setViewportSize({width:1440,height:1000});
 await page.locator('#email').fill(user.email);await page.locator('#senha').fill('SenhaSomenteDeTeste!123');await page.locator('#loginForm button').click();
 await page.locator('[data-page=usuarios]').click();await page.locator('#pc01Users table').waitFor();
 assert.equal(await page.locator('#pc01Legacy').isVisible(),false);
 await page.locator('#pc01Nome').fill('Gestora Visual');await page.locator('#pc01Email').fill('gestora@example.test');await page.locator('#pc01Password').fill('SenhaSomenteDeTeste!123');
 await page.locator('[name=funcao][value=GESTOR]').check();await page.locator('[name=funcao][value=FINANCEIRO]').check();await page.locator('[name=filial][value="1"]').check();
 await page.locator('#pc01Save').click();await page.getByRole('button',{name:'Editar Gestora Visual',exact:true}).waitFor();
 assert.deepEqual(writes[0].funcoes,['GESTOR','FINANCEIRO']);assert.deepEqual(writes[0].filiais,[1]);assert.equal(await page.locator('#pc01Password').inputValue(),'');
 await page.getByRole('button',{name:'Editar Gestora Visual',exact:true}).click();assert.equal(await page.locator('#pc01PasswordRow').isVisible(),false);
 await page.locator('#pc01Ativo').uncheck();await page.locator('#pc01Save').click();await page.waitForFunction(()=>document.getElementById('pc01Msg').textContent.includes('Conta salva'));
 assert.equal(writes[1].ativo,false);assert.equal('senha' in writes[1],false);
 await page.locator('#pc01Nome').fill('Duplicada');await page.locator('#pc01Email').fill('admin@example.test');await page.locator('#pc01Password').fill('SenhaSomenteDeTeste!123');await page.locator('[name=funcao][value=GESTOR]').check();failNext=true;
 await page.locator('#pc01Save').click();await page.getByText('Este e-mail já está cadastrado.',{exact:true}).waitFor();assert.equal(await page.locator('#pc01Save').isEnabled(),true);assert.equal(await page.locator('[name=filial][value="2"]').isDisabled(),true);
 await page.locator('#pc01Cancel').click();fs.mkdirSync('artifacts/pc01',{recursive:true});
 for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:768,height:1024}]){await page.setViewportSize(viewport);const geometry=await page.locator('#pc01Form').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));await page.locator('#usersPage').screenshot({path:`artifacts/pc01/users-${viewport.width}.png`});}
 await page.getByRole('button',{name:'Editar '+user.nome,exact:true}).click();await page.locator('#pc01Save').click();await page.locator('#loginBox').waitFor({state:'visible'});assert.equal(await page.locator('#pc01Password').inputValue(),'');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',writes:writes.length,viewports:[1440,1024,768],scope:'UI with synthetic HTTP API; SQL not exercised'}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
