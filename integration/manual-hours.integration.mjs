// Disposable SQL and actual authenticated HTTP; never connects to the installed pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import odbc from 'odbc';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {targetGuard} from '../pilot-local/build-schema.mjs';

test('horários: aprovação ADMIN, escopo, concorrência, recusa e bloqueio financeiro persistente',{skip:process.env.HOURS_SQL_TESTS!=='YES',timeout:240000},async t=>{
 const connect=odbc.connect.bind(odbc);
 t.mock.method(odbc,'connect',async(...args)=>{const connection=await connect(...args),query=connection.query.bind(connection);connection.query=async(...params)=>{try{return await query(...params);}catch(error){console.error('SQL diagnostics:',JSON.stringify(error.odbcErrors||[]));throw error;}};return connection;});
 const sqlServer=process.env.HOURS_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),instance=crypto.randomBytes(32).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,pc11:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,instance,{test:true});await seedCatalog(db);
  const email='admin@example.test',password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','${email}',N'Admin sintético')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const expect=async(path,cookie,body,status=200)=>{const r=await call(path,cookie,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
  const login=async mail=>{const r=await call('/api/auth/login',null,{email:mail,senha:password});assert.equal(r.status,200);return r.cookie;};
  const admin=await login(email),actors={};
  for(const [name,role,depot] of [['gestorA','GESTOR',1],['gestorB','GESTOR',2],['financeiro','FINANCEIRO',1]]){const r=await expect('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:[depot],ativo:true,senha:password},201);actors[name]={id:r.usuarioId,cookie:await login(name+'@example.test')};}
  const a=actors.gestorA.cookie,b=actors.gestorB.cookie,finance=actors.financeiro.cookie;
  const initialCount=Number((await db.query('SELECT COUNT(*) N FROM Operacao.Contratacao'))[0].N);
  const assignment={depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:'2026-11-09',inicioPrevisto:'2026-11-09T08:00',fimPrevisto:'2026-11-09T12:00',valor:'100.00'};
  // ADMIN is also an eligible responsible user in depot A; GESTOR still cannot assign it.
  const forged=await expect('/api/pc04/contratacoes',a,assignment,403);assert.equal(forged.erro,'GESTOR_RESPONSAVEL_FIXO');
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Operacao.Contratacao'))[0].N),initialCount);
  const adminAssigned=(await expect('/api/pc04/contratacoes',admin,{...assignment,gestorId:Number(actors.gestorA.id)},201)).resultado;
  assert.equal(String(adminAssigned.GestorResponsavelId),String(actors.gestorA.id));assert.equal(String(adminAssigned.CriadoPor),'1');
  const create=async(day)=>{const r=await expect('/api/pc04/contratacoes',a,{depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:Number(actors.gestorA.id),dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'100.00'},201);return r.resultado;};
  const path=c=>'/api/pc04/contratacoes/'+c.ContratacaoId;
  const change=async(c,cookie,action,extra={},status=200)=>(await expect(path(c)+'/'+action,cookie,{versao:Number(c.Versao),...extra},status)).resultado;
  const detail=async(c,cookie=a)=>expect(path(c),cookie);
  const proposed=day=>({entradaReal:day+'T09:00',saidaReal:day+'T12:30',motivo:'Relógio do tablet estava indisponível'});
  const decide=async(c,request,aprovar,cookie=admin,status=200)=>expect(path(c)+'/horarios/'+request.SolicitacaoId+'/decidir',cookie,{versao:Number(c.Versao),aprovar},status);
  let c=await create('2026-11-10');const originalVersion=c.Versao;
  await change(c,b,'horarios',proposed(c.DataServico),404);await change(c,finance,'horarios',proposed(c.DataServico),403);
  await change(c,a,'horarios',{...proposed(c.DataServico),motivo:''},400);
  c=await change(c,a,'horarios',proposed(c.DataServico));assert.equal(c.HorarioSolicitado,true);assert.equal(c.EntradaReal,null);assert.equal(Number(c.Versao),Number(originalVersion)+1);
  let d=await detail(c);assert.equal(d.podeAprovarHorarios,false);let pending=d.solicitacoesHorarios.find(r=>r.Status==='PENDENTE');assert.ok(pending);assert.equal(pending.Motivo,proposed(c.DataServico).motivo);
  await expect(path(c),b,undefined,404);await expect('/api/pc04/horarios-pendentes',a,undefined,403);await expect('/api/pc04/horarios-pendentes',finance,undefined,403);
  const queue=await expect('/api/pc04/horarios-pendentes',admin);assert.ok(queue.registros.some(r=>String(r.ContratacaoId)===String(c.ContratacaoId)&&r.Motivo===pending.Motivo));
  await change(c,a,'conferir',{},409);await change(c,admin,'conferir',{},409);await change(c,a,'horarios',proposed(c.DataServico),409);
  await decide(c,pending,true,a,403);await decide(c,pending,true,finance,403);
  await decide(c,pending,false);c=(await detail(c)).registro;assert.equal(c.EntradaReal,null);assert.equal((await detail(c)).solicitacoesHorarios.find(r=>String(r.SolicitacaoId)===String(pending.SolicitacaoId)).Status,'NEGADA');
  await decide(c,pending,true,admin,409);
  c=await change(c,a,'horarios',proposed(c.DataServico));pending=(await detail(c)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');
  const concurrent=await Promise.all([true,false].map(aprovar=>call(path(c)+'/horarios/'+pending.SolicitacaoId+'/decidir',admin,{versao:Number(c.Versao),aprovar})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);d=await detail(c);c=d.registro;
  const decision=d.solicitacoesHorarios.find(r=>String(r.SolicitacaoId)===String(pending.SolicitacaoId));
  if(decision.Status==='NEGADA'){c=await change(c,a,'horarios',proposed(c.DataServico));pending=(await detail(c)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');await decide(c,pending,true);c=(await detail(c)).registro;}
  assert.equal(c.EntradaReal,proposed(c.DataServico).entradaReal);assert.equal(c.SaidaReal,proposed(c.DataServico).saidaReal);assert.equal(c.EntradaOrigem,'MANUAL');
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC10Movimento'))[0].N),0);
  c=await change(c,a,'conferir');assert.equal(c.Status,'LIBERADA');assert.equal(Number(c.LiberacaoBloqueada),1);
  const before=JSON.stringify(await db.query(`SELECT * FROM Operacao.Contratacao WHERE ContratacaoId=${c.ContratacaoId}`),(_k,v)=>typeof v==='bigint'?String(v):v);
  for(const cookie of [a,admin])for(const [action,body] of [['horarios',proposed(c.DataServico)],['revisar',{valor:'999.00',motivo:'Tentativa depois da liberação'}],['cancelar',{motivo:'Tentativa depois da liberação'}]])await change(c,cookie,action,body,409);
  await expect('/api/pc05/contratacoes/'+c.ContratacaoId+'/tokens',a,{versao:Number(c.Versao),tipo:'ENTRADA'},409);
  assert.equal(JSON.stringify(await db.query(`SELECT * FROM Operacao.Contratacao WHERE ContratacaoId=${c.ContratacaoId}`),(_k,v)=>typeof v==='bigint'?String(v):v),before);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC10Movimento'))[0].N),1);
  let second=await create('2026-11-11');second=await change(second,admin,'horarios',proposed(second.DataServico));assert.equal(second.EntradaReal,proposed(second.DataServico).entradaReal);assert.equal((await detail(second)).solicitacoesHorarios.length,0);
  const validEntry=second.EntradaReal;second=await change(second,a,'horarios',{...proposed(second.DataServico),entradaReal:second.DataServico+'T10:00'});assert.equal(second.EntradaReal,validEntry);
  pending=(await detail(second)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');await decide(second,pending,false);second=(await detail(second)).registro;assert.equal(second.EntradaReal,validEntry);
  const issued=await expect('/api/pc05/contratacoes/'+second.ContratacaoId+'/tokens',a,{versao:Number(second.Versao),tipo:'SAIDA'},409);
  assert.ok(issued.erro);
  second=await change(second,a,'horarios',proposed(second.DataServico));await expect('/api/pc05/contratacoes/'+second.ContratacaoId+'/tokens',a,{versao:Number(second.Versao),tipo:'ENTRADA'},409);
  second=await change(second,a,'cancelar',{motivo:'Serviço cancelado enquanto aguardava análise'});assert.equal(second.Status,'CANCELADA');assert.equal((await detail(second)).solicitacoesHorarios.some(r=>r.Status==='PENDENTE'),false);
  const today=(await db.query("SELECT CONVERT(varchar(10),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS date),23) D"))[0].D;
  let third=await create(today);const issuedEntry=await expect('/api/pc05/contratacoes/'+third.ContratacaoId+'/tokens',a,{versao:Number(third.Versao),tipo:'ENTRADA'});third=(await detail(third)).registro;
  const paired=await expect('/api/pc05/tablets',a,{nome:'Tablet para pendência'}),activated=await call('/api/pc05/tablet/habilitar',null,{pareamento:paired.pareamento});assert.equal(activated.status,200);
  third=await change(third,a,'horarios',proposed(today));await expect('/api/pc05/tablet/apontar',activated.cookie,{codigo:issuedEntry.codigo},409);
  // Fault injection: even an outstanding token missed by invalidation cannot bypass the pending gate.
  await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=NULL WHERE ContratacaoId=${third.ContratacaoId}`);
  await expect('/api/pc05/tablet/apontar',activated.cookie,{codigo:issuedEntry.codigo},409);
  assert.equal((await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${third.ContratacaoId}`))[0].ConsumidoEmUtc,null);
  assert.equal((await db.query(`SELECT EntradaReal FROM Operacao.Contratacao WHERE ContratacaoId=${third.ContratacaoId}`))[0].EntradaReal,null);
  // A legacy reopened record must retain the one-way lock after migration/backfill.
  await db.query(`UPDATE Operacao.Contratacao SET LiberacaoBloqueada=0,Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL WHERE ContratacaoId=${c.ContratacaoId}`);
  const migration=fs.readFileSync(new URL('../pilot-local/manual-hours-approval.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  await db.beginTransaction();for(const batch of migration.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();
  c=(await detail(c)).registro;assert.equal(Number(c.LiberacaoBloqueada),1);await change(c,admin,'revisar',{valor:'110.00',motivo:'Tentativa em histórico reaberto'},409);
  // Historical attribution is captured at the event, not reinterpreted after a user change.
  const createdEvent=(await detail(c,admin)).eventos.find(e=>e.Acao==='CRIAR');
  assert.equal(createdEvent.AtorNome,'gestorA');assert.equal(createdEvent.AtorCargo,'GESTOR');assert.equal(Number(createdEvent.AtorIdentificacaoHistorica),1);
  assert.deepEqual(JSON.parse(createdEvent.DetalhesJson).ator,{nome:'gestorA',cargo:'GESTOR'});
  await db.query(`UPDATE Seguranca.Usuario SET Nome=N'Nome atualizado',Perfil='FINANCEIRO' WHERE UsuarioId=${actors.gestorA.id}`);
  const preserved=(await detail(c,admin)).eventos.find(e=>String(e.EventoId)===String(createdEvent.EventoId));
  assert.equal(preserved.AtorNome,'gestorA');assert.equal(preserved.AtorCargo,'GESTOR');assert.equal(preserved.DetalhesJson,createdEvent.DetalhesJson);
  // Legacy rows remain unchanged and identify their fallback explicitly.
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${third.ContratacaoId};INSERT Operacao.ContratacaoEvento(ContratacaoId,Acao,AtorUsuarioId,Versao,Status,Valor,ValorLiberado,DetalhesJson) SELECT ContratacaoId,'REVISAR',${actors.gestorA.id},Versao,Status,Valor,ValorLiberado,N'{"motivo":"Evento legado"}' FROM Operacao.Contratacao WHERE ContratacaoId=${third.ContratacaoId}`);
  const legacy=(await detail(third,admin)).eventos.find(e=>e.Motivo==='Evento legado');
  assert.equal(legacy.AtorNome,'Nome atualizado');assert.equal(legacy.AtorCargo,'FINANCEIRO');assert.equal(Number(legacy.AtorIdentificacaoHistorica),0);assert.equal(JSON.parse(legacy.DetalhesJson).ator,undefined);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));if(db){try{await db.rollback();}catch{}await db.close();}
  if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();
 }
});
