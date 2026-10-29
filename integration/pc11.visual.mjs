// Real PC11 panel/navigation and print CSS; synthetic HTTP does not certify SQL/auth.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),runtime=process.env.JETTA_PLAYWRIGHT_ROOT||'C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
let rejected=false;const queries=[];
const movement={MovimentoId:1,ContratacaoId:7,Numero:17,PrestadorId:3,Prestador:'Pessoa Norte',FilialId:1,Filial:'Norte',Gestor:'Gestor Norte',Atividade:'Descarga',DataServico:'2026-10-01',DataEfetiva:'2026-10-04',RegistradoEmUtc:'2026-10-06T12:00:00',Tipo:'PAGAMENTO',Valor:'-150.00',Saldo:'25.00',PagamentoId:9,TemAnexo:1,TemAnexoPagamento:1,Recibo:null,Motivo:'<img src=x onerror=alert(1)>'};
const data=q=>({filtros:q,saldoAnterior:'175.00',saldoFinal:'25.00',totalPago:'150.00',totalAberto:'25.00',totalDevolver:'0.00',movimentos:[movement],integracaoRecibos:'PENDENTE_PC09'});
const app=express();app.use(express.json());
app.all('/api/auth/:action',(_req,res)=>res.json({usuario:{id:1,nome:'ADM Teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc11:true}}));
app.get('/api/mfa/status',(_req,res)=>res.json({enrolled:true,verified:true,stepUp:true}));
app.get('/api/pc11/extrato',(req,res)=>{queries.push(req.query);if(rejected)return res.status(400).json({erro:'PERIODO_INVALIDO'});res.json(data(req.query));});
app.get('/api/pc11/pagamentos/9',(_req,res)=>res.json({itens:[{ContratacaoId:7,Numero:17,Prestador:'Pessoa Norte',Filial:'Norte',Gestor:'Gestor Norte',Valor:'150.00',Recibo:null,TemAnexoPagamento:1}],total:'150.00'}));
app.all('/api/*',(_req,res)=>res.status(403).json({erro:'Fora do recorte'}));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Financeiro'}).click();await page.locator('[data-page=extratos]').click();const panel=page.locator('#pc11Page');await panel.waitFor({state:'visible'});
 await panel.getByLabel('Nome do prestador').fill('Pessoa');await panel.getByLabel('Filial (código)').fill('1');await panel.getByLabel('De', {exact:true}).fill('2026-10-03');await panel.getByLabel('Até', {exact:true}).fill('2026-10-20');await panel.getByRole('button',{name:'Consultar extrato',exact:true}).click();
 await panel.locator('#pc11Final').filter({hasText:'25,00'}).waitFor();assert.equal(queries.at(-1).nome,'Pessoa');assert.equal(queries.at(-1).filialId,'1');assert.equal(queries.at(-1).inicio,'2026-10-03');assert.equal(await panel.locator('img').count(),0);assert.match(await panel.locator('#pc11Applied').innerText(),/Pessoa/);
 assert.match(await panel.locator('#pc11Rows').innerText(),/2026-10-01/);assert.match(await panel.locator('#pc11Rows').innerText(),/2026-10-06T12:00:00/);assert.equal(await panel.getByRole('link',{name:'Comprovante da contratação 17'}).getAttribute('href'),'/api/pc11/contratacoes/7/anexo');assert.equal(await panel.getByRole('link',{name:'Comprovante do movimento 1'}).getAttribute('href'),'/api/pc11/movimentos/1/anexo');
 await panel.getByRole('button',{name:'Consultar grupo 9'}).click();await panel.locator('#pc11Group').filter({hasText:'150,00'}).waitFor();assert.match(await panel.locator('#pc11Group').innerText(),/17/);
 await page.evaluate(()=>{window.print=()=>window.pc11Printed=true;});await panel.getByRole('button',{name:'Imprimir / salvar PDF'}).click();assert.equal(await page.evaluate(()=>window.pc11Printed),true);
 fs.mkdirSync('artifacts/pc11',{recursive:true});
 for(const width of [1440,820,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:`artifacts/pc11/panel-${width}.png`,fullPage:true});assert.ok(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+2),'Overflow '+width);}
 await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({media:'print'});assert.equal(await panel.getByRole('button',{name:'Consultar extrato'}).isVisible(),false);assert.equal(await panel.locator('#pc11Result').isVisible(),true);assert.equal(await page.locator('#sidebar').isVisible(),false);assert.ok((await panel.boundingBox()).y<30,'Print must start at top without hidden MFA gaps');await page.pdf({path:'artifacts/pc11/extrato.pdf',format:'A4',landscape:true,printBackground:true});await page.screenshot({path:'artifacts/pc11/print.png',fullPage:true});await page.emulateMedia({media:'screen'});
 // A retained statement must stay hidden when another screen is printed.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'inicio'})));await page.emulateMedia({media:'print'});assert.equal(await panel.isVisible(),false);await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'extratos'})));await panel.waitFor({state:'visible'});
 // Editing filters must not change the applied print snapshot until a successful query.
 await panel.getByLabel('Nome do prestador').fill('Outro nome');assert.match(await panel.locator('#pc11Applied').innerText(),/Pessoa/);assert.doesNotMatch(await panel.locator('#pc11Applied').innerText(),/Outro nome/);
 rejected=true;await panel.getByRole('button',{name:'Consultar extrato'}).click();await panel.locator('#pc11Message').filter({hasText:'PERIODO_INVALIDO'}).waitFor();assert.equal(await panel.locator('#pc11Result').isVisible(),false);assert.equal(await panel.getByRole('button',{name:'Imprimir / salvar PDF'}).isEnabled(),false);rejected=false;
 await panel.getByRole('button',{name:'Consultar extrato'}).click();await panel.locator('#pc11Result').waitFor({state:'visible'});await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));assert.equal(await panel.locator('#pc11Result').isVisible(),false);assert.equal(await panel.getByLabel('Nome do prestador').inputValue(),'');
 // Pending reads cannot repopulate the panel after logout.
 let release,started;const pending=new Promise(r=>release=r),seen=new Promise(r=>started=r);await page.route('**/api/pc11/extrato*',async route=>{started();await pending;try{await route.fulfill({json:data({})});}catch{}});
 await panel.getByRole('button',{name:'Consultar extrato'}).click();await seen;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));release();assert.equal(await panel.locator('#pc11Result').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS PC11 UI: shell real, consulta/filtros, grupo, anexos, XSS, erro, logout/resposta tardia, impressão/PDF e 1440/820/390. HTTP sintético.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
