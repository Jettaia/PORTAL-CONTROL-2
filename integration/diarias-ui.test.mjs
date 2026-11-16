import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

test('Diárias: total previsto exato, estados, paginação, filtros e layout operacional',async t=>{
 const server=express().use(express.static('public')).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1531,height:1000}});page.setDefaultTimeout(8000);const errors=[],posts=[],queries=[];page.on('pageerror',e=>errors.push(e.message));
 let fail=false,mode='normal',operational=true,releaseOld,hold=false;
 const base={DepositoId:1,DataServico:'2026-11-12',Status:'ABERTA',Tipo:'Descarga',InicioPrevisto:'2026-11-12T08:00',FimPrevisto:'2026-11-12T17:00'};
 const item=(id,Prestador,Valor,extra={})=>({...base,ContratacaoId:id,Numero:id,Prestador,Valor,...extra});
 const longName='Prestador com nome completo muito longo '.repeat(4).slice(0,160);
 const rows=[item(9,'Anderson Silva','100.10'),item(8,'Carlos Santos','200.20',{EntradaReal:'2026-11-12T08:02'}),item(7,'Entrada manual','0.10',{EntradaReal:'2026-11-12T08:00'}),item(6,'Horários pendentes','50.05',{EntradaReal:'2026-11-12T08:00',HorarioPendenteId:12}),item(5,'Liberado','300.30',{Status:'LIBERADA',EntradaReal:'2026-11-12T08:00',SaidaReal:'2026-11-12T17:00'}),item(4,'Serviço concluído','125.25',{EntradaReal:'2026-11-12T08:00',SaidaReal:'2026-11-12T17:00'}),item(3,'Cancelado','999999.99',{Status:'CANCELADA',EntradaReal:'2026-11-12T08:00'}),item(2,longName,'10.00')];
 await page.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;let body={registros:[],naoLidas:0},status=200;
  if(req.method()==='POST')posts.push(p);
  if(p==='/api/auth/me')body={usuario:{id:1,nome:'Gestora',perfil:operational?'GESTOR':'FINANCEIRO',funcoes:[operational?'GESTOR':'FINANCEIRO'],pc04:true,pc05:true},mfa:{necessarioParaAcoesSensiveis:false}};
  if(p==='/api/pc04/catalogo')body={podeOperar:operational,depositos:[{DepositoId:1,Nome:'Depósito de teste'},{DepositoId:2,Nome:'Outro depósito'}]};
  if(p==='/api/pc04/contratacoes'){
   queries.push(Object.fromEntries(u.searchParams));if(hold&&!u.searchParams.has('antes')){hold=false;await new Promise(r=>releaseOld=r);}
   if(fail){status=503;body={erro:'CONTRATACOES_INDISPONIVEIS'};}
   else if(u.searchParams.get('dataServico')==='2026-11-13')body={registros:[]};
   else if(mode==='dense')body={registros:Array.from({length:30},(_,i)=>item(100+i,i===0?longName:'Prestador '+i,'125.50',{EntradaReal:i%3?'2026-11-12T08:00':null,SaidaReal:i%3===2?'2026-11-12T17:00':null}))};
   else if(mode==='huge')body={registros:[item(1,longName,'9007199254740991.99'),item(2,'Centavo','0.01')]};
   else if(mode==='missing')body={registros:[item(1,'Sem valor',null)]};
   else if(u.searchParams.get('depositoId')==='2')body={registros:[item(1,'Dez centavos','0.10'),item(2,'Vinte centavos','0.20')]};
   else body={registros:u.searchParams.has('antes')?rows.slice(4):rows.slice(0,4),proximaPagina:u.searchParams.has('antes')?null:'6'};
  }
  if(p==='/api/mfa/status')body={enabled:false};
  if(p==='/api/pc04/contratacoes/9')body={registro:rows[0],podeOperar:false,solicitacoesHorarios:[],eventos:[]};
  await route.fulfill({status,json:body});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/#diarias`);await page.locator('#diariasDate').fill('2026-11-12');
 const host=page.locator('#diariasPage'),total=host.locator('#diariasTotal');await total.getByText('R$ 786,00',{exact:true}).waitFor();
 assert.equal(await host.locator('input[type=checkbox]').count(),0);assert.equal(await host.getByRole('button',{name:/tokens|códigos|Selecionar abertas/}).count(),0);
 for(const [key,count]of [['entry',2],['exit',2],['done',2],['pending',1],['cancelled',1]])assert.equal(await host.locator(`[data-status="${key}"] .diarias-person`).count(),count);
 assert.equal(await host.getByRole('link',{name:'Abrir contratação 9 de Anderson Silva',exact:true}).getAttribute('href'),'#contratacoes/9/resumo');
 await page.locator('#diariasSearch').fill('manual');assert.equal(await host.locator('.diarias-person').count(),1);assert.match(await total.innerText(),/786,00/);
 await page.locator('#diariasSearch').fill('');rows[1].Valor='200.25';await host.getByRole('button',{name:'Atualizar',exact:true}).click();await total.getByText('R$ 786,05',{exact:true}).waitFor();
 await page.locator('#diariasDepot').selectOption('2');await total.getByText('R$ 0,30',{exact:true}).waitFor();
 await page.locator('#diariasDate').fill('2026-11-13');await host.getByText('Nenhuma contratação neste dia.',{exact:true}).waitFor();await total.getByText('R$ 0,00',{exact:true}).waitFor();
 await page.locator('#diariasDate').fill('2026-11-12');await total.getByText('R$ 0,30',{exact:true}).waitFor();await page.locator('#diariasDepot').selectOption('1');await total.getByText('R$ 786,05',{exact:true}).waitFor();
 const dir='artifacts/diarias-presenca-'+Date.now();fs.mkdirSync(dir,{recursive:true});
 for(const scenario of ['normal','dense','huge']){
  mode=scenario;await host.getByRole('button',{name:'Atualizar',exact:true}).click();await host.getByRole('button',{name:'Atualizar',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#diariasPage button.diarias-refresh').disabled);await page.evaluate(()=>document.fonts.ready);
  if(mode==='huge')await total.getByText('R$ 9.007.199.254.740.992,00',{exact:true}).waitFor();
  for(const width of [1531,390]){
   await page.setViewportSize({width,height:1000});await page.screenshot({path:`${dir}/${scenario}-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sem overflow '+scenario+' '+width);
   await host.getByRole('button',{name:'Atualizar',exact:true}).hover();assert.equal(await host.getByRole('button',{name:'Atualizar',exact:true}).evaluate(e=>getComputedStyle(e).color),'rgb(18, 61, 102)');
   for(const el of await host.locator('.diarias-person:visible').all()){const box=await el.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'Pessoa alcançável');}
  }
 }
 mode='missing';await host.getByRole('button',{name:'Atualizar',exact:true}).click();await total.getByText('Indisponível',{exact:true}).waitFor();
 fail=true;await host.getByRole('button',{name:'Atualizar',exact:true}).click();await host.getByRole('status').filter({hasText:/Não foi possível carregar/}).waitFor();assert.equal(await host.locator('.diarias-person').count(),0);assert.doesNotMatch(await total.innerText(),/R\$ 0,00/);await page.screenshot({path:dir+'/error-390.png',fullPage:true});
 fail=false;mode='normal';await host.getByRole('button',{name:'Atualizar',exact:true}).click();await total.getByText('R$ 786,05',{exact:true}).waitFor();
 // A response for a previous day cannot replace the current selection.
 hold=true;await host.getByRole('button',{name:'Atualizar',exact:true}).click();await host.getByText('Consultando diárias…',{exact:true}).waitFor();await page.evaluate(()=>{const e=document.querySelector('#diariasDate');e.value='2026-11-13';e.dispatchEvent(new Event('change'));});await total.getByText('R$ 0,00',{exact:true}).waitFor();releaseOld();await page.getByText('Nenhuma contratação neste dia.',{exact:true}).waitFor();assert.match(await total.innerText(),/0,00/);
 await page.locator('#diariasDate').fill('2026-11-12');await total.getByText('R$ 786,05',{exact:true}).waitFor();await host.getByRole('link',{name:'Abrir contratação 9 de Anderson Silva',exact:true}).click();await page.locator('#pc04Dialog').getByRole('heading',{name:'Contratação #9',exact:true}).waitFor();
 operational=false;await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('[data-page=diarias]').isVisible(),false);
 assert.equal(posts.length,0);assert.ok(queries.some(q=>q.antes==='6'&&q.dataServico==='2026-11-12'&&q.depositoId==='1'));assert.deepEqual(errors,[]);
 fs.writeFileSync(dir+'/evidence.json',JSON.stringify({viewports:[1531,390],scenarios:['normal','dense','huge','error'],theme:'light',data:'real UI with synthetic HTTP',hashes:Object.fromEntries(['public/diarias.js','public/diarias.css'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2));console.log('Evidências: '+dir);
});
