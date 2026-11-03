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



test('PC-03: seleção de depósitos na edição com persistência e escopo SQL real',{skip:process.env.PC03_SQL_TESTS!=='YES'?'Requer PC03_SQL_TESTS=YES e PC03_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC03_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,b41:true,b32:true,b33:true,b34:false};
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
  const createUser=async(email,branch)=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Gestor Teste',email,funcoes:['GESTOR'],depositos:[branch],ativo:true,senha:password}});assert.equal(r.status,201);return login(email);};
  const a=await createUser('a@example.test',1),b=await createUser('b@example.test',2);
  const path='/api/b24a/chapas';
  const company={nome:'Empresa Documento Único',documento:'12.345.678/0001-90',telefone:'',depositos:[1]};
  const response=await call(path,{cookie:admin,body:company});assert.equal(response.status,201);
  const companyRow=(await response.json()).resultado;
  // Depot selection is saved atomically with common data; only the caller's scope is replaced.
  const companyId=companyRow.PrestadorId;
  const editCompany=async(cookie,depositos,extra={})=>{const current=(await db.query(`SELECT Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0];return call(path+'/'+companyId,{cookie,method:'PUT',body:{nome:'Empresa Editada',documento:companyRow.CPF,telefone:'11999999999',ativo:true,versao:Number(current.Versao),depositos,...extra}});};
  const linkedCompany=async()=> (await db.query(`SELECT DepositoId FROM Cadastro.PrestadorDeposito WHERE PrestadorId=${companyId} AND RevogadoEmUtc IS NULL ORDER BY DepositoId`)).map(r=>Number(r.DepositoId));
  const staleVersion=Number((await db.query(`SELECT Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0].Versao);
  assert.equal((await call(path+'/'+companyId+'/depositos/2',{cookie:admin,method:'PUT',body:{vinculado:true}})).status,200);
  assert.equal((await editCompany(admin,[1],{versao:staleVersion})).status,409,'Mudança concorrente pelo endpoint de vínculos invalida o formulário aberto');
  assert.deepEqual(await linkedCompany(),[1,2]);
  const versionAfterLink=Number((await db.query(`SELECT Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0].Versao);
  assert.equal((await call(path+'/'+companyId+'/depositos/2',{cookie:admin,method:'PUT',body:{vinculado:true}})).status,200);
  assert.equal(Number((await db.query(`SELECT Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0].Versao),versionAfterLink,'Vínculo idempotente não invalida edição');
  assert.equal((await editCompany(admin,[1,2])).status,200,'Edição deve aceitar seleção de depósitos');
  assert.deepEqual(await linkedCompany(),[1,2]);
  const beforeFailure=(await db.query(`SELECT Nome,Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0];
  await db.query("CREATE TRIGGER Seguranca.PC03_TestAuditFailure ON Seguranca.Auditoria AFTER INSERT AS BEGIN THROW 51000, 'Synthetic audit failure', 1; END");
  try{assert.equal((await editCompany(admin,[2],{nome:'Nome Revertido'})).status,503,'Falha de auditoria reverte edição inteira');}
  finally{await db.query('DROP TRIGGER Seguranca.PC03_TestAuditFailure');}
  assert.deepEqual(await linkedCompany(),[1,2]);const afterFailure=(await db.query(`SELECT Nome,Versao FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0];assert.equal(afterFailure.Nome,beforeFailure.Nome);assert.equal(Number(afterFailure.Versao),Number(beforeFailure.Versao));
  assert.equal((await editCompany(a,[2],{nome:'Nome Recusado'})).status,403,'Gestor não seleciona depósito alheio');
  assert.deepEqual(await linkedCompany(),[1,2]);assert.equal((await db.query(`SELECT Nome FROM Cadastro.Prestador WHERE PrestadorId=${companyId}`))[0].Nome,'Empresa Editada');
  assert.equal((await editCompany(admin,[1],{versao:1})).status,409,'Versão antiga não altera vínculos');
  assert.deepEqual(await linkedCompany(),[1,2]);
  assert.equal((await editCompany(a,[])).status,200,'Gestor remove somente seus vínculos');assert.deepEqual(await linkedCompany(),[2]);
  const viewB=await (await call(path+'?documento='+companyRow.CPF,{cookie:b})).json();assert.deepEqual(viewB.vinculos.map(r=>Number(r.DepositoId)),[2]);
  assert.equal((await editCompany(a,[1])).status,403,'Sem vínculo atual não recupera acesso pelo ID');
  assert.equal((await editCompany(admin,[1],{ativo:false})).status,409,'Prestador inativo não recebe vínculo novo');assert.deepEqual(await linkedCompany(),[2]);
  await db.query('UPDATE Cadastro.Deposito SET Ativo=0 WHERE DepositoId=2');
  assert.equal((await editCompany(admin,[2])).status,200,'Vínculo inativo já existente pode permanecer');
  assert.equal((await editCompany(admin,[])).status,200,'Remover último vínculo é permitido');assert.deepEqual(await linkedCompany(),[]);
  assert.equal((await editCompany(admin,[2])).status,403,'Não cria vínculo com depósito inativo');
  for(const depositos of [[1,1],['1'],null])assert.equal((await editCompany(admin,depositos)).status,400);
  assert.deepEqual(await linkedCompany(),[]);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
