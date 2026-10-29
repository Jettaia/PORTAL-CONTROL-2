// Production shell/DOM with synthetic HTTP. Does not certify SQL or real authorization.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),runtime=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
let paid=false,conflict=false;const writes=[],queries=[];
const rows=[1,2,3].map(id=>({ContratacaoId:id,Numero:id,FilialId:id===2?2:1,Filial:id===2?'Sul':'Norte',Gestor:'Gestor responsável',PrestadorId:id===3?8:7,Prestador:id===3?'Outro prestador':'Pessoa Teste',Tipo:'Descarga',DataServico:'2026-10-01',Valor:'150.50',Versao:3}));
const app=express();app.use(express.json({limit:'15mb'}));
app.all('/api/auth/:action',(req,res)=>req.params.action==='logout'?res.json({ok:true}):res.json({usuario:{id:1,nome:'Financeiro Teste',perfil:'FINANCEIRO',funcoes:['FINANCEIRO'],pc01:true,pc02:true,pc03:true,pc04:true,pc08:true}}));
app.get('/api/mfa/status',(_req,res)=>res.json({enrolled:true,verified:true,stepUp:true}));
app.get('/api/pc08/painel',(req,res)=>{queries.push(req.query);res.json({registros:rows.filter(r=>!req.query.filialId||String(r.FilialId)===req.query.filialId).filter(r=>req.query.situacao==='PAGO'?paid&&r.ContratacaoId!==3:!paid||r.ContratacaoId===3).map(r=>({...r,...(paid&&r.ContratacaoId!==3?{PagoEmUtc:'2026-10-28',DataPagamento:'2026-10-02',PagamentoId:9,RegistradoPor:1,RegistradoEmUtc:'2026-10-28T12:00:00'}:{})})),proximaPagina:null});});
app.post('/api/pc08/pagamentos',(req,res)=>{writes.push(req.body);if(conflict)return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});paid=true;res.status(201).json({resultado:{PagamentoId:9}});});
app.get('/api/pc08/anexos/:id',(_req,res)=>res.send('evidencia'));
app.all('/api/*',(_req,res)=>res.status(403).json({erro:'Fora do recorte'}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Financeiro'}).click();await page.locator('[data-page=pagamentos]').click();
 const panel=page.locator('#pc08Page');await panel.getByRole('checkbox',{name:'Selecionar contratação 1',exact:true}).check();
 const file={name:'comprovante.txt',mimeType:'text/plain',buffer:Buffer.from('evidencia')};
 await panel.locator('input[type=file][data-contract="1"]').setInputFiles(file);
 await panel.getByRole('checkbox',{name:'Selecionar contratação 2',exact:true}).check();
 assert.equal(await panel.locator('input[type=file][data-contract="1"]').evaluate(n=>n.files.length),1,'Adicionar item conserva anexo já selecionado');
 await panel.locator('input[type=file][data-contract="2"]').setInputFiles({...file,name:'foto.svg',buffer:Buffer.from('<svg/>')});
 await panel.getByRole('checkbox',{name:'Selecionar contratação 3',exact:true}).click();assert.equal(await panel.getByRole('checkbox',{name:'Selecionar contratação 3',exact:true}).isChecked(),false);
 assert.match(await panel.locator('#pc08Total').innerText(),/301,00/);
 await panel.locator('[name=dataPagamento]').fill('2026-10-02');
 fs.mkdirSync('artifacts/pc08',{recursive:true});
 for(const width of [1440,820,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:`artifacts/pc08/panel-${width}.png`,fullPage:true});assert.ok(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+2),'Overflow '+width);}
 await panel.getByRole('button',{name:'Registrar pagamento integral'}).click();await panel.locator('#pc08Message').filter({hasText:'registrado integralmente'}).waitFor();assert.equal(writes.length,1);assert.equal(writes[0].itens.length,2);assert.equal(writes[0].itens[0].anexo.conteudo,file.buffer.toString('base64'));
 await panel.locator('[name=situacao]').selectOption('PAGO');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.getByRole('link',{name:'Baixar anexo'}).first().waitFor();assert.equal(await panel.getByRole('checkbox').first().isDisabled(),true);
 assert.match(await panel.locator('#pc08Rows').innerText(),/Grupo 9/);
 await panel.locator('[name=filialId]').fill('2');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#pc08Rows tr').length===1);assert.equal(queries.at(-1).filialId,'2');
 paid=false;conflict=true;await panel.locator('[name=situacao]').selectOption('ABERTO');await panel.getByRole('button',{name:'Consultar',exact:true}).click();await panel.getByRole('checkbox',{name:'Selecionar contratação 2',exact:true}).check();await panel.locator('input[type=file]').setInputFiles(file);await panel.locator('[name=dataPagamento]').fill('2026-10-02');await panel.getByRole('button',{name:'Registrar pagamento integral'}).click();await panel.locator('#pc08Message').filter({hasText:'REGISTRO_ALTERADO_ATUALIZE'}).waitFor();assert.equal(await panel.getByRole('button',{name:'Registrar pagamento integral'}).isEnabled(),true);
 // A suspended step-up cannot submit under a subsequent account.
 const priorWrites=writes.length;await page.evaluate(()=>{window.jettaEnsureRecentMfa=()=>new Promise(resolve=>window.releasePc08Mfa=resolve);});
 await panel.getByRole('button',{name:'Registrar pagamento integral'}).click();await page.waitForFunction(()=>!!window.releasePc08Mfa);
 await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));window.releasePc08Mfa();});
 await page.waitForFunction(()=>document.querySelector('#pc08Total').textContent==='Nenhuma contratação selecionada.');assert.equal(writes.length,priorWrites);assert.equal(await panel.locator('input[type=file]').count(),0);assert.equal(await panel.getByRole('checkbox').count(),0);
 // Pending read must never repopulate data after logout.
 let releaseRead;const intercepted=new Promise(resolve=>releaseRead=resolve);let seenRead;const readStarted=new Promise(resolve=>seenRead=resolve);
 await page.route('**/api/pc08/painel?*',async route=>{seenRead();await intercepted;try{await route.fulfill({json:{registros:rows,proximaPagina:null}});}catch{}});
 await panel.getByRole('button',{name:'Consultar',exact:true}).click();await readStarted;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));releaseRead();await page.unroute('**/api/pc08/painel?*');
 assert.equal(await panel.getByRole('checkbox').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS PC08: shell, seleção multi-filial, arquivos preservados, total, baixa, pagos, filtro, conflito; 1440/820/390. HTTP sintético.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

