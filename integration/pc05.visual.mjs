// Production UI with synthetic HTTP. Does not certify SQL, authentication or concurrency.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(root,'playwright'));
const app=express();app.use(express.json());let authorized=false,available=true,operational=true,conflict=false,fail=false;const tokens=[];
let row={ContratacaoId:1,Numero:17,FilialId:1,Prestador:'Pessoa Norte',Filial:'Norte',Tipo:'Descarga',DataServico:'2026-10-28',InicioPrevisto:'2026-10-28T08:00',FimPrevisto:'2026-10-28T18:00',EntradaReal:null,SaidaReal:null,Valor:'150.00',Status:'ABERTA',Versao:1,CriadoPor:1,GestorResponsavel:'Gestor Norte'};
const devices=[];let entryUsed=false,blocked=false;
app.get('/api/pc05/status',(req,res)=>available?res.json({pc05:true}):res.sendStatus(404));
app.get('/api/pc04/catalogo',(req,res)=>res.json({podeOperar:operational,filiais:[],tipos:[],prestadores:[],gestores:[]}));
app.get('/api/pc04/contratacoes',(req,res)=>res.json({registros:[row],proximaPagina:null}));
app.get('/api/pc04/contratacoes/1',(req,res)=>res.json({registro:row,eventos:[],podeOperar:operational,pc05:available,entradaTokenUsada:entryUsed}));
app.post('/api/pc05/contratacoes/1/tokens',(req,res)=>{
 if(conflict){conflict=false;return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});}
 assert.equal(req.body.versao,row.Versao);tokens.push(req.body.tipo);row.Versao++;res.json({ok:true,codigo:req.body.tipo==='ENTRADA'?'12345678':'87654321',expiraEmUtc:'2026-10-28T22:00:00Z',versao:row.Versao});
});
app.get('/api/pc05/tablets',(req,res)=>res.json({registros:devices}));
app.post('/api/pc05/tablets',(req,res)=>{devices.push({TabletId:1,Nome:req.body.nome,Ativo:true,ExpiraEmUtc:'2026-10-29T00:00:00Z'});res.json({ok:true,tabletId:1,pareamento:'a'.repeat(64),expiraEmUtc:'2026-10-28T22:00:00Z'});});
app.post('/api/pc05/tablets/1/revogar',(req,res)=>{devices[0].Ativo=false;authorized=false;res.json({ok:true});});
app.post('/api/pc05/tablet/habilitar',(req,res)=>{assert.equal(req.body.pareamento,'a'.repeat(64));authorized=true;res.json({ok:true});});
app.get('/api/pc05/tablet/status',(req,res)=>authorized?res.json({ok:true}):res.status(401).json({erro:'AUTORIZACAO_TABLET_INVALIDA'}));
app.post('/api/pc05/tablet/apontar',(req,res)=>{
 if(blocked)return res.status(401).json({erro:'TABLET_BLOQUEADO'});
 if(fail)return res.status(503).json({erro:'indisponivel'});
 if(!authorized)return res.status(401).json({erro:'AUTORIZACAO_TABLET_INVALIDA'});
 if(req.body.codigo==='87654321'&&!row.EntradaReal)return res.status(409).json({erro:'ENTRADA_OBRIGATORIA'});
 if(!['12345678','87654321'].includes(req.body.codigo))return res.status(400).json({erro:'TOKEN_INVALIDO'});
 if(req.body.codigo==='12345678'){row.EntradaReal='2026-10-28T08:00';entryUsed=true;}else row.SaidaReal='2026-10-28T17:00';res.json({ok:true,mensagem:'Token aceito'});
});
app.post('/api/pc05/tablet/sair',(req,res)=>{authorized=false;res.json({ok:true});});
app.get('/visual',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"></head><body><main style="padding:20px"><section id="pc04Page"><div id="pc04Panel"></div></section></main><script>window.jettaEnsureRecentMfa=async()=>{};</script><script src="/pc04.js"></script></body></html>'));
app.get('/tablet.html',(req,res)=>res.sendFile(path.resolve('public/tablet-pc05.html')));
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true}),base=`http://127.0.0.1:${server.address().port}`;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);await page.clock.install();
 await page.goto(base+'/visual');await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 17',exact:true}).click();
 await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();await page.locator('#pc05Secret').getByText(/12345678/).waitFor();assert.equal(row.Versao,2);
 assert.equal(await page.getByRole('button',{name:'Gerar / substituir saída',exact:true}).isDisabled(),true,'exit generation requires entry consumption');assert.deepEqual(tokens,['ENTRADA']);await page.clock.fastForward(30001);assert.equal(await page.locator('#pc05Secret').textContent(),'','code expires from UI after30s');
 conflict=true;await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();await page.locator('#pc04Message').getByText(/Outra pessoa alterou/).waitFor();assert.equal(await page.locator('#pc05Secret').textContent(),'');
 await page.locator('#pc05_tabletNome').fill('Tablet recepção');await page.getByRole('button',{name:'Autorizar novo tablet',exact:true}).click();await page.locator('#pc05PairSecret').getByText('a'.repeat(64),{exact:false}).waitFor();
 const tablet=await browser.newPage({viewport:{width:768,height:1100}});tablet.on('pageerror',e=>errors.push(e.message));tablet.setDefaultTimeout(5000);await tablet.goto(base+'/tablet.html');await tablet.locator('#pairForm').waitFor({state:'visible'});await tablet.locator('#pairCode').fill('a'.repeat(64));await tablet.getByRole('button',{name:'Autorizar tablet',exact:true}).click();await tablet.locator('#operation').waitFor({state:'visible'});assert.equal(await tablet.locator('#pairCode').inputValue(),'');
 const type=async code=>{for(const digit of code)await tablet.getByRole('button',{name:digit,exact:true}).click();await tablet.getByRole('button',{name:'Confirmar token',exact:true}).click();};
 await type('87654321');await tablet.locator('#message').getByText(/Registre a entrada antes/).waitFor();assert.equal(await tablet.locator('#code').inputValue(),'');
 await type('12345678');await tablet.locator('#message').getByText('Token aceito',{exact:true}).waitFor();assert.equal(await tablet.locator('#code').inputValue(),'');
 await page.getByRole('button',{name:'Abrir 17',exact:true}).click();await page.getByRole('button',{name:'Gerar / substituir saída',exact:true}).click();await page.locator('#pc05Secret').getByText(/87654321/).waitFor();assert.deepEqual(tokens,['ENTRADA','SAIDA']);await page.locator('#pc04Page').evaluate(e=>{e.hidden=true;});await page.waitForFunction(()=>document.getElementById('pc05Secret').textContent==='');await page.locator('#pc04Page').evaluate(e=>{e.hidden=false;});await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 17',exact:true}).click();
 await tablet.reload();await tablet.locator('#operation').waitFor({state:'visible'});await type('87654321');await tablet.locator('#message').getByText('Token aceito',{exact:true}).waitFor();
 await type('00000000');await tablet.locator('#message').getByText(/inválido, expirado/).waitFor();fail=true;await type('12345678');await tablet.locator('#message').getByText(/Não foi possível confirmar/).waitFor();fail=false;
 fs.mkdirSync('artifacts/pc05',{recursive:true});for(const width of [1440,768,390]){await tablet.setViewportSize({width,height:1100});await tablet.screenshot({path:`artifacts/pc05/tablet-${width}.png`,fullPage:true});assert.ok(await tablet.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'tablet overflow '+width);}
 await page.getByRole('button',{name:'Revogar Tablet recepção',exact:true}).click();await page.locator('#pc04Message').getByText(/Autorização revogada/).waitFor();await tablet.reload();await tablet.locator('#pairForm').waitFor({state:'visible'});
 await tablet.locator('#pairCode').fill('a'.repeat(64));await tablet.getByRole('button',{name:'Autorizar tablet',exact:true}).click();await tablet.getByRole('button',{name:'Encerrar uso deste tablet',exact:true}).click();await tablet.locator('#pairForm').waitFor({state:'visible'});assert.equal(authorized,false);
 await tablet.locator('#pairCode').fill('a'.repeat(64));await tablet.getByRole('button',{name:'Autorizar tablet',exact:true}).click();blocked=true;await type('00000000');await tablet.locator('#pairForm').waitFor({state:'visible'});await tablet.locator('#message').getByText(/Solicite nova autorização ao gestor/).waitFor();blocked=false;
 await page.evaluate(()=>window.dispatchEvent(new Event('jetta:auth')));assert.equal(await page.locator('#pc05PairSecret').count(),0);assert.equal(await page.locator('#pc05Secret').count(),0);
 operational=false;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 17',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Autorizar novo tablet',exact:true}).count(),0);
 operational=true;entryUsed=false;row.SaidaReal=null;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 17',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Gerar / substituir saída',exact:true}).isDisabled(),true,'manual entry alone cannot generate exit');available=false;await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 17',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PC-05 UI PASS: generation/version/conflict, tablet enable/restore/keypad/errors/clear/revoke/end, roles, 1440/768/390. Synthetic HTTP only.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
