import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {statementWorkbook} from '../src/fin05-export-xlsx.js';

const zero={ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'};
const totals={ValorDevido:'10200.00',ValorPago:'100.00',Saldo:'10100.00'};
const provider=(depot,id=1)=>({DepositoId:depot,Deposito:depot===1?'Sumaré':'Floripa',PrestadorId:id,Prestador:id===1?'José da Silva':'Sem movimento',CPF:'01234567890',QuantidadeContratacoes:id===1?102:0,...(id===1?totals:zero)});
const contracts=Array.from({length:102},(_,i)=>({ContratacaoId:i+1,Numero:101+i,DataServico:'2026-11-09',DataCriacao:'2026-10-30T02:00:00',CentroCusto:'CC-19',Atividade:i===0?'<img src=x onerror=alert(1)> Descarga':'Descarga',ValorDevido:'100.00',DataPagamento:i===0?'2026-10-31T02:00:00':null,ValorPago:i===0?'100.00':'0.00'}));

test('FIN05 agrupado: expandir, paginar, imprimir, filtrar, erros e logout por persona',{timeout:120000},async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});fs.mkdirSync('artifacts/fin05-grouped',{recursive:true});
  for(const perfil of ['ADMIN','FINANCEIRO','GESTOR','COORDENADOR']){
   const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),queries=[],errors=[],writes=[];page.setDefaultTimeout(7000);
   let detailError=false,summaryError=false,slow=false,release,summaryPaged=false,exportMode='ok',releaseExport,exportDone;
   const exportQueries=[],downloads=[];page.on('download',download=>downloads.push(download));
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),q=Object.fromEntries(url.searchParams);if(req.method()!=='GET')writes.push(req.method());let body={};
    if(/^\/api\/financeiro\/extrato\/exportar\.(xlsx|pdf)$/.test(url.pathname)){
     const format=url.pathname.endsWith('.pdf')?'pdf':'xlsx';
     exportQueries.push(q);if(exportMode==='hold')await new Promise(r=>releaseExport=r);
     if(exportMode==='error'){await route.fulfill({status:format==='pdf'?503:413,json:{erro:format==='pdf'?'EXPORTACAO_PDF_OCUPADA':'EXPORTACAO_MUITOS_REGISTROS'}});return;}
     const buffer=statementWorkbook({geradoEm:'09/11/2026',filtrosTexto:'Todos autorizados',depositos:[{DepositoId:1,Deposito:'Sumaré',...totals}],prestadores:[provider(1)],contratacoes:contracts.map(row=>({...row,DepositoId:1,PrestadorId:1,Saldo:row.ValorPago==='100.00'?'0.00':'100.00'})),totais:totals});
     try{await route.fulfill({status:200,headers:{'content-type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="extrato-teste.'+format+'"'},body:format==='pdf'?Buffer.from('%PDF-1.4\nfixture'):buffer});}catch{}finally{exportDone?.();}
     return;
    }
    if(url.pathname==='/api/auth/me')body={usuario:{id:1,nome:'QA '+perfil,perfil,funcoes:[perfil],fin01:true,pc01:true,pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
    else if(url.pathname==='/api/conta')body={fin01:true,pc01:true,pc04:true};
    else if(['/api/financeiro/extrato/catalogo','/api/financeiro/catalogo'].includes(url.pathname))body={depositos:[{DepositoId:1,Nome:'Sumaré'},{DepositoId:2,Nome:'Floripa'}],prestadores:[{PrestadorId:1,Nome:'José da Silva'},{PrestadorId:2,Nome:'Sem movimento'}]};
    else if(url.pathname==='/api/financeiro/extrato'){
     queries.push(q);
     if(q.agrupamento==='deposito'){
      if(summaryError){await route.fulfill({status:503,json:{erro:'EXTRATO_INDISPONIVEL'}});return;}
      const all=q.inicio==='2026-01-02'?[]:[provider(1),...(['ADMIN','FINANCEIRO'].includes(perfil)?[provider(2)]:[]),...(q.somenteMovimentacao==='0'?[provider(1,2)]:[])].filter(r=>!q.depositoId||String(r.DepositoId)===q.depositoId);
      body={prestadores:summaryPaged?all.slice(q.pagina==='2'?1:0,q.pagina==='2'?all.length:1):all,contratacoes:[],depositos:[...new Set(all.map(r=>r.DepositoId))].map(id=>({DepositoId:id,Deposito:id===1?'Sumaré':'Floripa',QuantidadePrestadores:all.filter(r=>r.DepositoId===id).length,...totals})),totais:all.length?totals:zero,totalRegistros:all.length,proximaPagina:summaryPaged&&q.pagina!=='2'?2:null};
     }else{
      if(slow)await new Promise(r=>release=r);
      if(detailError){await route.fulfill({status:503,json:{erro:'DETALHE_INDISPONIVEL'}});return;}
      assert.ok(q.prestadorId&&q.depositoId,'detalhes e impressão precisam do par depósito/prestador');
      const all=q.prestadorId==='2'?[]:q.depositoId==='2'?[{...contracts[0],Numero:501}]:contracts,start=(Number(q.pagina||1)-1)*100;
      body={prestadores:[],contratacoes:all.slice(start,start+100),totais:q.prestadorId==='2'?zero:totals,totalRegistros:all.length,proximaPagina:all.length>start+100?Number(q.pagina||1)+1:null};
     }
    }else if(url.pathname==='/api/financeiro/contratacoes')body={registros:[],proximaPagina:null};
    else if(url.pathname==='/api/financeiro/contratacoes/1')body={registro:{...contracts[0],Prestador:'José da Silva',Tipo:'Descarga',ValorLiberado:'100.00',Cidade:'Sumaré',Estado:'SP',LiberadoPor:'Ana',GestorResponsavel:'Ana',Situacao:'PAGO'},podeOperar:false};
    else if(url.pathname==='/api/financeiro/contratacoes/1/pagamento')body={pagamento:null,anexos:[],historico:[],podeOperar:false};
    try{await route.fulfill({json:body});}catch(e){if(!page.isClosed())throw e;}
   });
   await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.jettaAccount?.fin01&&!document.getElementById('dashboard').hidden);
   await page.locator('#mainNav details').filter({has:page.locator('summary').filter({hasText:'Financeiro'})}).locator('summary').click();assert.equal(await page.locator('[data-page="extratoprestador"]').innerText(),'Extrato');await page.locator('[data-page="extratoprestador"]').click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();
   assert.equal(await page.locator('#fin05Page h2').innerText(),'Extrato');assert.equal(await page.locator('#breadcrumb').innerText(),'Financeiro > Extrato');
   assert.equal(queries[0].agrupamento,'deposito');assert.equal(queries[0].somenteMovimentacao,'1');assert.equal(await page.getByLabel('Somente com movimentação',{exact:true}).isChecked(),true);
   if(perfil==='ADMIN'){
    await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('2');const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar em Excel',exact:true}).click();const file=await downloadEvent;
    assert.equal(file.suggestedFilename(),'extrato-teste.xlsx');const exported=fs.readFileSync(await file.path());assert.equal(exported.subarray(0,2).toString(),'PK');assert.match(exported.toString(),/012\.345\.678-90/);assert.match(exported.toString(),/>202<\/t>/);assert.equal(exportQueries.at(-1).depositoId,undefined);assert.equal(exportQueries.at(-1).somenteMovimentacao,'1');assert.equal(exportQueries.at(-1).pagina,undefined);
    await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('');exportMode='error';await page.getByRole('button',{name:'Exportar em Excel',exact:true}).click();await page.getByText('EXPORTACAO_MUITOS_REGISTROS',{exact:true}).waitFor();assert.equal(downloads.length,1);exportMode='ok';
    await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('2');const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar em PDF',exact:true}).click();const pdfFile=await pdfEvent;assert.equal(pdfFile.suggestedFilename(),'extrato-teste.pdf');assert.equal(fs.readFileSync(await pdfFile.path()).subarray(0,5).toString(),'%PDF-');assert.equal(exportQueries.at(-1).depositoId,undefined);await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('');
    exportMode='error';await page.getByRole('button',{name:'Exportar em PDF',exact:true}).click();await page.getByText('EXPORTACAO_PDF_OCUPADA',{exact:true}).waitFor();assert.equal(downloads.length,2);exportMode='ok';
   }
   const depot=page.locator('[data-fin05-depot="1"]'),button=depot.getByRole('button',{name:'Expandir contratações de José da Silva',exact:true}),detail=depot.locator('[data-fin05-detail="1:1"]');
   assert.equal(await depot.getByText('012.345.678-90',{exact:true}).count(),1);await button.focus();await page.keyboard.press('Enter');await detail.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
   assert.equal(await button.getAttribute('aria-expanded'),'true');assert.equal(queries.at(-1).depositoId,'1');assert.equal(queries.at(-1).prestadorId,'1');
   assert.deepEqual(await detail.locator('tbody tr').first().locator('td').allTextContents(),['101','09/11/2026','29/10/2026','CC-19','<img src=x onerror=alert(1)> Descarga','R$ 100,00','30/10/2026','R$ 100,00','R$ 0,00','Detalhes']);assert.equal(await detail.locator('img').count(),0);
   await detail.getByRole('button',{name:'Carregar mais contratações',exact:true}).click();await detail.getByText('Exibindo 102 de 102 contratações.',{exact:true}).waitFor();
   if(perfil==='ADMIN'){
    await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('2');const promise=page.waitForEvent('popup');await detail.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();const popup=await promise;
    await popup.getByRole('heading',{name:'José da Silva',exact:true}).waitFor();assert.equal(await popup.locator('tbody tr').count(),102);assert.match(await popup.locator('body').innerText(),/Depósito: Sumaré/);assert.deepEqual(await popup.locator('.fin05-totals dd').allTextContents(),['R$ 10.200,00','R$ 100,00','R$ 10.100,00']);await popup.close();await page.getByLabel('Depósito do extrato',{exact:true}).selectOption('');
    for(const width of [1440,390]){
     await page.setViewportSize({width,height:width===390?900:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     const bounds=await depot.boundingBox(),actionBounds=await detail.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).boundingBox();assert.ok(actionBounds.x>=bounds.x&&actionBounds.x+actionBounds.width<=bounds.x+bounds.width+1,'impressão deve caber na largura visível do depósito');
     await depot.evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:'artifacts/fin05-grouped/'+(width===1440?'desktop':'mobile')+'-expanded.png'});
    }
    await page.setViewportSize({width:1440,height:1050});
    const other=page.locator('[data-fin05-depot="2"]');await other.getByRole('button',{name:'Expandir contratações de José da Silva',exact:true}).click();await other.getByText('Exibindo 1 de 1 contratações.',{exact:true}).waitFor();assert.match(await other.locator('tbody').last().innerText(),/501/);
   }
   await button.click();assert.equal(await detail.isVisible(),false);await button.click();await detail.getByText('Exibindo 102 de 102 contratações.',{exact:true}).waitFor();
   await page.getByLabel('Somente com movimentação',{exact:true}).uncheck();await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();assert.equal(queries.at(-1).somenteMovimentacao,'0');
   await page.getByRole('button',{name:'Expandir contratações de Sem movimento',exact:true}).click();await page.locator('[data-fin05-detail="1:2"]').getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();
   detailError=true;await button.click();await detail.getByText('DETALHE_INDISPONIVEL',{exact:true}).waitFor();detailError=false;await detail.getByRole('button',{name:'Tentar novamente',exact:true}).click();await detail.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
   if(perfil==='ADMIN'){
    summaryPaged=true;await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();assert.equal(await page.locator('.fin05-provider-row').count(),1);
    await page.getByRole('button',{name:'Carregar mais prestadores',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();assert.equal(await page.locator('.fin05-provider-row').count(),3);assert.equal(await page.locator('[data-fin05-depot="1"]').count(),1);summaryPaged=false;
    await button.click();await detail.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();slow=true;
    const printRequest=page.waitForRequest(r=>r.url().includes('/extrato?')&&r.url().includes('prestadorId=1')),popupEvent=page.waitForEvent('popup');await detail.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();const pendingPopup=await popupEvent;await printRequest;
    await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();assert.equal(pendingPopup.isClosed(),true);slow=false;release?.();
    exportMode='hold';const delivered=new Promise(resolve=>exportDone=resolve),exportRequest=page.waitForRequest(r=>r.url().includes('/extrato/exportar.pdf'));await page.getByRole('button',{name:'Exportar em PDF',exact:true}).click();await exportRequest;
    assert.equal(await page.getByRole('button',{name:'Exportar em Excel',exact:true}).isEnabled(),false);await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();exportMode='ok';releaseExport?.();await delivered;await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(downloads.length,2,'exportação cancelada ao mudar filtros não deve baixar arquivo antigo');
   }
   await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();slow=true;
   const request=page.waitForRequest(r=>r.url().includes('/extrato?')&&r.url().includes('prestadorId=1'));await button.click();await request;await page.getByLabel('Criação desde',{exact:true}).fill('2026-01-02');await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();slow=false;release?.();
   await page.getByText('Nenhum prestador encontrado para os filtros informados.',{exact:true}).waitFor();assert.equal(await page.locator('[data-fin05-detail]').count(),0);
   summaryError=true;await page.locator('#fin05Filters').getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('EXTRATO_INDISPONIVEL',{exact:true}).waitFor();assert.equal(await page.locator('#fin05Totals').isVisible(),false);
   if(perfil==='ADMIN'){
    summaryError=false;await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByText('Extrato atualizado.',{exact:true}).waitFor();await button.click();await detail.getByText('Exibindo 100 de 102 contratações.',{exact:true}).waitFor();
    await detail.getByRole('button',{name:'Detalhes da contratação 101',exact:true}).click();await page.locator('#fin01Detail').getByRole('heading',{name:'Contratação 101',exact:true}).waitFor();assert.equal(await page.locator('#fin01Page').isVisible(),true);
   }
   await page.evaluate(()=>{window.jettaAccount=null;window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null}));});assert.equal(await page.locator('[data-fin05-depot]').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await context.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
