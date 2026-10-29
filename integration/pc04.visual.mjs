// Real production PC-04 DOM and user actions, synthetic HTTP only; no SQL/auth certification.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(root,'playwright'));
const app=express();app.use(express.json());let logged=false;let row=null,conflict=false,finance=false,mixed=false,detailAllowed=true,paginated=false;const writes=[],events=[];
const catalog={gestores:[{UsuarioId:11,Nome:"Gestor Norte",FilialId:1},{UsuarioId:22,Nome:"Gestor Sul",FilialId:2}],filiais:[{FilialId:1,Nome:'Norte'},{FilialId:2,Nome:'Sul'}],tipos:[{TipoServicoId:1,Nome:'Descarga'}],prestadores:[{PrestadorId:7,Nome:'Pessoa Norte',CPF:'12345678901',FilialId:1},{PrestadorId:8,Nome:'Pessoa Sul',CPF:'12345678902',FilialId:2}],podeOperar:true};
app.all('/api/auth/:action',(req,res)=>{if(req.params.action==='login')logged=true;if(req.params.action==='logout')logged=false;return logged?res.json({usuario:{id:1,nome:'Gestor Teste',perfil:finance?'FINANCEIRO':'GESTOR',funcoes:mixed?['GESTOR','FINANCEIRO']:[finance?'FINANCEIRO':'GESTOR'],pc01:true,pc02:true,pc03:true,pc04:true}}):res.status(req.params.action==='logout'?200:401).json({ok:true});});
app.get('/api/mfa/status',(req,res)=>res.json({enrolled:true,verified:true,stepUp:true}));
app.get('/api/pc04/catalogo',(req,res)=>res.json({...catalog,podeOperar:!finance}));
app.get('/api/pc04/contratacoes',(req,res)=>res.json(paginated?(req.query.antes?{registros:[{...row,ContratacaoId:9001,Numero:1,Prestador:'Pendência antiga'}],proximaPagina:null}:{registros:Array.from({length:200},(_,i)=>({...row,ContratacaoId:2000+i,Numero:1200-i})),proximaPagina:'1001'}):{registros:row?[row]:[],proximaPagina:null}));
app.get('/api/pc04/contratacoes/9001',(req,res)=>res.json({registro:{...row,ContratacaoId:9001,Numero:1,Prestador:'Pendência antiga'},eventos:events,podeOperar:true}));
app.get('/api/pc04/contratacoes/1',(req,res)=>res.json({registro:row,eventos:events,podeOperar:!finance&&detailAllowed}));
app.post('/api/pc04/contratacoes',(req,res)=>{writes.push(req.body);row={ContratacaoId:1,Numero:17,FilialId:req.body.filialId,PrestadorId:req.body.prestadorId,TipoServicoId:1,Prestador:'Pessoa Norte',Filial:'Norte',Tipo:'Descarga',DataServico:req.body.dataServico,InicioPrevisto:req.body.inicioPrevisto,FimPrevisto:req.body.fimPrevisto,EntradaReal:null,SaidaReal:null,Valor:req.body.valor,Status:'ABERTA',Versao:1,CriadoPor:1,ConferidoPor:null,GestorResponsavelId:req.body.gestorId,GestorResponsavel:'Gestor Norte'};events.push({Acao:'CRIAR',AtorUsuarioId:1});res.status(201).json({ok:true,resultado:row});});
app.post('/api/pc04/contratacoes/1/:action',(req,res)=>{
 writes.push(req.body);if(finance)return res.status(403).json({erro:'PERMISSAO_NEGADA'});
 if(conflict){conflict=false;return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});}assert.equal(req.body.versao,row.Versao);
 const a=req.params.action;
 if(a==='horarios')Object.assign(row,{EntradaReal:req.body.entradaReal,SaidaReal:req.body.saidaReal});
 if(a==='conferir')Object.assign(row,{Status:'LIBERADA',ConferidoPor:2,ValorLiberado:row.Valor,LiberadoEmUtc:'2026-10-28T20:00:00Z'});
 if(a==='revisar')Object.assign(row,{Status:'ABERTA',Valor:req.body.valor,ValorLiberado:null,LiberadoEmUtc:null,ConferidoPor:null});
 if(a==='cancelar')Object.assign(row,{Status:'CANCELADA',ValorLiberado:null,LiberadoEmUtc:null});
 row.Versao++;events.push({Acao:a,AtorUsuarioId:2,Motivo:req.body.motivo});res.json({ok:true,resultado:row});
});
app.get('/visual',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"></head><body><main style="padding:20px"><section id="pc04Page" class="panel"><div id="pc04Panel"></div></section></main><script src="/pc04.js"></script></body></html>'));
app.all('/api/*',(req,res)=>res.status(403).json({erro:'Fora do recorte visual'}));
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#email').fill('gestor@example.test');await page.locator('#senha').fill('SenhaTeste!123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
 const panel=page.locator('#pc04Panel');await panel.getByRole('button',{name:'Criar contratação',exact:true}).waitFor();
 await page.locator('#pc04_filialId').selectOption('2');assert.equal(await page.locator('#pc04_gestorId option').filter({hasText:'Gestor Norte'}).count(),0);assert.equal(await page.locator('#pc04_prestadorId option').filter({hasText:'Pessoa Norte'}).count(),0);await page.locator('#pc04_filialId').selectOption('1');
 await page.locator('#pc04_busca').fill('12345678901');assert.equal(await page.locator('#pc04_prestadorId option').filter({hasText:'Pessoa Sul'}).count(),0);
 assert.equal(await page.locator('#pc04_gestorId').inputValue(),'');await page.locator('#pc04_gestorId').selectOption('11');await page.locator('#pc04_prestadorId').selectOption('7');await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_dataServico').fill('2026-10-28');await page.locator('#pc04_inicioPrevisto').fill('2026-10-28T22:00');await page.locator('#pc04_fimPrevisto').fill('2026-10-29T06:00');await page.locator('#pc04_valor').fill('150,50');await panel.getByRole('button',{name:'Criar contratação',exact:true}).click();
 await panel.getByRole('heading',{name:'Contratação 17',exact:true}).waitFor();assert.equal(writes[0].valor,'150.50');assert.equal(writes[0].gestorId,'11');await panel.locator('#pc04Detail').getByText('Gestor Norte',{exact:true}).waitFor();assert.equal(row.Status,'ABERTA');
 assert.equal(await panel.getByRole('button',{name:'Conferir e liberar',exact:true}).isDisabled(),true);
 await page.locator('#pc04_entradaReal').fill('2026-10-28T22:05');await page.locator('#pc04_saidaReal').fill('2026-10-29T05:00');await page.locator('#pc04_motivoHorario').fill('Esquecimento do registro');await panel.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();await panel.getByText('Horários manuais registrados.',{exact:true}).waitFor();assert.equal(row.Valor,'150.50');
 await panel.getByRole('button',{name:'Conferir e liberar',exact:true}).click();await panel.getByText('Contratação conferida e liberada.',{exact:true}).waitFor();assert.equal(row.ValorLiberado,'150.50');
 await page.locator('#pc04_novoValor').fill('160,00');await page.locator('#pc04_motivoRevisao').fill('Complemento negociado');conflict=true;await panel.getByRole('button',{name:'Revisar valor',exact:true}).click();await panel.getByText(/Outra pessoa alterou/).waitFor();assert.equal(await page.locator('#pc04_novoValor').inputValue(),'160,00');
 await panel.getByRole('button',{name:'Revisar valor',exact:true}).click();await panel.getByText('Valor revisado. Faça nova conferência.',{exact:true}).waitFor();assert.equal(row.Status,'ABERTA');assert.equal(row.ValorLiberado,null);
 await panel.getByRole('button',{name:'Conferir e liberar',exact:true}).click();await panel.getByText('Contratação conferida e liberada.',{exact:true}).waitFor();assert.equal(row.ValorLiberado,'160.00');
 fs.mkdirSync('artifacts/pc04',{recursive:true});for(const width of [1440,768,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:`artifacts/pc04/contracts-${width}.png`,fullPage:true});assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Panel overflow '+width);}
 // Mixed GESTOR + FINANCEIRO can create locally but can only read a released contract in another branch.
 await page.setViewportSize({width:1440,height:1100});await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});mixed=true;detailAllowed=false;
 await page.locator('#email').fill('misto@example.test');await page.locator('#senha').fill('SenhaTeste!123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=contratacoes]').click();await panel.getByRole('button',{name:'Criar contratação',exact:true}).waitFor();
 await panel.getByRole('button',{name:'Abrir 17',exact:true}).click();await panel.getByRole('heading',{name:'Contratação 17',exact:true}).waitFor();
 assert.equal(await panel.getByRole('button',{name:'Salvar horários manuais',exact:true}).count(),0,'mixed role outside branch cannot edit times');assert.equal(await panel.getByRole('button',{name:'Revisar valor',exact:true}).count(),0,'mixed role outside branch cannot revise');assert.equal(await panel.getByRole('button',{name:'Cancelar contratação',exact:true}).count(),0,'mixed role outside branch cannot cancel');assert.equal(await panel.getByRole('button',{name:'Criar contratação',exact:true}).count(),1);
 detailAllowed=true;await panel.getByRole('button',{name:'Abrir 17',exact:true}).click();await panel.getByRole('button',{name:'Cancelar contratação',exact:true}).waitFor();
 await page.locator('#pc04_motivoCancelamento').fill('Serviço cancelado antes do pagamento');await panel.getByRole('button',{name:'Cancelar contratação',exact:true}).click();await panel.getByText('Contratação cancelada. Histórico preservado.',{exact:true}).waitFor();assert.equal(row.Status,'CANCELADA');assert.equal(await panel.getByRole('button',{name:'Conferir e liberar',exact:true}).count(),0);
 // 201 records: the oldest pending contract must remain discoverable beyond the first 200.
 paginated=true;await panel.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await panel.getByRole('button',{name:'Abrir 1200',exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Abrir 1',exact:true}).count(),0);
 await panel.getByRole('button',{name:'Próxima página',exact:true}).click();await panel.getByText('Pendência antiga / Norte',{exact:true}).waitFor();await panel.getByRole('button',{name:'Abrir 1',exact:true}).click();await panel.getByRole('heading',{name:'Contratação 1',exact:true}).waitFor();
 await panel.getByRole('button',{name:'Primeira página',exact:true}).click();await panel.getByRole('button',{name:'Abrir 1200',exact:true}).waitFor();assert.equal(await panel.getByRole('heading',{name:'Contratação 1',exact:true}).count(),0);paginated=false;
 await page.setViewportSize({width:1440,height:1100});await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});assert.equal(await panel.locator('#pc04Detail').textContent(),'');assert.equal(await panel.locator('form').count(),0);finance=true;await page.locator('#email').fill('financeiro@example.test');await page.locator('#senha').fill('SenhaTeste!123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('[data-page=contratacoes]').click();await panel.getByText('Consulta financeira: somente contratações liberadas.',{exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Criar contratação',exact:true}).count(),0);assert.equal(await panel.getByRole('button',{name:'Revisar valor',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',writes:writes.length,viewports:[1440,768,390],sql:false,auth:false}));
}finally{await browser.close();await new Promise(r=>server.close(r));}




