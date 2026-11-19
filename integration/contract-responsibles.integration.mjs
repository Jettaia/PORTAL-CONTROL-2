// Real authenticated HTTP and disposable SQL. Never writes test data to the installed pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {setTimeout as delay} from 'node:timers/promises';

test('ADM: responsáveis incluem gestores e coordenadores vinculados ao depósito',{
 skip:process.env.RESPONSIBLES_SQL_TESTS!=='YES',timeout:240000
},async()=>{
 const sqlServer=process.env.RESPONSIBLES_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin sintético')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000'),('C',N'Depósito C','CC-C',N'Rua C','3',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1),(1,3,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  let requests=0;const requestWindowStart=Date.now();
  const call=async(path,cookie,body,status=200,method=body?'POST':'GET')=>{
   // Keep the real 90 requests/minute protection enabled as coverage grows.
   if(++requests===70)await delay(Math.min(59000,Math.max(0,60100-(Date.now()-requestWindowStart))));
   const r=await fetch(origin+path,{method,headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const response=await r.text();assert.equal(r.status,status,`${method} ${path}: ${response}`);const data=JSON.parse(response);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=async name=>(await call('/api/auth/login',null,{email:name+'@example.test',senha:password})).cookie;
  const admin=await login('admin');
  const make=async(name,funcoes,depositos,authenticate=true)=>{
   const body={nome:name+' Teste',email:name+'@example.test',funcoes,depositos,ativo:true,senha:password};
   const {data}=await call('/api/pc01/usuarios',admin,body,201);return {id:Number(data.usuarioId),cookie:authenticate?await login(name):null,body};
  };
  const manager=await make('gestor',['GESTOR'],[1]);
  const coordinator=await make('coord',['COORDENADOR'],[1]);
  const outside=await make('outro',['COORDENADOR'],[2]);
  const finance=await make('fin',['FINANCEIRO'],[1]);
  const revoked=await make('revogado',['GESTOR'],[1]);
  const inactive=await make('inativo',['COORDENADOR'],[1]);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${revoked.id};UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${inactive.id}`);
  const catalog=(await call('/api/pc04/catalogo',admin)).data;
  const ids=depot=>catalog.gestores.filter(g=>Number(g.DepositoId)===depot).map(g=>Number(g.UsuarioId));
  assert.ok(ids(1).includes(manager.id),'gestor vinculado deve aparecer');
  assert.ok(ids(1).includes(coordinator.id),'coordenador vinculado deve aparecer');
  for(const actor of [outside,finance,revoked,inactive])assert.ok(!ids(1).includes(actor.id),'usuario inelegivel deve ficar fora');
  assert.ok(ids(2).includes(outside.id));assert.ok(!ids(2).includes(manager.id));assert.ok(!ids(2).includes(coordinator.id));
  const body={depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:coordinator.id,inicioPrevisto:'2026-11-20T08:00',fimPrevisto:'2026-11-20T17:00',valor:'150.00'};
  const contract=(await call('/api/pc04/contratacoes',admin,body,201)).data.resultado;
  assert.equal(Number(contract.GestorResponsavelId),coordinator.id);
  for(const actor of [outside,finance,revoked,inactive])await call('/api/pc04/contratacoes',admin,{...body,gestorId:actor.id},403);
  await call('/api/pc04/contratacoes/'+contract.ContratacaoId+'/deposito',admin,{versao:Number(contract.Versao),depositoId:2,gestorId:coordinator.id,motivo:'Troca de unidade'},403);
  const moved=(await call('/api/pc04/contratacoes/'+contract.ContratacaoId+'/deposito',admin,{versao:Number(contract.Versao),depositoId:2,gestorId:outside.id,motivo:'Troca de unidade'})).data.resultado;
  assert.equal(Number(moved.GestorResponsavelId),outside.id);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);await master.query(`IF DB_ID('${database}') IS NOT NULL BEGIN ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}];END`);await master.close();
 }
});
