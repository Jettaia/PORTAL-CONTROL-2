import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import express from 'express';
import {chromium} from 'playwright';

test('Financeiro: menu Exportar contido e detalhe sobre o Extrato sem perder consulta',async()=>{
 const app=express();app.get('/',(_q,r)=>r.type('html').send(fs.readFileSync('public/index.html')));app.use(express.static('public'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1531,height:764}});page.setDefaultTimeout(4000);const errors=[],navigation=[];page.on('pageerror',e=>errors.push(e.message));
 const contract={ContratacaoId:4,Numero:4,Prestador:'Prestador de exemplo',Deposito:'Depósito Norte',CentroCusto:'CC-20',Tipo:'Carga',DataServico:'2026-11-10',DataCriacao:'2026-11-09T12:00:00',ValorLiberado:'100.00',ValorDevido:'100.00',ValorPago:'0.00',LiberadoEmUtc:'2026-11-10T12:00:00',Situacao:'RECIBO_GERADO',ReciboId:40,DataEmissao:'2026-11-10',Cidade:'Campinas',Estado:'SP'};
 const totals={ValorDevido:'100.00',ValorPago:'0.00',Saldo:'100.00'},provider={DepositoId:1,PrestadorId:2,Deposito:'Depósito Norte',Prestador:'Prestador de exemplo',QuantidadeContratacoes:1,CPF:'12345678900',...totals};
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url()),p=u.pathname;let body={registros:[],depositos:[],prestadores:[],usuarios:[],solicitacoes:[],proximaPagina:null};
 if(p==='/api/auth/me')body={usuario:{id:1,nome:'Operador de teste',perfil:'ADMIN',funcoes:['ADMIN'],fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
 else if(p==='/api/conta')body={fin01:true};
 else if(p.endsWith('/financeiro/catalogo'))body={depositos:[{DepositoId:1,Nome:'Depósito Norte'}],prestadores:[{PrestadorId:2,Nome:provider.Prestador}],podeOperar:true};
 else if(p==='/api/financeiro/contratacoes')body={registros:[contract],proximaPagina:null,podeOperar:true};
 else if(p.endsWith('/extrato'))body=u.searchParams.get('agrupamento')==='deposito'?{prestadores:[provider],depositos:[{DepositoId:1,Deposito:'Depósito Norte',QuantidadePrestadores:1,...totals}],totais:totals,totalRegistros:1,proximaPagina:null}:{contratacoes:[contract],totais:totals,totalRegistros:1,proximaPagina:null};
 else if(p.endsWith('/pagamento'))body={pagamento:null,anexos:[],historico:[],podeOperar:true};
 else if(/\/contratacoes\/\d+$/.test(p))body={registro:contract,podeOperar:true};
 await route.fulfill({json:body});});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#dashboard').waitFor({state:'visible'});await page.evaluate(()=>window.addEventListener('jetta:go',e=>(window.__navigations??=[]).push(e.detail)));
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'pagamentos'})));await page.locator('#fin01Rows tr[data-contract]').waitFor();
 const evidence='artifacts/financeiro-annotations-'+Date.now();fs.mkdirSync(evidence,{recursive:true});
 for(const width of [1531,390]){await page.setViewportSize({width,height:844});const menu=page.locator('.fin01-export');await menu.locator('summary').click();const panel=menu.locator('.fin01-export-menu');await panel.waitFor();const box=await panel.boundingBox();for(const button of await panel.locator('button').all()){const rect=await button.boundingBox();assert.ok(rect.x>=box.x&&rect.x+rect.width<=box.x+box.width+1,'opção contida horizontalmente');assert.ok(rect.y>=box.y&&rect.y+rect.height<=box.y+box.height+1,'opção contida verticalmente');assert.equal(await button.evaluate(e=>e.scrollWidth<=e.clientWidth),true,'texto sem corte');}assert.ok(box.x>=0&&box.x+box.width<=width);await page.screenshot({path:`${evidence}/export-${width}.png`,fullPage:true});await menu.locator('summary').click();}
 await page.setViewportSize({width:1531,height:764});await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'extratoprestador'})));await page.getByText('Extrato atualizado.',{exact:true}).waitFor();await page.getByRole('button',{name:'Expandir contratações de '+provider.Prestador,exact:true}).click();await page.getByRole('button',{name:'Detalhes da contratação 4',exact:true}).waitFor();
 const button=page.getByRole('button',{name:'Detalhes da contratação 4',exact:true});await button.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>({y:scrollY,query:document.querySelector('#fin05Filters').innerHTML,group:document.querySelector('#fin05Groups').innerHTML,nav:window.__navigations.length}));
 await button.click();await page.locator('#fin01DetailDialog[open]').waitFor();await page.locator('#fin01Detail').getByText(provider.Prestador,{exact:true}).waitFor();assert.equal(await page.locator('#fin05Page').isVisible(),true);assert.equal(await page.locator('#fin01Page').isVisible(),false);assert.equal(await page.locator('#pageHeading').innerText(),'Extrato');assert.equal(await page.evaluate(()=>window.__navigations.length),before.nav);
 await page.screenshot({path:`${evidence}/extrato-detail-1531.png`});await page.getByRole('button',{name:'Fechar detalhes',exact:true}).click();assert.deepEqual(await page.evaluate(()=>({y:scrollY,query:document.querySelector('#fin05Filters').innerHTML,group:document.querySelector('#fin05Groups').innerHTML,nav:window.__navigations.length})),before);assert.equal(await button.evaluate(e=>document.activeElement===e),true);
 await button.click();await page.locator('#fin01DetailDialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#fin01DetailDialog').getAttribute('open'),null);
 await page.setViewportSize({width:390,height:844});await button.click();await page.locator('#fin01DetailDialog[open]').waitFor();await page.locator('#fin01Detail').getByText(provider.Prestador,{exact:true}).waitFor();assert.equal(await page.locator('#fin05Page').isVisible(),true);const modalBox=await page.locator('#fin01DetailDialog').boundingBox();assert.ok(modalBox.x>=0&&modalBox.x+modalBox.width<=390);await page.screenshot({path:`${evidence}/extrato-detail-390.png`});await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'pagamentos'})));await page.locator('#fin01DetailDialog').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 const hashes={};for(const file of ['public/fin01.js','public/fin01.css','public/fin05.js'])hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(evidence+'/evidence.json',JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD']).toString().trim(),hashes,theme:'light',viewports:['1531x844 export','390x844 export','1531x764 statement modal','390x844 statement modal'],data:'synthetic released contract, real shell/modules, controlled HTTP',checks:['export options contained and unclipped','no navigation on statement detail','filters/groups/scroll/focus preserved','close/Escape/screen change'],errors},null,2));console.log('Evidence: '+evidence);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
