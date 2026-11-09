import test from 'node:test';
import express from 'express';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
test('PC04 UI: criar sem data separada, resumo e editar previsão',async()=>{
const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let browser,browserServer;
try{
 browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(8000);let created=false;const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const row={ContratacaoId:999,Numero:999,DepositoId:1,PrestadorId:1,TipoServicoId:1,Prestador:'Prestador sintético',Deposito:'Depósito sintético',Tipo:'Descarga',DataServico:'2026-11-05',InicioPrevisto:'2026-11-05T08:00',FimPrevisto:'2026-11-05T18:00',Valor:'100.00',Status:'ABERTA',Versao:1,GestorResponsavelId:1,GestorResponsavel:'Administrador sintético',CriadoPor:1};
 await page.route('**/api/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname.replace(/^\/chapa/,'');requests.push(req.method()+' '+p);let body={};let status=200;
 if(p==='/api/auth/me')body={usuario:{id:1,nome:'ADM sintético',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
 else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true,fin01:true};
 else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
 else if(p==='/api/pc04/catalogo')body={depositos:[{DepositoId:1,Nome:'Depósito sintético'}],tipos:[{TipoServicoId:1,Nome:'Descarga'}],prestadores:[{PrestadorId:1,Nome:'Prestador sintético',CPF:'00000000000',DepositoId:1}],gestores:[{UsuarioId:1,Nome:'Administrador sintético',DepositoId:1}],podeOperar:true,podeAprovarHorarios:true};
 else if(p==='/api/pc04/horarios-pendentes')body={registros:[]};
 else if(p==='/api/pc05/status')body={pc05:true};
 else if(p==='/api/pc04/media')body={media:null,quantidade:0,minimo:3};
 else if(p==='/api/pc04/contratacoes'&&req.method()==='POST'){const b=req.postDataJSON();assert.equal(b.dataServico,undefined);assert.equal(b.inicioPrevisto,'2026-11-05T08:00');created=true;body={ok:true,resultado:row};status=201;}
 else if(p==='/api/pc04/contratacoes')body={registros:created?[row]:[],proximaPagina:null};
 else if(p==='/api/pc04/contratacoes/999/previstos'){const b=req.postDataJSON();assert.equal(b.versao,row.Versao);row.InicioPrevisto=b.inicioPrevisto;row.FimPrevisto=b.fimPrevisto;row.DataServico=b.inicioPrevisto.slice(0,10);row.Versao++;body={ok:true,resultado:row};}
 else if(p==='/api/pc04/contratacoes/999')body={registro:row,eventos:[],podeOperar:true,pc05:true};
 await route.fulfill({status,json:body});
 });
 await page.goto(process.env.PC04_FEEDBACK_URL||`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
 await page.getByRole('button',{name:'Criar contratação',exact:true}).waitFor();
 for(const [name,value]of [['prestadorId','1'],['tipoServicoId','1'],['gestorId','1']])await page.locator('#pc04_'+name).selectOption(value);
 for(const [name,value]of [['inicioPrevisto','2026-11-05T08:00'],['fimPrevisto','2026-11-05T18:00'],['valor','100,00']])await page.locator('#pc04_'+name).fill(value);
 await page.getByRole('button',{name:'Criar contratação',exact:true}).click();
 await page.getByText('Contratação criada.',{exact:true}).waitFor();
 assert.equal(await page.locator('#pc04_dataServico').count(),0);
 const summary=page.locator('#pc04Detail .pc04-summary');
 assert.equal(await summary.locator('dt').filter({hasText:/^Depósito$/}).count(),1);
 assert.equal(await summary.locator('dt').filter({hasText:/^Atividade$/}).count(),1);
 assert.equal(await summary.locator('dt').filter({hasText:'Depósito / atividade'}).count(),0);
 const edit=page.locator('#pc04Detail section').filter({has:page.getByRole('heading',{name:'Horários previstos',exact:true})});
 await edit.getByLabel('Entrada prevista',{exact:true}).fill('2026-11-06T22:00');
 await edit.getByLabel('Saída prevista',{exact:true}).fill('2026-11-07T06:00');
 await edit.getByRole('button',{name:'Salvar horários previstos',exact:true}).click();
 await page.getByText('Horários previstos atualizados.',{exact:true}).waitFor();
 assert.equal(row.DataServico,'2026-11-06');
 assert.ok((await summary.innerText()).includes('2026-11-06 22:00'));
 assert.deepEqual(errors,[]);
 fs.mkdirSync('artifacts/pc04-planned',{recursive:true});
 await page.locator('#pc04Detail').screenshot({path:'artifacts/pc04-planned/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#pc04Detail').screenshot({path:'artifacts/pc04-planned/mobile.png'});
 assert.equal(await edit.getByRole('button',{name:'Salvar horários previstos',exact:true}).isVisible(),true);
 assert.ok(requests.includes('POST /api/pc04/contratacoes/999/previstos'));
}finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
