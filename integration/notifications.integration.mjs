// Opt-in real HTTP/SQL proof in a newly created disposable database only.
import test from 'node:test';
import odbc from 'odbc';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {buildSchema} from '../pilot-local/build-schema.mjs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('notificações reais: solicitação, leitura por usuário, decisão, escopo e paginação',{skip:process.env.NOTIFICATIONS_SQL_TESTS!=='YES',timeout:180000},async t=>{
 const connect=odbc.connect.bind(odbc);t.mock.method(odbc,'connect',async(...args)=>{const db=await connect(...args),query=db.query.bind(db);db.query=async q=>{try{return await query(q);}catch(e){console.error('Failing SQL:',q.slice(0,240),e.odbcErrors);throw e;}};return db;});
 const sqlServer=process.env.NOTIFICATIONS_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 buildSchema();
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),instance=crypto.randomBytes(32).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,instance,{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin sintético')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depot] of [['gestor','GESTOR',1],['coordA','COORDENADOR',1],['coordB','COORDENADOR',2],['finance','FINANCEIRO',1]]){const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:[depot],ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};}
  const notices=async cookie=>(await call('/api/notificacoes',cookie)).data;
  await call('/api/notificacoes',null,undefined,401);await call('/api/notificacoes',actors.finance.cookie,undefined,403);
  let c=(await call('/api/pc04/contratacoes',actors.gestor.cookie,{depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:Number(actors.gestor.id),inicioPrevisto:'2026-11-12T08:00',fimPrevisto:'2026-11-12T12:00',valor:'100.00'},201)).data.resultado;
  c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,actors.gestor.cookie,{versao:Number(c.Versao),entradaReal:'2026-11-12T08:15',saidaReal:'2026-11-12T12:15',motivo:'Correção manual'})).data.resultado;
  const notice=(await notices(admin)).registros[0];assert.equal(notice.Status,'PENDENTE');assert.equal((await notices(actors.coordA.cookie)).naoLidas,1);assert.equal((await notices(actors.coordB.cookie)).naoLidas,0);assert.equal((await notices(actors.gestor.cookie)).naoLidas,0);
  await call(`/api/notificacoes/${notice.Id}/lida`,actors.coordB.cookie,{},404);
  await Promise.all([1,2].map(()=>call(`/api/notificacoes/${notice.Id}/lida`,admin,{})));
  assert.equal((await notices(admin)).naoLidas,0);assert.equal((await notices(actors.coordA.cookie)).naoLidas,1);
  assert.equal((await notices(admin)).registros[0].Status,'PENDENTE');
  await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios/${notice.SolicitacaoId}/decidir`,actors.coordA.cookie,{versao:Number(c.Versao),aprovar:true});
  const outcome=(await notices(actors.gestor.cookie)).registros[0];assert.equal(outcome.Tipo,'RESULTADO');assert.equal(outcome.Status,'APROVADA');assert.equal((await notices(admin)).registros[0].Status,'APROVADA');
  await call(`/api/notificacoes/${outcome.Id}/lida`,actors.gestor.cookie,{});assert.equal((await notices(actors.gestor.cookie)).naoLidas,0);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.coordA.id}`);
  assert.equal((await notices(actors.coordA.cookie)).registros.length,0);await call(`/api/notificacoes/${notice.Id}/lida`,actors.coordA.cookie,{},404);
  // ADM has no depot links in this fixture and still sees the complete history.
  await db.query('DELETE Seguranca.UsuarioDeposito WHERE UsuarioId=1');assert.equal((await notices(admin)).registros.length,1);
  await db.query(`INSERT Operacao.ContratacaoHorarioSolicitacao(ContratacaoId,EntradaReal,SaidaReal,Motivo,SolicitanteId,Status,DecididoPor,DecididoEmUtc) SELECT TOP(35) ${c.ContratacaoId},'2026-11-12T08:15:00','2026-11-12T12:15:00',N'Histórico sintético',${actors.gestor.id},'NEGADA',1,SYSUTCDATETIME() FROM sys.all_objects`);
  const first=await notices(admin);assert.equal(first.registros.length,30);assert.equal(first.naoLidas,35);assert.ok(first.proximaPagina);
  const second=(await call('/api/notificacoes?antes='+first.proximaPagina,admin)).data;assert.equal(second.registros.length,6);assert.equal(new Set([...first.registros,...second.registros].map(r=>r.Id)).size,36);
  assert.equal((await notices(actors.gestor.cookie)).naoLidas,35);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();
 }
});
