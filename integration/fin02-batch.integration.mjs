import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('FIN02 lote: prévia completa, emissão parcial, retry e impressão HTTP/SQL',{skip:process.env.FIN02_BATCH_SQL_TESTS!=='YES',timeout:300000},async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 let now='2026-10-31T01:30:00Z';
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:'chave-de-teste-com-quarenta-caracteres-nao-hex',mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true,fin02Now:()=>new Date(now)};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga e descarga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200,extra={})=>{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();assert.equal(response.status,status,raw);let data;try{data=JSON.parse(raw);}catch{data=raw;}return {data,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(depot,day,release=true)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}return c;};
  await db.query(`WITH nums AS(SELECT TOP(103) ROW_NUMBER() OVER(ORDER BY object_id) N FROM sys.all_objects)
   INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,Valor,Status,Versao,CriadoPor,ConferidoPor,LiberadoEmUtc,ValorLiberado,LiberacaoBloqueada)
   SELECT N,1,1,1,1,CASE WHEN N<100 THEN '2026-11-01' ELSE '2026-11-05' END,CASE WHEN N<100 THEN '2026-11-01T08:00:00' ELSE '2026-11-05T08:00:00' END,CASE WHEN N<100 THEN '2026-11-01T12:00:00' ELSE '2026-11-05T12:00:00' END,CASE WHEN N<100 THEN '2026-11-01T08:00:00' ELSE '2026-11-05T08:00:00' END,CASE WHEN N<100 THEN '2026-11-01T12:00:00' ELSE '2026-11-05T12:00:00' END,'MANUAL','MANUAL',100,'LIBERADA',1,1,1,DATEADD(second,N,CONVERT(datetime2,'2026-11-06T10:00:00')),100,1 FROM nums;`);
  await create(1,'2026-11-03',false);await create(1,'2026-10-31');
  const base='/api/financeiro/recibos',range='?inicio=2026-11-01&fim=2026-11-05';
  await call(base+'/previa'+range,null,undefined,401);await call(base+'/previa'+range,actors.gestorA.cookie,undefined,403);
  const all=(await call(base+'/previa'+range,actors.financeiro.cookie)).data;assert.equal(all.quantidade,103);assert.equal(all.registros.length,103);assert.equal(all.total,'10300.00');assert.equal(all.jaEmitidos,0);assert.ok(Buffer.byteLength(all.previa)>8192);await call(base+'/gerar',admin,{previa:all.previa},403);
  assert.equal((await call(base+'/previa'+range+'&depositoId=2',admin)).data.quantidade,0);
  assert.equal((await call(base+'/previa'+range+'&prestadorId=999',admin)).data.quantidade,0);
  assert.equal((await call(base+'/previa?inicio=2026-11-01&fim=2026-11-01',admin)).data.quantidade,99);
  for(const query of ['','?inicio=2026-11-05&fim=2026-11-01','?inicio=2026-02-30&fim=2026-11-05','?inicio=2026-11-01&fim=2026-11-05&depositoId=1x'])await call(base+'/previa'+query,admin,undefined,400);
  await call('/api/financeiro/contratacoes/100/recibo',admin,{});
  const preview=(await call(base+'/previa?inicio=2026-11-05&fim=2026-11-05',admin)).data;assert.equal(preview.quantidade,3);assert.equal(preview.jaEmitidos,1);
  await call(base+'/gerar',actors.gestorA.cookie,{previa:preview.previa},403);
  await call(base+'/gerar',actors.financeiro.cookie,{previa:preview.previa},403);
  await call(base+'/gerar',admin,{previa:preview.previa+'x'},400);
  await call(base+'/gerar',admin,{previa:preview.previa},403,{Origin:'https://example.test'});
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo'))[0].N),1);
  await db.query("UPDATE Operacao.Contratacao SET Versao=2 WHERE ContratacaoId=103");
  await db.query("CREATE TRIGGER Seguranca.BatchReceiptFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'FIN02_EMITIR' AND JSON_VALUE(DetalhesJson,'$.contratacaoId')='102') THROW 55998,N'Falha sintetica',1;END");
  const first=(await call(base+'/gerar',admin,{previa:preview.previa})).data;assert.equal(first.gerados,1);assert.equal(first.falhas,2);assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo'))[0].N),2);assert.equal(first.resultados.find(r=>r.contratacaoId==='103').erro,'PREVIA_ALTERADA');
  await db.query('DROP TRIGGER Seguranca.BatchReceiptFail');
  const retried=(await call(base+'/gerar',admin,{previa:preview.previa})).data;assert.equal(retried.gerados,1);assert.equal(retried.ignorados,1);assert.equal(retried.falhas,1);
  const fresh=(await call(base+'/previa?inicio=2026-11-05&fim=2026-11-05',admin)).data;assert.equal(fresh.quantidade,1);assert.equal(fresh.jaEmitidos,3);
  const race=await Promise.all([call(base+'/gerar',admin,{previa:fresh.previa}),call(base+'/gerar',admin,{previa:fresh.previa})]);assert.equal(race.reduce((n,r)=>n+r.data.gerados,0),1);assert.equal(race.reduce((n,r)=>n+r.data.ignorados,0),1);
  cfg.fin02BatchNow=()=>Date.now()+16*60000;await call(base+'/gerar',admin,{previa:fresh.previa},409);delete cfg.fin02BatchNow;await call(base+'/gerar',admin,{previa:''},400);
  const printed=await call(base+'/impressao',actors.financeiro.cookie,{contratacaoIds:['101','102','103']});assert.equal((printed.data.match(/<main class="receipt">/g)||[]).length,3);assert.match(printed.data,/recibos\/estilo\.css/);const css=(await call(base+'/estilo.css',actors.financeiro.cookie)).data;assert.match(css,/break-after:page/);assert.match(printed.data,/Contratação 101/);assert.match(printed.data,/Contratação 103/);assert.ok(printed.headers.get('content-security-policy').includes("default-src 'none'"));assert.equal(printed.headers.get('cache-control'),'no-store');
  const browserServer=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1'}),browser=await chromium.connect(browserServer.wsEndpoint());
  try{
   const context=await browser.newContext(),[cookieName,cookieValue]=admin.split('=');await context.addCookies([{name:cookieName,value:cookieValue,url:origin}]);const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
   const popupEvent=page.waitForEvent('popup');await page.evaluate(async()=>{const popup=window.open('about:blank','_blank');popup.opener=null;const response=await fetch('/api/financeiro/recibos/impressao',{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify({contratacaoIds:['101','102','103']})});if(!response.ok)throw Error('Impressao recusada');const html=await response.text();popup.document.open();popup.document.write(html);popup.document.close();});
   const popup=await popupEvent;await popup.waitForFunction(()=>document.querySelector('h1')&&getComputedStyle(document.querySelector('h1')).textAlign==='center');assert.equal(await popup.locator('.receipt').count(),3);
   const pdf=await popup.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,3,'um recibo por página no PDF nativo');
   fs.mkdirSync('artifacts/fin02-batch',{recursive:true});fs.writeFileSync('artifacts/fin02-batch/recibos-sinteticos.pdf',pdf);await popup.screenshot({path:'artifacts/fin02-batch/impressao.png',fullPage:true});
  }finally{for(const context of browser.contexts())await context.close();await browserServer.kill();}
  await call(base+'/impressao',actors.gestorA.cookie,{contratacaoIds:['101']},403);await call(base+'/impressao',admin,{contratacaoIds:['101','999999']},404);await call(base+'/impressao',admin,{contratacaoIds:['1x']},400);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo'))[0].N),4);assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa'))[0].N),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Acao='FIN02_EMITIR'"))[0].N),4);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();try{if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);}finally{await master.close();}}
});
