// Opt-in, disposable SQL only. Never opens the installed pilot or JETTA_CONTROL.
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



test('PC-03: dois gestores, CPF concorrente, vínculos e histórico SQL real',{skip:process.env.PC03_SQL_TESTS!=='YES'?'Requer PC03_SQL_TESTS=YES e PC03_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC03_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,b41:true,b32:true,b33:true,b34:false};
 const envKeys=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 let db,server,created=false;
 try{
  const master=await connectPilot('master',sqlServer);try{await master.query(`CREATE DATABASE [${database}]`);created=true;}finally{await master.close();}
  db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const setup=crypto.randomBytes(32).toString('hex'),password=crypto.randomBytes(24).toString('base64')+'aA1!';
  await db.beginTransaction();await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setup)}',N'admin@example.test',N'ADM Teste')`);await db.commit();
  await completeSetup(cfg,{token:setup,password});await assert.rejects(()=>completeSetup(cfg,{token:setup,password}));
  await db.query("INSERT Cadastro.Filial(Codigo,Nome) VALUES('A',N'Filial A'),('B',N'Filial B');INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(1,'A',N'Depósito A'),(2,'B',N'Depósito B');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','00000000001');");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async email=>{const r=await call('/api/auth/login',{body:{email,senha:password}});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],secret=crypto.randomBytes(20),cipher=encryptedSecret(secret),uid=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s(email)}`))[0].UsuarioId;
   await db.query(`INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave,ConfirmadoEmUtc) VALUES(${uid},0x${cipher.toString('hex')},1,SYSUTCDATETIME())`);
   assert.equal((await call('/api/mfa/verify',{cookie,body:{code:hotp(secret,Math.floor(Date.now()/30000)),purpose:'STEPUP'}})).status,200);return cookie;};
  const admin=await login('admin@example.test');
  const createUser=async(email,branch)=>{const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Gestor Teste',email,funcoes:['GESTOR'],filiais:[branch],ativo:true,senha:password}});assert.equal(r.status,201);return login(email);};
  const a=await createUser('a@example.test',1),b=await createUser('b@example.test',2);
  const body={nome:'Pessoa Compartilhada',cpf:'12345678901',telefone:'',cnpj:'',filiais:[1]};
  const path='/api/b24a/chapas';
  assert.equal((await call(path,{cookie:a,body:{...body,filiais:[]}})).status,400);
  assert.equal((await call(path,{cookie:a,body:{...body,filiais:[2]}})).status,403);
  const concurrent=await Promise.all([1,2].map(()=>call(path,{cookie:a,body})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  let person=(await concurrent.find(r=>r.status===201).json()).resultado;const id=person.PrestadorId;
  const lookup=async cookie=>{const r=await call(path+'?cpf='+person.CPF,{cookie});assert.equal(r.status,200);return r.json();};
  const found=await lookup(b);assert.equal(String(found.registros[0].PrestadorId),String(id));assert.equal(found.vinculos.length,0);
  const link=(cookie,filial,vinculado)=>call(path+'/'+id+'/filiais/'+filial,{cookie,method:'PUT',body:{vinculado}});
  assert.equal((await link(b,1,false)).status,403);
  assert.deepEqual((await Promise.all([1,2].map(()=>link(b,2,true)))).map(r=>r.status),[200,200]);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Cadastro.PrestadorFilial WHERE PrestadorId=${id} AND RevogadoEmUtc IS NULL`))[0].N),2);
  const edit={nome:'Pessoa Atualizada',cpf:person.CPF,telefone:'',cnpj:'',ativo:true,versao:1};
  assert.equal((await call(path+'/'+id,{cookie:a,method:'PUT',body:{...edit,cpf:'12345678902'}})).status,403);
  assert.equal((await call(path+'/'+id,{cookie:a,method:'PUT',body:{...edit,ativo:false}})).status,403);
  const edits=await Promise.all([a,b].map(cookie=>call(path+'/'+id,{cookie,method:'PUT',body:edit})));
  assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  const planned={filialId:1,depositoId:1,tipoServicoId:1,dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00',descricao:'Histórico PC03'};
  const activity=await call('/api/b3/atividades',{cookie:a,body:planned});assert.equal(activity.status,200);const activityId=(await activity.json()).atividadeId;
  const add=()=>call('/api/b3/atividades/'+activityId+'/participantes',{cookie:a,body:{prestadorId:Number(id),valorContratado:'100.00'}});
  assert.equal((await add()).status,200);
  assert.equal((await link(a,1,false)).status,200);
  assert.equal((await call('/api/b3/atividades/'+activityId,{cookie:a})).status,200);
  const catalog=await (await call('/api/b3/catalogo',{cookie:a})).json();assert.ok(!catalog.prestadores.some(p=>String(p.PrestadorId)===String(id)));
  assert.equal((await add()).status,409);
  assert.equal((await link(b,2,false)).status,200);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Cadastro.PrestadorFilial WHERE PrestadorId=${id} AND RevogadoEmUtc IS NULL`))[0].N),0);
  person=(await lookup(a)).registros[0];assert.equal(String(person.PrestadorId),String(id));
  assert.equal((await link(b,2,true)).status,200);
  const correction={...edit,cpf:'12345678903',versao:Number(person.Versao)};
  assert.equal((await call(path+'/'+id,{cookie:admin,method:'PUT',body:correction})).status,200);person.CPF=correction.cpf;
  person=(await lookup(admin)).registros[0];assert.equal((await call(path+'/'+id,{cookie:admin,method:'PUT',body:{...correction,ativo:false,versao:Number(person.Versao)}})).status,200);
  assert.equal((await link(a,1,true)).status,409);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Cadastro.Prestador WHERE PrestadorId=${id}`))[0].N),1);
  assert.ok(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade='Prestador' AND EntidadeId=${id} AND Acao LIKE 'PC03_%'`))[0].N)>=8);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
