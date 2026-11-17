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

test('tablet código curto: SQL e HTTP reais, uso único, renovação, expiração e sessão longa', {skip:process.env.TABLET_PAIRING_SQL_TESTS!=='YES',timeout:240000}, async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,fin01:true,pc05:true};
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

  const base='/api/pc05/tablets',activate='/api/pc05/tablet/habilitar';
  const first=await expect(base,admin,{nome:'Código curto',depositos:[1,2]});assert.match(first.pareamento,/^\d{3}-\d{3}-\d{3}$/);
  const stored=(await db.query('SELECT PareamentoHash FROM Operacao.TabletPC05 WHERE TabletId='+first.tabletId))[0].PareamentoHash;assert.notEqual(stored,hashToken(first.pareamento.replaceAll('-','')));
  const active=await call(activate,null,{pareamento:first.pareamento.replaceAll('-','')});assert.equal(active.status,200);assert.match(active.cookie,/^jetta_pc05_tablet=[a-f0-9]{64}$/);
  await expect(activate,null,{pareamento:first.pareamento},401);
  const renewed=await expect(base+'/'+first.tabletId+'/pareamento',admin,{});assert.match(renewed.pareamento,/^\d{3}-\d{3}-\d{3}$/);await expect('/api/pc05/tablet/status',active.cookie,undefined,401);
  await db.query('UPDATE Operacao.TabletPC05 SET CriadoEmUtc=DATEADD(minute,-10,SYSUTCDATETIME()),PareamentoExpiraEmUtc=DATEADD(minute,-5,SYSUTCDATETIME()) WHERE TabletId='+first.tabletId);await expect(activate,null,{pareamento:renewed.pareamento},401);
  const fresh=await expect(base+'/'+first.tabletId+'/pareamento',admin,{});await expect(activate,null,{pareamento:renewed.pareamento},401);const next=await call(activate,null,{pareamento:fresh.pareamento});assert.equal(next.status,200);await expect('/api/pc05/tablet/status',next.cookie);
  // Successful activations do not consume the per-IP invalid-attempt budget.
  for(let i=0;i<6;i++){const p=await expect(base,admin,{nome:'Autorização '+i,depositoId:1});await expect(activate,null,{pareamento:p.pareamento});}
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
});
