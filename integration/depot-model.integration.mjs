import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {hashPassword} from '../src/security.js';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {resetPilotData} from '../pilot-local/depot-reset.mjs';

test('depósitos: instalação, HTTP real por persona, persistência e reset preservando ADMIN',{skip:process.env.DEPOT_SQL_TESTS!=='YES',timeout:240000},async()=>{
 const sqlServer=process.env.DEPOT_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),instance=crypto.randomBytes(32).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,pc11:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);
  await installSchema(db,instance,{test:true});await seedCatalog(db);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.tables WHERE name IN('Filial','UsuarioFilial','PrestadorFilial')"))[0].N),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.columns WHERE name LIKE '%Filial%'"))[0].N),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.sql_modules WHERE definition LIKE '%Filial%'"))[0].N),0);
  const email='guilherme.ribeiro@jettatransportes.com.br',password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','${email}',N'Admin sintético')`);
  await completeSetup(cfg,{token,password});
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const request=async(path,cookie,body,method=body?'POST':'GET')=>{const r=await fetch(origin+path,{method,headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const expect=async(path,cookie,body,status=200,method)=>{const r=await request(path,cookie,body,method);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
  const login=async mail=>{const r=await request('/api/auth/login',null,{email:mail,senha:password});assert.equal(r.status,200,JSON.stringify(r.data));return r.cookie;};
  const admin=await login(email),body={nome:'Depósito A',centroCusto:'CC-A',rua:'Rua Um',numero:'10',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010-000'};
  const a=(await expect('/api/b24a/depositos',admin,body,201)).resultado;
  const b=(await expect('/api/b24a/depositos',admin,{...body,nome:'Depósito B',centroCusto:'CC-B'},201)).resultado;
  assert.equal(a.Rua,body.rua);assert.equal(a.CentroCusto,'CC-A');assert.equal(a.CEP,'13010000');
  await expect('/api/b24a/filiais',admin,undefined,404);
  await expect('/api/b24a/depositos',admin,{...body,estado:'XX'},400);
  await expect('/api/b24a/depositos',admin,{...body,rua:''},400);
  const original={...body,cep:'13010000',ativo:true};
  await expect('/api/b24a/depositos/'+a.DepositoId,admin,{...body,nome:'Depósito A editado',ativo:true,original},200,'PUT');
  await expect('/api/b24a/depositos/'+a.DepositoId,admin,{...body,nome:'Sobrescrita',ativo:true,original},409,'PUT');
  const identities={};
  for(const [name,role,depot] of [['gestorA','GESTOR',a.DepositoId],['gestorB','GESTOR',b.DepositoId],['financeiroA','FINANCEIRO',a.DepositoId]]){
   const mail=name+'@example.test';const r=await expect('/api/pc01/usuarios',admin,{nome:name,email:mail,funcoes:[role],depositos:[Number(depot)],ativo:true,senha:password},201);
   identities[name]={id:r.resultado?.usuarioId||r.usuarioId,cookie:await login(mail),mail};
  }
  for(const person of ['gestorA','financeiroA']){
   const rows=(await expect('/api/b24a/depositos',identities[person].cookie)).registros;assert.deepEqual(rows.map(x=>String(x.DepositoId)),[String(a.DepositoId)]);
   const permitted=await expect('/api/depositos/permitidos',identities[person].cookie);assert.deepEqual(permitted.depositos.map(x=>String(x.DepositoId)),[String(a.DepositoId)]);
   await expect('/api/b24a/depositos',identities[person].cookie,body,403);
  }
  const provider=(await expect('/api/b24a/chapas',admin,{nome:'Prestador teste',cpf:'12345678901',telefone:'',cnpj:'',depositos:[Number(a.DepositoId),Number(b.DepositoId)]},201)).resultado;
  const service=(await expect('/api/b24a/servicos',admin,{nome:'Diária',descricao:''},201)).resultado;
  const actor=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email='gestorB@example.test'`))[0].UsuarioId;
  const contract=(await expect('/api/pc04/contratacoes',identities.gestorB.cookie,{depositoId:Number(b.DepositoId),prestadorId:Number(provider.PrestadorId||provider.prestadorId),tipoServicoId:Number(service.TipoServicoId),gestorId:Number(actor),dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T10:00',valor:'100.00'},201)).resultado;
  for(const person of ['gestorA','financeiroA']){
   await expect('/api/pc04/contratacoes/'+contract.ContratacaoId,identities[person].cookie,undefined,404);
   const catalog=await expect('/api/pc04/contratacoes',identities[person].cookie);assert.equal(catalog.registros.length,0);
  }
  const privateProvider=(await expect('/api/b24a/chapas',admin,{nome:'Exclusivo B',cpf:'98765432101',telefone:'',cnpj:'',depositos:[Number(b.DepositoId)]},201)).resultado;
  await expect(`/api/b24a/chapas/${privateProvider.PrestadorId}/depositos/${a.DepositoId}`,identities.gestorA.cookie,{vinculado:true},403,'PUT');
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Cadastro.PrestadorDeposito WHERE PrestadorId=${privateProvider.PrestadorId} AND DepositoId=${a.DepositoId}`))[0].N),0);
  // Exercise the actual tablet boundary against the renamed SQL column and revoked grants.
  const today=(await db.query("SELECT CONVERT(varchar(10),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS date),23) D"))[0].D;
  await db.query(`UPDATE Operacao.Contratacao SET DataServico='${today}',InicioPrevisto='${today}T00:00:00',FimPrevisto='${today}T23:59:00' WHERE ContratacaoId=${contract.ContratacaoId}`);
  const code=await expect(`/api/pc05/contratacoes/${contract.ContratacaoId}/tokens`,identities.gestorB.cookie,{versao:1,tipo:'ENTRADA'});
  const paired=await expect('/api/pc05/tablets',identities.gestorB.cookie,{nome:'Tablet B'});
  const activated=await request('/api/pc05/tablet/habilitar',null,{pareamento:paired.pareamento});assert.equal(activated.status,200,JSON.stringify(activated.data));
  await expect('/api/pc01/usuarios/'+identities.gestorB.id,admin,{nome:'gestorB',email:identities.gestorB.mail,funcoes:['GESTOR'],depositos:[],ativo:true},200,'PUT');
  await expect('/api/pc05/tablet/apontar',activated.cookie,{codigo:code.codigo},409);
  assert.equal((await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${contract.ContratacaoId}`))[0].ConsumidoEmUtc,null);
  assert.equal((await db.query(`SELECT EntradaReal FROM Operacao.Contratacao WHERE ContratacaoId=${contract.ContratacaoId}`))[0].EntradaReal,null);
  await expect('/api/pc01/usuarios/'+identities.gestorB.id,admin,{nome:'gestorB',email:identities.gestorB.mail,funcoes:['GESTOR'],depositos:[Number(b.DepositoId)],ativo:true},200,'PUT');
  await expect('/api/pc05/tablet/apontar',activated.cookie,{codigo:code.codigo});
  assert.ok((await db.query(`SELECT EntradaReal FROM Operacao.Contratacao WHERE ContratacaoId=${contract.ContratacaoId}`))[0].EntradaReal);
  await expect('/api/pc01/usuarios/'+identities.gestorA.id,admin,{nome:'gestorA',email:identities.gestorA.mail,funcoes:['GESTOR'],depositos:[],ativo:true},200,'PUT');
  await expect('/api/b24a/depositos',identities.gestorA.cookie,undefined,401);
  assert.equal((await expect('/api/b24a/depositos',await login(identities.gestorA.mail))).registros.length,0);
  await new Promise(resolve=>server.close(resolve));server=null;
  await db.beginTransaction();await assert.rejects(()=>resetPilotData(db,{preserveEmail:'other@example.test',pilotInstance:instance}));await db.rollback();
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Cadastro.Deposito'))[0].N),2);
  await db.beginTransaction();const result=await resetPilotData(db,{preserveEmail:email,pilotInstance:instance});await db.commit();assert.equal(result.credentialsUnchanged,true);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Usuario'))[0].N),1);
  for(const table of ['Cadastro.Deposito','Cadastro.Prestador','Cadastro.TipoServico','Operacao.Contratacao','Seguranca.UsuarioDeposito','Seguranca.SessaoWeb'])assert.equal(Number((await db.query('SELECT COUNT(*) N FROM '+table))[0].N),0,table);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1'))[0].N),0);
  server=createApp(cfg).listen(cfg.port,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const preservedCookie=await login(email);assert.equal((await expect('/api/b24a/depositos',preservedCookie)).registros.length,0);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.close();
  if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);
  await master.close();
 }
});

test('upgrade legado: recusa dados existentes, limpeza autorizada e remoção transacional da filial',{skip:process.env.DEPOT_SQL_TESTS!=='YES',timeout:240000},async()=>{
 const sqlServer=process.env.DEPOT_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),instance=crypto.randomBytes(32).toString('hex');
 const master=await connectPilot('master',sqlServer);let db;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);
  await db.query(`ALTER DATABASE [${database}] SET CHANGE_TRACKING=ON(CHANGE_RETENTION=2 DAYS,AUTO_CLEANUP=ON)`);
  await db.beginTransaction();
  await db.query(`EXEC sys.sp_addextendedproperty @name=N'JETTA_PILOT_INSTANCE',@value=N'${instance}';EXEC sys.sp_addextendedproperty @name=N'JETTA_PILOT_TEST',@value=N'1';`);
  const manifest=JSON.parse(fs.readFileSync(new URL('../pilot-local/sql/manifest.json',import.meta.url)));
  for(const file of manifest.files.filter(f=>f.file!=='29-depot-model.sql'))for(const batch of fs.readFileSync(new URL('../pilot-local/sql/'+file.file,import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  await db.commit();await seedCatalog(db);
  const password='SyntheticOnly!Pass123',salt=crypto.randomBytes(16).toString('hex');
  await db.query(`INSERT Seguranca.Usuario(Nome,Email,Perfil,Ativo) VALUES(N'Preservar ADMIN','guilherme.ribeiro@jettatransportes.com.br','ADMIN',1),(N'Excluir','remove@example.test','GESTOR',1);INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(1,'${salt}','${hashPassword(password,salt)}');INSERT Seguranca.UsuarioRaiz(UsuarioId) VALUES(1);INSERT Seguranca.UsuarioPerfil(UsuarioId,PerfilId) SELECT 1,PerfilId FROM Seguranca.PerfilAcesso WHERE Codigo='PC01_ADMIN';INSERT Cadastro.Filial(Codigo,Nome) VALUES('OLD',N'Excluir');INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(1,'OLD',N'Excluir');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Excluir','12345678901');INSERT Seguranca.UsuarioFilial(UsuarioId,FilialId,ConcedidoPor) VALUES(2,1,1);`);
  const batches=fs.readFileSync(new URL('../pilot-local/depot-model.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`).split(/^\s*GO\s*$/im).filter(s=>s.trim());
  await db.beginTransaction();await assert.rejects(()=>db.query(batches[0]));try{await db.rollback();}catch{}
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Cadastro.Deposito'))[0].N),1);
  await db.beginTransaction();await resetPilotData(db,{preserveEmail:'guilherme.ribeiro@jettatransportes.com.br',pilotInstance:instance});
  for(const batch of batches)await db.query(batch);await db.commit();
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Usuario'))[0].N),1);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.columns WHERE name LIKE '%Filial%'"))[0].N),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.sql_modules WHERE definition LIKE '%Filial%'"))[0].N),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.Permissao WHERE Chave LIKE 'filiais.%'"))[0].N),0);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Cadastro.Deposito'))[0].N),0);
 }finally{
  if(db){try{await db.rollback();}catch{}await db.close();}
  if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);
  await master.close();
 }
});
