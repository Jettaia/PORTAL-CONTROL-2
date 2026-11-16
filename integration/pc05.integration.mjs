// Opt-in real HTTP/auth/SQL proof. Uses only a newly created disposable local database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {chromium} from 'playwright';

test('PC05 CPF fixo: navegador/HTTP/SQL real sem emissão, replay, concorrência e saída',{
 skip:process.env.PC05_SQL_TESTS!=='YES'?'Requer PC05_SQL_TESTS=YES e servidor local explícito':false,timeout:180000
},async()=>{
 const sqlServer=process.env.PC05_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,b32:true,b33:true,b41:true};
 let db,server,browser,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();await completeSetup(cfg,{token:setup,password});
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body}={})=>fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const expect=async(response,status=200)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
  const login=await call('/api/auth/login',{body:{email:'admin@example.test',senha:password}});await expect(login);const admin=login.headers.get('set-cookie').split(';')[0];
  const depot=(await expect(await call('/api/b24a/depositos',{cookie:admin,body:{nome:'Depósito CPF',centroCusto:'CC-A',rua:'Rua A',numero:'1',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010000'}}),201)).resultado.DepositoId;
  const service=(await expect(await call('/api/b24a/servicos',{cookie:admin,body:{nome:'Serviço CPF',descricao:''}}),201)).resultado.TipoServicoId;
  const today=(await db.query("SELECT CONVERT(varchar(10),SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time',23) Dia"))[0].Dia;
  const create=async(name,cpf)=>{const p=(await expect(await call('/api/b24a/chapas',{cookie:admin,body:{nome:name,cpf,telefone:'',cnpj:'',depositos:[Number(depot)]}}),201)).resultado;return (await expect(await call('/api/pc04/contratacoes',{cookie:admin,body:{depositoId:Number(depot),gestorId:1,prestadorId:Number(p.PrestadorId),tipoServicoId:Number(service),inicioPrevisto:today+'T00:00',fimPrevisto:today+'T23:59',valor:'125.50'}}),201)).resultado;};
  const contract=await create('Pessoa CPF','01234567890'),contractPath='/api/pc04/contratacoes/'+contract.ContratacaoId;
  const detail=()=>call(contractPath,{cookie:admin}).then(expect);assert.equal((await detail()).codigoRegistro,'0123');
  await expect(await call('/api/pc05/contratacoes/'+contract.ContratacaoId+'/tokens',{cookie:admin,body:{versao:1,tipo:'ENTRADA'}}),410);
  const pair=await expect(await call('/api/pc05/tablets',{cookie:admin,body:{nome:'Tablet CPF',depositos:[Number(depot)]}}));
  const activation=await call('/api/pc05/tablet/habilitar',{body:{pareamento:pair.pareamento}});await expect(activation);const tabletCookie=activation.headers.get('set-cookie').split(';')[0];
  const consume=body=>call('/api/pc05/tablet/apontar',{cookie:tabletCookie,body});
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
  const context=await browser.newContext(),[name,...values]=tabletCookie.split('=');await context.addCookies([{name,value:values.join('='),url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let sent;
  page.on('request',r=>{if(r.url().endsWith('/apontar'))sent=r.postDataJSON();});
  await page.goto(base+'/tablet.html');await page.locator('#operation').waitFor({state:'visible'});await page.locator('#code').fill('0123');await page.getByRole('button',{name:'Confirmar código',exact:true}).click();await page.getByText('Token aceito',{exact:true}).waitFor();
  assert.ok(sent.requisicaoId);assert.deepEqual(await expect(await consume(sent)),{ok:true,mensagem:'Token aceito'});
  const raceBodies=[1,2].map(()=>({codigo:'0123',requisicaoId:crypto.randomUUID()})),race=await Promise.all(raceBodies.map(consume));for(const r of race)await expect(r);
  let actual=(await detail()).registro;assert.ok(actual.EntradaReal);assert.equal(actual.SaidaReal,null);assert.equal(actual.Valor,'125.50');assert.equal(actual.EntradaOrigem,'TOKEN');
  const count=async()=>Number((await db.query(`SELECT COUNT(*) N FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${contract.ContratacaoId} AND Acao='TOKEN_USAR'`))[0].N);assert.equal(await count(),1);
  // A distinct later submission represents the real exit, rather than transport retry.
  await db.query("WAITFOR DELAY '00:00:10.100'");
  await expect(await consume(raceBodies[0]));assert.equal((await detail()).registro.SaidaReal,null,'Retry tardio de repetição não pode virar saída');
  const exit={codigo:'0123',requisicaoId:crypto.randomUUID()};await expect(await consume(exit));await expect(await consume(exit));await expect(await consume(sent));
  actual=(await detail()).registro;assert.ok(actual.SaidaReal);assert.equal(actual.SaidaOrigem,'TOKEN');assert.equal(actual.Status,'ABERTA');assert.equal(actual.Valor,'125.50');assert.equal(await count(),2);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Operacao.ContratacaoToken'))[0].N),0);
  await create('Coincidência A','45671234567');await create('Coincidência B','45679876543');await expect(await consume({codigo:'4567'}),409);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Operacao.Contratacao WHERE EntradaReal IS NOT NULL'))[0].N),1);
  // Real internal detail remains readable without issuing a code.
  const internal=await browser.newContext(),[adminName,...adminValue]=admin.split('=');await internal.addCookies([{name:adminName,value:adminValue.join('='),url:base}]);const ip=await internal.newPage();ip.on('pageerror',e=>errors.push(e.message));
  await ip.goto(base+'/#contratacoes/'+contract.ContratacaoId+'/tokens');await ip.getByRole('textbox',{name:'Código para entrada e saída',exact:true}).waitFor();assert.equal(await ip.getByRole('textbox',{name:'Código para entrada e saída',exact:true}).inputValue(),'0123');
  fs.mkdirSync('artifacts/pc05-fixed-code',{recursive:true});await ip.screenshot({path:'artifacts/pc05-fixed-code/sql-real-internal.png'});await page.screenshot({path:'artifacts/pc05-fixed-code/sql-real-tablet.png'});assert.deepEqual(errors,[]);
  await expect(await call('/api/pc05/tablets/'+pair.tabletId+'/revogar',{cookie:admin,body:{}}));await expect(await consume({codigo:'0123'}),401);
 }finally{
  if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();
  if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
 }
});
