// Real UI/CSS, synthetic read-only HTTP. Database attribution is verified separately.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express(),record={ContratacaoId:1,Numero:3,Prestador:'Prestador Teste',Deposito:'Sumaré',Tipo:'Diária',GestorResponsavel:'Guilherme Ribeiro',DataServico:'2026-10-29',Status:'LIBERADA',Valor:'100.00',ValorLiberado:'100.00',LiberacaoBloqueada:1};
const actions=['CRIAR','TOKEN_GERAR','TOKEN_USAR','HORARIOS','HORARIO_SOL','HORARIO_APROV','HORARIO_NEGADO','REVISAR','CONFERIR','CANCELAR'];
const events=actions.map((Acao,i)=>({EventoId:i+1,Acao,CriadoEmUtc:i===8?'2026-10-30T01:00:00.000':'2026-10-29T19:42:21.932',AtorUsuarioId:1,AtorNome:'Guilherme Ribeiro',AtorCargo:i===4?'GESTOR':'ADMIN',AtorIdentificacaoHistorica:1,Motivo:i===3?'Atraso <script>window.hacked=true</script>':null}));
events.push({EventoId:11,Acao:'CRIAR',CriadoEmUtc:'2026-10-29T19:42:21.932',AtorUsuarioId:2,AtorNome:'Nome atual <img src=x onerror=alert(1)>',AtorCargo:'GESTOR',AtorIdentificacaoHistorica:0});
events.push({EventoId:12,Acao:'CRIAR',CriadoEmUtc:null,AtorUsuarioId:3,AtorNome:'Usuário não identificado',AtorCargo:null,AtorIdentificacaoHistorica:0});
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"><link rel="stylesheet" href="/jc-refinado.css"></head><body><main id="pc04Page" class="panel"><section id="pc04Panel"></section></main><script src="/pc04.js"></script></body></html>'));
app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:false}));app.get('/api/pc05/status',(_req,res)=>res.status(404).json({}));app.get('/api/pc04/contratacoes',(_req,res)=>res.json({registros:[record]}));app.get('/api/pc04/contratacoes/1',(_req,res)=>res.json({registro:record,podeOperar:false,eventos:events}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({timezoneId:'Asia/Tokyo',viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));await page.getByRole('button',{name:'Abrir 3',exact:true}).click();await page.getByRole('heading',{name:'Contratação 3',exact:true}).waitFor();
 const history=page.locator('.pc04-history');assert.equal(await history.count(),1);const entries=history.locator('li');assert.equal(await entries.count(),12);
 const labels=['Contratação criada','Token gerado','Token utilizado','Horários manuais registrados','Horários enviados para aprovação','Horários aprovados pelo ADMIN','Horários negados pelo ADMIN','Valor revisado','Liberada para pagamento','Contratação cancelada'];
 for(let i=0;i<labels.length;i++)assert.ok((await entries.nth(i).textContent()).includes(labels[i]),labels[i]);
 assert.ok((await entries.first().textContent()).includes('ADMIN'));assert.ok((await entries.first().textContent()).includes('Guilherme Ribeiro'));assert.equal(await entries.first().locator('time').textContent(),'29/10/2026 às 16:42:21');assert.equal(await entries.nth(8).locator('time').textContent(),'29/10/2026 às 22:00:00');
 assert.ok((await entries.nth(10).textContent()).includes('Identificação do cadastro atual'));assert.ok((await entries.nth(11).textContent()).includes('Perfil não informado'));assert.ok((await entries.nth(11).textContent()).includes('Data não disponível'));
 assert.ok((await entries.nth(3).textContent()).includes('Atraso <script>'));assert.equal(await history.locator('script,img').count(),0);assert.equal(await page.evaluate(()=>window.hacked),undefined);assert.ok(!(await history.textContent()).includes('Usuário 1'));
 fs.mkdirSync('artifacts/contract-history',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await history.screenshot({path:`artifacts/contract-history/history-${width}.png`});assert.ok(await history.evaluate(e=>e.scrollWidth<=e.clientWidth+2));}
 assert.deepEqual(errors,[]);console.log('Histórico UI PASS: ações PT, cargo/nome, Brasília em browser Tóquio, mudança de dia, legado/fallback, texto seguro e desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
