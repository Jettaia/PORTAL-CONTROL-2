import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import * as tablet from '../src/pc05.js';
import {backupAndVerify,rehearseRestore,snapshot} from '../pilot-local/recovery.mjs';
import {invalidateRecoveredAccess} from '../pilot-local/recovered-access.mjs';

test('recuperação atual preserva financeiro e invalida web/tablets/tokens com SQL real',{
 skip:process.env.SQL_RECOVERY_TESTS!=='YES',timeout:300000
},async t=>{
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),pilotInstance=crypto.randomBytes(32).toString('hex');
 const cfg={server:'localhost\\SQLEXPRESS',database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
 const master=await connectPilot('master',cfg.server);let db,server,verified=false;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,cfg.server);await installSchema(db,pilotInstance,{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',setup=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token:setup,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('R',N'Depósito recuperação','R',N'Rua A','1',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(route,cookie,body,status=200)=>{
   const r=await fetch(origin+route,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();assert.equal(r.status,status,text);return {data:JSON.parse(text),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const web=await call('/api/auth/login',null,{email:'admin@example.test',senha:password}),admin=web.cookie,rawSession=admin.split('=')[1];
  const create=async day=>(await call('/api/pc04/contratacoes',admin,{depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;
  let paid=await create('2026-11-01');
  paid=(await call(`/api/pc04/contratacoes/${paid.ContratacaoId}/horarios`,admin,{versao:Number(paid.Versao),entradaReal:'2026-11-01T08:00',saidaReal:'2026-11-01T10:00',motivo:'Ensaio sintético'})).data.resultado;
  paid=(await call(`/api/pc04/contratacoes/${paid.ContratacaoId}/conferir`,admin,{versao:Number(paid.Versao)})).data.resultado;
  const financial=`/api/financeiro/contratacoes/${paid.ContratacaoId}`;
  const receipt=(await call(financial+'/recibo',admin,{})).data.recibo;
  const file={nome:'assinado.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nassinatura sintetica\n%%EOF').toString('base64')};
  await call(financial+'/pagamento',admin,{reciboId:receipt.ReciboId,arquivo:file,baixaAnteriorId:null});
  const open=await create('2026-11-02');
  const paired=await tablet.pair(cfg,1,rawSession,{nome:'Tablet ativo',depositoId:1}),pending=await tablet.pair(cfg,1,rawSession,{nome:'Pareamento pendente',depositoId:1});
  const active=await tablet.activate(cfg,{pareamento:paired.pareamento});assert.equal((await tablet.status(cfg,active.token)).ok,true);
  const code=await tablet.issue(cfg,1,rawSession,open.ContratacaoId,{versao:Number(open.Versao),tipo:'ENTRADA'});
  const consumedHash=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc,ConsumidoEmUtc,TabletId) VALUES(${open.ContratacaoId},'SAIDA','${consumedHash}',1,DATEADD(hour,1,SYSUTCDATETIME()),SYSUTCDATETIME(),${paired.tabletId})`);
  const backup=await backupAndVerify({server:cfg.server,database,pilotInstance});
  // A real audit failure must roll back every revocation, including current PC05.
  await db.query("CREATE TRIGGER Seguranca.RecoveryFailTest ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'RESTORE_INVALIDAR_CONTEXTO') THROW 55999,N'Falha sintética de recuperação',1;END");
  try{await assert.rejects(()=>invalidateRecoveredAccess(db,pilotInstance));assert.deepEqual(await snapshot(db),backup.tables);}finally{await db.query('DROP TRIGGER Seguranca.RecoveryFailTest');}
  // Access revoked after the backup must not be resurrected by restoring it.
  await tablet.revoke(cfg,1,rawSession,paired.tabletId,{});
  const result=await rehearseRestore({server:cfg.server,database,pilotInstance},backup,{onRestored:async restored=>{
   verified=true;const target=(await restored.query('SELECT DB_NAME() D'))[0].D,restoredCfg={...cfg,database:target};
   await assert.rejects(()=>tablet.status(restoredCfg,active.token),e=>e.status===401);
   await assert.rejects(()=>tablet.activate(restoredCfg,{pareamento:pending.pareamento}),e=>e.status===401);
   const tokenState=(await restored.query(`SELECT InvalidadoEmUtc,ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${open.ContratacaoId} AND ConsumidoEmUtc IS NULL`))[0];assert.ok(tokenState.InvalidadoEmUtc);assert.equal(tokenState.ConsumidoEmUtc,null);
   const consumed=(await restored.query(`SELECT InvalidadoEmUtc,ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE CodigoHash='${consumedHash}'`))[0];assert.equal(consumed.InvalidadoEmUtc,null);assert.ok(consumed.ConsumidoEmUtc);
   assert.equal(Number((await restored.query('SELECT COUNT(*) N FROM Seguranca.SessaoWeb WHERE RevogadoEmUtc IS NULL'))[0].N),0);
   const {read}=await import('../src/fin02.js');
   // HTTP serializes SQL BIGINT identifiers; compare the same identifiers losslessly.
   const normalize=r=>({...r,ReciboId:String(r.ReciboId),ContratacaoId:String(r.ContratacaoId),EmitidoPor:String(r.EmitidoPor)});
   assert.deepEqual(normalize((await read(restoredCfg,1,paid.ContratacaoId)).recibo),normalize(receipt));
   const {read:readPayment,attachment}=await import('../src/fin03.js');const payment=(await readPayment(restoredCfg,1,paid.ContratacaoId)).pagamento;assert.ok(payment);
   const attached=await attachment(restoredCfg,1,paid.ContratacaoId,payment.AnexoId);assert.equal(Buffer.from(attached.Conteudo).toString('base64'),file.conteudoBase64);
   // Fresh credentials can be issued while the old service code stays unusable.
   const {login,findSession}=await import('../src/auth-db.js');assert.equal(await findSession(restoredCfg,rawSession),null);
   const newLogin=await login(restoredCfg,'admin@example.test',password);assert.ok(newLogin?.token);
   const replacement=await tablet.pair(restoredCfg,1,newLogin.token,{nome:'Novo aparelho',depositoId:1}),fresh=await tablet.activate(restoredCfg,{pareamento:replacement.pareamento});
   const rejected=await tablet.consume(restoredCfg,fresh.token,{codigo:code.codigo});assert.equal(rejected.erro,'TOKEN_INVALIDO');
  }});
  assert.equal(verified,true,'O ensaio precisa inspecionar as credenciais atuais no banco restaurado');assert.equal(result.tabletsRevoked,true);assert.equal(result.tokensInvalidated,true);assert.equal(result.status,'PASS');
  t.diagnostic('Backup/restore/CHECKDB e consumidores PC05/FIN02/03 atuais verificados; limpeza será conferida.');
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();
  try{if((await master.query(`SELECT DB_ID('${database}') D`))[0].D!==null)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') D`))[0].D,null);t.diagnostic('Banco origem sintético removido.');}finally{await master.close();}
 }
});
