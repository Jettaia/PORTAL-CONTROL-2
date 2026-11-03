// Opt-in, disposable SQL only. Never opens the installed pilot or JETTA_CONTROL.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {encryptedSecret} from '../src/mfa-b2b.js';
import {hotp} from '../src/totp.js';
import {nvarcharLiteral as s} from '../src/auth-db.js';



test('Solicitação pública, aprovação, recusa e autorização em SQL real',{
 skip:process.env.ACCESS_SQL_TESTS!=='YES'?'Requer ACCESS_SQL_TESTS=YES e PC01_SQL_SERVER (instância local de testes).':false
},async()=>{
 const sqlServer=process.env.PC01_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,b41:true,b32:true,b33:true,b34:false};
 const envKeys=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 let db,server,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();
  await completeSetup(cfg,{token:setup,password});await assert.rejects(()=>completeSetup(cfg,{token:setup,password}));
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','00000000001');");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async email=>{const r=await call('/api/auth/login',{body:{email,senha:password}});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],secret=crypto.randomBytes(20),cipher=encryptedSecret(secret),uid=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s(email)}`))[0].UsuarioId;
   await db.query(`INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave,ConfirmadoEmUtc) VALUES(${uid},0x${cipher.toString('hex')},1,SYSUTCDATETIME())`);
   assert.equal((await call('/api/mfa/verify',{cookie,body:{code:hotp(secret,Math.floor(Date.now()/30000)),purpose:'STEPUP'}})).status,200);return cookie;};
  const admin=await login('admin@example.test');
  const requestBody={nome:'Pessoa Solicitante',email:' NOVO@example.test '};
  const pending=()=>db.query("SELECT * FROM Seguranca.SolicitacaoAcesso WHERE Email=N'novo@example.test'");
  assert.equal((await call('/api/acesso/solicitacoes',{body:requestBody})).status,202);
  assert.equal((await pending()).length,1);
  assert.equal((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'novo@example.test'")).length,0);
  assert.equal((await call('/api/auth/login',{body:{email:'novo@example.test',senha:password}})).status,401);
  assert.equal((await call('/api/acesso/solicitacoes',{body:{...requestBody,funcoes:['ADMIN']}})).status,400);
  assert.equal((await call('/api/acesso/solicitacoes',{body:{nome:'X',email:'invalido'}})).status,400);
  assert.equal((await call('/api/acesso/solicitacoes',{body:requestBody})).status,202);
  assert.equal((await pending()).length,1);
  assert.equal((await call('/api/pc01/solicitacoes')).status,401);
  const rows=await (await call('/api/pc01/solicitacoes',{cookie:admin})).json();
  assert.equal(rows.solicitacoes.length,1);const id=String(rows.solicitacoes[0].SolicitacaoId);
  const decision={nome:'Pessoa Solicitante',email:'novo@example.test',senha:password,funcoes:['GESTOR'],depositos:[1],ativo:true};
  const approve=(body=decision,cookie=admin)=>call('/api/pc01/solicitacoes/'+id+'/aprovar',{cookie,body});
  assert.equal((await approve({...decision,senha:'fraca'})).status,400);
  assert.equal((await pending())[0].Estado,'PENDENTE');
  await db.query("CREATE TRIGGER Seguranca.Access_TestFailure ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao='ACESSO_APROVADO') THROW 51000,'Synthetic failure',1; END");
  try{assert.equal((await approve()).status,503);}finally{await db.query('DROP TRIGGER Seguranca.Access_TestFailure');}
  assert.equal((await pending())[0].Estado,'PENDENTE');
  assert.equal((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'novo@example.test'")).length,0);
  const results=await Promise.all([approve(),approve()]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const approved=(await pending())[0];assert.equal(approved.Estado,'APROVADA');assert.ok(approved.DecididoPor);assert.ok(approved.DecididoEmUtc);
  const manager=await login('novo@example.test');
  const context=await (await call('/api/auth/me',{cookie:manager})).json();assert.deepEqual(context.usuario.funcoes,['GESTOR']);assert.deepEqual(context.usuario.depositos,['1']);
  assert.equal((await call('/api/pc01/solicitacoes',{cookie:manager})).status,403);
  assert.equal((await approve(decision,manager)).status,403);
  assert.equal((await approve(decision,null)).status,401);
  assert.equal((await call('/api/acesso/solicitacoes',{body:{nome:'Pessoa Recusada',email:'recusa@example.test'}})).status,202);
  const rejectedId=String((await db.query("SELECT SolicitacaoId FROM Seguranca.SolicitacaoAcesso WHERE Email=N'recusa@example.test'"))[0].SolicitacaoId);
  const rejectPath='/api/pc01/solicitacoes/'+rejectedId+'/recusar';
  assert.equal((await call(rejectPath,{cookie:manager,body:{}})).status,403);
  assert.equal((await call(rejectPath,{cookie:admin,body:{}})).status,200);
  assert.equal((await call(rejectPath,{cookie:admin,body:{}})).status,409);
  assert.equal((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'recusa@example.test'")).length,0);
  assert.equal((await call('/api/auth/login',{body:{email:'recusa@example.test',senha:password}})).status,401);
  assert.equal((await db.query("SELECT Estado FROM Seguranca.SolicitacaoAcesso WHERE SolicitacaoId="+rejectedId))[0].Estado,'RECUSADA');
  const audit=await db.query("SELECT DetalhesJson FROM Seguranca.Auditoria WHERE Acao IN('ACESSO_APROVADO','ACESSO_RECUSADO')");assert.equal(audit.length,2);assert.ok(!JSON.stringify(audit).includes(password));
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
