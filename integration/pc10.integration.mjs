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
import {change as changeContract} from '../src/pc04.js';
import {pay as payContract} from '../src/pc08.js';
import {contractMovements} from '../src/pc10-ledger.js';
import {nvarcharLiteral as s} from '../src/auth-db.js';



test('PC-10: correção, estorno, diferenças e concorrência com SQL real',{skip:process.env.PC10_SQL_TESTS!=='YES'?'Requer PC10_SQL_TESTS=YES e PC10_SQL_SERVER local explícito.':false},async()=>{
 const sqlServer=process.env.PC10_SQL_SERVER;
 assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/,'Instância local explícita obrigatória');
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,pc11:true,b41:true,b32:true,b33:true,b34:false};
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
  const call=async(path,{cookie,body,method=body?'POST':'GET'}={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-jetta-request':'web',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body,(_key,value)=>typeof value==='bigint'?value.toString():value)}:{})});
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

  const actor=Number((await db.query("SELECT UsuarioId FROM Seguranca.Usuario WHERE Email=N'a@example.test'"))[0].UsuarioId);
  let day=0;
  async function contract(branch=1){day++;const d='2026-09-'+String(day).padStart(2,'0');const id=(await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem) OUTPUT inserted.ContratacaoId VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),${branch},${provider},1,${actor},'${d}','${d}T08:00:00','${d}T10:00:00',150.00,${actor},'ABERTA','${d}T08:00:00','${d}T10:00:00','MANUAL','MANUAL')`))[0].ContratacaoId;await request('/api/pc04/contratacoes/'+id+'/conferir',{cookie:admin,body:{versao:1}},200);return id;}
  async function request(path,options,status){const r=await call(path,options);assert.equal(r.status,status,await r.clone().text());return r;}
  const detail=async(id,cookie=finance)=>(await request('/api/pc10/contratacoes/'+id,{cookie},200)).json();
  // Explicit historical fixtures only: this reconstructs adjustments made before
  // immutable release existed. Current production APIs below must reject them.
  async function seedHistoricalAdjustment(key,action,amount){
   const previous=(await db.query(`SELECT ContratacaoId,Versao,Status,PagoEmUtc,CONVERT(varchar(40),Valor) Valor,CONVERT(varchar(40),ValorLiberado) ValorLiberado FROM Operacao.Contratacao WHERE ContratacaoId=${key}`))[0];
   await db.beginTransaction();try{
    await contractMovements(db,actor,previous,action,previous.Valor,'Fixture histórica anterior ao bloqueio');
    const fields=action==='revisar'?`Valor=${amount},Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL`:action==='conferir'?`Status='LIBERADA',ValorLiberado=Valor,LiberadoEmUtc=SYSUTCDATETIME(),ConferidoPor=${actor}`:"Status='CANCELADA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL";
    await db.query(`UPDATE Operacao.Contratacao SET ${fields},LiberacaoBloqueada=1,Versao=Versao+1 WHERE ContratacaoId=${key}`);await db.commit();
   }catch(e){await db.rollback();throw e;}
  }
  const c1=await contract(),c2=await contract(2);
  const proof={nome:'prova.txt',conteudo:Buffer.from('Dinheiro entregue').toString('base64')};
  const payment=await (await request('/api/pc08/pagamentos',{cookie:finance,body:{dataPagamento:'2026-10-01',itens:[c1,c2].map(id=>({contratacaoId:id,versao:2,valor:'150.00',anexo:proof}))}},201)).json();
  assert.equal((await detail(c1)).saldo,'0.00');
  await assert.rejects(()=>changeContract({...cfg,pc10:false},actor,'ignored',c1,'revisar',{versao:3,valor:'180.00',motivo:'Flag desligada'}));
  await assert.rejects(()=>payContract({...cfg,pc10:false},actor,'ignored',{dataPagamento:'2026-10-01',itens:[{contratacaoId:c1,versao:3,valor:'150.00',anexo:proof}]}));
  await request('/api/pc10/contratacoes/'+c2,{cookie:a},404);
  await request('/api/pc04/contratacoes/'+c1+'/revisar',{cookie:a,body:{versao:3,valor:'180.00',motivo:'Acordo corrigido'}},409);
  assert.equal((await detail(c1)).saldo,'0.00');assert.equal(Number((await detail(c1)).registro.Versao),3);
  await seedHistoricalAdjustment(c1,'revisar','180.00');
  let state=await detail(c1);assert.equal(state.saldo,'-150.00');assert.equal(state.podeRegularizar,false);
  await request('/api/pc04/contratacoes/'+c1+'/conferir',{cookie:a,body:{versao:4}},409);
  assert.equal((await detail(c1)).saldo,'-150.00');await seedHistoricalAdjustment(c1,'conferir');
  state=await detail(c1);assert.equal(state.saldo,'30.00');
  const regularize={versao:5,valor:'30.00',data:'2026-10-02',motivo:'Diferença paga',anexo:proof};
  const race=await Promise.all([call('/api/pc10/contratacoes/'+c1+'/regularizar',{cookie:finance,body:regularize}),call('/api/pc10/contratacoes/'+c1+'/regularizar',{cookie:admin,body:regularize})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  state=await detail(c1);assert.equal(state.saldo,'0.00');const move=state.movimentos.find(m=>m.Tipo==='QUITACAO');
  assert.equal(await (await request('/api/pc10/movimentos/'+move.MovimentoId+'/anexo',{cookie:finance},200)).text(),'Dinheiro entregue');
  await request('/api/pc10/movimentos/'+move.MovimentoId+'/anexo',{cookie:b},404);
  await request('/api/pc04/contratacoes/'+c2+'/cancelar',{cookie:b,body:{versao:3,motivo:'Cancelado após pagamento'}},409);
  assert.equal((await detail(c2)).saldo,'0.00');await seedHistoricalAdjustment(c2,'cancelar');
  state=await detail(c2);assert.equal(state.saldo,'-150.00');
  await request('/api/pc10/contratacoes/'+c2+'/regularizar',{cookie:finance,body:{versao:4,valor:'-150.00',data:'2026-10-02',motivo:'Dinheiro devolvido',anexo:proof}},200);
  assert.equal((await detail(c2)).saldo,'0.00');
  const pid=payment.resultado.PagamentoId;
  // Reuse the persisted two-branch journey for PC11; no duplicate fixture/flow.
  const statement=async(cookie,query='')=>(await request('/api/pc11/extrato?prestadorId='+provider+query,{cookie},200)).json();
  const global=await statement(finance),scopedA=await statement(a),scopedB=await statement(b);
  assert.equal(global.saldoFinal,'0.00');assert.equal(scopedA.saldoFinal,'0.00');assert.equal(scopedB.saldoFinal,'0.00');
  assert.ok(scopedA.movimentos.every(m=>Number(m.DepositoId)===1));assert.ok(scopedB.movimentos.every(m=>Number(m.DepositoId)===2));
  assert.equal((await statement(a,'&depositoId=2')).movimentos.length,0);
  const cents=v=>BigInt(v.replace('.',''));
  assert.equal(cents(global.saldoFinal),cents(scopedA.saldoFinal)+cents(scopedB.saldoFinal));
  const period=await statement(finance,'&inicio=2026-10-02&fim=2026-10-02');
  assert.equal(cents(period.saldoAnterior)+period.movimentos.reduce((sum,m)=>sum+cents(m.Valor),0n),cents(period.saldoFinal));
  assert.ok(period.movimentos.every(m=>m.DataEfetiva==='2026-10-02'));
  const group=await (await request('/api/pc11/pagamentos/'+pid,{cookie:a},200)).json();
  assert.equal(group.total,'150.00');assert.equal(group.itens.length,1);assert.equal(Number(group.itens[0].DepositoId),1);
  assert.equal((await (await request('/api/pc11/pagamentos/'+pid,{cookie:finance},200)).json()).total,'300.00');
  await request('/api/pc11/contratacoes/'+c2+'/anexo',{cookie:a},404);
  assert.equal(await (await request('/api/pc11/contratacoes/'+c1+'/anexo',{cookie:a},200)).text(),'Dinheiro entregue');
  await request('/api/pc11/movimentos/'+move.MovimentoId+'/anexo',{cookie:b},404);
  assert.equal(await (await request('/api/pc11/movimentos/'+move.MovimentoId+'/anexo',{cookie:a},200)).text(),'Dinheiro entregue');
  const reverse=await Promise.all([call('/api/pc10/pagamentos/'+pid+'/estornar',{cookie:finance,body:{motivo:'Registro equivocado'}}),call('/api/pc10/pagamentos/'+pid+'/estornar',{cookie:admin,body:{motivo:'Registro equivocado'}})]);assert.deepEqual(reverse.map(r=>r.status).sort(),[200,409]);
  assert.equal((await detail(c1)).saldo,'150.00');assert.equal((await detail(c2)).saldo,'150.00');
  assert.equal((await statement(finance)).saldoFinal,'300.00');assert.equal((await statement(a)).saldoFinal,'150.00');
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.PC08Item WHERE PagamentoId=${pid}`))[0].N),2);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.PC08Anexo WHERE ContratacaoId IN(${c1},${c2})`))[0].N),2);
  await db.query("CREATE TRIGGER Financeiro.PC10TestFailure ON Financeiro.PC10Movimento AFTER INSERT AS BEGIN THROW 55999,N'Falha de teste',1;END");
  state=await detail(c1);await request('/api/pc10/contratacoes/'+c1+'/regularizar',{cookie:finance,body:{...regularize,versao:Number(state.registro.Versao),valor:state.saldo}},503);
  assert.equal((await detail(c1)).saldo,'150.00');await db.query('DROP TRIGGER Financeiro.PC10TestFailure');
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if(created){const master=await connectPilot('master',sqlServer);try{await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);}finally{await master.close();}}
  for(const key of envKeys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
 }
});
