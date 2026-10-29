// Production DOM, synthetic HTTP. Does not certify SQL persistence or real authentication.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),runtime=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const app=express();app.use(express.json());let mode='normal',row=null;const queries=[],writes=[];
const catalog={podeOperar:true,filiais:[{FilialId:1,Nome:'Norte'},{FilialId:2,Nome:'Sul'}],tipos:[{TipoServicoId:1,Nome:'Descarga'},{TipoServicoId:2,Nome:'Conferência'}],prestadores:[{PrestadorId:7,Nome:'Pessoa Teste',CPF:'12345678901',FilialId:1}],gestores:[{UsuarioId:11,Nome:'Gestor Norte',FilialId:1}]};
app.get('/api/pc04/catalogo',(req,res)=>res.json(catalog));
app.get('/api/pc04/contratacoes',(req,res)=>res.json({registros:row?[row]:[],proximaPagina:null}));
app.get('/api/pc04/contratacoes/7',(req,res)=>res.json({registro:row,podeOperar:true,eventos:[]}));
app.get('/api/pc04/media',async(req,res)=>{
 const q={...req.query};queries.push(q);const state=mode;
 if(state==='slow')await new Promise(r=>setTimeout(r,700));
 if(state==='error')return res.status(503).json({erro:'MEDIA_INDISPONIVEL'});
 const quantity=state==='empty'?4:5,media=q.filialId==='2'?'200.00':'100.00';
 res.json({quantidade:quantity,media:quantity<5?null:media,acima:quantity>=5&&Number(q.valor)>Number(media),janelaDias:90,limite:20,minimo:5});
});
app.post('/api/pc04/contratacoes',(req,res)=>{writes.push(req.body);row={ContratacaoId:7,Numero:17,FilialId:1,TipoServicoId:1,DataServico:req.body.dataServico,Prestador:'Pessoa Teste',Filial:'Norte',Tipo:'Descarga',Valor:req.body.valor,Status:'ABERTA',Versao:1,GestorResponsavel:'Gestor Norte',GestorResponsavelId:11,InicioPrevisto:req.body.inicioPrevisto,FimPrevisto:req.body.fimPrevisto};res.status(201).json({resultado:row});});
app.post('/api/pc04/contratacoes/7/revisar',(req,res)=>{writes.push(req.body);row={...row,Valor:req.body.valor,Versao:row.Versao+1};res.json({resultado:row});});
app.get('/visual',(req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"></head><body><main style="padding:20px"><section id="pc04Page" class="panel"><div id="pc04Panel"></div></section></main><script src="/pc04.js"></script></body></html>'));
app.all('/api/*',(req,res)=>res.status(404).json({erro:'Fora do recorte'}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}/visual`);await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc04')));
 const creation=page.locator('#pc04Panel section').filter({has:page.getByRole('heading',{name:'Nova contratação',exact:true})});
 await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_dataServico').fill('2026-10-28');await page.locator('#pc04_valor').fill('150,00');
 const comparison=creation.locator('[data-pc07-comparison]');
 await comparison.getByText(/Valor acima da média/).waitFor();assert.match(await comparison.textContent(),/100,00.*5/);
 assert.equal(await comparison.getAttribute('aria-live'),'polite');
 await page.locator('#pc04_valor').fill('100,00');await comparison.getByText(/Valor dentro da média/).waitFor();assert.ok(!(await comparison.textContent()).includes('Valor acima'));
 const below=page.waitForResponse(r=>r.url().includes('/api/pc04/media')&&r.url().includes('99.99'));await page.locator('#pc04_valor').fill('99,99');await below;await comparison.getByText(/Valor dentro da média/).waitFor();assert.equal(queries.at(-1).valor,'99.99');
 const changedType=page.waitForRequest(r=>r.url().includes('/api/pc04/media')&&r.url().includes('tipoServicoId=2'));await page.locator('#pc04_tipoServicoId').selectOption('2');await changedType;await comparison.getByText(/Valor dentro da média/).waitFor();
 const changedDate=page.waitForRequest(r=>r.url().includes('/api/pc04/media')&&r.url().includes('dataServico=2026-10-29'));await page.locator('#pc04_dataServico').fill('2026-10-29');await changedDate;await comparison.getByText(/Valor dentro da média/).waitFor();
 await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_dataServico').fill('2026-10-28');await comparison.getByText(/Valor dentro da média/).waitFor();
 const countBeforeInvalid=queries.length;await page.locator('#pc04_valor').fill('inválido');await comparison.getByText('Informe um valor válido para comparar.',{exact:true}).waitFor();await page.waitForTimeout(250);assert.equal(queries.length,countBeforeInvalid);
 mode='empty';await page.locator('#pc04_valor').fill('151,00');await comparison.getByText('Sem base para comparação',{exact:false}).waitFor();assert.ok(!(await comparison.textContent()).includes('R$ 0'));
 mode='error';await page.locator('#pc04_valor').fill('152,00');await comparison.getByText(/Não foi possível consultar a média/).waitFor();assert.ok(!(await comparison.textContent()).includes('Sem base'));
 // A completed slow response must not overwrite the newer branch context.
 mode='slow';await page.locator('#pc04_valor').fill('153,00');await page.waitForRequest(r=>r.url().includes('/api/pc04/media')&&r.url().includes('153.00'));
 mode='normal';await page.locator('#pc04_filialId').selectOption('2');await comparison.getByText(/200,00/).waitFor();await page.waitForTimeout(800);assert.match(await comparison.textContent(),/200,00/);assert.ok(!(await comparison.textContent()).includes('100,00'));
 await page.locator('#pc04_filialId').selectOption('1');await page.locator('#pc04_prestadorId').selectOption('7');await page.locator('#pc04_gestorId').selectOption('11');await page.locator('#pc04_inicioPrevisto').fill('2026-10-28T08:00');await page.locator('#pc04_fimPrevisto').fill('2026-10-28T17:00');await comparison.getByText(/Valor acima da média/).waitFor();
 fs.mkdirSync('artifacts/pc07',{recursive:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:`artifacts/pc07/average-${width}.png`,fullPage:true});assert.ok(await page.locator('#pc04Panel').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Overflow '+width);}
 // Warning is advisory: the actual native submit persists the entered amount.
 await creation.getByRole('button',{name:'Criar contratação',exact:true}).click();await page.getByRole('heading',{name:'Contratação 17',exact:true}).waitFor();assert.equal(writes[0].valor,'153.00');
 const revision=page.locator('#pc04Detail section').filter({has:page.getByRole('heading',{name:'Revisão do valor',exact:true})}),revised=revision.locator('[data-pc07-comparison]');
 await revised.getByText(/Valor acima da média/).waitFor();assert.ok(queries.some(q=>q.contratacaoId==='7'&&q.filialId==='1'&&q.tipoServicoId==='1'&&q.dataServico==='2026-10-28'));
 await page.locator('#pc04_novoValor').fill('160,00');await page.locator('#pc04_motivoRevisao').fill('Acordo revisto');await revised.getByText(/Valor acima da média/).waitFor();await revision.getByRole('button',{name:'Revisar valor',exact:true}).click();await page.getByText('Valor revisado. Faça nova conferência.',{exact:true}).waitFor();assert.equal(writes[1].valor,'160.00');
 // Technical failure also leaves submission available.
 mode='error';await page.locator('#pc04_novoValor').fill('170,00');await revised.getByText(/Não foi possível consultar a média/).waitFor();await page.locator('#pc04_motivoRevisao').fill('Revisão sem consulta');await revision.getByRole('button',{name:'Revisar valor',exact:true}).click();await page.getByText('Valor revisado. Faça nova conferência.',{exact:true}).waitFor();assert.equal(writes[2].valor,'170.00');
 // In-flight result from the old session cannot repopulate cleared UI.
 mode='slow';await page.locator('#pc04_novoValor').fill('180,00');await page.waitForRequest(r=>r.url().includes('/api/pc04/media')&&r.url().includes('180.00'));await page.evaluate(()=>window.dispatchEvent(new Event('jetta:auth')));await page.waitForTimeout(800);assert.equal(await page.locator('[data-pc07-comparison]').count(),0);assert.equal(await page.locator('#pc04Detail').textContent(),'');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',writes:writes.length,queries:queries.length,viewports:[1440,768,390],sql:false,auth:false}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
