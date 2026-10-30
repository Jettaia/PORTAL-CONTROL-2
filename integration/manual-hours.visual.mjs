// Real PC04 component/CSS, synthetic HTTP; server authorization is proven separately.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let admin=false,writes=[],requests=[],next=1;
const row={ContratacaoId:1,Numero:17,Prestador:'Pessoa Teste',Deposito:'Depósito Norte',DepositoId:1,Tipo:'Diária',TipoServicoId:1,GestorResponsavel:'Gestor Norte',DataServico:'2026-10-30',InicioPrevisto:'2026-10-30T08:00',FimPrevisto:'2026-10-30T18:00',Valor:'100.00',Status:'ABERTA',Versao:1,EntradaReal:null,SaidaReal:null};
const pending=()=>requests.filter(r=>r.Status==='PENDENTE');
app.get('/fixture',(_req,res)=>res.send('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pc04.css"><link rel="stylesheet" href="/jc-refinado.css"></head><body><main id="pc04Page" class="panel"><section id="pc04Panel"></section></main><script src="/pc04.js"></script></body></html>'));
app.get('/api/pc04/catalogo',(_req,res)=>res.json({podeOperar:true,podeAprovarHorarios:admin,depositos:[],tipos:[],prestadores:[],gestores:[]}));
app.get('/api/pc04/media',(_req,res)=>res.json({media:null,quantidade:0,minimo:3}));
app.get('/api/pc05/status',(_req,res)=>res.json({pc05:true}));
app.get('/api/pc05/tablets',(_req,res)=>res.json({registros:[]}));
app.get('/api/pc04/contratacoes',(_req,res)=>res.json({registros:[row]}));
app.get('/api/pc04/horarios-pendentes',(_req,res)=>admin?res.json({registros:pending().map(r=>({...r,...row}))}):res.sendStatus(403));
app.get('/api/pc04/contratacoes/1',(_req,res)=>res.json({registro:{...row,HorarioPendenteId:pending()[0]?.SolicitacaoId||null},podeOperar:true,podeAprovarHorarios:admin,pc05:true,entradaTokenUsada:false,solicitacoesHorarios:requests,eventos:[]}));
app.post('/api/pc04/contratacoes/1/:action',(req,res)=>{
 writes.push({action:req.params.action,body:req.body});row.Versao++;
 if(req.params.action==='horarios'){
  if(admin){row.EntradaReal=req.body.entradaReal;row.SaidaReal=req.body.saidaReal;}
  else requests.push({SolicitacaoId:next++,ContratacaoId:1,EntradaReal:req.body.entradaReal,SaidaReal:req.body.saidaReal,Motivo:req.body.motivo,Solicitante:'Gestor Norte',Status:'PENDENTE'});
 }else if(req.params.action==='conferir'){row.Status='LIBERADA';row.LiberacaoBloqueada=true;}
 res.json({resultado:{...row,HorarioSolicitado:req.params.action==='horarios'&&!admin}});
});
app.post('/api/pc04/contratacoes/1/horarios/:id/decidir',(req,res)=>{
 writes.push({action:'decidir',body:req.body});const request=requests.find(r=>String(r.SolicitacaoId)===req.params.id);request.Status=req.body.aprovar?'APROVADA':'NEGADA';if(req.body.aprovar){row.EntradaReal=request.EntradaReal;row.SaidaReal=request.SaidaReal;}row.Versao++;res.json({resultado:row});
});
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('#pc04Detail');
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.evaluate(()=>{window.jettaEnsureRecentMfa=async()=>{};window.dispatchEvent(new Event('jetta:pc04'));});await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
 const open=async()=>{await page.getByRole('button',{name:'Abrir 17',exact:true}).click();await page.getByText('Contratação carregada.',{exact:true}).waitFor();};
 const reload=async()=>{await page.evaluate(()=>{window.dispatchEvent(new Event('jetta:auth'));window.dispatchEvent(new Event('jetta:pc04'));});await page.getByText('Consulta atualizada.',{exact:true}).waitFor();};
 await open();const confirm=detail.getByRole('button',{name:'Conferir e liberar para pagamento',exact:true});assert.equal(await confirm.count(),1);
 assert.equal(await detail.evaluate(e=>{const cancel=[...e.querySelectorAll('h3')].find(n=>n.textContent==='Cancelamento da contratação');const confirm=[...e.querySelectorAll('button')].find(n=>n.textContent==='Conferir e liberar para pagamento');return !!(cancel.compareDocumentPosition(confirm)&Node.DOCUMENT_POSITION_FOLLOWING);}),true);
 const submit=async()=>{await page.locator('#pc04_entradaReal').fill('2026-10-30T08:15');await page.locator('#pc04_saidaReal').fill('2026-10-30T18:15');await page.locator('#pc04_motivoHorario').fill('Ajuste solicitado <script>não executar</script>');await detail.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();};
 await submit();await page.getByText('Horários enviados para aprovação do ADMIN.',{exact:true}).waitFor();assert.equal(row.EntradaReal,null);assert.equal(await detail.getByRole('button',{name:'Aprovar horários',exact:true}).count(),0);assert.equal(await confirm.isDisabled(),true);assert.equal(await detail.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).isDisabled(),true);assert.ok(await detail.getByText('Ajuste solicitado <script>não executar</script>',{exact:true}).count());
 admin=true;await reload();await page.getByRole('heading',{name:'Horários aguardando aprovação',exact:true}).waitFor();await page.getByRole('button',{name:'Abrir solicitação 1',exact:true}).click();await page.getByText('Contratação carregada.',{exact:true}).waitFor();await detail.getByRole('button',{name:'Negar horários',exact:true}).click();await page.getByText('Horários negados. Os horários válidos foram preservados.',{exact:true}).waitFor();assert.equal(row.EntradaReal,null);
 admin=false;await reload();await open();await submit();await page.getByText('Horários enviados para aprovação do ADMIN.',{exact:true}).waitFor();
 admin=true;await reload();await page.getByRole('button',{name:'Abrir solicitação 2',exact:true}).click();await page.getByText('Contratação carregada.',{exact:true}).waitFor();
 fs.mkdirSync('artifacts/manual-hours',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await detail.screenshot({path:`artifacts/manual-hours/pending-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page overflow '+width);}
 await detail.getByRole('button',{name:'Aprovar horários',exact:true}).click();await page.getByText('Horários aprovados.',{exact:true}).waitFor();assert.equal(row.EntradaReal,'2026-10-30T08:15');
 await page.locator('#pc04_motivoHorario').fill('Admin registra diretamente');await detail.getByRole('button',{name:'Salvar horários manuais',exact:true}).click();await page.getByText('Horários manuais registrados.',{exact:true}).waitFor();assert.equal(requests.length,2);
 await confirm.click();await page.getByText('Contratação conferida e liberada.',{exact:true}).waitFor();assert.equal(row.Status,'LIBERADA');
 assert.equal(await page.locator('#pc04_entradaReal').isDisabled(),true);assert.equal(await page.locator('#pc04_novoValor').isDisabled(),true);assert.equal(await page.locator('#pc04_motivoCancelamento').isDisabled(),true);
 const before=writes.length;await detail.locator('form').evaluateAll(forms=>forms.forEach(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))));assert.equal(writes.length,before,'released handlers must not send writes');
 await detail.screenshot({path:'artifacts/manual-hours/released-390.png'});assert.equal(await detail.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).count(),0);
 row.Status='ABERTA';await reload();await open();assert.equal(await page.locator('#pc04_entradaReal').isDisabled(),true);assert.equal(await confirm.isDisabled(),true);assert.equal(await detail.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).count(),0);
 row.Status='CANCELADA';await reload();await open();assert.equal(await confirm.count(),0);assert.deepEqual(errors,[]);console.log('Horários UI PASS: gestor solicita, ADMIN localiza/nega/aprova/grava, pendência bloqueia liberação/tokens, ordem, bloqueio histórico e final, 1440/390.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
