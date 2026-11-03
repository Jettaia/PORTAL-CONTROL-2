// Opt-in SQL integration: creates and drops only a random disposable test database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken,passwordValid} from '../src/security.js';
import {resetPassword} from '../src/pc01.js';

test('senhas PC01: HTTP, persistência SQL, sessão, autorização, rollback e concorrência',{
 skip:process.env.PC01_PASSWORD_SQL_TESTS!=='YES'?'Requer PC01_PASSWORD_SQL_TESTS=YES e PC01_SQL_SERVER local.':false,timeout:120000
},async t=>{
 const sqlServer=process.env.PC01_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,mfaRequired:false};
 const password='Cc3!de',newPassword='Aa1!bc',nextPassword='Bb2!cd';
 const master=await connectPilot('master',sqlServer);let db,server,created=false;
 try{
  await master.query(`CREATE DATABASE [${database}]`);created=true;db=await connectPilot(database,sqlServer);
  await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex');await seedCatalog(db);
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);
  await completeSetup(cfg,{token:setup,password});
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;
  const base=`http://127.0.0.1:${cfg.port}`;
  const call=(url,{cookie,body,origin=base,method=body?'POST':'GET'}={})=>fetch(base+url,{method,headers:{Origin:origin,'Content-Type':'application/json','x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async(email,pwd=password)=>{const r=await call('/api/auth/login',{body:{email,senha:pwd}});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.headers.get('set-cookie').split(';')[0];};
  const admin=await login('admin@example.test');
  const create=async(email,funcoes)=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Pessoa Teste',email,funcoes,depositos:[],ativo:true,senha:password}});assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return (await r.json()).usuarioId;};
  const managerId=await create('gestor@example.test',['GESTOR']),financeId=await create('financeiro@example.test',['FINANCEIRO']);
  const manager=await login('gestor@example.test'),managerOther=await login('gestor@example.test'),finance=await login('financeiro@example.test');
  const changeBody={senhaAtual:password,senha:newPassword,confirmacao:newPassword},resetBody={senha:newPassword,confirmacao:newPassword};
  const credential=async id=>(await db.query(`SELECT SaltHex,SenhaHashHex,Falhas,BloqueadoAteUtc FROM Seguranca.Credencial WHERE UsuarioId=${id}`))[0];
  const auditCount=async()=>Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria'))[0].N);
  assert.equal((await call('/api/pc01/minha-senha',{body:changeBody})).status,401);
  assert.equal((await call('/api/pc01/minha-senha',{cookie:manager,body:changeBody,origin:'http://forged.test'})).status,403);
  for(const cookie of [manager,finance])assert.equal((await call('/api/pc01/usuarios/1/senha',{cookie,body:resetBody})).status,403);
  const original=await credential(managerId),beforeAudit=await auditCount();
  for(const body of [{...changeBody,senha:'Aa1!b',confirmacao:'Aa1!b'},{...changeBody,confirmacao:'Outro1!'},{...changeBody,usuarioId:financeId}])assert.equal((await call('/api/pc01/minha-senha',{cookie:manager,body})).status,400);
  assert.deepEqual(await credential(managerId),original);assert.equal(await auditCount(),beforeAudit);
  assert.equal((await call('/api/pc01/minha-senha',{cookie:manager,body:{...changeBody,senhaAtual:'Incorreta1!'}})).status,400);
  assert.equal((await credential(managerId)).SenhaHashHex,original.SenhaHashHex);
  assert.equal(Number((await credential(managerId)).Falhas),1);
  assert.equal((await call('/api/auth/me',{cookie:manager})).status,200);
  await db.query(`INSERT Seguranca.ConviteAtivacaoPiloto(UsuarioId,TokenHash,EmissorId,ExpiraUtc) VALUES(${managerId},'${hashToken(crypto.randomBytes(32).toString('hex'))}',1,DATEADD(minute,30,SYSUTCDATETIME()))`);
  const successful=await call('/api/pc01/minha-senha',{cookie:manager,body:changeBody});assert.equal(successful.status,200,JSON.stringify(await successful.clone().json()));
  const changed=await credential(managerId);assert.equal(passwordValid(newPassword,changed.SaltHex,changed.SenhaHashHex),true);assert.equal(passwordValid(password,changed.SaltHex,changed.SenhaHashHex),false);assert.equal(Number(changed.Falhas),0);
  for(const cookie of [manager,managerOther])assert.equal((await call('/api/auth/me',{cookie})).status,401);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.ConviteAtivacaoPiloto WHERE UsuarioId=${managerId} AND RevogadoUtc IS NULL`))[0].N),0);
  assert.equal((await call('/api/auth/login',{body:{email:'gestor@example.test',senha:password}})).status,401);
  const managerNew=await login('gestor@example.test',newPassword);
  const reset=await call(`/api/pc01/usuarios/${financeId}/senha`,{cookie:admin,body:resetBody});assert.equal(reset.status,200,JSON.stringify(await reset.clone().json()));
  assert.equal((await call('/api/auth/me',{cookie:finance})).status,401);assert.equal((await call('/api/auth/me',{cookie:admin})).status,200);
  const financeNew=await login('financeiro@example.test',newPassword);
  const beforeMfa=await credential(financeId);
  await assert.rejects(()=>resetPassword({...cfg,mfaRequired:true},1,admin.split('=')[1],{senha:nextPassword,confirmacao:nextPassword},financeId),e=>e.status===403&&e.message==='MFA_RECENTE_OBRIGATORIO');
  assert.deepEqual(await credential(financeId),beforeMfa);
  // Fail audit after credential/session updates: the entire transaction must roll back.
  await db.query("CREATE TRIGGER Seguranca.PasswordAuditFailure ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao='PC01_REDEFINIR_SENHA') THROW 55999,N'Synthetic audit failure',1; END");
  assert.equal((await call(`/api/pc01/usuarios/${financeId}/senha`,{cookie:admin,body:{senha:nextPassword,confirmacao:nextPassword}})).status,503);
  assert.deepEqual(await credential(financeId),beforeMfa);assert.equal((await call('/api/auth/me',{cookie:financeNew})).status,200);
  await db.query('DROP TRIGGER Seguranca.PasswordAuditFailure');
  const concurrent=await Promise.all([1,2].map(()=>call('/api/pc01/minha-senha',{cookie:managerNew,body:{senhaAtual:newPassword,senha:nextPassword,confirmacao:nextPassword}})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,401]);
  assert.equal(passwordValid(nextPassword,(await credential(managerId)).SaltHex,(await credential(managerId)).SenhaHashHex),true);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso p ON p.PerfilId=up.PerfilId WHERE up.UsuarioId=${managerId} AND p.Codigo='PC01_GESTOR'`))[0].N),1);
  const audit=await db.query("SELECT Acao,DetalhesJson FROM Seguranca.Auditoria WHERE Acao IN('PC01_ALTERAR_SENHA','PC01_REDEFINIR_SENHA')");assert.equal(audit.length,3);
  for(const row of audit){assert.deepEqual(JSON.parse(row.DetalhesJson),{sessoesRevogadas:true});assert.equal(row.DetalhesJson.includes(newPassword),false);}
  assert.equal((await call('/api/pc01/usuarios/99999/senha',{cookie:admin,body:resetBody})).status,404);
  assert.equal((await call('/api/pc01/usuarios/1/senha',{cookie:admin,body:resetBody})).status,200);
  assert.equal((await call('/api/auth/me',{cookie:admin})).status,401);
  const beforeRevoked=await credential(financeId);
  await assert.rejects(()=>resetPassword(cfg,1,admin.split('=')[1],{senha:nextPassword,confirmacao:nextPassword},financeId),e=>e.status===401&&e.message==='SESSAO_INVALIDA');
  assert.deepEqual(await credential(financeId),beforeRevoked);
  t.diagnostic('Persistência, login novo/antigo, revogação, privilégios, MFA, rollback e concorrência comprovados por HTTP/SQL isolados.');
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();
  try{if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic('Banco descartável removido: '+database);}}finally{await master.close();}
 }
});
