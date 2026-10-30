// Real shell/panel with synthetic HTTP: proves UI orchestration, not SQL authorization.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),runtime=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const app=express();app.use(express.json());let docs=[],reject=false,posts=0,localidade='Campinas/SP';
const record={ContratacaoId:7,Numero:77,Versao:3,Status:'LIBERADA',ValorLiberado:'150.50',Tipo:'Descarga <script>',DataServico:'2026-10-01',Endereco:'Rua A - Campinas/SP'};
app.all('/api/auth/:action',(_req,res)=>res.json({usuario:{id:1,nome:'ADM Teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc09:true}}));
app.get('/api/mfa/status',(_req,res)=>res.json({enrolled:true,verified:true,stepUp:true}));
app.get('/api/pc09/contratacoes/7',(_req,res)=>reject?res.status(403).json({erro:'PERMISSAO_NEGADA'}):res.json({registro:record,documentos:docs,localidade}));
app.post('/api/pc09/contratacoes/7',(req,res)=>{posts++;assert.deepEqual(req.body,{localidade:'Campinas/SP'});docs=[{numero:'91',versao:3,estado:'ATUAL',exigeNovaAssinatura:false}];res.status(201).json({documento:{numero:'91'}});});
app.all('/api/*',(_req,res)=>res.status(403).json({erro:'Fora do recorte'}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Financeiro'}).click();await page.locator('[data-page=recibos]').click();const panel=page.locator('#pc09Page');await panel.waitFor({state:'visible'});
 await panel.getByLabel('Contratação (código)').fill('7');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.locator('#pc09Detail').waitFor({state:'visible'});
 assert.match(await panel.locator('#pc09Summary').innerText(),/150,50/);assert.equal(await panel.locator('script').count(),0);
 assert.equal(await panel.getByRole('button',{name:'Emitir recibo',exact:true}).isEnabled(),false);
 await panel.getByLabel('Confirmo a localidade Campinas/SP').check();await panel.getByRole('button',{name:'Emitir recibo',exact:true}).click();await panel.getByRole('link',{name:'Imprimir recibo 91'}).waitFor();
 assert.equal(posts,1);assert.equal(await panel.getByRole('link',{name:'Imprimir recibo 91'}).getAttribute('href'),'/api/pc09/contratacoes/7/impressao?numero=91');
 docs=[{numero:'91',versao:2,estado:'SUBSTITUIDO',exigeNovaAssinatura:true},{numero:'92',versao:3,estado:'ATUAL',exigeNovaAssinatura:true}];
 await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.getByRole('link',{name:'Imprimir recibo 92'}).waitFor();assert.match(await panel.locator('#pc09History').innerText(),/SUBSTITUIDO/);assert.match(await panel.locator('#pc09History').innerText(),/Nova assinatura/);
 fs.mkdirSync('artifacts/pc09',{recursive:true});for(const width of [1440,820,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/pc09/panel-${width}.png`,fullPage:true});assert.ok(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+2),'Overflow '+width);}
 reject=true;await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.locator('#pc09Message').filter({hasText:'PERMISSAO_NEGADA'}).waitFor();assert.equal(await panel.locator('#pc09Detail').isVisible(),false);reject=false;
 localidade=null;await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.locator('#pc09Eligibility').filter({hasText:'Corrija o endereço'}).waitFor();assert.equal(await panel.getByRole('button',{name:'Emitir recibo',exact:true}).isEnabled(),false);localidade='Campinas/SP';
 await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.locator('#pc09Detail').waitFor({state:'visible'});
 // A session change while step-up is pending must prevent the write.
 await page.evaluate(()=>{window.jettaEnsureRecentMfa=()=>{window.pc09MfaWaiting=true;return new Promise(resolve=>window.pc09ReleaseMfa=resolve);};});
 await panel.getByLabel('Confirmo a localidade Campinas/SP').check();await panel.getByRole('button',{name:'Emitir recibo',exact:true}).click();await page.waitForFunction(()=>window.pc09MfaWaiting);await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));window.pc09ReleaseMfa();});
 assert.equal(posts,1);assert.equal(await panel.locator('#pc09Detail').isVisible(),false);assert.equal(await panel.getByLabel('Contratação (código)').inputValue(),'');
 let release,started;const pending=new Promise(r=>release=r),seen=new Promise(r=>started=r);await page.route('**/api/pc09/contratacoes/7',async route=>{started();await pending;try{await route.fulfill({json:{registro:record,documentos:docs,localidade:'Campinas/SP'}});}catch{}});
 await panel.getByLabel('Contratação (código)').fill('7');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await seen;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));release();assert.equal(await panel.locator('#pc09Detail').isVisible(),false);assert.deepEqual(errors,[]);
 console.log('PASS PC09 UI: shell, consulta, confirmação, emissão/MFA, histórico/reimpressão, XSS, erro, logout/resposta tardia, 1440/820/390. HTTP sintético.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
