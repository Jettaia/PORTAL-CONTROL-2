// Actual authenticated HTTP and SQL, restricted to a newly created disposable database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {targetGuard} from '../pilot-local/build-schema.mjs';

test('tablets permanentes: migração, gestão por depósito, sessões independentes e tokens de uso único',{
 skip:process.env.JETTA_B3_RUN_SQL_TESTS!=='YES',timeout:240000
},async t=>{
 const sqlServer=process.env.JETTA_B3_SQL_SERVER||'localhost\\SQLEXPRESS';
 assert.match(sqlServer,/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,pc11:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 const closeServer=async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;}};
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);
  await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const email='admin@example.test',password='SyntheticOnly!Pass123',setupToken=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setupToken)}','${email}',N'Admin sintético')`);
  await completeSetup(cfg,{token:setupToken,password});
  const legacyPair=crypto.randomBytes(32).toString('hex'),legacySession=crypto.randomBytes(32).toString('hex');
  const legacy=(await db.query(`INSERT Operacao.TabletPC05(Nome,EmissorId,PareamentoHash,SessaoHash,PareamentoExpiraEmUtc,ExpiraEmUtc,AtivadoEmUtc) OUTPUT inserted.TabletId VALUES(N'Tablet legado sem depósito',1,'${hashToken(legacyPair)}','${hashToken(legacySession)}',DATEADD(minute,5,SYSUTCDATETIME()),DATEADD(hour,8,SYSUTCDATETIME()),SYSUTCDATETIME())`))[0].TabletId;
  const migrate=async()=>{
   const sql=fs.readFileSync(new URL('../pilot-local/tablets-permanent.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
   await db.beginTransaction();try{for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){try{await db.rollback();}catch{}throw e;}
  };
  await migrate();await migrate();
  assert.equal((await db.query(`SELECT Nome,DepositoId FROM Operacao.TabletPC05 WHERE TabletId=${legacy}`))[0].DepositoId,null);
  const start=async()=>{server=createApp(cfg).listen(cfg.port,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));cfg.port=server.address().port;};
  await start();const origin=`http://127.0.0.1:${cfg.port}`;
  const request=async(path,cookie,body)=>{
   // A fresh connection also exercises reopening the server without reusing a dead keep-alive socket.
   const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Connection:'close','x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],setCookie:r.headers.get('set-cookie')};
  };
  const expect=async(path,cookie,body,status=200)=>{const r=await request(path,cookie,body);assert.equal(r.status,status,path+': '+JSON.stringify(r.data));return r.data;};
  const login=async mail=>{const r=await request('/api/auth/login',null,{email:mail,senha:password});assert.equal(r.status,200,JSON.stringify(r.data));assert.ok(r.cookie);return r.cookie;};
  const admin=await login(email),depotBody={nome:'Depósito A',centroCusto:'CC-A',rua:'Rua Um',numero:'10',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010-000'};
  const depotA=(await expect('/api/b24a/depositos',admin,depotBody,201)).resultado;
  const depotB=(await expect('/api/b24a/depositos',admin,{...depotBody,nome:'Depósito B',centroCusto:'CC-B'},201)).resultado;
  const aId=Number(depotA.DepositoId),bId=Number(depotB.DepositoId),actors={};
  for(const [name,role,depot] of [['gestorA','GESTOR',aId],['gestorB','GESTOR',bId],['financeiro','FINANCEIRO',aId]]){
   const created=await expect('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:[depot],ativo:true,senha:password},201);
   actors[name]={id:Number(created.usuarioId),cookie:await login(name+'@example.test')};
  }
  const a=actors.gestorA.cookie,b=actors.gestorB.cookie,finance=actors.financeiro.cookie;
  const base='/api/pc05/tablets',tabletStatus='/api/pc05/tablet/status',activate='/api/pc05/tablet/habilitar',point='/api/pc05/tablet/apontar';
  const listed=await expect(base,admin),legacyRow=listed.registros.find(r=>String(r.TabletId)===String(legacy));
  assert.ok(legacyRow);assert.equal(legacyRow.Estado,'SEM_DEPOSITO');assert.equal(Number(legacyRow.Ativo),0);
  await expect(tabletStatus,'jetta_pc05_tablet='+legacySession,undefined,401);
  await expect(activate,null,{pareamento:legacyPair},401);
  await expect(base,finance,undefined,403);await expect(base,finance,{nome:'Negado',depositoId:aId},403);
  const listA=await expect(base,a);assert.deepEqual(listA.depositos.map(d=>Number(d.DepositoId)),[aId]);assert.equal(listA.registros.some(r=>String(r.TabletId)===String(legacy)),false);
  assert.deepEqual(listed.depositos.map(d=>Number(d.DepositoId)).sort(),[aId,bId].sort());
  await expect(base,a,{nome:'Sem depósito'},400);await expect(base,a,{nome:'Fora do escopo',depositoId:bId},404);
  const first=await expect(base,admin,{nome:'Tablet A',depositoId:aId}),second=await expect(base,b,{nome:'Tablet B',depositoId:bId});
  const firstId=Number(first.tabletId),secondId=Number(second.tabletId);assert.ok(firstId&&secondId&&firstId!==secondId);
  const snapshot=async tabletId=>JSON.stringify(await db.query(`SELECT * FROM Operacao.TabletPC05 WHERE TabletId=${tabletId}`),(_k,v)=>typeof v==='bigint'?String(v):v);
  const before=await snapshot(secondId);
  for(const [action,body] of [['pareamento',{}],['cadastro',{nome:'Ataque',depositoId:aId}],['revogar',{}]]){
   const denied=await expect(`${base}/${secondId}/${action}`,a,body,404);assert.equal(JSON.stringify(denied).includes('Tablet B'),false);
   await expect(`${base}/${secondId}/${action}`,finance,body,403);
  }
  assert.equal(await snapshot(secondId),before);
  assert.equal((await expect(base,a)).registros.some(r=>Number(r.TabletId)===secondId),false);
  // A gestor sees an ADMIN-created tablet by its depot rather than by its issuer.
  assert.ok((await expect(base,a)).registros.some(r=>Number(r.TabletId)===firstId));
  const activatePair=async pairing=>{const r=await request(activate,null,{pareamento:pairing});assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.cookie||'',/^jetta_pc05_tablet=[a-f0-9]{64}$/);assert.ok(Number(r.setCookie.match(/Max-Age=(\d+)/)?.[1])>28800);return r.cookie;};
  const cookieA=await activatePair(first.pareamento),cookieB=await activatePair(second.pareamento);assert.notEqual(cookieA,cookieB);
  await expect(activate,null,{pareamento:first.pareamento},401);
  assert.equal((await db.query(`SELECT ExpiraEmUtc FROM Operacao.TabletPC05 WHERE TabletId=${firstId}`))[0].ExpiraEmUtc,null);
  await db.query(`UPDATE Operacao.TabletPC05 SET AtivadoEmUtc=DATEADD(hour,-12,SYSUTCDATETIME()) WHERE TabletId=${firstId}`);
  const renewed=await request(tabletStatus,cookieA);assert.equal(renewed.status,200);assert.match(renewed.setCookie||'',/Max-Age=\d+/);assert.ok(Number(renewed.setCookie.match(/Max-Age=(\d+)/)[1])>28800);
  const beforeLocalExit=await snapshot(firstId);
  const localExit=await fetch(origin+'/api/pc05/tablet/sair',{method:'POST',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',Cookie:cookieA},body:'{}'});
  assert.equal(localExit.status,404);assert.equal(localExit.headers.get('set-cookie'),null);
  assert.equal(await snapshot(firstId),beforeLocalExit);await expect(tabletStatus,cookieA);
  await expect(tabletStatus,cookieB);
  await closeServer();await start();await expect(tabletStatus,cookieA);await expect(tabletStatus,cookieB);
  const persisted=(await expect(base,admin)).registros.find(r=>Number(r.TabletId)===firstId);
  for(const field of ['TabletId','Nome','DepositoId','Deposito','CentroCusto','Estado','Ativo','CriadoEmUtc','AtivadoEmUtc'])assert.ok(Object.hasOwn(persisted,field),field);
  assert.equal(persisted.CentroCusto,'CC-A');assert.equal(persisted.Deposito,'Depósito A');assert.equal(persisted.Nome,'Tablet A');assert.equal(Number(persisted.Ativo),1);
  const today=(await db.query("SELECT CONVERT(varchar(10),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS date),23) D"))[0].D;
  const service=(await expect('/api/b24a/servicos',admin,{nome:'Diária tablet',descricao:''},201)).resultado;
  const contract=async(depot,actor,cpf)=>{
   const provider=(await expect('/api/b24a/chapas',admin,{nome:'Prestador '+cpf,cpf,telefone:'',cnpj:'',depositos:[depot]},201)).resultado;
   return (await expect('/api/pc04/contratacoes',actor.cookie,{depositoId:depot,prestadorId:Number(provider.PrestadorId),tipoServicoId:Number(service.TipoServicoId),gestorId:actor.id,dataServico:today,inicioPrevisto:today+'T00:00',fimPrevisto:today+'T23:59',valor:'100.00'},201)).resultado;
  };
  const ca=await contract(aId,actors.gestorA,'12345678901'),cb=await contract(bId,actors.gestorB,'98765432101');
  const codeA=await expect(`/api/pc05/contratacoes/${ca.ContratacaoId}/tokens`,a,{versao:Number(ca.Versao),tipo:'ENTRADA'});
  let codeB=await expect(`/api/pc05/contratacoes/${cb.ContratacaoId}/tokens`,b,{versao:Number(cb.Versao),tipo:'ENTRADA'});
  const tokenLife=(await db.query(`SELECT DATEDIFF(second,CriadoEmUtc,ExpiraEmUtc) Seconds FROM Operacao.ContratacaoToken WHERE ContratacaoId=${ca.ContratacaoId}`))[0].Seconds;assert.ok(Number(tokenLife)>=3599&&Number(tokenLife)<=3601);
  await expect(point,cookieA,{codigo:codeB.codigo},409);
  assert.equal((await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${cb.ContratacaoId}`))[0].ConsumidoEmUtc,null);
  await db.query(`UPDATE Operacao.ContratacaoToken SET CriadoEmUtc=DATEADD(hour,-2,SYSUTCDATETIME()),ExpiraEmUtc=DATEADD(hour,-1,SYSUTCDATETIME()) WHERE ContratacaoId=${cb.ContratacaoId}`);
  await expect(point,cookieB,{codigo:codeB.codigo},409);
  assert.equal((await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${cb.ContratacaoId}`))[0].ConsumidoEmUtc,null);
  codeB=await expect(`/api/pc05/contratacoes/${cb.ContratacaoId}/tokens`,b,{versao:Number(codeB.versao),tipo:'ENTRADA'});
  const race=await Promise.all([request(point,cookieA,{codigo:codeA.codigo}),request(point,cookieA,{codigo:codeA.codigo})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${ca.ContratacaoId} AND Acao='TOKEN_USAR'`))[0].N),1);
  const local=(await db.query(`SELECT CONVERT(varchar(19),EntradaReal,126) Entrada,EntradaOrigem,CONVERT(varchar(19),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS datetime2(0)),126) Agora FROM Operacao.Contratacao WHERE ContratacaoId=${ca.ContratacaoId}`))[0];assert.equal(local.EntradaOrigem,'TOKEN');assert.ok(Math.abs(Date.parse(local.Entrada+'Z')-Date.parse(local.Agora+'Z'))<10000);
  await expect(point,cookieB,{codigo:codeB.codigo});await expect(point,cookieB,{codigo:codeB.codigo},409);
  const repaired=await expect(`${base}/${legacy}/cadastro`,admin,{nome:'Legado atribuído',depositoId:aId});assert.ok(repaired);
  await expect(tabletStatus,'jetta_pc05_tablet='+legacySession,undefined,401);
  const newPair=await expect(`${base}/${firstId}/pareamento`,a,{});assert.notEqual(newPair.pareamento,first.pareamento);
  await expect(tabletStatus,cookieA,undefined,401);await expect(tabletStatus,cookieB);
  const nextCookie=await activatePair(newPair.pareamento);
  const beforeMove=await snapshot(firstId);
  await expect(`${base}/${firstId}/cadastro`,a,{nome:'Mudança negada',depositoId:bId},404);assert.equal(await snapshot(firstId),beforeMove);
  await expect(`${base}/${firstId}/cadastro`,admin,{nome:'Tablet transferido para B',depositoId:bId});await expect(tabletStatus,nextCookie,undefined,401);
  assert.equal((await expect(base,a)).registros.some(r=>Number(r.TabletId)===firstId),false);
  const updated=(await expect(base,b)).registros.find(r=>Number(r.TabletId)===firstId);assert.equal(updated.Nome,'Tablet transferido para B');assert.equal(updated.CentroCusto,'CC-B');
  const expiring=await expect(`${base}/${firstId}/pareamento`,b,{});
  // Keep both sides of the original five-minute interval valid while moving it into the past.
  await db.query(`UPDATE Operacao.TabletPC05 SET CriadoEmUtc=DATEADD(minute,-10,SYSUTCDATETIME()),PareamentoExpiraEmUtc=DATEADD(minute,-5,SYSUTCDATETIME()) WHERE TabletId=${firstId}`);
  await expect(activate,null,{pareamento:expiring.pareamento},401);
  const fresh=await expect(`${base}/${firstId}/pareamento`,b,{}),finalCookie=await activatePair(fresh.pareamento);
  await expect(`${base}/${firstId}/revogar`,b,{});await expect(tabletStatus,finalCookie,undefined,401);await expect(point,finalCookie,{codigo:codeA.codigo},401);
  await expect(tabletStatus,cookieB);assert.equal((await expect(base,admin)).registros.find(r=>Number(r.TabletId)===firstId).Estado,'REVOGADO');
  // Additive deletion migration is safe to reapply; consumed tokens keep their FK.
  const beforeDelete=await snapshot(firstId);
  // Emulate the previous schema on this disposable database, with consumed tokens present.
  await db.query('ALTER TABLE Operacao.TabletPC05 DROP CONSTRAINT CK_PC05_TabletExcluidoRevogado;ALTER TABLE Operacao.TabletPC05 DROP COLUMN ExcluidoEmUtc;');
  const deletionSql=fs.readFileSync(new URL('../pilot-local/delete-tablet.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(let attempt=0;attempt<2;attempt++)for(const batch of deletionSql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  assert.equal(await snapshot(firstId),beforeDelete);
  const tokensBefore=Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoToken WHERE TabletId=${firstId} ORDER BY TokenId`));assert.ok(tokensBefore.length);
  const eventsBefore=Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${ca.ContratacaoId} ORDER BY EventoId`));
  const secondBefore=await snapshot(secondId),secondTokens=Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoToken WHERE TabletId=${secondId} ORDER BY TokenId`));
  await expect(`${base}/${secondId}/excluir`,b,{},403);await expect(`${base}/${secondId}/excluir`,finance,{},403);assert.equal(await snapshot(secondId),secondBefore);
  await db.query("CREATE TRIGGER Seguranca.TabletDeleteTestFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'PC05_EXCLUIR') THROW 55998,N'Falha sintetica de auditoria',1;END");
  await expect(`${base}/${secondId}/excluir`,admin,{},503);assert.equal(await snapshot(secondId),secondBefore);await expect(tabletStatus,cookieB);
  await db.query('DROP TRIGGER Seguranca.TabletDeleteTestFail');
  await expect(`${base}/${secondId}/excluir`,admin,{});await expect(tabletStatus,cookieB,undefined,401);await expect(point,cookieB,{codigo:codeB.codigo},401);
  const deletedActive=(await db.query(`SELECT ExcluidoEmUtc,RevogadoEmUtc,SessaoHash,PareamentoHash FROM Operacao.TabletPC05 WHERE TabletId=${secondId}`))[0];assert.ok(deletedActive.ExcluidoEmUtc);assert.ok(deletedActive.RevogadoEmUtc);assert.equal(deletedActive.SessaoHash,null);assert.equal(deletedActive.PareamentoHash,null);
  assert.deepEqual(Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoToken WHERE TabletId=${secondId} ORDER BY TokenId`)),secondTokens);
  await expect(`${base}/${secondId}/excluir`,admin,{},404);
  const pendingDelete=await expect(base,admin,{nome:'Pendente para excluir',depositoId:aId});await expect(`${base}/${pendingDelete.tabletId}/excluir`,admin,{});await expect(activate,null,{pareamento:pendingDelete.pareamento},401);

  await expect(`${base}/${firstId}/excluir`,b,{},403);
  await expect(`${base}/${firstId}/excluir`,admin,{});
  assert.equal((await expect(base,admin)).registros.some(r=>Number(r.TabletId)===firstId),false);
  assert.equal((await expect(base,b)).registros.some(r=>Number(r.TabletId)===firstId),false);
  assert.deepEqual(Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoToken WHERE TabletId=${firstId} ORDER BY TokenId`)),tokensBefore);
  assert.deepEqual(Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${ca.ContratacaoId} ORDER BY EventoId`)),eventsBefore);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade=N'TabletPC05' AND EntidadeId=${firstId} AND Acao=N'PC05_EXCLUIR'`))[0].N),1);
  for(const action of ['excluir','revogar','pareamento','cadastro'])await expect(`${base}/${firstId}/${action}`,admin,action==='cadastro'?{nome:'Restaurar',depositoId:aId}:{},404);
  await expect(tabletStatus,finalCookie,undefined,401);
  t.diagnostic(`SQL real e HTTP verificados em ${database}; limpeza será executada no finally.`);
 }finally{
  await closeServer();if(db){try{await db.rollback();}catch{}await db.close();}
  try{if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic(`Banco descartável removido: ${database}`);}finally{await master.close();}
 }
});
