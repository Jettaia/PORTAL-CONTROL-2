import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const rows=[1,2,3].map(i=>({ContratacaoId:i,Numero:100+i,Prestador:'José da Silva',Deposito:i===3?'Santos':'Campinas',Tipo:'Carga e descarga',DataServico:'2026-10-30',ValorLiberado:'175.25',LiberadoEmUtc:'2026-10-30T11:00:00.1234567',LiberadoPor:'Ana Gestora',Situacao:['AGUARDANDO_PAGAMENTO','RECIBO_GERADO','PAGO'][i-1],GestorResponsavel:'Ana',Cidade:'Campinas',Estado:'SP',CentroCusto:'CC-01',InicioPrevisto:'2026-10-30T08:00',FimPrevisto:'2026-10-30T12:00',EntradaReal:'2026-10-30T08:10',SaidaReal:'2026-10-30T12:00'}));
try{
 for(const perfil of ['ADMIN','FINANCEIRO','GESTOR']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],queries=[],writes=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url()),q=Object.fromEntries(url.searchParams);let body={};
   if(req.method()!=='GET')writes.push(url.pathname);
   if(url.pathname==='/api/auth/me')body={usuario:{id:1,nome:'QA '+perfil,perfil,fin01:true,pc04:true,pc08:true,pc10:true,pc11:true},mfa:{necessarioParaAcoesSensiveis:false}};
   if(url.pathname==='/api/financeiro/catalogo')body={podeOperar:perfil!=='GESTOR',depositos:[{DepositoId:1,Nome:'Campinas'},{DepositoId:2,Nome:'Santos'}],prestadores:[{PrestadorId:1,Nome:'José da Silva'}]};
   if(url.pathname==='/api/financeiro/contratacoes'){queries.push(q);body={registros:q.numero?[rows[0]]:q.cursor?[rows[2]]:rows.slice(0,2),proximaPagina:q.numero||q.cursor?null:'next',podeOperar:perfil!=='GESTOR'};}
   if(/\/api\/financeiro\/contratacoes\/\d+$/.test(url.pathname))body={registro:rows.find(r=>url.pathname.endsWith('/'+r.ContratacaoId)),podeOperar:perfil!=='GESTOR'};
   if(url.pathname==='/api/conta')body={pc01:true,pc04:true,fin01:true};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.jettaAccount?.fin01&&!document.getElementById('dashboard').hidden);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'pagamentos'})));
  await page.locator('#fin01Page:not([hidden])').waitFor();await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
  const financialNav=page.locator('#mainNav details').filter({has:page.locator('summary').filter({hasText:'Financeiro'})});
  assert.deepEqual(await financialNav.locator('button:not([hidden])').allTextContents(),['Financeiro','Extrato por prestador']);
  assert.equal(await page.locator('#fin01Page [role=tab]').count(),0);
  assert.equal(await page.locator('#fin01Rows tr[data-contract]').count(),2);
  await page.getByRole('button',{name:'Carregar mais',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#fin01Rows tr[data-contract]').length===3);
  for(const [index,background,color] of [[0,'rgb(255, 243, 205)','rgb(117, 76, 0)'],[1,'rgb(231, 237, 244)','rgb(23, 50, 77)'],[2,'rgb(220, 252, 231)','rgb(22, 101, 52)']]){
   const badge=page.locator('#fin01Rows .fin01-badge').nth(index);
   assert.deepEqual(await badge.evaluate(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color})),{background,color});
  }
  if(perfil==='ADMIN'){fs.mkdirSync('artifacts/fin01',{recursive:true});await page.locator('#fin01Page .fin01-scroll').screenshot({path:'artifacts/fin01/situacoes.png'});}
  await page.getByLabel('Número da contratação',{exact:true}).fill('101');await page.getByLabel('Depósito',{exact:true}).selectOption('1');await page.getByLabel('Prestador',{exact:true}).selectOption('1');await page.locator('#fin01Filters').getByLabel('Serviço desde').fill('2026-10-01');await page.locator('#fin01Filters').getByLabel('Serviço até').fill('2026-10-31');
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#fin01Rows tr[data-contract]').length===1);
  assert.deepEqual(queries.at(-1),{numero:'101',depositoId:'1',prestadorId:'1',inicio:'2026-10-01',fim:'2026-10-31',situacao:'AGUARDANDO_PAGAMENTO'});
  await page.getByRole('button',{name:'Detalhes da contratação 101',exact:true}).click();await page.locator('#fin01Detail').getByText('Ana Gestora',{exact:true}).waitFor();
  assert.match(await page.locator('#fin01Detail').innerText(),/175,25/);
  assert.equal(await page.locator('#fin01Detail .fin01-badge').innerText(),'Aguardando pagamento');
  assert.equal(await page.locator('#fin01Detail .fin01-badge').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(255, 243, 205)');
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#fin01Page .fin01-scroll').evaluate(node=>node.scrollLeft=0);fs.mkdirSync('artifacts/fin01',{recursive:true});if(perfil==='ADMIN')await page.screenshot({path:`artifacts/fin01/fila-${width}.png`,fullPage:true});}
  // Old direct navigation cannot re-open conflicting forms in the transition.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'ajustes'})));assert.equal(await page.locator('#fin01Page').isVisible(),true);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  await page.evaluate(()=>{window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});assert.equal(await page.locator('#fin01Rows tr[data-contract]').count(),0);assert.equal(await page.locator('#fin01Detail').innerText(),'');await page.close();
 }
 console.log('PASS FIN01 UI: ADMIN/FINANCEIRO/GESTOR, filtros juntos, paginação, detalhe, legado inacessível, logout, 1440/768/390, zero escritas/erros JS.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
