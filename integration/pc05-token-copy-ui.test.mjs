import test from 'node:test';
import express from 'express';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
test('PC05 UI: token persistente e cópia desktop/mobile',async()=>{
const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let browser,browserServer;
try{
 browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'});browser=await chromium.connect(browserServer.wsEndpoint());
 for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:{width:1440,height:1100},isMobile:mobile,hasTouch:mobile,permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();page.setDefaultTimeout(8000);let created=true,issued=0,failNext=false;const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const row={ContratacaoId:999,Numero:999,DepositoId:1,PrestadorId:1,TipoServicoId:1,Prestador:'Prestador sintético',Deposito:'Depósito sintético',Tipo:'Descarga',DataServico:'2026-11-05',InicioPrevisto:'2026-11-05T08:00',FimPrevisto:'2026-11-05T18:00',Valor:'100.00',Status:'ABERTA',Versao:1,GestorResponsavelId:1,GestorResponsavel:'Administrador sintético',CriadoPor:1,EntradaReal:'2026-11-05T08:00'};
 await page.route('**/api/**',async route=>{
 const req=route.request(),p=new URL(req.url()).pathname.replace(/^\/chapa/,'');requests.push(req.method()+' '+p);let body={};let status=200;
 if(p==='/api/auth/me')body={usuario:{id:1,nome:'ADM sintético',perfil:mobile?'GESTOR':'ADMIN',funcoes:[mobile?'GESTOR':'ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
 else if(p==='/api/conta')body={pc01:true,pc04:true,pc05:true,fin01:true};
 else if(p==='/api/mfa/status')body={enabled:false,enrolled:false,verified:false,stepUp:false};
 else if(p==='/api/pc04/catalogo')body={depositos:[{DepositoId:1,Nome:'Depósito sintético'}],tipos:[{TipoServicoId:1,Nome:'Descarga'}],prestadores:[{PrestadorId:1,Nome:'Prestador sintético',CPF:'00000000000',DepositoId:1}],gestores:[{UsuarioId:1,Nome:'Administrador sintético',DepositoId:1}],podeOperar:true,podeAprovarHorarios:true};
 else if(p==='/api/pc04/horarios-pendentes')body={registros:[]};
 else if(p==='/api/pc05/status')body={pc05:true};
 else if(p==='/api/pc04/media')body={media:null,quantidade:0,minimo:3};
 else if(p==='/api/pc04/contratacoes'&&req.method()==='POST'){const b=req.postDataJSON();assert.equal(b.dataServico,undefined);assert.equal(b.inicioPrevisto,'2026-11-05T08:00');created=true;body={ok:true,resultado:row};status=201;}
 else if(p==='/api/pc04/contratacoes')body={registros:created?[row]:[],proximaPagina:null};
 else if(p==='/api/pc05/contratacoes/999/tokens'){if(failNext){failNext=false;status=409;body={erro:'TOKEN_INDISPONIVEL'};}else{issued++;row.Versao++;body={codigo:issued===1?'0123':'8765',versao:row.Versao,expiraEmUtc:new Date(Date.now()+3600000).toISOString()};}}
 else if(p==='/api/pc04/contratacoes/999/previstos'){const b=req.postDataJSON();assert.equal(b.versao,row.Versao);row.InicioPrevisto=b.inicioPrevisto;row.FimPrevisto=b.fimPrevisto;row.DataServico=b.inicioPrevisto.slice(0,10);row.Versao++;body={ok:true,resultado:row};}
 else if(p==='/api/pc04/contratacoes/999')body={registro:row,eventos:[],podeOperar:true,pc05:true,entradaTokenUsada:true};
 await route.fulfill({status,json:body});
 });
 await page.goto(process.env.PC04_FEEDBACK_URL||`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=contratacoes]').click();
 await page.getByRole('button',{name:'Criar contratação',exact:true}).waitFor();
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).waitFor();
 // Existing entry enables saída; use saída first, then model a new available entry for replacement.
 row.EntradaReal=null;
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 if(mobile)await page.setViewportSize({width:390,height:844});
 await page.clock.install();
 await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();
 const code=page.getByRole('textbox',{name:'Token gerado',exact:true});
 await code.waitFor();assert.equal(await code.inputValue(),'0123');
 await page.clock.fastForward(31000);
 assert.equal(await code.inputValue(),'0123');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await code.inputValue(),'0123');
 assert.ok(!(await page.locator('#pc05Secret').innerText()).includes('30 segundos'));
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 await page.getByText('Token copiado!',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Token de entrada: 0123');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Negado','NotAllowedError'))}}));
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 await page.getByText('Texto selecionado. Use a opção Copiar do seu dispositivo.',{exact:true}).waitFor();
 assert.equal(await code.inputValue(),'Token de entrada: 0123');
 assert.ok(await code.evaluate(e=>e.scrollWidth<=e.clientWidth),'Texto completo visível para cópia manual');
 assert.deepEqual(await code.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,'Token de entrada: 0123'.length]);
 await page.evaluate(()=>delete navigator.clipboard);
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 await page.getByText('Token copiado!',{exact:true}).waitFor();
 assert.equal(await code.inputValue(),'0123');
 failNext=true;
 await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#pc04Message').textContent.includes('Operação recusada'));
 assert.equal(await code.inputValue(),'0123');
 await page.getByRole('button',{name:'Gerar / substituir entrada',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Token gerado"]')?.value==='8765');
 row.EntradaReal='2026-11-05T08:00';
 // A fresh detail refresh permits saída; generation must replace the displayed code.
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await page.getByRole('button',{name:'Gerar / substituir saída',exact:true}).click();
 await code.waitFor();assert.equal(await code.inputValue(),'8765');
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Token de saída: 8765');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Negado','NotAllowedError'))}}));
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 await page.getByText('Texto selecionado. Use a opção Copiar do seu dispositivo.',{exact:true}).waitFor();
 assert.equal(await code.inputValue(),'Token de saída: 8765');
 assert.ok(await code.evaluate(e=>e.scrollWidth<=e.clientWidth),'Texto completo visível para cópia manual');
 assert.deepEqual(await code.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,'Token de saída: 8765'.length]);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
 await page.getByRole('button',{name:'Copiar token',exact:true}).click();
 assert.equal(await code.inputValue(),'Token de saída: 8765');
 assert.deepEqual(await code.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,'Token de saída: 8765'.length]);
 assert.deepEqual(errors,[]);
 fs.mkdirSync('artifacts/pc05-copy',{recursive:true});
 await page.locator('#pc05Secret').screenshot({path:'artifacts/pc05-copy/'+(mobile?'mobile':'desktop')+'.png'});
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Copiar token',exact:true}).count(),0);
 await page.getByRole('button',{name:'Gerar / substituir saída',exact:true}).click();
 await code.waitFor();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:auth',{detail:null})));
 assert.equal(await page.getByRole('textbox',{name:'Token gerado',exact:true}).count(),0);
 await context.close();
 }
}finally{if(browser)for(const context of browser.contexts())await context.close();await browserServer?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
