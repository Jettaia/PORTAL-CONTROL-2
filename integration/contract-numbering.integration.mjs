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

test('numeração por depósito: migração, API, concorrência, escopo e paginação SQL real', {skip:process.env.CONTRACT_NUMBER_SQL_TESTS!=='YES',timeout:240000}, async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const email='admin@example.test',password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','${email}',N'Admin sintético')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const expect=async(path,cookie,body,status=200)=>{const r=await call(path,cookie,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
  const login=async mail=>{const r=await call('/api/auth/login',null,{email:mail,senha:password});assert.equal(r.status,200);return r.cookie;};
  const admin=await login(email),root='/api/pc04/contratacoes';
  const input=(depot,day,gestorId=1)=>({depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'100.00'});
  const create=async(depot,day)=>(await expect(root,admin,input(depot,day),201)).resultado;
  const a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02');
  assert.deepEqual([Number(a.Numero),Number(b.Numero)],[1,1]);
  const race=await Promise.all(['2026-11-03','2026-11-04'].map(day=>create(1,day)));assert.deepEqual(race.map(r=>Number(r.Numero)).sort(),[2,3]);
  const cancel=race.find(r=>Number(r.Numero)===3);await expect(root+'/'+cancel.ContratacaoId+'/cancelar',admin,{versao:1,motivo:'Cancelada para testar sequência'});
  assert.equal(Number((await create(1,'2026-11-05')).Numero),4);
  const u=await expect('/api/pc01/usuarios',admin,{nome:'Gestor A',email:'a@example.test',funcoes:['GESTOR'],depositos:[1],ativo:true,senha:password},201),actor=await login('a@example.test');
  await expect(root,actor,input(2,'2026-11-06',Number(u.usuarioId)),403);await expect(root+'/'+b.ContratacaoId,actor,undefined,404);
  assert.equal(Number((await create(2,'2026-11-06')).Numero),2);
  const filtered=await expect(root+'?numero=1',admin);assert.equal(filtered.registros.length,2);
  assert.deepEqual((await expect(root+'?numero=1',actor)).registros.map(r=>Number(r.DepositoId)),[1]);
  // Exercise old populated state and migration, then a retry. Only Numero may change.
  const migrate=async()=>{const sql=fs.readFileSync(new URL('../pilot-local/contract-numbering.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);await db.beginTransaction();try{for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){await db.rollback();throw e;}};
  await db.query("DROP TABLE Operacao.ContratacaoNumeracaoMigracao;ALTER TABLE Operacao.Contratacao DROP CONSTRAINT CK_PC04_NumeroPositivo;ALTER TABLE Operacao.Contratacao DROP CONSTRAINT UQ_PC04_DepositoNumero;UPDATE Operacao.Contratacao SET Numero=ContratacaoId+100,CriadoEmUtc=DATEADD(second,-CONVERT(int,ContratacaoId),'2026-10-01');ALTER TABLE Operacao.Contratacao ADD CONSTRAINT UQ_PC04_Numero UNIQUE(Numero);");
  const preservation=async()=>{const cols=(await db.query("SELECT name N FROM sys.columns WHERE object_id=OBJECT_ID('Operacao.Contratacao') AND name<>'Numero' ORDER BY column_id")).map(c=>'['+c.N+']').join(',');return JSON.stringify(await db.query(`SELECT ${cols} FROM Operacao.Contratacao ORDER BY ContratacaoId`),(_k,v)=>typeof v==='bigint'?String(v):v);};
  const before=await preservation();await migrate();assert.equal(await preservation(),before);
  const migrated=await db.query('SELECT DepositoId,Numero,ContratacaoId FROM Operacao.Contratacao ORDER BY DepositoId,CriadoEmUtc,ContratacaoId');
  const counters=new Map();for(const r of migrated){const d=String(r.DepositoId),next=(counters.get(d)||0)+1;counters.set(d,next);assert.equal(Number(r.Numero),next);}
  const mapping=await db.query('SELECT ContratacaoId,NumeroAnterior,NumeroNovo FROM Operacao.ContratacaoNumeracaoMigracao');assert.equal(mapping.length,migrated.length);for(const r of mapping)assert.equal(BigInt(r.NumeroAnterior),BigInt(r.ContratacaoId)+100n);
  await migrate();assert.deepEqual(await db.query('SELECT DepositoId,Numero,ContratacaoId FROM Operacao.Contratacao ORDER BY DepositoId,CriadoEmUtc,ContratacaoId'),migrated);
  await assert.rejects(()=>db.query(`UPDATE Operacao.Contratacao SET Numero=1 WHERE ContratacaoId=${a.ContratacaoId}`));
  // More than one page, deliberately repeated numbers across depots.
  await db.query("DECLARE @i int=0;WHILE @i<205 BEGIN INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor) SELECT COALESCE(MAX(Numero),0)+1,@i%2+1,1,1,1,DATEADD(day,@i,'2027-01-01'),DATEADD(day,@i,'2027-01-01T08:00:00'),DATEADD(day,@i,'2027-01-01T12:00:00'),100,1 FROM Operacao.Contratacao WHERE DepositoId=@i%2+1;SET @i+=1;END");
  const all=[];let cursor;do{const page=await expect(root+(cursor?'?antes='+cursor:''),admin);all.push(...page.registros);cursor=page.proximaPagina;}while(cursor);
  assert.equal(all.length,211);assert.equal(new Set(all.map(r=>String(r.ContratacaoId))).size,211);
  assert.ok((await expect(root,actor)).registros.every(r=>Number(r.DepositoId)===1));
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
});
