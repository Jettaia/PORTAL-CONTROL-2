// Opt-in real HTTP/auth/SQL proof. Uses only a newly created disposable local database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {encryptedSecret} from '../src/mfa-b2b.js';
import {hotp} from '../src/totp.js';
import {nvarcharLiteral as s} from '../src/auth-db.js';

test('PC-05: tokens, tablet sem filial, persistência, consumo concorrente, manual e revogação SQL real',{
 skip:process.env.PC05_SQL_TESTS!=='YES'?'Requer PC05_SQL_TESTS=YES e PC05_SQL_SERVER local explícito; SKIP não homologa SQL.':false,
},async()=>{
 const sqlServer=process.env.PC05_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Somente localhost ou . com instância local explícita');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,b41:true,b32:true,b33:true,b34:false};
 const envKeys=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 let db,server,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();
  await completeSetup(cfg,{token:setup,password});
  await db.query("INSERT Cadastro.Filial(Codigo,Nome) VALUES('A',N'Filial A'),('B',N'Filial B');INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(1,'A',N'Depósito A'),(2,'B',N'Depósito B');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');");
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
  const manager=async(email,branch)=>{await expect(await call('/api/pc01/usuarios',{cookie:admin.cookie,body:{nome:'Gestor Teste',email,funcoes:['GESTOR'],filiais:[branch],ativo:true,senha:password}}),201);return login(email);};
  const a=await manager('a@example.test',1),b=await manager('b@example.test',2);
  const provider=async(actor,name,cpf,branch)=>(await expect(await call('/api/b24a/chapas',{cookie:actor.cookie,body:{nome:name,cpf,telefone:'',cnpj:'',filiais:[branch]}}),201)).resultado.PrestadorId;
  const pa=await provider(a,'Pessoa A','12345678901',1),pb=await provider(b,'Pessoa B','12345678902',2);
  // Match the server's SQL timezone, rather than execution host or UTC date.
  const today=(await db.query("SELECT CONVERT(varchar(10),SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time',23) Dia"))[0].Dia;
  const create=async(actor,branch,person)=>(await expect(await call('/api/pc04/contratacoes',{cookie:actor.cookie,body:{filialId:branch,gestorId:actor.id,prestadorId:Number(person),tipoServicoId:1,dataServico:today,inicioPrevisto:today+'T00:00',fimPrevisto:today+'T23:59',valor:'125.50'}}),201)).resultado;
  const ca=await create(a,1,pa),cb=await create(b,2,pb),contracts='/api/pc04/contratacoes/',tokens='/api/pc05/contratacoes/';
  const detail=async(actor,row)=>(await expect(await call(contracts+row.ContratacaoId,{cookie:actor.cookie}),200)).registro;
  const issue=async(actor,row,tipo,status=200)=>expect(await call(tokens+row.ContratacaoId+'/tokens',{cookie:actor?.cookie,body:{versao:Number((await detail(actor||a,row)).Versao),tipo}}),status);
  await expect(await call(tokens+ca.ContratacaoId+'/tokens',{body:{versao:1,tipo:'ENTRADA'}}),401);
  await expect(await call(tokens+ca.ContratacaoId+'/tokens',{cookie:b.cookie,body:{versao:1,tipo:'ENTRADA'}}),404);
  await issue(a,ca,'SAIDA',409);
  const first=await issue(a,ca,'ENTRADA'),replacement=await issue(a,ca,'ENTRADA');assert.match(replacement.codigo,/^\d{8}$/);assert.notEqual(first.codigo,replacement.codigo);
  const issued=(await db.query(`SELECT CodigoHash,ConsumidoEmUtc,InvalidadoEmUtc,DATEDIFF(second,CriadoEmUtc,ExpiraEmUtc) Segundos FROM Operacao.ContratacaoToken WHERE ContratacaoId=${ca.ContratacaoId} AND Tipo='ENTRADA' ORDER BY TokenId`));
  assert.equal(issued.length,2);assert.ok(issued[0].InvalidadoEmUtc);assert.equal(issued[1].InvalidadoEmUtc,null);assert.ok(Number(issued[1].Segundos)>=3599&&Number(issued[1].Segundos)<=3600);assert.notEqual(issued[1].CodigoHash,replacement.codigo);
  const pair=await expect(await call('/api/pc05/tablets',{cookie:a.cookie,body:{nome:'Tablet compartilhado'}}),200);
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
  // datetime2(0) records full seconds. A real second must elapse before a later exit.
  await db.query("WAITFOR DELAY '00:00:01.100'");await consume(exit.codigo);
  const completed=await detail(a,ca);assert.ok(completed.SaidaReal);assert.equal(completed.SaidaOrigem,'TOKEN');assert.equal(completed.Valor,'125.50');
  // Expire B's token exactly at the SQL server clock, preserving its deadline constraint.
  const expired=await issue(b,cb,'ENTRADA');await db.query(`UPDATE Operacao.ContratacaoToken SET CriadoEmUtc=DATEADD(hour,-1,SYSUTCDATETIME()),ExpiraEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${cb.ContratacaoId} AND Tipo='ENTRADA' AND InvalidadoEmUtc IS NULL`);
  await consume(expired.codigo,409);assert.equal((await detail(b,cb)).EntradaReal,null);
  const entryB=await issue(b,cb,'ENTRADA');await consume(entryB.codigo);assert.ok((await detail(b,cb)).EntradaReal,'tablet authorized by A accepts B branch token');
  const exitB=await issue(b,cb,'SAIDA'),beforeManual=await detail(b,cb);
  await expect(await call(contracts+cb.ContratacaoId+'/horarios',{cookie:b.cookie,body:{versao:Number(beforeManual.Versao),entradaReal:today+'T00:00',saidaReal:today+'T00:01',motivo:'Correção justificada do apontamento'}}),200);
  await consume(exitB.codigo,409);const manual=await detail(b,cb);assert.equal(manual.EntradaOrigem,'MANUAL');assert.equal(manual.SaidaOrigem,'MANUAL');assert.equal(manual.Valor,'125.50');
  assert.ok((await db.query(`SELECT InvalidadoEmUtc FROM Operacao.ContratacaoToken WHERE ContratacaoId=${cb.ContratacaoId} AND Tipo='SAIDA' AND ConsumidoEmUtc IS NULL`))[0].InvalidadoEmUtc);
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
