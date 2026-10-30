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



test('PC-07: amostragem e escopos com SQL real',{skip:process.env.PC07_SQL_TESTS!=='YES'?'Requer PC07_SQL_TESTS=YES e PC07_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC07_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,b41:true,b32:true,b33:true,b34:false};
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
  await db.query("INSERT Cadastro.TipoServico(Nome) VALUES(N'Outro tipo');");
  let sequence=100;
  async function insert({days=1,value='100.00',branch=1,type=1,status='LIBERADA',paid=false}={}){
   const day=new Date('2026-10-28T00:00:00Z');day.setUTCDate(day.getUTCDate()-days);const date=day.toISOString().slice(0,10);
   const cpf=String(sequence++).padStart(11,'0');
   const p=(await db.query(`INSERT Cadastro.Prestador(Nome,CPF) OUTPUT inserted.PrestadorId VALUES(N'Fixture ${sequence}','${cpf}')`))[0].PrestadorId;
   const released=status==='LIBERADA';
   return (await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,ConferidoPor,LiberadoEmUtc,ValorLiberado,PagoEmUtc) OUTPUT inserted.ContratacaoId VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),${branch},${p},${type},${aId},'${date}','${date}T08:00:00','${date}T10:00:00',${value},1,'${status}',${released?`'${date}T08:00:00','${date}T10:00:00','MANUAL','MANUAL',1,SYSUTCDATETIME(),${value},${paid?'SYSUTCDATETIME()':'NULL'}`:'NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL'})`))[0].ContratacaoId;
  }
  const query={depositoId:'1',tipoServicoId:'1',dataServico:'2026-10-28',valor:'100.01'};
  async function compare(cookie=a,changes={},status=200){const response=await call('/api/pc04/media?'+new URLSearchParams({...query,...changes}),{cookie});assert.equal(response.status,status,await response.clone().text());return response.json();}
  await insert({days:91,value:'9000.00'});await insert({days:0,value:'9000.00'});await insert({days:-1,value:'9000.00'});
  await insert({branch:2,value:'9000.00'});await insert({type:2,value:'9000.00'});await insert({status:'ABERTA',value:'9000.00'});await insert({status:'CANCELADA',value:'9000.00'});
  const boundary=await insert({days:90});for(let i=0;i<3;i++)await insert({days:2+i});
  let result=await compare();assert.equal(result.quantidade,4);assert.equal(result.media,null);assert.equal(result.acima,false);
  const paid=await insert({days:1,paid:true});result=await compare();assert.equal(result.quantidade,5);assert.equal(result.media,'100.00');assert.equal(result.acima,true);
  assert.equal((await compare(a,{valor:'100.00'})).acima,false);assert.equal((await compare(a,{valor:'99.99'})).acima,false);
  await compare(b,{},403);await compare(finance,{},403);await compare(null,{},401);assert.equal((await compare(admin)).media,'100.00');
  // Revisions/cancellations remove eligibility until reconference, paid rows remain included.
  await db.query(`UPDATE Operacao.Contratacao SET Status='ABERTA',ConferidoPor=NULL,LiberadoEmUtc=NULL,ValorLiberado=NULL WHERE ContratacaoId=${boundary}`);
  assert.equal((await compare()).media,null);
  await db.query(`UPDATE Operacao.Contratacao SET Status='LIBERADA',ConferidoPor=1,LiberadoEmUtc=SYSUTCDATETIME(),ValorLiberado=Valor WHERE ContratacaoId=${boundary}`);
  assert.equal((await compare()).quantidade,5);
  // Twenty latest samples replace the older five; same-date ties use descending id.
  for(let i=0;i<21;i++)await insert({days:1,value:String(200+i)+'.00'});
  result=await compare(a,{valor:'210.50'});assert.equal(result.quantidade,20);assert.equal(result.media,'210.50');assert.equal(result.acima,false);
  assert.equal((await compare(a,{valor:'210.51'})).acima,true);
  // Excluding a selected existing record from a valid context must not leak other branches.
  // Moving the reference day back includes the old 91-day row at the new 90-day boundary.
  const earlier=await compare(a,{contratacaoId:String(paid),dataServico:'2026-10-27'});assert.equal(earlier.quantidade,5);assert.equal(earlier.media,'1880.00');
  await compare(b,{contratacaoId:String(paid)},403);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
