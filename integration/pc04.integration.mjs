// Opt-in, disposable SQL only. Never opens the installed pilot or JETTA_CONTROL.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {snapshot} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {encryptedSecret} from '../src/mfa-b2b.js';
import {hotp} from '../src/totp.js';
import {nvarcharLiteral as s} from '../src/auth-db.js';



test('PC-04: criação, concorrência, horários, conferência, revisão e cancelamento SQL real',{skip:process.env.PC04_SQL_TESTS!=='YES'?'Requer PC04_SQL_TESTS=YES e PC04_SQL_SERVER local explícito.':false},async t=>{
 const sqlServer=process.env.PC04_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,b41:true,b32:true,b33:true,b34:false};
 const envKeys=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 let db,server,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();
  await completeSetup(cfg,{token:setup,password});await assert.rejects(()=>completeSetup(cfg,{token:setup,password}));
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','00000000001');");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async email=>{const r=await call('/api/auth/login',{body:{email,senha:password}});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],secret=crypto.randomBytes(20),cipher=encryptedSecret(secret),uid=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s(email)}`))[0].UsuarioId;
   await db.query(`INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave,ConfirmadoEmUtc) VALUES(${uid},0x${cipher.toString('hex')},1,SYSUTCDATETIME())`);
   assert.equal((await call('/api/mfa/verify',{cookie,body:{code:hotp(secret,Math.floor(Date.now()/30000)),purpose:'STEPUP'}})).status,200);return cookie;};
  const admin=await login('admin@example.test');
  const createUser=async(email,branch)=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Gestor Teste',email,funcoes:['GESTOR'],depositos:[branch],ativo:true,senha:password}});assert.equal(r.status,201);return login(email);};
  const a=await createUser('a@example.test',1),b=await createUser('b@example.test',2);
  const financeResponse=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Financeiro Teste',email:'finance@example.test',funcoes:['FINANCEIRO'],depositos:[1,2],ativo:true,senha:password}});assert.equal(financeResponse.status,201);
  const finance=await login('finance@example.test');
  const linked=await call('/api/b24a/chapas',{cookie:a,body:{nome:'Pessoa PC04',cpf:'12345678901',telefone:'',cnpj:'',depositos:[1]}});assert.equal(linked.status,201);
  const provider=(await linked.json()).resultado.PrestadorId;
  await db.query(`INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(${provider},2,1)`);
  const aId=Number((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'a@example.test'"))[0].UsuarioId),bId=Number((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'b@example.test'"))[0].UsuarioId);
  const root='/api/pc04/contratacoes';
  const body={depositoId:1,gestorId:aId,prestadorId:Number(provider),tipoServicoId:1,inicioPrevisto:'2026-11-10T22:00',fimPrevisto:'2026-11-11T06:00',valor:'125.50'};
  const post=(cookie,suffix,data)=>call(root+suffix,{cookie,body:data});
  const expectStatus=async(response,status)=>{assert.equal(response.status,status,JSON.stringify(await response.clone().json()));return response.json();};
  await expectStatus(await post(undefined,'',body),401);
  await expectStatus(await post(finance,'',body),403);
  await expectStatus(await post(b,'',body),403);
  const existing=(await expectStatus(await post(a,'',body),201)).resultado;
  await db.query('ALTER TABLE Operacao.Contratacao ADD CONSTRAINT UQ_PC04_PrestadorData UNIQUE(PrestadorId,DataServico)');
  const migrationSql=fs.readFileSync(new URL('../pilot-local/contract-planning.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`),beforeUpgrade=await snapshot(db);
  await db.beginTransaction();try{for(const batch of migrationSql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);assert.deepEqual(await snapshot(db),beforeUpgrade);await db.commit();}catch(e){await db.rollback();throw e;}
  const creations=await Promise.all([a,b].map((cookie,i)=>post(cookie,'',{...body,depositoId:i+1,gestorId:i===0?aId:bId})));
  assert.deepEqual(creations.map(r=>r.status).sort(),[201,201]);
  const createdRows=await Promise.all(creations.map(async r=>(await r.json()).resultado));
  assert.notEqual(String(createdRows[0].ContratacaoId),String(createdRows[1].ContratacaoId));
  let row=createdRows[0];
  assert.equal(Number(row.GestorResponsavelId),Number(row.DepositoId)==1?aId:bId);
  const owner=row.DepositoId==1?a:b,other=row.DepositoId==1?b:a,id=row.ContratacaoId,number=row.Numero;
  t.diagnostic(`Criação concorrente permitida: depósito ${row.DepositoId}; sequência e conclusão validadas nesse depósito`);
  const detail=async cookie=>expectStatus(await call(root+'/'+id,{cookie}),200);
  await expectStatus(await call(root+'/'+id,{cookie:other}),404);
  const planned={inicioPrevisto:'2026-11-09T21:00',fimPrevisto:'2026-11-10T05:00'};
  await expectStatus(await post(finance,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),403);
  await expectStatus(await post(other,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),404);
  await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc) VALUES(${id},'ENTRADA','${hashToken(crypto.randomBytes(20))}',${aId},DATEADD(hour,1,SYSUTCDATETIME()))`);
  row=(await expectStatus(await post(owner,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),200)).resultado;
  assert.equal((await detail(owner)).registro.InicioPrevisto,planned.inicioPrevisto);
  assert.equal(row.DataServico,'2026-11-09');
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.ContratacaoToken WHERE ContratacaoId=${id} AND InvalidadoEmUtc IS NOT NULL`))[0].N),1);
  const filtered=await expectStatus(await call(root+'?dataServico=2026-11-09',{cookie:owner}),200);assert.ok(filtered.registros.some(r=>String(r.ContratacaoId)===String(id)));

  await expectStatus(await post(owner,'/'+id+'/previstos',{versao:Number(row.Versao)-1,...planned}),409);
  await expectStatus(await post(admin,'/'+id+'/previstos',{versao:Number(row.Versao),...planned,fimPrevisto:planned.inicioPrevisto}),400);
  row=(await expectStatus(await post(admin,'/'+id+'/previstos',{versao:Number(row.Versao),inicioPrevisto:'2026-11-10T20:00',fimPrevisto:'2026-11-11T06:00'}),200)).resultado;
  assert.equal(row.DataServico,'2026-11-10');
  await expectStatus(await post(owner,'/'+id+'/conferir',{versao:Number(row.Versao)}),409);
  await expectStatus(await post(finance,'/'+id+'/horarios',{versao:Number(row.Versao),entradaReal:'2026-11-10T22:00',saidaReal:'2026-11-11T03:00',motivo:'Registro esquecido'}),403);
  // Inactivation and unlink must not prevent completion of existing agreements.
  await db.query(`UPDATE Cadastro.Prestador SET Ativo=0 WHERE PrestadorId=${provider};UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE PrestadorId=${provider};UPDATE Cadastro.Deposito SET Ativo=0 WHERE DepositoId=${row.DepositoId};UPDATE Cadastro.TipoServico SET Ativo=0 WHERE TipoServicoId=1;`);
  row=(await expectStatus(await post(owner,'/'+id+'/horarios',{versao:Number(row.Versao),entradaReal:'2026-11-10T22:00',saidaReal:'2026-11-11T03:00',motivo:'Registro esquecido'}),200)).resultado;
  assert.equal(row.Valor,'125.50');assert.equal(row.EntradaReal,null);assert.equal(row.HorarioSolicitado,true);
  await expectStatus(await post(owner,'/'+id+'/conferir',{versao:Number(row.Versao)}),409);
  await expectStatus(await post(owner,'/'+id+'/horarios/'+row.HorarioPendenteId+'/decidir',{versao:Number(row.Versao),aprovar:true}),403);
  await expectStatus(await post(owner,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),409);
  row=(await expectStatus(await post(admin,'/'+id+'/horarios/'+row.HorarioPendenteId+'/decidir',{versao:Number(row.Versao),aprovar:true}),200)).resultado;
  await expectStatus(await post(owner,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),409);
  assert.equal((await detail(owner)).registro.DataServico,'2026-11-10');
  const race=await Promise.all(['130.00','140.00'].map(valor=>post(owner,'/'+id+'/revisar',{versao:Number(row.Versao),valor,motivo:'Correção antes da conferência'})));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);row=(await race.find(r=>r.status===200).json()).resultado;
  assert.equal(row.Status,'ABERTA');assert.equal(row.ValorLiberado,null);
  row=(await expectStatus(await post(owner,'/'+id+'/conferir',{versao:Number(row.Versao)}),200)).resultado;
  assert.equal(row.Status,'LIBERADA');assert.equal(row.ValorLiberado,row.Valor);assert.ok(row.LiberadoEmUtc);assert.equal(row.DataServico,body.inicioPrevisto.slice(0,10));assert.equal(Number(row.LiberacaoBloqueada),1);
  assert.equal((await detail(finance)).registro.Status,'LIBERADA');
  for(const cookie of [owner,admin]){
   await expectStatus(await post(cookie,'/'+id+'/previstos',{versao:Number(row.Versao),...planned}),409);
   await expectStatus(await post(cookie,'/'+id+'/revisar',{versao:Number(row.Versao),valor:'200.00',motivo:'Tentativa após liberação'}),409);
   await expectStatus(await post(cookie,'/'+id+'/cancelar',{versao:Number(row.Versao),motivo:'Tentativa após liberação'}),409);
   await expectStatus(await post(cookie,'/'+id+'/horarios',{versao:Number(row.Versao),entradaReal:'2026-11-10T22:00',saidaReal:'2026-11-11T04:00',motivo:'Tentativa após liberação'}),409);
  }
  const wallet=await expectStatus(await call(root,{cookie:finance}),200);assert.ok(wallet.registros.some(r=>String(r.ContratacaoId)===String(id)));
  const history=await detail(owner);assert.ok(history.eventos.length>=5);
  await db.query(`UPDATE Cadastro.Prestador SET Ativo=1 WHERE PrestadorId=${provider};UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=NULL WHERE PrestadorId=${provider};UPDATE Cadastro.Deposito SET Ativo=1;UPDATE Cadastro.TipoServico SET Ativo=1;`);
  await expectStatus(await post(a,'',body),201);
  // Numbering is per depot (migration36); the earlier race may have been won by B.
  const next={...body,depositoId:Number(row.DepositoId),gestorId:Number(row.GestorResponsavelId),dataServico:'2026-11-12',inicioPrevisto:'2026-11-12T08:00',fimPrevisto:'2026-11-12T12:00'};
  let after=(await expectStatus(await post(owner,'',next),201)).resultado;assert.equal(String(after.DepositoId),String(row.DepositoId));assert.ok(BigInt(after.Numero)>BigInt(number));
  after=(await expectStatus(await post(admin,'/'+after.ContratacaoId+'/horarios',{versao:Number(after.Versao),entradaReal:next.inicioPrevisto,saidaReal:next.fimPrevisto,motivo:'Registro manual ADMIN'}),200)).resultado;
  after=(await expectStatus(await post(owner,'/'+after.ContratacaoId+'/conferir',{versao:Number(after.Versao)}),200)).resultado;
  await db.query(`UPDATE Operacao.Contratacao SET PagoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${after.ContratacaoId}`);
  const paid=(await db.query(`SELECT CONVERT(varchar(23),PagoEmUtc,126) PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${after.ContratacaoId}`))[0].PagoEmUtc;
  await expectStatus(await post(owner,'/'+after.ContratacaoId+'/cancelar',{versao:Number(after.Versao),motivo:'Não deve apagar pagamento'}),409);
  assert.equal((await db.query(`SELECT CONVERT(varchar(23),PagoEmUtc,126) PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${after.ContratacaoId}`))[0].PagoEmUtc,paid);
  const cancellable=(await expectStatus(await post(a,'',{...body,dataServico:'2026-11-13',inicioPrevisto:'2026-11-13T08:00',fimPrevisto:'2026-11-13T12:00'}),201)).resultado;
  const cancelled=(await expectStatus(await post(a,'/'+cancellable.ContratacaoId+'/cancelar',{versao:Number(cancellable.Versao),motivo:'Antes da liberação'}),200)).resultado;assert.equal(cancelled.Status,'CANCELADA');
  const snapshotBefore=await snapshot(db),migration=fs.readFileSync(new URL('../pilot-local/contract-planning.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(let i=0;i<2;i++){await db.beginTransaction();try{for(const batch of migration.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);assert.deepEqual(await snapshot(db),snapshotBefore);await db.commit();}catch(e){await db.rollback();throw e;}}

 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
