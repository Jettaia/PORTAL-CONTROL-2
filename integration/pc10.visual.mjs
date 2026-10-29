// Real PC10 DOM and handlers; synthetic HTTP isolates UI. Does not certify authorization or SQL.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const runtime=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
let balance='25.00',conflict=false;const writes=[];
const data=()=>({registro:{ContratacaoId:7,Versao:4,Status:'LIBERADA',ValorLiberado:'175.00',PagoEmUtc:'2026-10-28'},saldo:balance,podeRegularizar:true,movimentos:[{MovimentoId:1,Tipo:'PAGAMENTO',Valor:'-150.00',DataEfetiva:'2026-10-01',AtorUsuarioId:3,Motivo:'<img src=x onerror=alert(1)>',PagamentoId:9,TemAnexo:1}],pagamentosEstornaveis:[{PagamentoId:9}],documentos:[{Versao:2,Estado:'SUBSTITUIDO',ExigeNovaAssinatura:true}]});
const app=express();app.use(express.json({limit:'2mb'}));
app.get('/qa-pc10',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pc10.css"><main id="pc10Page"></main><script src="/pc10.js"></script></html>'));
app.get('/api/pc10/contratacoes/:id',(_req,res)=>res.json(data()));
app.post('/api/pc10/contratacoes/:id/regularizar',(req,res)=>{writes.push({path:req.path,body:req.body,csrf:req.get('x-jetta-request')});if(conflict)return res.status(409).json({erro:'SALDO_ALTERADO_ATUALIZE'});balance='0.00';res.status(201).json({ok:true});});
app.post('/api/pc10/pagamentos/:id/estornar',(req,res)=>{writes.push({path:req.path,body:req.body,csrf:req.get('x-jetta-request')});res.json({ok:true});});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}/qa-pc10`);
 const panel=page.locator('#pc10Page');await panel.getByLabel('Contratação (código)').fill('7');await panel.getByRole('button',{name:'Consultar',exact:true}).click();
 await panel.locator('#pc10Balance').filter({hasText:'25,00 a pagar'}).waitFor();assert.equal(await panel.locator('img').count(),0);assert.match(await panel.locator('#pc10Documents').innerText(),/Documentos até a versão 2/);assert.match(await panel.locator('#pc10Documents').innerText(),/Nova assinatura/);assert.equal(await panel.getByRole('link',{name:'Baixar comprovante do movimento 1'}).getAttribute('href'),'/api/pc10/movimentos/1/anexo');
 const file={name:'comprovante.txt',mimeType:'text/plain',buffer:Buffer.from('dinheiro entregue')};
 await panel.getByLabel('Data efetiva').fill('2026-10-02');await panel.getByLabel('Justificativa da regularização').fill('Complemento da diária');await panel.getByLabel('Comprovante').setInputFiles(file);
 fs.mkdirSync('artifacts/pc10',{recursive:true});for(const width of [1440,820,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/pc10/panel-${width}.png`,fullPage:true});assert.ok(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+2),'Overflow '+width);}
 await panel.getByRole('button',{name:'Registrar regularização'}).click();await panel.locator('#pc10Message').filter({hasText:'Regularização registrada'}).waitFor();assert.equal(writes.length,1);assert.equal(writes[0].body.valor,'25.00');assert.equal(writes[0].body.versao,4);assert.equal(writes[0].body.anexo.conteudo,file.buffer.toString('base64'));assert.equal(writes[0].csrf,'web');assert.equal(await panel.locator('#pc10Submit').isEnabled(),false);
 balance='-20.50';await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.locator('#pc10Balance').filter({hasText:'20,50 a devolver'}).waitFor();
 await panel.getByLabel('Data efetiva').fill('2026-10-02');await panel.getByLabel('Justificativa da regularização').fill('Devolução em dinheiro');await panel.getByLabel('Comprovante').setInputFiles(file);conflict=true;
 await panel.getByRole('button',{name:'Registrar regularização'}).click();await panel.locator('#pc10Message').filter({hasText:'SALDO_ALTERADO_ATUALIZE'}).waitFor();assert.equal(writes[1].body.valor,'-20.50');assert.equal(await panel.locator('#pc10Submit').isEnabled(),false);
 conflict=false;await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.getByLabel('Justificativa do estorno do grupo 9').fill('Baixa registrada por engano');await panel.getByLabel('Confirmo o estorno integral do grupo 9').check();await panel.getByRole('button',{name:'Estornar grupo 9',exact:true}).click();await panel.locator('#pc10Message').filter({hasText:'Estorno registrado'}).waitFor();assert.equal(writes.at(-1).body.motivo,'Baixa registrada por engano');assert.equal(writes.at(-1).path,'/api/pc10/pagamentos/9/estornar');
 // A pending MFA cannot write under a later identity.
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=()=>new Promise(resolve=>window.resolvePc10Mfa=resolve);});await panel.getByLabel('Data efetiva').fill('2026-10-02');await panel.getByLabel('Justificativa da regularização').fill('Outra devolução');await panel.getByLabel('Comprovante').setInputFiles(file);const before=writes.length;await panel.getByRole('button',{name:'Registrar regularização'}).click();await page.waitForFunction(()=>!!window.resolvePc10Mfa);await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));window.resolvePc10Mfa();});assert.equal(writes.length,before);assert.equal(await panel.locator('#pc10Detail').isVisible(),false);
 // Late reads must not repopulate data after logout.
 let releaseRead,started;const pending=new Promise(r=>releaseRead=r),seen=new Promise(r=>started=r);await page.route('**/api/pc10/contratacoes/7',async route=>{started();await pending;try{await route.fulfill({json:data()});}catch{}});
 await panel.getByLabel('Contratação (código)').fill('7');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await seen;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));releaseRead();assert.equal(await panel.locator('#pc10Detail').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS PC10 UI: consulta, diferenças pagar/devolver, anexo, regularização, conflito, estorno de grupo, logout/MFA e 1440/820/390. HTTP sintético.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
