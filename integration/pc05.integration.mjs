// Opt-in real HTTP/auth/SQL proof. Uses only a newly created disposable local database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {snapshot} from '../pilot-local/recovery.mjs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {encryptedSecret} from '../src/mfa-b2b.js';
import {hotp} from '../src/totp.js';
import {nvarcharLiteral as s} from '../src/auth-db.js';

test('PC-05: tokens, tablets por depósito, persistência, consumo concorrente, manual e revogação SQL real',{
 skip:process.env.PC05_SQL_TESTS!=='YES'?'Requer PC05_SQL_TESTS=YES e PC05_SQL_SERVER local explícito; SKIP não homologa SQL.':false,
},async()=>{
 const sqlServer=process.env.PC05_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Somente localhost ou . com instância local explícita');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,pc08:true,pc10:true,b41:true,b32:true,b33:true,b34:false};
 const envKeys=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 let db,server,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();
  await completeSetup(cfg,{token:setup,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'content-type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const expect=async(response,status)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
  const cookieOf=response=>{const header=response.headers.get('set-cookie');assert.ok(header,'Cookie emitido');return header.split(';')[0];};
  const login=async email=>{
   const response=await call('/api/auth/login',{body:{email,senha:password}});await expect(response,200);const cookie=cookieOf(response);
   const uid=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s(email)}`))[0].UsuarioId,secret=crypto.randomBytes(20),cipher=encryptedSecret(secret);
   await db.query(`INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave,ConfirmadoEmUtc) VALUES(${uid},0x${cipher.toString('hex')},1,SYSUTCDATETIME())`);
   await expect(await call('/api/mfa/verify',{cookie,body:{code:hotp(secret,Math.floor(Date.now()/30000)),purpose:'STEPUP'}}),200);return {cookie,id:Number(uid)};
  };
  const admin=await login('admin@example.test');
  const manager=async(email,branch)=>{await expect(await call('/api/pc01/usuarios',{cookie:admin.cookie,body:{nome:'Gestor Teste',email,funcoes:['GESTOR'],depositos:[branch],ativo:true,senha:password}}),201);return login(email);};
  const a=await manager('a@example.test',1),b=await manager('b@example.test',2);
  const provider=async(actor,name,cpf,branch)=>(await expect(await call('/api/b24a/chapas',{cookie:actor.cookie,body:{nome:name,cpf,telefone:'',cnpj:'',depositos:[branch]}}),201)).resultado.PrestadorId;
  const pa=await provider(a,'Pessoa A','12345678901',1),pb=await provider(b,'Pessoa B','12345678902',2);
  // Match the server's SQL timezone, rather than execution host or UTC date.
  const today=(await db.query("SELECT CONVERT(varchar(10),SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time',23) Dia"))[0].Dia;
  const create=async(actor,branch,person)=>(await expect(await call('/api/pc04/contratacoes',{cookie:actor.cookie,body:{depositoId:branch,gestorId:actor.id,prestadorId:Number(person),tipoServicoId:1,dataServico:today,inicioPrevisto:today+'T00:00',fimPrevisto:today+'T23:59',valor:'125.50'}}),201)).resultado;
  const ca=await create(a,1,pa),cb=await create(b,2,pb),contracts='/api/pc04/contratacoes/',tokens='/api/pc05/contratacoes/';
  const detail=async(actor,row)=>(await expect(await call(contracts+row.ContratacaoId,{cookie:actor.cookie}),200)).registro;
  const issue=async(actor,row,tipo,status=200)=>expect(await call(tokens+row.ContratacaoId+'/tokens',{cookie:actor?.cookie,body:{versao:Number((await detail(actor||a,row)).Versao),tipo}}),status);
  await expect(await call(tokens+ca.ContratacaoId+'/tokens',{body:{versao:1,tipo:'ENTRADA'}}),401);
  await expect(await call(tokens+ca.ContratacaoId+'/tokens',{cookie:b.cookie,body:{versao:1,tipo:'ENTRADA'}}),404);
  await issue(a,ca,'SAIDA',409);
  const first=await issue(a,ca,'ENTRADA'),replacement=await issue(a,ca,'ENTRADA');assert.match(replacement.codigo,/^\d{4}$/);assert.notEqual(first.codigo,replacement.codigo);
  const migrate=async(file)=>{await db.beginTransaction();try{const sql=fs.readFileSync(new URL('../pilot-local/'+file,import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){await db.rollback();throw e;}};
  const beforeMigration=await snapshot(db);
  await migrate('pc05-four-digit-tokens-down.sql');
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.key_constraints WHERE name='UQ_PC05_Codigo'"))[0].N),1);
  await migrate('pc05-four-digit-tokens.sql');await migrate('pc05-four-digit-tokens.sql');
  assert.deepEqual(await snapshot(db),beforeMigration,'Migração e repetição preservam todos os dados');
  const issued=(await db.query(`SELECT CodigoHash,ConsumidoEmUtc,InvalidadoEmUtc,DATEDIFF(second,CriadoEmUtc,ExpiraEmUtc) Segundos FROM Operacao.ContratacaoToken WHERE ContratacaoId=${ca.ContratacaoId} AND Tipo='ENTRADA' ORDER BY TokenId`));
  assert.equal(issued.length,2);assert.ok(issued[0].InvalidadoEmUtc);assert.equal(issued[1].InvalidadoEmUtc,null);assert.ok(Number(issued[1].Segundos)>=3599&&Number(issued[1].Segundos)<=3600);assert.notEqual(issued[1].CodigoHash,replacement.codigo);
  const pair=await expect(await call('/api/pc05/tablets',{cookie:a.cookie,body:{nome:'Tablet A',depositoId:1}}),200);
  await expect(await call('/api/pc05/tablet/habilitar',{cookie:a.cookie,body:{pareamento:pair.pareamento}}),403);
  const activated=await call('/api/pc05/tablet/habilitar',{body:{pareamento:pair.pareamento}});await expect(activated,200);const tablet=cookieOf(activated);
  assert.match(activated.headers.get('set-cookie'),/HttpOnly/i);assert.match(activated.headers.get('set-cookie'),/SameSite=Strict/i);
  await expect(await call('/api/pc05/tablet/habilitar',{body:{pareamento:pair.pareamento}}),401);
  await expect(await call('/api/pc05/tablet/status',{cookie:tablet}),200);
  const consume=(codigo,status=200)=>call('/api/pc05/tablet/apontar',{cookie:tablet,body:{codigo}}).then(r=>expect(r,status));
  await consume(first.codigo,409);
  // Defensive fixture: model a premature/stale exit token without granting entry.
  let premature;do{premature=String(crypto.randomInt(100000000)).padStart(8,'0');}while([first.codigo,replacement.codigo].includes(premature));
  const verifier=crypto.createHmac('sha256',cfg.token).update('PC05:'+premature).digest('hex');
  await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc) VALUES(${ca.ContratacaoId},'SAIDA','${verifier}',${a.id},DATEADD(hour,1,SYSUTCDATETIME()))`);
  const denied=await consume(premature,409);assert.equal(denied.erro,'ENTRADA_OBRIGATORIA');
  const race=await Promise.all([1,2].map(()=>call('/api/pc05/tablet/apontar',{cookie:tablet,body:{codigo:replacement.codigo}})));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const persisted=(await db.query(`SELECT EntradaReal,EntradaOrigem,Valor FROM Operacao.Contratacao WHERE ContratacaoId=${ca.ContratacaoId}`))[0];assert.ok(persisted.EntradaReal);assert.equal(persisted.EntradaOrigem,'TOKEN');assert.equal(Number(persisted.Valor),125.50);
  assert.equal(Number((await db.query(`SELECT COUNT(*) Q FROM Operacao.ContratacaoToken WHERE ContratacaoId=${ca.ContratacaoId} AND Tipo='ENTRADA' AND ConsumidoEmUtc IS NOT NULL`))[0].Q),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) Q FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${ca.ContratacaoId} AND Acao='TOKEN_USAR'`))[0].Q),1);
  const exit=await issue(a,ca,'SAIDA');
  assert.match(exit.codigo,/^\d{4}$/);
  // Existing eight-digit codes still work through the public consumption route.
  const legacy='12345678',digest=code=>crypto.createHmac('sha256',cfg.token).update('PC05:'+code).digest('hex');
  await db.query(`UPDATE Operacao.ContratacaoToken SET CodigoHash='${digest(legacy)}' WHERE ContratacaoId=${ca.ContratacaoId} AND Tipo='SAIDA' AND CodigoHash='${digest(exit.codigo)}'`);
  // datetime2(0) records full seconds. A real second must elapse before a later exit.
  await db.query("WAITFOR DELAY '00:00:01.100'");await consume(legacy);
  const completed=await detail(a,ca);assert.ok(completed.SaidaReal);assert.equal(completed.SaidaOrigem,'TOKEN');assert.equal(completed.Valor,'125.50');
  const pairB=await expect(await call('/api/pc05/tablets',{cookie:b.cookie,body:{nome:'Tablet B',depositoId:2}}),200);
  const activatedB=await call('/api/pc05/tablet/habilitar',{body:{pareamento:pairB.pareamento}});await expect(activatedB,200);const tabletB=cookieOf(activatedB);
  const consumeB=(codigo,status=200)=>call('/api/pc05/tablet/apontar',{cookie:tabletB,body:{codigo}}).then(r=>expect(r,status));
  // Expire B's token exactly at the SQL server clock, preserving its deadline constraint.
  const expired=await issue(b,cb,'ENTRADA');await db.query(`UPDATE Operacao.ContratacaoToken SET CriadoEmUtc=DATEADD(hour,-1,SYSUTCDATETIME()),ExpiraEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${cb.ContratacaoId} AND Tipo='ENTRADA' AND InvalidadoEmUtc IS NULL`);
  await consumeB(expired.codigo,409);assert.equal((await detail(b,cb)).EntradaReal,null);
  const entryB=await issue(b,cb,'ENTRADA');await consume(entryB.codigo,409);assert.equal((await detail(b,cb)).EntradaReal,null,'Tablet A não pode apontar depósito B sem vínculo');
  // Broadening the issuer's access must not broaden a device's assigned depot.
  await db.query(`INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(${a.id},2,${admin.id});UPDATE Operacao.TabletPC05 SET Falhas=0 WHERE TabletId=${pair.tabletId}`);
  await consume(entryB.codigo,409);assert.equal((await detail(b,cb)).EntradaReal,null,'Tablet A continua restrito ao depósito A mesmo com emissor autorizado em B');
  assert.equal((await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${cb.ContratacaoId} AND Tipo='ENTRADA' AND InvalidadoEmUtc IS NULL`))[0].ConsumidoEmUtc,null);
  await consumeB(entryB.codigo);assert.ok((await detail(b,cb)).EntradaReal,'Tablet B aceita o código de seu próprio depósito');
  const exitB=await issue(b,cb,'SAIDA'),beforeManual=await detail(b,cb);
  await expect(await call(contracts+cb.ContratacaoId+'/horarios',{cookie:admin.cookie,body:{versao:Number(beforeManual.Versao),entradaReal:today+'T00:00',saidaReal:today+'T00:01',motivo:'Correção justificada do apontamento ADMIN'}}),200);
  await consumeB(exitB.codigo,409);const manual=await detail(b,cb);assert.equal(manual.EntradaOrigem,'MANUAL');assert.equal(manual.SaidaOrigem,'MANUAL');assert.equal(manual.Valor,'125.50');
  assert.ok((await db.query(`SELECT InvalidadoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${cb.ContratacaoId} AND Tipo='SAIDA' AND ConsumidoEmUtc IS NULL`))[0].InvalidadoEmUtc);
  // Concurrent replacements with the same version have one winner only.
  const pc=await provider(a,'Pessoa C','12345678903',1),cc=await create(a,1,pc);
  const emit=versao=>call(tokens+cc.ContratacaoId+'/tokens',{cookie:a.cookie,body:{versao,tipo:'ENTRADA'}});
  const generated=await Promise.all([emit(Number(cc.Versao)),emit(Number(cc.Versao))]);
  assert.deepEqual(generated.map(r=>r.status).sort(),[200,409]);
  const current=await generated.find(r=>r.status===200).json();
  const reserved=new Set((await db.query('SELECT CodigoHash FROM Operacao.ContratacaoToken WHERE ExpiraEmUtc>SYSUTCDATETIME()')).map(r=>r.CodigoHash));
  const available=Array.from({length:10000},(_,i)=>String(i).padStart(4,'0')).filter(code=>!reserved.has(digest(code)));
  const reusedCode=available[0],maxId=Number((await db.query('SELECT MAX(TokenId) N FROM Operacao.ContratacaoToken'))[0].N);
  // Fill every remaining code, including consumed and invalidated reservations.
  for(let start=0;start<available.length;start+=400){const values=available.slice(start,start+400).map((code,i)=>`(${cc.ContratacaoId},'ENTRADA','${digest(code)}',${a.id},DATEADD(hour,1,SYSUTCDATETIME()),${i%3===0?'SYSUTCDATETIME()':'NULL'},${i%3===1?'SYSUTCDATETIME()':'NULL'},${i%3===0?pair.tabletId:'NULL'})`);await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc,ConsumidoEmUtc,InvalidadoEmUtc,TabletId) VALUES${values.join(',')}`);}
  const full=Array.from(await db.query(`SELECT * FROM Operacao.ContratacaoToken ORDER BY TokenId`)),beforeFull=await detail(a,cc);
  const unavailable=await issue(a,cc,'ENTRADA',503);assert.equal(unavailable.erro,'GERACAO_INDISPONIVEL');
  assert.deepEqual(Array.from(await db.query('SELECT * FROM Operacao.ContratacaoToken ORDER BY TokenId')),full,'Saturação não invalida nem grava tokens');
  assert.equal((await detail(a,cc)).Versao,beforeFull.Versao);
  // Expire fixture reservations; force selection of an expired historical code.
  await db.query(`UPDATE Operacao.ContratacaoToken SET CriadoEmUtc=DATEADD(hour,-2,SYSUTCDATETIME()),ExpiraEmUtc=DATEADD(hour,-1,SYSUTCDATETIME()) WHERE TokenId>${maxId}`);
  const rng=crypto.randomInt;let reused;try{crypto.randomInt=()=>Number(reusedCode);reused=await issue(a,cc,'ENTRADA');}finally{crypto.randomInt=rng;}
  assert.equal(reused.codigo,reusedCode);assert.match(reused.codigo,/^\d{4}$/);
  const history=await db.query(`SELECT TokenId,ConsumidoEmUtc,InvalidadoEmUtc FROM Operacao.ContratacaoToken WHERE CodigoHash='${digest(reusedCode)}' ORDER BY TokenId`);assert.equal(history.length,2);assert.ok(history[0].ConsumidoEmUtc);assert.equal(history[1].ConsumidoEmUtc,null);
  await db.query(`UPDATE Operacao.TabletPC05 SET Falhas=0 WHERE TabletId=${pair.tabletId}`);
  await consume(reused.codigo);assert.ok((await detail(a,cc)).EntradaReal,'Consumo escolhe nova emissão, sem confundir com histórico');
  const old=await db.query(`SELECT ConsumidoEmUtc FROM Operacao.ContratacaoToken WHERE TokenId=${history[0].TokenId}`);assert.deepEqual(old[0].ConsumidoEmUtc,history[0].ConsumidoEmUtc);
  await consume(reused.codigo,409);
  await assert.rejects(()=>migrate('pc05-four-digit-tokens-down.sql'),'Rollback com duplicatas deve ser recusado sem apagar histórico');
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.ContratacaoToken WHERE CodigoHash='${digest(reusedCode)}'`))[0].N),2);
  await expect(await call('/api/pc05/tablets/'+pair.tabletId+'/revogar',{cookie:b.cookie,body:{}}),404);
  await expect(await call('/api/pc05/tablets/'+pair.tabletId+'/revogar',{cookie:admin.cookie,body:{}}),200);
  await expect(await call('/api/pc05/tablet/status',{cookie:tablet}),401);
  await consume(replacement.codigo,401);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
