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



test('PC-08: baixa atômica, concorrência e anexos com SQL real',{skip:process.env.PC08_SQL_TESTS!=='YES'?'Requer PC08_SQL_TESTS=YES e PC08_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC08_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,b41:true,b32:true,b33:true,b34:false};
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
  const financeResponse=await call('/api/pc01/usuarios',{cookie:admin,body:{nome:'Financeiro Teste',email:'finance@example.test',funcoes:['FINANCEIRO'],filiais:[],ativo:true,senha:password}});assert.equal(financeResponse.status,201);
  const finance=await login('finance@example.test');
  const linked=await call('/api/b24a/chapas',{cookie:a,body:{nome:'Pessoa PC04',cpf:'12345678901',telefone:'',cnpj:'',filiais:[1]}});assert.equal(linked.status,201);
  const provider=(await linked.json()).resultado.PrestadorId;
  await db.query(`INSERT Cadastro.PrestadorFilial(PrestadorId,FilialId,ConcedidoPor) VALUES(${provider},2,1)`);

  const actor=Number((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'a@example.test'"))[0].UsuarioId);
  let day=0;
  async function contract({branch=1,person=provider}={}){day++;return (await db.query(`INSERT Operacao.Contratacao(FilialId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,ConferidoPor,LiberadoEmUtc,ValorLiberado) OUTPUT inserted.ContratacaoId VALUES(${branch},${person},1,${actor},'2026-09-${String(day).padStart(2,'0')}','2026-09-${String(day).padStart(2,'0')}T08:00','2026-09-${String(day).padStart(2,'0')}T10:00',150.50,1,'LIBERADA','2026-09-${String(day).padStart(2,'0')}T08:00','2026-09-${String(day).padStart(2,'0')}T10:00','MANUAL','MANUAL',${actor},SYSUTCDATETIME(),150.50)`))[0].ContratacaoId;}
  const evidence={nome:'evidencia.html',conteudo:Buffer.from('<script>não executar</script>').toString('base64')};
  const item=id=>({contratacaoId:id,versao:1,valor:'150.50',anexo:evidence});
  const payload=ids=>({dataPagamento:'2026-10-01',itens:ids.map(item)});
  async function request(path,options,status){const r=await call('/api/pc08'+path,options);assert.equal(r.status,status,await r.clone().text());return r;}
  const c1=await contract(),c2=await contract({branch:2});
  await request('/painel',{cookie:a},403);await request('/painel',{},401);
  let panel=await (await request('/painel?situacao=ABERTO',{cookie:finance},200)).json();assert.equal(panel.registros.length,2);
  await request('/pagamentos',{cookie:a,body:payload([c1])},403);
  await request('/pagamentos',{cookie:finance,body:{...payload([c1]),itens:[{...item(c1),anexo:undefined}]}},400);
  const mixed=await contract({person:1});await request('/pagamentos',{cookie:finance,body:payload([c1,mixed])},409);
  const created=await (await request('/pagamentos',{cookie:finance,body:payload([c1,c2])},201)).json();assert.equal(created.resultado.ValorTotal,'301.00');
  const pid=created.resultado.PagamentoId;
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.PC08Item WHERE PagamentoId=${pid}`))[0].N),2);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.PC08Anexo WHERE ContratacaoId IN(${c1},${c2})`))[0].N),2);
  const download=await request('/anexos/'+c1,{cookie:finance},200);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.equal(await download.text(),Buffer.from(evidence.conteudo,'base64').toString());
  await request('/anexos/'+c2,{cookie:b},403);
  await request('/pagamentos',{cookie:admin,body:payload([c1])},409);
  const revise=await call('/api/pc04/contratacoes/'+c1+'/revisar',{cookie:a,body:{versao:2,valor:'160.00',motivo:'teste'}});assert.equal(revise.status,409);
  panel=await (await request('/painel?situacao=PAGO&filialId=2',{cookie:finance},200)).json();assert.equal(panel.registros.length,1);assert.equal(Number(panel.registros[0].ContratacaoId),Number(c2));assert.equal(panel.registros[0].DataPagamento,'2026-10-01');
  const c3=await contract();const concurrent=await Promise.all([call('/api/pc08/pagamentos',{cookie:finance,body:payload([c3])}),call('/api/pc08/pagamentos',{cookie:admin,body:payload([c3])})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  const c4=await contract();const race=await Promise.all([call('/api/pc08/pagamentos',{cookie:finance,body:payload([c4])}),call('/api/pc04/contratacoes/'+c4+'/revisar',{cookie:a,body:{versao:1,valor:'170.00',motivo:'corrigir'}})]);assert.ok([[201,409],[409,200]].some(x=>JSON.stringify(x)===JSON.stringify(race.map(r=>r.status))));
  const c5=await contract();await db.query("CREATE TRIGGER Financeiro.PC08TesteFalha ON Financeiro.PC08Anexo AFTER INSERT AS BEGIN THROW 55999,N'Falha intencional de teste',1;END");
  const countBefore=Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC08Pagamento'))[0].N);
  await request('/pagamentos',{cookie:finance,body:payload([c5])},503);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC08Pagamento'))[0].N),countBefore);assert.equal((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${c5}`))[0].PagoEmUtc,null);
  await db.query('DROP TRIGGER Financeiro.PC08TesteFalha');
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
