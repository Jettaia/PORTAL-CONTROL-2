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

test('tablet multidepósito: persistência, escopo completo e consumo em todos os vínculos',{
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

  const multi=await expect(base,admin,{nome:'Compartilhado',depositos:[aId,bId]});
  const mid=Number(multi.tabletId);
  const row=(await expect(base,admin)).registros.find(r=>Number(r.TabletId)===mid);
  assert.deepEqual(row.Depositos.map(d=>Number(d.DepositoId)).sort(),[aId,bId].sort());
  for(const cookie of [a,b]){
   assert.equal((await expect(base,cookie)).registros.some(r=>Number(r.TabletId)===mid),false);
   for(const action of ['cadastro','pareamento','revogar'])await expect(base+'/'+mid+'/'+action,cookie,action==='cadastro'?{nome:'Ataque',depositos:[aId]}:{},404);
  }
  const count=async()=>Number((await db.query('SELECT COUNT(*) N FROM Operacao.TabletPC05'))[0].N),before=await count();
  for(const depositos of [[],[aId,aId],[0],[aId,'1 OR 1=1']])await expect(base,admin,{nome:'Inválido',depositos},400);
  await expect(base,a,{nome:'Fora',depositos:[aId,bId]},404);
  await expect(base,admin,{nome:'Ambíguo',depositoId:aId,depositos:[aId,bId]},400);
  assert.equal(await count(),before);
  const activated=await request(activate,null,{pareamento:multi.pareamento});assert.equal(activated.status,200);const cookie=activated.cookie;
  const today=(await db.query("SELECT CONVERT(varchar(10),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS date),23) D"))[0].D;
  const service=(await expect('/api/b24a/servicos',admin,{nome:'Diária compartilhada',descricao:''},201)).resultado;
  const issueFor=async(depot,actor,cpf)=>{
   const provider=(await expect('/api/b24a/chapas',admin,{nome:'Prestador '+cpf,cpf,telefone:'',cnpj:'',depositos:[depot]},201)).resultado;
   const contract=(await expect('/api/pc04/contratacoes',actor.cookie,{depositoId:depot,prestadorId:Number(provider.PrestadorId),tipoServicoId:Number(service.TipoServicoId),gestorId:actor.id,inicioPrevisto:today+'T00:00',fimPrevisto:today+'T23:59',valor:'100.00'},201)).resultado;
   return {contract,code:await expect('/api/pc05/contratacoes/'+contract.ContratacaoId+'/tokens',actor.cookie,{versao:Number(contract.Versao),tipo:'ENTRADA'})};
  };
  const ca=await issueFor(aId,actors.gestorA,'11122233344'),cb=await issueFor(bId,actors.gestorB,'22233344455');
  await expect(point,cookie,{codigo:ca.code.codigo});await expect(point,cookie,{codigo:cb.code.codigo});
  for(const c of [ca,cb])assert.equal(Number((await db.query('SELECT TabletId FROM Operacao.ContratacaoToken WHERE ContratacaoId='+c.contract.ContratacaoId))[0].TabletId),mid);
  const depotC=(await expect('/api/b24a/depositos',admin,{...depotBody,nome:'Depósito C',centroCusto:'CC-C'},201)).resultado,cId=Number(depotC.DepositoId);
  const cc=await issueFor(cId,{id:1,cookie:admin},'33344455566');
  await expect(point,cookie,{codigo:cc.code.codigo},409);
  assert.equal((await db.query('SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId='+cc.contract.ContratacaoId))[0].ConsumidoEmUtc,null);
  const inactive=await issueFor(bId,actors.gestorB,'44455566677');
  await db.query('UPDATE Cadastro.Deposito SET Ativo=0 WHERE DepositoId='+bId);
  await expect(point,cookie,{codigo:inactive.code.codigo},409);
  await expect(tabletStatus,cookie); // the active A link keeps the device usable
  await db.query('UPDATE Cadastro.Deposito SET Ativo=1 WHERE DepositoId='+bId);
  await db.query('UPDATE Operacao.TabletPC05 SET EmissorId='+actors.gestorA.id+' WHERE TabletId='+mid);
  await expect(point,cookie,{codigo:inactive.code.codigo},409); // issuer has no current B scope
  assert.equal((await db.query('SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId='+inactive.contract.ContratacaoId))[0].ConsumidoEmUtc,null);
  await db.query('UPDATE Operacao.TabletPC05 SET EmissorId=1 WHERE TabletId='+mid);
  await db.query("CREATE TRIGGER Seguranca.TabletMultiTestFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'PC05_CADASTRO') THROW 55998,N'Falha sintetica de auditoria',1;END");
  await expect(base+'/'+mid+'/cadastro',admin,{nome:'Falha revertida',depositos:[aId]},503);
  await db.query('DROP TRIGGER Seguranca.TabletMultiTestFail');
  const unchanged=(await expect(base,admin)).registros.find(r=>Number(r.TabletId)===mid);assert.equal(unchanged.Nome,'Compartilhado');assert.equal(unchanged.Depositos.length,2);await expect(tabletStatus,cookie);
  await expect(base+'/'+mid+'/cadastro',admin,{nome:'Somente A',depositos:[aId]});await expect(tabletStatus,cookie,undefined,401);
  const final=(await expect(base,a)).registros.find(r=>Number(r.TabletId)===mid);assert.deepEqual(final.Depositos.map(d=>Number(d.DepositoId)),[aId]);
  const sql=fs.readFileSync(new URL('../pilot-local/tablets-multidepot.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/','IF NOT ('+targetGuard+") THROW 55900,N'Destino recusado',1;");
  await expect(base,admin,{nome:'Preservar vínculos',depositos:[aId,bId]});
  const snapshot=async()=>JSON.stringify({tablets:Array.from(await db.query('SELECT * FROM Operacao.TabletPC05 ORDER BY TabletId')),links:Array.from(await db.query('SELECT * FROM Operacao.TabletPC05Deposito ORDER BY TabletId,DepositoId'))},(_k,v)=>typeof v==='bigint'?String(v):v),beforeMigration=await snapshot();
  await db.beginTransaction();try{for(let i=0;i<2;i++)for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){await db.rollback();throw e;}
  assert.equal(await snapshot(),beforeMigration);
 }finally{
  await closeServer();if(db){try{await db.rollback();}catch{}await db.close();}
  try{if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic(`Banco descartável removido: ${database}`);}finally{await master.close();}
 }
});
