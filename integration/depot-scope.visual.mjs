import assert from 'node:assert/strict';
import express from 'express';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let logged=false,fail=false;const writes=[],accounts=[];
const depot={DepositoId:1,Nome:'Depósito Norte',CentroCusto:'CC01',Rua:'Rua Norte',Numero:'10',Bairro:'Centro',Cidade:'Campinas',Estado:'SP',CEP:'13010000',Ativo:true};
app.all('/api/*',(req,res)=>{
 const usuario={id:1,nome:'Teste',perfil:'ADMIN',pc01:true,pc02:true,funcoes:['ADMIN']};
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario});}
 if(!logged)return res.sendStatus(401);
 if(req.path==='/api/auth/me')return res.json({usuario});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/usuarios'){
  if(req.method==='GET')return res.json({usuarios:[],depositos:[{...depot,Ativo:true}]});
  accounts.push(req.body);return res.json({ok:true});
 }
 if(req.path==='/api/b24a/depositos'||req.path.startsWith('/api/b24a/depositos/')){
  if(req.method==='GET')return res.json({pc02:true,registros:[depot],podeEditar:true});
  writes.push(req.body);if(fail){fail=false;return res.status(400).json({erro:'Falha de teste'});}
  for(const key of ['nome','centroCusto','rua','numero','bairro','cidade','estado','cep'])assert.equal(typeof req.body[key],'string',key);
  assert.equal(req.body.filialId,undefined);Object.assign(depot,Object.fromEntries(Object.entries(req.body).filter(([k])=>k!=='original').map(([k,v])=>[k==='cep'?'CEP':k[0].toUpperCase()+k.slice(1),v])));return res.json({ok:true});
 }
 if(req.path==='/api/b24c/usuarios'||req.path==='/api/b24c/abrangencias')return res.json({registros:[]});
 return res.status(403).json({erro:'Fora do recorte'});
});app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#email').fill('teste@example.test');await page.locator('#senha').fill('Senha!Teste123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=depositos]').click();
 await page.getByText('1 depósitos autorizados para consulta.',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-page=filiais]').count(),0);
 const row=page.locator('#b24cDepTable tr').filter({hasText:'Depósito Norte'});await row.getByRole('button',{name:'Editar',exact:true}).click();
 await page.locator('#b24cNome').fill('Nome descartado');await page.getByRole('button',{name:'Cancelar edição',exact:true}).click();assert.equal(writes.length,0);assert.equal(await row.getByText('Depósito Norte',{exact:true}).count(),1);
 await row.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#b24cNome').fill('Depósito atualizado');await page.locator('#b24cCentroCusto').fill('CC02');await page.locator('#b24cRua').fill('Rua Nova');await page.locator('#b24cNumero').fill('99');await page.locator('#b24cBairro').fill('Vila Nova');await page.locator('#b24cAtivo').selectOption('false');fail=true;
 await page.locator('#b24cDepForm button[type=submit]').click();await page.getByText('Falha de teste',{exact:true}).waitFor();assert.equal(await page.locator('#b24cNome').inputValue(),'Depósito atualizado');
 await page.locator('#b24cDepForm button[type=submit]').click();await page.getByText('Depósito atualizado.',{exact:true}).waitFor();assert.equal(depot.Nome,'Depósito atualizado');assert.equal(depot.CentroCusto,'CC02');assert.equal(depot.Rua,'Rua Nova');assert.equal(depot.Ativo,false);assert.equal(writes.at(-1).original.nome,'Depósito Norte');
 assert.equal(await page.locator('#b24cDepTable button').isEnabled(),true);
 fs.mkdirSync('artifacts/depot-scope',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('#depositsPage').screenshot({path:`artifacts/depot-scope/deposits-${width}.png`});}
 await page.setViewportSize({width:1440,height:1000});
 for(const [id,value]of [['Nome','Depósito Sul'],['CentroCusto','CC03'],['Rua','Rua Sul'],['Numero','7'],['Bairro','Centro'],['Cidade','Sumaré'],['Estado','SP'],['Cep','13170000']])await page.locator('#b24c'+id).fill(value);
 await page.locator('#b24cDepForm button[type=submit]').click();await page.getByText('Depósito cadastrado.',{exact:true}).waitFor();assert.equal(depot.Nome,'Depósito Sul');assert.equal(writes.at(-1).original,undefined);
 await page.locator('[data-page=usuarios]').click();await page.locator('#pc01Nome').fill('Gestor Teste');await page.locator('#pc01Email').fill('gestor@example.test');await page.locator('#pc01Password').fill('SenhaForte!123456');await page.locator('[name=funcao][value=GESTOR]').check();await page.locator('[name=deposito][value="1"]').check();await page.locator('#pc01Save').click();await page.getByText('Conta salva. As sessões anteriores foram encerradas.',{exact:true}).waitFor();assert.deepEqual(accounts.at(-1).depositos,[1]);assert.equal(accounts.at(-1).filiais,undefined);
 assert.deepEqual(errors,[]);console.log('Depósitos PASS: cadastro/campos completos, edição/cancelamento/erro, vínculo de conta e desktop/mobile (HTTP simulado)');
}finally{await browser.close();server.close();}
