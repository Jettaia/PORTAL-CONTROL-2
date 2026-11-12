import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import express from 'express';
import fs from 'node:fs';

test('PC04 layout A: exportação legível sem sobreposição, toolbar compacta e popup aprovado',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1531,height:764}});page.setDefaultTimeout(6000);
  const errors=[],queries=[];page.on('pageerror',e=>errors.push(e.message));
  const row={ContratacaoId:1842,Numero:1842,DepositoId:1,PrestadorId:1,TipoServicoId:1,Prestador:'Carlos Henrique da Silva',Deposito:'Guarulhos',CentroCusto:'CC-001',Tipo:'Carga e descarga',DataServico:'2026-11-12',InicioPrevisto:'2026-11-12T08:00',FimPrevisto:'2026-11-12T17:00',Valor:'180.00',Status:'ABERTA',Versao:1,GestorResponsavel:'Ana Martins'};
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;let body={};
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'Ana Martins',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc04:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true};
   else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
   else if(p==='/api/pc04/catalogo')body={depositos:[{DepositoId:1,Nome:'Guarulhos'}],tipos:[{TipoServicoId:1,Nome:'Carga e descarga'}],prestadores:[{PrestadorId:1,Nome:row.Prestador,CPF:'00000000000',DepositoId:1}],gestores:[{UsuarioId:1,Nome:'Ana Martins',DepositoId:1}],podeOperar:true};
   else if(p==='/api/pc05/status')body={pc05:true};
   else if(p==='/api/pc04/contratacoes'){queries.push(Object.fromEntries(url.searchParams));body={registros:[row],proximaPagina:null};}
   else if(p==='/api/pc04/contratacoes/1842')body={registro:row,eventos:[],podeOperar:true,pc05:true};
   await route.fulfill({json:body});
  });
  await page.goto(process.env.PC04_PARITY_URL||`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
  const menu=page.locator('.pc04-export');await menu.locator('summary').click();const excel=page.getByRole('button',{name:'Exportar em Excel',exact:true}),pdf=page.getByRole('button',{name:'Exportar em PDF',exact:true});
  const boxes=await Promise.all([excel.boundingBox(),pdf.boundingBox()]);
  assert.ok(boxes[0].y+boxes[0].height<=boxes[1].y,'Exportar Excel e PDF devem ocupar linhas separadas: '+JSON.stringify(boxes));
  assert.ok(boxes[0].width>=180,'Menu deve caber o texto em uma linha');
  assert.equal(await excel.evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
  await menu.locator('summary').click();
  const primary=page.locator('.pc04-filter-primary');assert.ok((await primary.boundingBox()).height<=48,'Busca e filtros devem ter uma única linha compacta no desktop');
  const search=page.getByRole('searchbox',{name:'Buscar prestador ou número'});await search.fill('1842');await search.press('Enter');await page.getByText('Página atualizada.',{exact:true}).waitFor();assert.equal(queries.at(-1).numero,'1842');assert.equal(queries.at(-1).prestador,undefined);
  await search.fill('Carlos');await search.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-pc04-filter=prestador]').value==='Carlos'&&document.querySelector('#pc04Message').textContent==='Página atualizada.');assert.equal(queries.at(-1).prestador,'Carlos');assert.equal(queries.at(-1).numero,undefined);
  await page.locator('.pc04-page-counts button').first().click();await page.waitForFunction(()=>document.querySelector('[data-pc04-filter=situacao]').value==='ABERTA'&&document.querySelector('#pc04Message').textContent==='Página atualizada.');assert.equal(queries.at(-1).situacao,'ABERTA');await primary.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByText('Página atualizada.',{exact:true}).waitFor();assert.deepEqual(queries.at(-1),{});
  await page.getByRole('button',{name:'Editar',exact:true}).click();const modal=page.locator('#pc04Dialog');await modal.getByRole('tab',{name:'Resumo',exact:true}).waitFor();
  assert.equal(await modal.locator('.pc04-summary-primary > div').count(),6,'Resumo deve usar os seis grupos do modelo aprovado');
  await modal.getByRole('tab',{name:'Tokens',exact:true}).click();assert.equal(await modal.locator('.pc04-token-rows > div').count(),2,'Entrada e saída em linhas distintas');
  fs.mkdirSync('artifacts/pc04-parity-repro',{recursive:true});await page.screenshot({path:'artifacts/pc04-parity-repro/popup.png',fullPage:true});
  for(const width of [390,700,1531]){
   await page.setViewportSize({width,height:764});await page.keyboard.press('Escape');await menu.locator('summary').click();const bounds=await excel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'Menu deve caber no viewport '+width);await page.screenshot({path:`artifacts/pc04-parity-repro/export-${width}.png`,fullPage:true});await menu.locator('summary').click();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
