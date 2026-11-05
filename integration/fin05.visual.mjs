import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use((req,res,next)=>{res.set('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'");next();});app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const contracts=Array.from({length:102},(_,i)=>({ContratacaoId:i+1,Numero:101+i,PrestadorId:1,Prestador:'José da Silva',DataCriacao:'2026-10-30T02:00:00',Deposito:'Sumaré',CentroCusto:'CC-19',Atividade:i===0?'<img src=x onerror=alert(1)> Descarga':'Descarga de caminhão',ValorDevido:'100.00',DataPagamento:i===0?'2026-10-31T02:00:00':null,ValorPago:i===0?'100.00':'0.00'}));
const totals={ValorDevido:'10200.00',ValorPago:'100.00',Saldo:'10100.00'};
fs.mkdirSync('artifacts/fin05',{recursive:true});
try{
 for(const perfil of ['ADMIN','FINANCEIRO','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],writes=[],queries=[];page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
  let fail=false,delayPrint=false;
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),q=Object.fromEntries(url.searchParams);if(req.method()!=='GET')writes.push(url.pathname);let body={},status=200;
   if(url.pathname==='/api/auth/me')body={usuario:{id:1,nome:'QA '+perfil,perfil,fin01:true,pc01:true,pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
   if(url.pathname==='/api/conta')body={pc01:true,pc04:true,fin01:true};
   if(url.pathname==='/api/financeiro/catalogo')body={depositos:[{DepositoId:1,Nome:'Sumaré'}],prestadores:[{PrestadorId:1,Nome:'José da Silva'},{PrestadorId:2,Nome:'Maria Souza'}]};
   if(url.pathname==='/api/financeiro/extrato'){
    queries.push(q);if(delayPrint||q.inicio==='2026-02-01')await new Promise(r=>setTimeout(r,300));
    if(fail){status=503;body={erro:'EXTRATO_INDISPONIVEL'};}
    else if(q.prestadorId){const empty=q.inicio==='2026-01-02';const filtered=q.inicio==='2026-01-01';const all=empty?[]:filtered?contracts.slice(0,1):contracts;const start=(Number(q.pagina||1)-1)*100;
     body={prestadores:[],contratacoes:all.slice(start,start+100),totais:empty?{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'}:filtered?{ValorDevido:'100.00',ValorPago:'100.00',Saldo:'0.00'}:totals,totalRegistros:all.length,proximaPagina:all.length>start+100?Number(q.pagina||1)+1:null};
    }else body={prestadores:[{PrestadorId:1,Prestador:'José da Silva',...totals},...(perfil==='GESTOR'?[]:[{PrestadorId:2,Prestador:'Maria Souza',ValorDevido:'200.00',ValorPago:'0.00',Saldo:'200.00'}])],contratacoes:[],totais:perfil==='GESTOR'?totals:{ValorDevido:'10400.00',ValorPago:'100.00',Saldo:'10300.00'},totalRegistros:perfil==='GESTOR'?1:2,proximaPagina:null};
   }
   if(url.pathname==='/api/financeiro/contratacoes')body={registros:[],proximaPagina:null};
   if(url.pathname==='/api/financeiro/contratacoes/1')body={registro:{...contracts[0],Prestador:'José da Silva',Tipo:'Descarga',ValorLiberado:'100.00',Cidade:'Sumaré',Estado:'SP',LiberadoPor:'Ana',GestorResponsavel:'Ana',Situacao:'PAGO'},podeOperar:false};
   if(url.pathname==='/api/financeiro/contratacoes/1/pagamento')body={pagamento:null,anexos:[],historico:[],podeOperar:false};
   try{await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});}catch(error){if(!page.isClosed())throw error;}
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.jettaAccount?.fin01&&!document.getElementById('dashboard').hidden);
  assert.equal(await page.locator('[data-page="extratoprestador"]').count(),1,'Menu deve oferecer Extrato por prestador');
  await page.locator('#mainNav details').filter({has:page.locator('summary').filter({hasText:'Financeiro'})}).locator('summary').click();
  const nav=page.locator('[data-page="extratoprestador"]');assert.equal(await nav.isVisible(),true);await nav.click();
  await page.getByText('Extrato atualizado.',{exact:true}).waitFor();assert.equal(await page.locator('#fin05Rows tr[data-key]').count(),perfil==='GESTOR'?1:2);
  if(perfil==='ADMIN')await page.screenshot({path:'artifacts/fin05/resumo.png',fullPage:true});
  assert.deepEqual(queries[0],{});assert.equal(await page.locator('#fin05More').isVisible(),false);
  await page.getByRole('button',{name:'Ver extrato de José da Silva',exact:true}).click();await page.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
  assert.deepEqual(await page.locator('#fin05Head th').allTextContents(),['Número da contratação','Data de criação','Depósito','Centro de custo','Descrição da atividade','Valor devido','Data do pagamento','Valor pago','Consulta']);
  for(const selector of ['#fin05Head th:first-child','#fin05Rows tr:first-child td:first-child'])assert.equal(await page.locator(selector).evaluate(e=>getComputedStyle(e).textAlign),'center','número da contratação centralizado na tela');
  assert.equal(await page.locator('#fin05Rows tr:first-child td:first-child').evaluate(e=>getComputedStyle(e).verticalAlign),'middle');
  assert.deepEqual(await page.locator('#fin05Totals dd').allTextContents(),['R$ 10.200,00','R$ 100,00','R$ 10.100,00']);
  assert.equal(await page.locator('#fin05Rows tr').first().locator('td').nth(1).innerText(),'29/10/2026');assert.equal(await page.locator('#fin05Rows tr').first().locator('td').nth(6).innerText(),'30/10/2026');
  assert.equal(await page.locator('#fin05Rows tr').nth(1).locator('td').nth(6).innerText(),'—');assert.equal(await page.locator('#fin05Rows img').count(),0);
  if(perfil==='ADMIN'){
   // Print must fetch the unloaded second page and use applied filters, not draft values.
   await page.getByLabel('Prestador do extrato',{exact:true}).selectOption('2');
   const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();const popup=await popupPromise;
   await popup.getByRole('heading',{name:'José da Silva',exact:true}).waitFor();assert.equal(await popup.locator('tbody tr').count(),102);assert.equal(await popup.locator('img,script').count(),0);
   assert.deepEqual(await popup.locator('.fin05-totals dd').allTextContents(),['R$ 10.200,00','R$ 100,00','R$ 10.100,00']);
   await popup.waitForFunction(()=>document.styleSheets.length>0);assert.equal(await popup.locator('body').evaluate(node=>getComputedStyle(node).fontFamily),'Arial, sans-serif');
   for(const media of ['screen','print']){
    await popup.emulateMedia({media});
    for(const selector of ['thead th:first-child','tbody tr:first-child td:first-child'])assert.equal(await popup.locator(selector).evaluate(e=>getComputedStyle(e).textAlign),'center','número centralizado na impressão/PDF');
    assert.equal(await popup.locator('tbody tr:first-child td:first-child').evaluate(e=>getComputedStyle(e).verticalAlign),'middle');
   }
   await popup.emulateMedia({media:'screen'});await popup.screenshot({path:'artifacts/fin05/print-alignment.png'});
   await popup.pdf({path:'artifacts/fin05/extrato.pdf',preferCSSPageSize:true});await popup.screenshot({path:'artifacts/fin05/print.png',fullPage:true});await popup.close();await page.getByLabel('Prestador do extrato',{exact:true}).selectOption('1');
  }
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click();await page.getByText('Exibindo 102 de 102 contratações.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Detalhes da contratação 101',exact:true}).click();await page.locator('#fin01Detail').getByRole('heading',{name:'Contratação 101',exact:true}).waitFor();assert.equal(await page.locator('#fin01Page').isVisible(),true);
  await nav.click();await page.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
  await page.getByLabel('Criação desde',{exact:true}).fill('2026-01-01');await page.getByLabel('Criação até',{exact:true}).fill('2026-01-31');await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('1');
  fail=true;await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('EXTRATO_INDISPONIVEL',{exact:true}).waitFor();assert.equal(await page.locator('#fin05Print').isEnabled(),false);
  fail=false;await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Exibindo 1 de 1 contratações.',{exact:true}).waitFor();
  assert.deepEqual(queries.at(-1),{prestadorId:'1',depositoId:'1',inicio:'2026-01-01',fim:'2026-01-31'});assert.equal(await page.locator('#fin05Totals h3').innerText(),'Totais do período');assert.deepEqual(await page.locator('#fin05Totals dd').allTextContents(),['R$ 100,00','R$ 100,00','R$ 0,00']);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(perfil==='ADMIN')await page.screenshot({path:`artifacts/fin05/individual-${width}.png`,fullPage:true});}
  // A slower old filter must not overwrite the newer empty result.
  await page.getByLabel('Criação desde',{exact:true}).fill('2026-02-01');await page.getByLabel('Criação até',{exact:true}).fill('2026-02-28');
  const slowRequest=page.waitForRequest(req=>req.url().includes('/extrato?')&&req.url().includes('2026-02-01'));await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await slowRequest;
  await page.getByLabel('Criação até',{exact:true}).fill('2026-01-31');
  await page.getByLabel('Criação desde',{exact:true}).fill('2026-01-02');await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.locator('#fin05Rows').getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();assert.deepEqual(await page.locator('#fin05Totals dd').allTextContents(),['R$ 0,00','R$ 0,00','R$ 0,00']);await page.waitForTimeout(400);assert.equal(await page.locator('#fin05Rows tr[data-key]').count(),0);
  await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByRole('heading',{name:'Resumo por prestador',exact:true}).waitFor();await page.getByRole('button',{name:'Ver extrato de José da Silva',exact:true}).click();await page.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
  if(perfil==='ADMIN'){
   // Applying a new filter cancels an in-progress print instead of publishing stale data.
   delayPrint=true;const filterPrint=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();const canceledPopup=await filterPrint;
   await page.getByLabel('Criação desde',{exact:true}).fill('2026-01-01');await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();assert.equal(canceledPopup.isClosed(),true);
   delayPrint=false;await page.getByText('Exibindo 1 de 1 contratações.',{exact:true}).waitFor();
   // Logout while printing invalidates the asynchronous result and closes the popup.
   delayPrint=true;const promise=page.waitForEvent('popup');await page.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();const popup=await promise;
   await page.evaluate(()=>{window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});await page.waitForTimeout(400);assert.equal(popup.isClosed(),true);
  }else await page.evaluate(()=>{window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});
  assert.equal(await page.locator('#fin05Rows tr[data-key]').count(),0);assert.equal(await page.locator('#fin05Totals').isVisible(),false);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS FIN05 UI: menu, ADMIN/FINANCEIRO/GESTOR, resumo/individual, totais globais, datas locais, paginação, filtros, erro/empty, detalhes, print integral/PDF, logout, 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
