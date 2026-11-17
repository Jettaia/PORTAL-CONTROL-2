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

test('transferência de depósito: HTTP autenticado, SQL, numeração, concorrência, auditoria e migração', {skip:process.env.CONTRACT_DEPOT_SQL_TESTS!=='YES',timeout:240000}, async()=>{
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
  const transfer=(r,depot,cookie=admin,gestorId=1)=>expect(root+'/'+r.ContratacaoId+'/deposito',cookie,{versao:Number(r.Versao),depositoId:depot,gestorId,motivo:'Correção do depósito de criação.'});
  let moved=(await transfer(a,2)).resultado;
  assert.equal(Number(moved.ContratacaoId),Number(a.ContratacaoId));assert.equal(Number(moved.Numero),2);assert.equal(moved.Valor,a.Valor);assert.equal(moved.InicioPrevisto,a.InicioPrevisto);
  moved=(await transfer(moved,1)).resultado;assert.equal(Number(moved.Numero),2);
  assert.equal(Number((await create(1,'2026-11-03')).Numero),3);
  moved=(await transfer(moved,2)).resultado;assert.equal(Number(moved.Numero),3);
  assert.equal(Number((await create(2,'2026-11-04')).Numero),4);
  const denied=await expect(root+'/'+moved.ContratacaoId+'/deposito',admin,{versao:Number(moved.Versao),depositoId:1,gestorId:1,motivo:'Versão vencida'},200);moved=denied.resultado;
  const race=await Promise.all([1,2].map(()=>call(root+'/'+moved.ContratacaoId+'/deposito',admin,{versao:Number(moved.Versao),depositoId:2,gestorId:1,motivo:'Concorrência'})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);moved=race.find(r=>r.status===200).data.resultado;
  const before=JSON.stringify(await db.query('SELECT * FROM Operacao.Contratacao WHERE ContratacaoId='+moved.ContratacaoId),(_k,v)=>typeof v==='bigint'?String(v):v);
  const reservations=await db.query('SELECT COUNT(*) N FROM Operacao.ContratacaoNumeroTransferido');
  await db.query("CREATE TRIGGER Operacao.TR_DepotChangeAuditProof ON Operacao.ContratacaoEvento AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao='DEPOSITO') THROW 55999,N'Falha de auditoria sintetica',1;END;");
  await expect(root+'/'+moved.ContratacaoId+'/deposito',admin,{versao:Number(moved.Versao),depositoId:1,gestorId:1,motivo:'Auditoria com falha'},503);
  await db.query('DROP TRIGGER Operacao.TR_DepotChangeAuditProof');
  assert.equal(JSON.stringify(await db.query('SELECT * FROM Operacao.Contratacao WHERE ContratacaoId='+moved.ContratacaoId),(_k,v)=>typeof v==='bigint'?String(v):v),before);assert.deepEqual(await db.query('SELECT COUNT(*) N FROM Operacao.ContratacaoNumeroTransferido'),reservations);
  await db.query('UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE PrestadorId=1 AND DepositoId=1');
  await expect(root+'/'+moved.ContratacaoId+'/deposito',admin,{versao:Number(moved.Versao),depositoId:1,gestorId:1,motivo:'Vínculo revogado'},409);
  await db.query('UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=NULL WHERE PrestadorId=1 AND DepositoId=1');
  const u=await expect('/api/pc01/usuarios',admin,{nome:'Gestor A',email:'a@example.test',funcoes:['GESTOR'],depositos:[1],ativo:true,senha:password},201),actor=await login('a@example.test');
  await expect(root+'/'+b.ContratacaoId+'/deposito',actor,{versao:1,depositoId:1,gestorId:Number(u.usuarioId),motivo:'Origem fora do acesso'},404);
  const sourceContract=await create(1,'2026-11-05');await expect(root+'/'+sourceContract.ContratacaoId+'/deposito',actor,{versao:1,depositoId:2,gestorId:Number(u.usuarioId),motivo:'Destino fora do acesso'},403);
  const history=await expect(root+'/'+moved.ContratacaoId,admin);const changes=history.eventos.filter(e=>e.Acao==='DEPOSITO');assert.equal(changes.length,5);const details=JSON.parse(changes[0].DetalhesJson);assert.equal(details.antes.Deposito,'Depósito A');assert.equal(details.depositoDepois.nome,'Depósito B');assert.equal(details.motivo,'Correção do depósito de criação.');
  const preservation=async()=>JSON.stringify(await db.query('SELECT * FROM Operacao.Contratacao ORDER BY ContratacaoId'),(_k,v)=>typeof v==='bigint'?String(v):v);const preserved=await preservation();
  const sql=fs.readFileSync(new URL('../pilot-local/contract-depot-change.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);await db.beginTransaction();try{for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){await db.rollback();throw e;}assert.equal(await preservation(),preserved);
  await expect(root+'/'+moved.ContratacaoId+'/excluir',admin,{versao:Number(moved.Versao),motivo:'Limpeza sintética',confirmar:true});assert.deepEqual(await db.query('SELECT COUNT(*) N FROM Operacao.ContratacaoNumeroTransferido'),reservations);
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
});
