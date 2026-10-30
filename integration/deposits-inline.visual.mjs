import assert from 'node:assert/strict';
import express from 'express';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let logged=false,fail=false;const writes=[];
const depot={DepositoId:1,FilialId:1,FilialNome:'Filial Norte',Codigo:'D1',Nome:'Depósito Norte',Endereco:'Rua da filial, 10',Ativo:true};
app.all('/api/*',(req,res)=>{
 const usuario={id:1,nome:'Teste',perfil:'ADMIN',pc01:true,pc02:true,funcoes:['ADMIN']};
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario});}
 if(!logged)return res.sendStatus(401);
 if(req.path==='/api/auth/me')return res.json({usuario});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/b24a/filiais')return res.json({pc02:true,podeEditar:true,registros:[{FilialId:1,Nome:'Filial Norte',Ativo:true}]});
 if(req.path==='/api/b24c/depositos'){
  if(req.method==='GET')return res.json({registros:[depot],podeEditar:true});
  writes.push(req.body);if(fail){fail=false;return res.status(400).json({erro:'Falha de teste'});}
  assert.equal(req.body.endereco,undefined);Object.assign(depot,{Nome:req.body.nome,Ativo:req.body.ativo});return res.json({ok:true});
 }
 if(req.path==='/api/b24c/usuarios'||req.path==='/api/b24c/abrangencias')return res.json({registros:[]});
 return res.status(403).json({erro:'Fora do recorte'});
});app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#email').fill('teste@example.test');await page.locator('#senha').fill('Senha!Teste123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=depositos]').click();
 const row=page.locator('#b24cDepTable tr').filter({hasText:'D1'});await row.getByRole('button',{name:'Editar',exact:true}).click();
 await row.getByLabel('Nome do depósito').fill('Nome descartado');await row.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(writes.length,0);assert.equal(await row.getByText('Depósito Norte',{exact:true}).count(),1);
 await row.getByRole('button',{name:'Editar',exact:true}).click();await row.getByLabel('Nome do depósito').fill('Depósito atualizado');await row.getByLabel('Situação do depósito').selectOption('false');fail=true;
 await row.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByText('Falha de teste',{exact:true}).waitFor();assert.equal(await row.getByLabel('Nome do depósito').inputValue(),'Depósito atualizado');
 await row.getByRole('button',{name:'Salvar',exact:true}).click();await page.getByText('Depósito atualizado.',{exact:true}).waitFor();assert.equal(depot.Nome,'Depósito atualizado');assert.equal(depot.Ativo,false);
 assert.equal(await page.locator('#b24cEditForm,#b24cEndereco,#b24cEditEndereco').count(),0);assert.equal(await row.getByText('Rua da filial, 10',{exact:true}).count(),1);
 fs.mkdirSync('artifacts/cadastros',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await row.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#depositsPage').screenshot({path:`artifacts/cadastros/deposits-${width}.png`});await row.getByRole('button',{name:'Cancelar',exact:true}).click();}
 assert.deepEqual(errors,[]);console.log('Depósitos inline PASS: editar/cancelar/erro/salvar/endereço herdado/desktop/mobile');
}finally{await browser.close();server.close();}
