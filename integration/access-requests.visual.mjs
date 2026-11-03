// Real frontend interaction; HTTP fixture. Authorization/persistence covered by SQL test.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());
const user={id:1,nome:'ADM Teste',email:'admin@example.test',perfil:'ADMIN',pc01:true,funcoes:['ADMIN']};
let logged=false,requests=[],writes=[],publicFail=true,decisionFail=true;
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/acesso/solicitacoes'){writes.push(req.body);if(publicFail)return res.status(503).json({erro:'SOLICITACOES_INDISPONIVEIS'});requests.push({SolicitacaoId:requests.length+1,Nome:req.body.nome,Email:req.body.email});return res.status(202).json({ok:true});}
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:user});}
 if(!logged)return res.status(401).json({erro:'Login necessário'});
 if(req.path==='/api/auth/me')return res.json({usuario:user});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/usuarios')return res.json({usuarios:[],depositos:[{DepositoId:1,Nome:'Depósito A',Ativo:true}]});
 if(req.path==='/api/pc01/solicitacoes')return res.json({solicitacoes:requests});
 if(/^\/api\/pc01\/solicitacoes\/\d+\/(aprovar|recusar)$/.test(req.path)){
  writes.push(req.body);if(decisionFail)return res.status(409).json({erro:'OPERACAO_OCUPADA'});
  requests=requests.filter(r=>r.SolicitacaoId!==Number(req.path.split('/')[4]));return res.json({ok:true});
 }
 return res.status(403).json({erro:'Fora do recorte'});
});
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('button',{name:'Solicitar acesso',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Solicitar acesso',exact:true});await dialog.waitFor();
 await dialog.getByLabel('Nome completo').fill('Pessoa Teste');await dialog.getByLabel('E-mail',{exact:true}).fill('pessoa@example.test');
 await dialog.getByRole('button',{name:'Enviar solicitação'}).click();await dialog.getByText('Não foi possível enviar. Tente novamente.').waitFor();
 assert.equal(await dialog.getByLabel('Nome completo').inputValue(),'Pessoa Teste');publicFail=false;
 fs.mkdirSync('artifacts/access-requests',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/access-requests/request-${width}.png`,fullPage:true});assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));}
 await dialog.getByRole('button',{name:'Enviar solicitação'}).click();await dialog.getByText(/Solicitação enviada/).waitFor();assert.deepEqual(writes.at(-1),{nome:'Pessoa Teste',email:'pessoa@example.test'});
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();assert.equal(await dialog.isVisible(),false);
 await page.locator('#email').fill(user.email);await page.locator('#senha').fill('SenhaTeste!123');await page.locator('#loginForm button').click();await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-page=usuarios]').click();await page.getByRole('button',{name:'Aprovar Pessoa Teste',exact:true}).click();
 assert.equal(await page.locator('#pc01Nome').inputValue(),'Pessoa Teste');assert.equal(await page.locator('#pc01Email').evaluate(e=>e.readOnly),true);assert.equal(await page.locator('#pc01PasswordRow').isVisible(),true);
 await page.locator('#pc01Password').fill('SenhaTeste!123');await page.locator('[name=funcao][value=GESTOR]').check();await page.locator('[name=deposito][value="1"]').check();await page.locator('#pc01Save').click();await page.getByText('Outra operação está em andamento. Tente novamente.',{exact:true}).waitFor();
 assert.equal(requests.length,1);decisionFail=false;await page.locator('#pc01Password').fill('SenhaTeste!123');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/access-requests/approval-${width}.png`,fullPage:true});assert.ok(await page.locator('#pc01Form').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
 await page.locator('#pc01Save').click();await page.getByText(/Acesso aprovado/).waitFor();assert.equal(requests.length,0);assert.deepEqual(writes.at(-1).funcoes,['GESTOR']);assert.deepEqual(writes.at(-1).depositos,[1]);assert.equal(await page.locator('#pc01Password').inputValue(),'');assert.equal(await page.locator('#pc01Email').evaluate(e=>e.readOnly),false);
 requests=[{SolicitacaoId:2,Nome:'Recusar Teste',Email:'recusar@example.test'}];await page.locator('#pc01Reload').click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Recusar Recusar Teste',exact:true}).click();assert.equal(requests.length,1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Recusar Recusar Teste',exact:true}).click();await page.getByText('Solicitação recusada.',{exact:true}).waitFor();assert.equal(requests.length,0);
 assert.deepEqual(errors,[]);console.log('PASS solicitação, erro/reenvio, aprovação com senha/permissões, recusa/cancelamento, desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
