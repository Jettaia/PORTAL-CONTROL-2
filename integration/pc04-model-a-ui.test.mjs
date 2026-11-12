import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

test('PC04 modelo A: popup, abas, operações reais, locks e encerramento seguro',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const context=await browser.newContext({viewport:{width:1531,height:960},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();page.setDefaultTimeout(5000);
  const dir='artifacts/pc04-model-a-'+process.pid;fs.mkdirSync(dir,{recursive:true});const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});};
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));let mfa=0,version=1,tokenCount=0,releaseDetail=null,holdDetail=false,conflict=false,operating=true,empty=false,expanded=false;
  const row={ContratacaoId:999,Numero:1842,DepositoId:1,PrestadorId:1,TipoServicoId:1,Prestador:'Carlos Henrique Ferreira de Albuquerque e Silva',Deposito:'Guarulhos',CentroCusto:'CC-001',Tipo:'Carga e descarga',DataServico:'2026-11-12',InicioPrevisto:'2026-11-12T08:00',FimPrevisto:'2026-11-12T17:00',Valor:'180.00',Status:'ABERTA',Versao:version,GestorResponsavelId:1,GestorResponsavel:'Ana Martins',CriadoPor:'Ana Martins'};
  const events=[];
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname.replace(/^\/chapa/,'');let body={},status=200;
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'Ana Martins',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true,fin01:true};
   else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
   else if(p==='/api/pc04/catalogo')body={depositos:[{DepositoId:1,Nome:'Guarulhos'}],tipos:[{TipoServicoId:1,Nome:'Carga e descarga'}],prestadores:[{PrestadorId:1,Nome:row.Prestador,CPF:'00000000000',DepositoId:1}],gestores:[{UsuarioId:1,Nome:'Ana Martins',DepositoId:1}],podeOperar:operating,podeAprovarHorarios:true};
   else if(p==='/api/pc04/horarios-pendentes')body={registros:[]};
   else if(p==='/api/pc05/status')body={pc05:true};
   else if(p==='/api/pc04/media')body={media:null,quantidade:0,minimo:3};
   else if(p==='/api/pc04/contratacoes'&&req.method()==='GET')body={registros:empty?[]:expanded?Array.from({length:22},(_,i)=>({...row,Numero:1842-i,ContratacaoId:999+i,Prestador:i%2?row.Prestador:'Marcos Oliveira',Status:i%3===0?'LIBERADA':i%3===1?'ABERTA':'CANCELADA'})):[row],proximaPagina:null};
   else if(p==='/api/pc04/contratacoes/999'&&req.method()==='GET'){
    if(holdDetail){holdDetail=false;await new Promise(r=>releaseDetail=r);}
    body={registro:row,eventos:events,podeOperar:operating,pc05:true,entradaTokenUsada:!!row.EntradaReal,podeRegistrarHorariosDireto:true};
   }else if(req.method()==='POST'){
    const data=req.postDataJSON();writes.push({p,data});
    if(p==='/api/pc04/contratacoes'){assert.equal(data.valor,'180.00');body={resultado:row};}
    else if(p.endsWith('/tokens')){assert.equal(data.versao,row.Versao);tokenCount++;row.Versao++;body={codigo:tokenCount===1?'0123':'9876',versao:row.Versao,expiraEmUtc:new Date(Date.now()+3600000).toISOString()};}
    else {assert.equal(data.versao,row.Versao);if(conflict){conflict=false;status=409;body={erro:'VERSAO_DESATUALIZADA'};}else{
     if(p.endsWith('/previstos')){row.InicioPrevisto=data.inicioPrevisto;row.FimPrevisto=data.fimPrevisto;row.DataServico=data.inicioPrevisto.slice(0,10);}
     if(p.endsWith('/horarios')){row.EntradaReal=data.entradaReal;row.SaidaReal=data.saidaReal;}
     if(p.endsWith('/revisar'))row.Valor=data.valor;
     if(p.endsWith('/cancelar'))row.Status='CANCELADA';if(p.endsWith('/conferir'))row.Status='LIBERADA';
     row.Versao++;events.unshift({Acao:p.endsWith('/revisar')?'REVISAR':'HORARIOS',AtorNome:'Ana Martins',AtorCargo:'ADMIN',AtorIdentificacaoHistorica:true,CriadoEmUtc:'2026-11-12T12:00:00Z',Motivo:data.motivo});body={resultado:row};
    }}
   }
   await route.fulfill({status,json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
  await page.evaluate(()=>window.jettaEnsureRecentMfa=async()=>{window.__mfaCalls=(window.__mfaCalls||0)+1;});
  await page.getByRole('button',{name:'Nova contratação',exact:true}).click();const modal=page.locator('#pc04Dialog');await modal.waitFor({state:'visible'});
  await capture('desktop-create');
  await page.locator('#pc04_prestadorId').selectOption('1');await page.locator('#pc04_tipoServicoId').selectOption('1');await page.locator('#pc04_gestorId').selectOption('1');
  await page.locator('#pc04_inicioPrevisto').fill('2026-11-12T08:00');await page.locator('#pc04_fimPrevisto').fill('2026-11-12T17:00');await page.locator('#pc04_valor').fill('180,00');await modal.getByRole('button',{name:'Criar contratação',exact:true}).click();
  const tab=name=>modal.getByRole('tab',{name,exact:true});await tab('Resumo').waitFor();
  for(const viewport of [{width:1531,height:764},{width:390,height:844}]){
   await page.setViewportSize(viewport);await tab('Resumo').click();const initial=await modal.boundingBox(),header=modal.locator('.pc04-dialog-header'),headerTop=(await header.boundingBox()).y;
   for(const label of ['Tokens','Horários','Valor','Cancelamento','Histórico','Resumo']){await tab(label).click();const box=await modal.boundingBox();for(const key of ['x','y','width','height'])assert.ok(Math.abs(box[key]-initial[key])<1,`${viewport.width}: ${label} mantém ${key}; inicial ${initial[key]}, atual ${box[key]}`);}
   const body=modal.locator('.pc04-dialog-body');await body.evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(Math.abs((await header.boundingBox()).y-headerTop)<1,'header fixo ao rolar corpo');await capture('fixed-summary-'+viewport.width);await tab('Tokens').click();assert.equal(await body.evaluate(el=>el.scrollTop),0,'nova aba começa no topo');await capture('fixed-tokens-'+viewport.width);
  }
  await page.setViewportSize({width:1531,height:960});await tab('Resumo').click();await capture('desktop-summary');await tab('Tokens').click();
  assert.equal(await modal.getByRole('button',{name:'Gerar / substituir saída',exact:true}).isDisabled(),true);await modal.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();await page.getByLabel('Token gerado',{exact:true}).waitFor();await capture('desktop-token');await modal.getByRole('button',{name:'Copiar token',exact:true}).click();await modal.getByText('Token copiado!',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Token de entrada: 0123');
  await tab('Horários').click();assert.equal(await page.getByLabel('Token gerado',{exact:true}).count(),0);await page.locator('#pc04_editarInicioPrevisto').fill('2026-11-12T07:30');await modal.getByRole('button',{name:'Salvar horários previstos',exact:true}).click();await modal.getByText('Horários previstos atualizados.',{exact:true}).waitFor();assert.equal(await tab('Horários').getAttribute('aria-selected'),'true');
  await page.locator('#pc04_entradaReal').fill('2026-11-12T07:45');await page.locator('#pc04_saidaReal').fill('2026-11-12T17:15');await page.locator('#pc04_motivoHorario').fill('Horários reais conferidos com o responsável');await modal.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();await modal.getByText('Horários manuais registrados.',{exact:true}).waitFor();
  await tab('Valor').click();await page.locator('#pc04_novoValor').fill('235,00');await page.locator('#pc04_motivoRevisao').fill('Extensão do serviço');conflict=true;await modal.getByRole('button',{name:'Revisar valor',exact:true}).click();await modal.getByText(/Outra pessoa alterou/).waitFor();assert.equal(row.Valor,'180.00');await modal.getByRole('button',{name:'Revisar valor',exact:true}).click();await modal.getByText('Valor revisado.',{exact:true}).waitFor();assert.equal(row.Valor,'235.00');
  await tab('Histórico').click();await modal.getByText('Extensão do serviço',{exact:false}).waitFor();
  await capture('desktop-history');
  await tab('Cancelamento').click();await page.locator('#pc04_motivoCancelamento').fill('Serviço dispensado');const prior=writes.length;await modal.getByRole('button',{name:'Cancelar contratação',exact:true}).click();assert.equal(writes.length,prior);await modal.getByLabel('Confirmo o cancelamento desta contratação.').check();await modal.getByRole('button',{name:'Cancelar contratação',exact:true}).click();await modal.getByText('Contratação cancelada. Histórico preservado.',{exact:true}).waitFor();assert.equal(row.Status,'CANCELADA');
  await modal.getByRole('button',{name:'Fechar contratação',exact:true}).click();await modal.waitFor({state:'hidden'});await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Resumo').waitFor();assert.equal(await modal.getByRole('button',{name:'Cancelar contratação',exact:true}).count(),0);await page.keyboard.press('Escape');
  row.Status='LIBERADA';await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Horários').click();assert.equal(await modal.getByRole('button',{name:'Salvar horários previstos',exact:true}).isDisabled(),true);await tab('Valor').click();assert.equal(await modal.getByRole('button',{name:'Revisar valor',exact:true}).isDisabled(),true);await page.setViewportSize({width:390,height:844});await capture('mobile-locked');assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.keyboard.press('Escape');
  row.Status='ABERTA';row.HorarioPendenteId=12;await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Tokens').click();assert.equal(await modal.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).isDisabled(),true);await tab('Horários').click();assert.equal(await modal.getByRole('button',{name:'Salvar horários previstos',exact:true}).isDisabled(),true);await capture('mobile-pending');await page.keyboard.press('Escape');row.HorarioPendenteId=null;
  await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Resumo').waitFor();const beforeRelease=writes.length;await modal.getByRole('button',{name:'Conferir e liberar para pagamento',exact:true}).click();assert.equal(writes.length,beforeRelease);await modal.getByRole('button',{name:'Confirmar liberação',exact:true}).click();await modal.getByText('Contratação conferida e liberada.',{exact:true}).waitFor();assert.equal(row.Status,'LIBERADA');await page.keyboard.press('Escape');
  // Closing a pending read must suppress late detail, and must allow retry.
  row.Status='ABERTA';row.SaidaReal=null;holdDetail=true;await page.getByRole('button',{name:'Editar',exact:true}).click();await modal.waitFor({state:'visible'});await modal.getByRole('button',{name:'Fechar contratação',exact:true}).click();releaseDetail();await page.waitForTimeout(80);assert.equal(await modal.isVisible(),false);await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Tokens').click();await modal.getByRole('button',{name:'Gerar / substituir saída',exact:true}).click();await page.getByLabel('Token gerado',{exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));assert.equal(await modal.isVisible(),false);assert.equal(await page.getByLabel('Token gerado',{exact:true}).count(),0);
  mfa=await page.evaluate(()=>window.__mfaCalls);assert.ok(mfa>=8);
  expanded=true;await page.setViewportSize({width:1531,height:960});await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();await page.locator('.pc04-table tbody tr').nth(21).waitFor({state:'attached'});await capture('desktop-full');await page.locator('.pc04-table').evaluate(e=>e.scrollTop=e.scrollHeight);await capture('desktop-scroll-end');
  await page.setViewportSize({width:390,height:844});await page.locator('.pc04-table').evaluate(e=>{e.scrollTop=0;e.scrollLeft=e.scrollWidth;});await capture('mobile-table-end');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  empty=true;await page.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await page.getByText('Nenhuma contratação neste acesso.',{exact:true}).waitFor();await capture('mobile-empty');
  expanded=false;empty=false;operating=false;row.Status='LIBERADA';await page.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await page.getByText('Consulta financeira: somente contratações liberadas.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Nova contratação',exact:true}).count(),0);await page.getByRole('button',{name:'Editar',exact:true}).click();await tab('Tokens').click();assert.equal(await modal.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).count(),0);await tab('Cancelamento').click();assert.equal(await modal.getByRole('button',{name:'Cancelar contratação',exact:true}).count(),0);await capture('mobile-readonly');assert.deepEqual(errors,[]);
  const hashes={};for(const file of ['public/pc04.js','public/pc04.css','public/index.html','public/pilot-design.css'])hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(dir+'/evidence.json',JSON.stringify({sha:execFileSync('git',['rev-parse','HEAD']).toString().trim(),hashes,theme:'light',viewports:['1531x960','390x844'],data:'Synthetic HTTP fixtures, production portal DOM/JS/CSS',writes:writes.map(w=>w.p),mfa,errors},null,2));console.log(JSON.stringify({evidence:dir,mfa,writes:writes.length}));
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
