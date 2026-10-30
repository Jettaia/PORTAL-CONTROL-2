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
import {save} from '../src/pc01.js';
import {financialAuthorize} from '../src/b5-1.js';

test('PC-01: login, ADM, funções, deposito forjada, duplicidade e sessão desativada em SQL real',{
 skip:process.env.PC01_SQL_TESTS!=='YES'?'Requer PC01_SQL_TESTS=YES e PC01_SQL_SERVER (instância local de testes).':false
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
  assert.equal((await call('/api/pc01/usuarios')).status,401);
  assert.equal((await call('/api/pc01/usuarios/1',{cookie:admin,method:'PUT',body:{nome:'ADM Teste',email:'admin@example.test',funcoes:['GESTOR'],depositos:[],ativo:true}})).status,409);
  const body=(email,funcoes,depositos=[1])=>({nome:'Conta Teste',email,funcoes,depositos,ativo:true,senha:password});
  const make=async(email,funcoes,depositos)=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:body(email,funcoes,depositos)});assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return (await r.json()).usuarioId;};
  const managerId=await make('gestor@example.test',['GESTOR']);
  await make('financeiro@example.test',['FINANCEIRO'],[]);await make('combo@example.test',['GESTOR','FINANCEIRO']);const admin2Id=await make('adm2@example.test',['ADMIN'],[]);
  assert.equal((await call('/api/pc01/usuarios',{cookie:admin,body:body(' GESTOR@EXAMPLE.TEST ',['GESTOR'])})).status,409);
  const manager=await login('gestor@example.test'),finance=await login('financeiro@example.test'),combo=await login('combo@example.test'),admin2=await login('adm2@example.test');
  for(const cookie of [manager,finance])assert.equal((await call('/api/pc01/usuarios',{cookie})).status,403);
  const planned={depositoId:1,tipoServicoId:1,dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00',descricao:'Teste isolado'};
  // Read and writes through the real planning API; body role/branch cannot elevate.
  assert.equal((await call('/api/b3/atividades',{cookie:manager,body:planned})).status,200);
  assert.equal((await call('/api/b3/atividades',{cookie:combo,body:{...planned,depositoId:2}})).status,403);
  assert.equal((await call('/api/b3/atividades',{cookie:finance,body:planned})).status,403);
  assert.equal((await call('/api/b3/atividades',{cookie:admin2,body:{...planned,depositoId:2}})).status,200);
  assert.equal((await call('/api/b3/disponibilidade',{cookie:admin2,body:{prestadorId:1,depositoId:2,inicio:planned.inicioPrevisto,fim:planned.fimPrevisto,estado:'DISPONIVEL',requisicaoId:crypto.randomUUID()}})).status,200);
  const comboId=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s('combo@example.test')}`))[0].UsuarioId;
  await financialAuthorize(db,comboId,'financeiro.carteira.consultar',1);
  await assert.rejects(()=>financialAuthorize(db,comboId,'financeiro.carteira.consultar',2));
  await assert.rejects(()=>financialAuthorize(db,managerId,'financeiro.carteira.consultar',2));
  const update=body('gestor@example.test',['GESTOR']);delete update.senha;update.ativo=false;
  assert.equal((await call('/api/pc01/usuarios/'+managerId,{cookie:admin,method:'PUT',body:update})).status,200);
  assert.equal((await call('/api/auth/me',{cookie:manager})).status,401);
  assert.equal((await call('/api/auth/login',{body:{email:'gestor@example.test',senha:password}})).status,401);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Usuario WHERE UsuarioId=${managerId}`))[0].N),1);
  assert.ok(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade='Usuario' AND EntidadeId=${managerId}`))[0].N)>=2);
  const concurrentEmails=await Promise.all([1,2].map(()=>call('/api/pc01/usuarios',{cookie:admin,body:body('concorrencia@example.test',['GESTOR'])})));
  assert.deepEqual(concurrentEmails.map(r=>r.status).sort(),[201,409]);
  const demote=email=>({nome:'ADM Teste',email,funcoes:['GESTOR'],depositos:[],ativo:true});
  const concurrentDemotions=await Promise.allSettled([save(cfg,1,admin.split('=')[1],demote('admin@example.test'),1),save(cfg,admin2Id,admin2.split('=')[1],demote('adm2@example.test'),admin2Id)]);
  assert.equal(concurrentDemotions.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(concurrentDemotions.find(r=>r.status==='rejected').reason.message,'ULTIMO_ADM_ATIVO');
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u ON u.UsuarioId=r.UsuarioId WHERE u.Ativo=1"))[0].N),1);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);}finally{await master.close();}}
  for(const k of envKeys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];
 }
});
