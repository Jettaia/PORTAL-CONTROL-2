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
import {save} from '../src/pc02.js';


test('PC-02: API autenticada, persistência, concorrência e histórico em SQL real',{skip:process.env.PC02_SQL_TESTS!=='YES'?'Requer PC02_SQL_TESTS=YES e PC02_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC02_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,b41:true,b32:true,b33:true,b34:false};
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
  const branch={nome:'Filial Endereço',codigo:' E-01 ',endereco:'Rua das Flores, 10 — Campinas/SP'};
  const create=await call('/api/b24a/filiais',{cookie:admin,body:branch});assert.equal(create.status,201,JSON.stringify(await create.clone().json()));const filial=(await create.json()).resultado;
  assert.equal(filial.Endereco,branch.endereco);assert.equal(filial.Codigo,'E-01');
  const typeBody={nome:'Carga global',descricao:'Descarga manual'};
  const createdType=await call('/api/b24a/servicos',{cookie:admin,body:typeBody});assert.equal(createdType.status,201);const tipo=(await createdType.json()).resultado;
  assert.equal(tipo.Descricao,typeBody.descricao);
  assert.equal((await call('/api/b24a/filiais',{body:branch})).status,401);
  for(const role of ['GESTOR','FINANCEIRO']){
   const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Conta Teste',email:role.toLowerCase()+'@example.test',funcoes:[role],filiais:[Number(filial.FilialId)],ativo:true,senha:password}});assert.equal(r.status,201);
   const cookie=await login(role.toLowerCase()+'@example.test');
   for(const kind of ['filiais','servicos'])assert.equal((await call('/api/b24a/'+kind,{cookie,body:kind==='filiais'?branch:typeBody})).status,403);
  }
  const duplicate=await Promise.all([1,2].map(()=>call('/api/b24a/filiais',{cookie:admin,body:{...branch,codigo:'UNICO'}})));
  assert.deepEqual(duplicate.map(r=>r.status).sort(),[201,409]);
  const original={...branch,codigo:'E-01',ativo:true},update={...branch,nome:'Filial Atualizada',ativo:true,original};
  const updates=await Promise.all([1,2].map(i=>call('/api/b24a/filiais/'+filial.FilialId,{cookie:admin,method:'PUT',body:{...update,nome:'Atualização '+i}})));
  assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
  // Prepare a genuine historical activity while branch/type are active.
  await db.query(`INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(${filial.FilialId},'HIST',N'Depósito histórico')`);
  const depot=(await db.query(`SELECT DepositoId FROM Cadastro.Deposito WHERE FilialId=${filial.FilialId}`))[0].DepositoId;
  const planned={filialId:Number(filial.FilialId),depositoId:Number(depot),tipoServicoId:Number(tipo.TipoServicoId),dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00',descricao:'Histórico PC02'};
  const activity=await call('/api/b3/atividades',{cookie:admin,body:planned});assert.equal(activity.status,200);const activityId=(await activity.json()).atividadeId;
  const current=(await (await call('/api/b24a/filiais',{cookie:admin})).json()).registros.find(r=>String(r.FilialId)===String(filial.FilialId));
  const originalCurrent={nome:current.Nome,codigo:current.Codigo,endereco:current.Endereco,ativo:true};
  assert.equal((await call('/api/b24a/filiais/'+filial.FilialId,{cookie:admin,method:'PUT',body:{...branch,codigo:'E-01',nome:current.Nome,ativo:false,original:originalCurrent}})).status,200);
  assert.equal((await call('/api/b24a/servicos/'+tipo.TipoServicoId,{cookie:admin,method:'PUT',body:{...typeBody,ativo:false,original:{...typeBody,ativo:true}}})).status,200);
  const catalog=await (await call('/api/b3/catalogo',{cookie:admin})).json();assert.ok(!catalog.depositos.some(d=>String(d.FilialId)===String(filial.FilialId)));assert.ok(!catalog.servicos.some(t=>String(t.TipoServicoId)===String(tipo.TipoServicoId)));
  assert.equal((await call('/api/b3/atividades/'+activityId,{cookie:admin})).status,200);
  assert.equal((await call('/api/b3/atividades',{cookie:admin,body:planned})).status,403);
  assert.equal((await call('/api/b3/atividades/'+activityId+'/participantes',{cookie:admin,body:{prestadorId:1,valorContratado:'100.00'}})).status,409);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.Atividade WHERE AtividadeId=${activityId}`))[0].N),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade='Filial' AND EntidadeId=${filial.FilialId} AND Acao LIKE 'PC02_%'`))[0].N),3);
  // Type-only inactivation cannot be bypassed by posting its ID with an active branch.
  assert.equal((await call('/api/b3/atividades',{cookie:admin,body:{...planned,filialId:1,depositoId:1}})).status,400);
  // No recent MFA: production service must reject even if HTTP gate is bypassed.
  await db.query('UPDATE Seguranca.SessaoWeb SET MfaStepUpEmUtc=NULL WHERE UsuarioId=1');
  await assert.rejects(()=>save(cfg,1,admin.split('=')[1],'filiais',{...branch,codigo:'SEM_MFA'}),e=>e.status===403);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);}finally{await master.close();}}
  for(const k of envKeys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];
 }
});
