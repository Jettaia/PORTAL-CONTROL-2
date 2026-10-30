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
import {createDeposit,updateDeposit,listDeposits} from '../src/b24c.js';


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
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Serviço teste');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','00000000001');");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const base=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const login=async email=>{const r=await call('/api/auth/login',{body:{email,senha:password}});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],secret=crypto.randomBytes(20),cipher=encryptedSecret(secret),uid=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=${s(email)}`))[0].UsuarioId;
   await db.query(`INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave,ConfirmadoEmUtc) VALUES(${uid},0x${cipher.toString('hex')},1,SYSUTCDATETIME())`);
   assert.equal((await call('/api/mfa/verify',{cookie,body:{code:hotp(secret,Math.floor(Date.now()/30000)),purpose:'STEPUP'}})).status,200);return cookie;};
  const admin=await login('admin@example.test');
  const branch={nome:'Depósito Endereço',centroCusto:'CC-01',rua:'Rua das Flores',numero:'10',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010000'};
  const create=await call('/api/b24a/depositos',{cookie:admin,body:branch});assert.equal(create.status,201,JSON.stringify(await create.clone().json()));const deposito=(await create.json()).resultado;
  assert.equal(deposito.Rua,branch.rua);assert.equal(deposito.CentroCusto,branch.centroCusto);assert.equal(deposito.Cidade,'Campinas');assert.equal(deposito.Estado,'SP');assert.equal(deposito.CEP,'13010000');
  const aliasBody={...branch,nome:'Depósito via alias',centroCusto:'CC-ALIAS',rua:'Rua independente'};
  const dep=await createDeposit(cfg,1,aliasBody,admin.split('=')[1]);
  assert.equal((await listDeposits(cfg,1)).find(d=>String(d.DepositoId)===String(dep.DepositoId)).Rua,aliasBody.rua);
  await updateDeposit(cfg,1,{depositoId:dep.DepositoId,...aliasBody,nome:'Depósito editado',ativo:false,original:{...aliasBody,ativo:true}},admin.split('=')[1]);
  assert.equal((await listDeposits(cfg,1)).find(d=>String(d.DepositoId)===String(dep.DepositoId)).Nome,'Depósito editado');
  const typeBody={nome:'Carga global',descricao:'Descarga manual'};
  const createdType=await call('/api/b24a/servicos',{cookie:admin,body:typeBody});assert.equal(createdType.status,201);const tipo=(await createdType.json()).resultado;
  assert.equal(tipo.Descricao,typeBody.descricao);
  assert.equal((await call('/api/b24a/depositos',{body:branch})).status,401);
  const roleCookies={};for(const role of ['GESTOR','FINANCEIRO']){
   const r=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Conta Teste',email:role.toLowerCase()+'@example.test',funcoes:[role],depositos:[1,Number(deposito.DepositoId)],ativo:true,senha:password}});assert.equal(r.status,201);
   const cookie=await login(role.toLowerCase()+'@example.test');
   roleCookies[role]=cookie;
   for(const kind of ['depositos','servicos'])assert.equal((await call('/api/b24a/'+kind,{cookie,body:kind==='depositos'?branch:typeBody})).status,403);
  }
  const duplicate=await Promise.all([1,2].map(()=>call('/api/b24a/depositos',{cookie:admin,body:{...branch,nome:'Nome único'}})));
  assert.deepEqual(duplicate.map(r=>r.status).sort(),[201,409]);
  const original={...branch,ativo:true},update={...branch,nome:'Depósito Atualizado',ativo:true,original};
  const updates=await Promise.all([1,2].map(i=>call('/api/b24a/depositos/'+deposito.DepositoId,{cookie:admin,method:'PUT',body:{...update,nome:'Atualização '+i,rua:'Novo endereço do depósito'}})));
  assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);assert.equal((await listDeposits(cfg,1)).find(d=>String(d.DepositoId)===String(dep.DepositoId)).Rua,aliasBody.rua);
  // Prepare a genuine historical activity while depot/type are active.
  const planned={depositoId:Number(deposito.DepositoId),tipoServicoId:Number(tipo.TipoServicoId),dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00',descricao:'Histórico PC02'};
  const activity=await call('/api/b3/atividades',{cookie:roleCookies.GESTOR,body:planned});assert.equal(activity.status,200,await activity.clone().text());const activityId=(await activity.json()).atividadeId;
  const current=(await (await call('/api/b24a/depositos',{cookie:admin})).json()).registros.find(r=>String(r.DepositoId)===String(deposito.DepositoId));
  const originalCurrent={nome:current.Nome,centroCusto:current.CentroCusto,rua:current.Rua,numero:current.Numero,bairro:current.Bairro,cidade:current.Cidade,estado:current.Estado,cep:current.CEP,ativo:true};
  assert.equal((await call('/api/b24a/depositos/'+deposito.DepositoId,{cookie:admin,method:'PUT',body:{...originalCurrent,ativo:false,original:originalCurrent}})).status,200);
  assert.equal((await call('/api/b24a/servicos/'+tipo.TipoServicoId,{cookie:admin,method:'PUT',body:{...typeBody,ativo:false,original:{...typeBody,ativo:true}}})).status,200);
  const catalog=await (await call('/api/b3/catalogo',{cookie:admin})).json();assert.ok(!catalog.depositos.some(d=>String(d.DepositoId)===String(deposito.DepositoId)));assert.ok(!catalog.servicos.some(t=>String(t.TipoServicoId)===String(tipo.TipoServicoId)));
  assert.equal((await call('/api/b3/atividades/'+activityId,{cookie:admin})).status,200);
  assert.equal((await call('/api/b3/atividades',{cookie:admin,body:planned})).status,403);
  assert.equal((await call('/api/b3/atividades/'+activityId+'/participantes',{cookie:roleCookies.GESTOR,body:{prestadorId:1,valorContratado:'100.00'}})).status,409);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.Atividade WHERE AtividadeId=${activityId}`))[0].N),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade='Deposito' AND EntidadeId=${deposito.DepositoId} AND Acao LIKE 'PC02_%'`))[0].N),3);
  // Type-only inactivation cannot be bypassed by posting its ID with an active branch.
  const beforeInactiveType=Number((await db.query('SELECT COUNT(*) N FROM Operacao.Atividade'))[0].N);
  const inactiveType=await call('/api/b3/atividades',{cookie:roleCookies.GESTOR,body:{...planned,depositoId:1}});
  assert.equal(inactiveType.status,409);assert.equal((await inactiveType.json()).erro,'SERVICO_INATIVO');
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Operacao.Atividade'))[0].N),beforeInactiveType);
  // No recent MFA: production service must reject even if HTTP gate is bypassed.
  await db.query('UPDATE Seguranca.SessaoWeb SET MfaStepUpEmUtc=NULL WHERE UsuarioId=1');
  await assert.rejects(()=>save(cfg,1,admin.split('=')[1],'depositos',{...branch,nome:'Sem MFA'}),e=>e.status===403);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);}finally{await master.close();}}
  for(const k of envKeys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];
 }
});
