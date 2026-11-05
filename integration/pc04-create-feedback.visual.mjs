import express from 'express';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(8000);let created=false,rejectDuplicate=true;const requests=[],errors=[];
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
 else if(p==='/api/pc04/media')body={disponivel:false};
 else if(p==='/api/pc04/contratacoes'&&req.method()==='POST'){if(rejectDuplicate){body={erro:'PRESTADOR_JA_CONTRATADO_NA_DATA'};status=409;}else{created=true;body={ok:true,resultado:row};status=201;}}
 else if(p==='/api/pc04/contratacoes')body={registros:created?[row]:[],proximaPagina:null};
 else if(p==='/api/pc04/contratacoes/999')body={registro:row,eventos:[],podeOperar:true,pc05:true};
 await route.fulfill({status,json:body});
 });
 await page.goto(process.env.PC04_FEEDBACK_URL||`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
 await page.getByRole('button',{name:'Criar contratação',exact:true}).waitFor();
 for(const [name,value]of [['prestadorId','1'],['tipoServicoId','1'],['gestorId','1']])await page.locator('#pc04_'+name).selectOption(value);
 for(const [name,value]of [['dataServico','2026-11-05'],['inicioPrevisto','2026-11-05T08:00'],['fimPrevisto','2026-11-05T18:00'],['valor','100,00']])await page.locator('#pc04_'+name).fill(value);
 await page.getByRole('button',{name:'Criar contratação',exact:true}).click();
 const createForm=page.locator('#pc04_valor').locator('..').locator('..');
 const feedback=createForm.getByText('Operação recusada: Já existe contratação deste prestador para a data.',{exact:true});
 await feedback.waitFor({state:'visible',timeout:2500});
 assert.ok(await feedback.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'recusa deve estar visível junto do botão');
 fs.mkdirSync('artifacts/pc04-feedback',{recursive:true});await page.screenshot({path:'artifacts/pc04-feedback/duplicate.png'});
 assert.equal(await page.locator('#pc04_valor').inputValue(),'100,00');assert.equal(await page.getByRole('button',{name:'Criar contratação',exact:true}).isEnabled(),true);
 const postsBefore=requests.filter(r=>r==='POST /api/pc04/contratacoes').length;
 await page.locator('#pc04_valor').fill('inválido');await page.getByRole('button',{name:'Criar contratação',exact:true}).click();
 await createForm.getByText('Informe um valor com até duas casas decimais.',{exact:true}).waitFor();assert.equal(requests.filter(r=>r==='POST /api/pc04/contratacoes').length,postsBefore);
 await page.locator('#pc04_valor').fill('100');rejectDuplicate=false;
 await page.getByRole('button',{name:'Criar contratação',exact:true}).click();
 await page.getByText('Contratação criada.',{exact:true}).waitFor();assert.ok(created);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',surface:'real UI, synthetic APIs, ADMIN duplicate feedback, invalid amount and successful creation',requests,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
