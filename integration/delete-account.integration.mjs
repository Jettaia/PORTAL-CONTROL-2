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



test('Excluir conta: autorização, persistência, histórico e sessões em SQL real',{
 skip:process.env.DELETE_SQL_TESTS!=='YES'?'Requer DELETE_SQL_TESTS=YES e PC01_SQL_SERVER (instância local de testes).':false
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
  const body=email=>({nome:'Conta Teste',email,senha:password,ativo:true,funcoes:['GESTOR'],depositos:[1]});
  const create=async email=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:body(email)});assert.equal(r.status,201);return String((await r.json()).usuarioId);};
  const id=await create('excluir@example.test'),manager=await login('excluir@example.test');
  const remove=(cookie=admin,target=id)=>call('/api/pc01/usuarios/'+target,{cookie,method:'DELETE',body:{}});
  assert.equal((await remove()).status,200);
  const deleted=(await db.query('SELECT Ativo,ExcluidoEmUtc,ExcluidoPor FROM Seguranca.Usuario WHERE UsuarioId='+id))[0];
  assert.equal(Number(deleted.Ativo),0);assert.ok(deleted.ExcluidoEmUtc);assert.equal(Number(deleted.ExcluidoPor),1);
  assert.equal((await call('/api/auth/me',{cookie:manager})).status,401);
  assert.equal((await call('/api/auth/login',{body:{email:'excluir@example.test',senha:password}})).status,401);
  assert.equal((await remove()).status,404);
  const catalog=await(await call('/api/pc01/usuarios',{cookie:admin})).json();assert.ok(!catalog.usuarios.some(u=>String(u.UsuarioId)===id));
  const editBody=body('excluir@example.test');delete editBody.senha;
  assert.equal((await call('/api/pc01/usuarios/'+id,{cookie:admin,method:'PUT',body:editBody})).status,404);
  assert.equal((await call('/api/pc01/usuarios/'+id+'/senha',{cookie:admin,body:{senha:password,confirmacao:password}})).status,404);
  assert.equal((await db.query('SELECT * FROM Seguranca.Auditoria WHERE EntidadeId='+id+" AND Entidade='Usuario' AND Acao='PC01_CRIAR'")).length,1,'Histórico anterior preservado');
  assert.equal((await db.query('SELECT * FROM Seguranca.Auditoria WHERE EntidadeId='+id+" AND Acao='PC01_EXCLUIR'")).length,1);
  assert.equal((await db.query('SELECT * FROM Seguranca.UsuarioDeposito WHERE UsuarioId='+id+' AND RevogadoEmUtc IS NULL')).length,0);
  const second=await create('preservar@example.test'),otherManager=await login('preservar@example.test');
  assert.equal((await remove(null,second)).status,401);assert.equal((await remove(otherManager,second)).status,403);
  assert.equal((await remove(admin,'1')).status,409,'Não excluir própria conta/último ADM');
  assert.equal((await remove(admin,'abc')).status,400);
  await db.query("CREATE TRIGGER Seguranca.Delete_TestFailure ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao='PC01_EXCLUIR') THROW 51000,'Synthetic failure',1; END");
  try{assert.equal((await remove(admin,second)).status,503);}finally{await db.query('DROP TRIGGER Seguranca.Delete_TestFailure');}
  const preserved=(await db.query('SELECT Ativo,ExcluidoEmUtc FROM Seguranca.Usuario WHERE UsuarioId='+second))[0];assert.equal(Number(preserved.Ativo),1);assert.equal(preserved.ExcluidoEmUtc,null);
  assert.equal((await call('/api/auth/me',{cookie:otherManager})).status,200);
  // Inactivation remains reversible and distinct from deletion.
  const update={...editBody,email:'preservar@example.test',ativo:false};
  assert.equal((await call('/api/pc01/usuarios/'+second,{cookie:admin,method:'PUT',body:update})).status,200);
  assert.equal((await call('/api/pc01/usuarios/'+second,{cookie:admin,method:'PUT',body:{...update,ativo:true}})).status,200);
  const race=await Promise.all([remove(admin,second),remove(admin,second)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,404]);
  await assert.rejects(()=>db.query('UPDATE Seguranca.Usuario SET Ativo=1 WHERE UsuarioId='+id),'Banco impede reativação por rota alternativa');
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
