import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';

test('Horários manuais: coordenador salva diretamente e gestor solicita aprovação',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(5000);
  let role='COORDENADOR',saved=false;const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  const row=()=>({ContratacaoId:104,Numero:8,DepositoId:1,Deposito:'Campinas',CentroCusto:'CC-002',Prestador:'Ana Paula',Tipo:'Diária',GestorResponsavel:'Bruno',Valor:'180.00',DataServico:'2026-11-13',InicioPrevisto:'2026-11-13T08:00',FimPrevisto:'2026-11-13T17:00',Status:'ABERTA',Versao:saved?2:1,EntradaReal:saved&&role==='COORDENADOR'?'2026-11-13T08:10':null,SaidaReal:saved&&role==='COORDENADOR'?'2026-11-13T17:10':null});
  await page.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;let body={registros:[],naoLidas:0};
   if(path==='/api/auth/me')body={usuario:{id:1,nome:'Teste',perfil:role,funcoes:[role],pc04:true},mfa:{necessarioParaAcoesSensiveis:false}};
   else if(path==='/api/mfa/status')body={enabled:false};
   else if(path==='/api/pc04/catalogo')body={podeOperar:true,podeAprovarHorarios:role==='COORDENADOR',depositos:[],depositosFiltro:[],tipos:[],prestadores:[],gestores:[]};
   else if(path==='/api/pc04/contratacoes')body={registros:[row()]};
   else if(path==='/api/pc04/contratacoes/104')body={registro:row(),podeOperar:true,podeRegistrarHorariosDireto:role==='COORDENADOR',podeAprovarHorarios:role==='COORDENADOR',eventos:[]};
   else if(path==='/api/pc04/contratacoes/104/horarios'){
    writes.push(req.postDataJSON());saved=true;body={resultado:{...row(),...(role==='GESTOR'?{HorarioSolicitado:true}:{})}};
   }
   await route.fulfill({json:body});
  });
  for(role of ['COORDENADOR','GESTOR']){
   saved=false;await page.goto(`http://127.0.0.1:${server.address().port}/#contratacoes`);
   await page.locator('tr[data-contract="104"]').getByRole('button',{name:'Editar',exact:true}).click();
   await page.getByRole('tab',{name:'Horários',exact:true}).click();
   await page.getByText(role==='COORDENADOR'?'Os horários serão registrados diretamente, sem necessidade de aprovação.':'Os horários enviados serão analisados pela supervisão antes de valerem.',{exact:true}).waitFor();
   await page.locator('#pc04_entradaReal_date').fill('2026-11-13');await page.locator('#pc04_entradaReal_time').fill('08:10');
   await page.locator('#pc04_saidaReal_date').fill('2026-11-13');await page.locator('#pc04_saidaReal_time').fill('17:10');
   await page.locator('#pc04_motivoHorario').fill('Tablet indisponível');
   await page.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();
   await page.getByText(role==='COORDENADOR'?'Horários manuais registrados.':'Horários enviados para aprovação da supervisão.',{exact:true}).waitFor();
   assert.equal(writes.at(-1).motivo,'Tablet indisponível');assert.equal(writes.at(-1).entradaReal,'2026-11-13T08:10');assert.equal(saved,true);
   await page.getByRole('button',{name:'Fechar contratação',exact:true}).click();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
