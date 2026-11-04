import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {hostname} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';

test('FIN03: baixa/anexos/correções HTTP, rollback, concorrência, versão e acesso com SQL real',{skip:process.env.FIN03_SQL_TESTS!=='YES',timeout:240000},async t=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 let now=new Date(Date.now()-172800000).toISOString();
 const events=[];
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true,fin02Now:()=>new Date(now),observe:event=>events.push(event)};
 const master=await connectPilot('master',sqlServer);let db,server,created=false;
 let lastStage=performance.now();
 const stage=name=>{const current=performance.now();console.log(`FIN03 etapa: ${name} (${Math.round(current-lastStage)} ms desde a anterior)`);lastStage=current;};
 try{
  stage('instalação sintética');
  const identity=(await master.query("SELECT CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')) MachineName"))[0];
  assert.equal(identity.MachineName.toLowerCase(),hostname().toLowerCase(),'SQL deve pertencer à máquina local');
  await master.query(`CREATE DATABASE [${database}]`);created=true;db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  stage('schema instalado; preparando catálogo');
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  // Match ACCESS/PC04 fixtures: commit the catalog once instead of flushing every grant.
  await db.beginTransaction();try{
   await seedCatalog(db);
   await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);
   await db.commit();
  }catch(error){await db.rollback();throw error;}
  stage('catálogo pronto; preparando atores');await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga e descarga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200,extra={})=>{
   const large=body?.arquivo?.conteudoBase64?.length>1000000;
   let response;try{response=await fetch(origin+path,{signal:AbortSignal.timeout(large?60000:15000),method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}
   catch(error){throw Error(`FIN03 requisição falhou: ${body?'POST':'GET'} ${path} (${large?'anexo grande':'corpo pequeno'})`,{cause:error});}
   const raw=await response.text();assert.equal(response.status,status,raw);let data;try{data=JSON.parse(raw);}catch{data=raw;}return {data,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(depot,day,release=true)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}return c;};
  stage('criando contratações');
  const a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02'),missing=await create(1,'2026-11-03'),stale=await create(1,'2026-11-04'),rollback=await create(1,'2026-11-05');
  const root=c=>`/api/financeiro/contratacoes/${c.ContratacaoId}`;
  const file=(suffix='')=>({nome:'assinado.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nrecibo assinado'+suffix+'\n%%EOF').toString('base64')});
  const issue=async c=>(await call(root(c)+'/recibo',admin,{})).data.recibo;
  stage('emitindo recibos e validando recusas');
  const ra=await issue(a),rb=await issue(b),rs=await issue(stale),rr=await issue(rollback);
  assert.ok((await call(root(stale)+'/pagamento',admin)).data.historico.some(e=>e.Acao==='FIN02_EMITIR'));
  const payload={reciboId:ra.ReciboId,arquivo:file(),baixaAnteriorId:null};
  const largeFile={...file(),conteudoBase64:Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(5242880-9,32)]).toString('base64')};
  await call(root(a)+'/pagamento',admin,{...payload,arquivo:{...largeFile,conteudoBase64:Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(5242880,32)]).toString('base64')}},400);
  await call(root(a)+'/pagamento',null,payload,401);await call(root(a)+'/pagamento',admin,payload,403,{Origin:'https://foreign.test'});await call(root(a)+'/pagamento',actors.gestorA.cookie,payload,403);
  await call(root(missing)+'/pagamento',admin,{reciboId:ra.ReciboId,arquivo:file()},409);
  await call(root(a)+'/pagamento',admin,{reciboId:ra.ReciboId},400);
  await call(root(a)+'/pagamento',admin,{...payload,valor:'1'},400);
  await call(root(a)+'/pagamento',admin,{...payload,itens:[a.ContratacaoId]},400);
  await call(root(a)+'/pagamento',admin,{...payload,arquivo:{...file(),tipo:'text/html'}},400);
  await call(root(a)+'/pagamento',admin,{...payload,arquivo:{...file(),conteudoBase64:Buffer.from('<html>bad</html>').toString('base64')}},400);
  now='2026-11-03T15:00:00Z';
  // Hold the real application lock until both HTTP transactions are waiting in SQL.
  stage('barreira de concorrência');
  await db.beginTransaction();
  let settled;
  try{
   const blocker=Number((await db.query('SELECT @@SPID Spid'))[0].Spid);
   const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];
   assert.ok(Number(lock.R)>=0);
   const start=events.length;
   settled=Promise.all([call(root(a)+'/pagamento',admin,payload),call(root(a)+'/pagamento',actors.financeiro.cookie,payload)]).then(value=>({value}),error=>({error}));
   const deadline=Date.now()+3500;let spids=[],waiters=[];
   while(Date.now()<deadline){
    spids=[...new Set(events.slice(start).filter(e=>e.event==='sql.begin'&&e.operationId==='APPLOCK').map(e=>e.spid))];
    if(spids.length===2){
     assert.ok(spids.every(value=>Number.isInteger(value)&&value>0&&value!==blocker));
     waiters=await db.query(`SELECT r.session_id Spid,r.blocking_session_id Blocker FROM sys.dm_exec_requests r WHERE r.session_id IN(${spids.join(',')}) AND EXISTS(SELECT 1 FROM sys.dm_tran_locks l WHERE l.request_session_id=r.session_id AND l.resource_database_id=DB_ID() AND l.resource_type='APPLICATION' AND l.request_status='WAIT')`);
     if(waiters.length===2)break;
    }
    await delay(25);
   }
   assert.equal(spids.length,2,'duas sessões SQL distintas');assert.equal(waiters.length,2,'ambas as sessões devem aguardar o applock');
   // SQL may report the earlier waiter as the next waiter's blocker (lock queue).
   assert.ok(waiters.every(row=>Number(row.Blocker)===blocker||waiters.some(parent=>Number(parent.Spid)===Number(row.Blocker)&&Number(parent.Blocker)===blocker)),'cadeia de espera deve terminar na sessão de controle');
   t.diagnostic(`Concorrência SQL comprovada: ${JSON.stringify(waiters)} aguardando APPLICATION lock sob SPID ${blocker} antes da liberação`);
  }finally{await db.rollback();if(settled)await settled;}
  const outcome=await settled;if(outcome.error)throw outcome.error;const paid=outcome.value;
  stage('concorrência concluída; verificando persistência/índice');
  const payment=paid[0].data.pagamento;assert.equal(String(payment.BaixaId),String(paid[1].data.pagamento.BaixaId));assert.equal(payment.DataPagamento,ra.DataEmissao);assert.equal(payment.Valor,'175.25');assert.ok(payment.ConfirmadoEmUtc.slice(0,10)>ra.DataEmissao);assert.ok(payment.ConfirmadoPor);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa'))[0].N),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoAnexo WHERE ContratacaoId=${a.ContratacaoId}`))[0].N),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade=N'Fin03' AND EntidadeId=${a.ContratacaoId} AND Acao=N'FIN03_CONFIRMAR'`))[0].N),1);
  // Exercise the actual unique index, independently of the service's applock.
  await db.beginTransaction();try{
   await assert.rejects(()=>db.query(`INSERT Financeiro.ContratacaoBaixa(ContratacaoId,ReciboId,AnexoId,Valor,DataPagamento,ConfirmadoPor) SELECT ContratacaoId,ReciboId,AnexoId,Valor,DataPagamento,ConfirmadoPor FROM Financeiro.ContratacaoBaixa WHERE BaixaId=${payment.BaixaId}`),error=>error.odbcErrors?.some(e=>[2601,2627].includes(Number(e.code))));
  }finally{await db.rollback();}
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${a.ContratacaoId} AND DesfeitoEmUtc IS NULL`))[0].N),1);
  t.diagnostic('Persistência: uma baixa ativa, um anexo, uma auditoria; índice único recusou duplicação SQL');
  assert.equal((await call(root(a),admin)).data.registro.Situacao,'PAGO');
  assert.equal((await call('/api/financeiro/contratacoes?situacao=PAGO',admin)).data.registros.length,1);
  assert.ok((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${a.ContratacaoId}`))[0].PagoEmUtc);
  const anexo=paid[0].data.anexos[0],download=root(a)+'/anexos/'+anexo.AnexoId;
  assert.equal((await call(download,actors.gestorA.cookie)).data,Buffer.from(file().conteudoBase64,'base64').toString());await call(download,actors.gestorB.cookie,undefined,404);
  await call(root(a)+'/pagamento',actors.gestorB.cookie,undefined,404);
  await call(root(a)+'/pagamento',admin,{...payload,arquivo:file('different')},409);
  const cas={baixaId:payment.BaixaId,anexoId:payment.AnexoId};
  for(const action of ['/desfazer','/anexo'])await call(root(a)+'/pagamento'+action,actors.gestorA.cookie,{...cas,motivo:'erro',arquivo:file()},403);
  await call(root(a)+'/pagamento/desfazer',admin,{...cas,motivo:''},400);
  stage('rollback de correções');
  await db.query("CREATE TRIGGER Seguranca.Fin03CorrectionFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao IN(N'FIN03_SUBSTITUIR',N'FIN03_DESFAZER')) THROW 55997,N'Falha correção',1;END");
  await call(root(a)+'/pagamento/anexo',admin,{...cas,arquivo:file('rollback')},503);await call(root(a)+'/pagamento/desfazer',admin,{...cas,motivo:'rollback'},503);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoAnexo WHERE ContratacaoId=${a.ContratacaoId}`))[0].N),1);assert.equal((await call(root(a),admin)).data.registro.Situacao,'PAGO');await db.query('DROP TRIGGER Seguranca.Fin03CorrectionFail');
  await call(`/api/pc04/contratacoes/${a.ContratacaoId}/cancelar`,admin,{versao:Number(a.Versao),motivo:'Não pode apagar paga'},409);
  const exchanged=(await call(root(a)+'/pagamento/anexo',actors.financeiro.cookie,{...cas,arquivo:file('corrected')})).data;
  assert.equal(String(exchanged.pagamento.BaixaId),String(payment.BaixaId));assert.equal(exchanged.anexos.length,2);assert.notEqual(String(exchanged.pagamento.AnexoId),String(anexo.AnexoId));
  await call(root(a)+'/pagamento/desfazer',admin,{...cas,motivo:'stale'},409);
  assert.match((await call(download,admin)).data,/%PDF/);
  const undone=(await call(root(a)+'/pagamento/desfazer',admin,{baixaId:payment.BaixaId,anexoId:exchanged.pagamento.AnexoId,motivo:'Confirmação indevida'})).data;
  assert.equal(undone.pagamento,null);assert.equal((await call(root(a),admin)).data.registro.Situacao,'RECIBO_GERADO');assert.equal((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${a.ContratacaoId}`))[0].PagoEmUtc,null);assert.ok(undone.historico.some(e=>e.Acao==='FIN03_DESFAZER'));
  assert.equal((await call(root(a)+'/recibo',admin)).data.recibo.DataEmissao,ra.DataEmissao);
  await call(root(a)+'/pagamento',admin,payload,409);payload.baixaAnteriorId=payment.BaixaId;
  const race=await Promise.all([call(root(a)+'/pagamento',admin,payload),call(`/api/pc04/contratacoes/${a.ContratacaoId}/revisar`,admin,{versao:Number(a.Versao),valor:'10',motivo:'Concorrência revisão'},409)]);assert.equal(race[0].data.pagamento.Valor,'175.25');assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa'))[0].N),2);
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${stale.ContratacaoId}`);await call(root(stale)+'/pagamento',admin,{reciboId:rs.ReciboId,arquivo:file()},409);
  stage('rollback de confirmação e recuperação');
  await db.query("CREATE TRIGGER Seguranca.Fin03TestFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'FIN03_CONFIRMAR') THROW 55998,N'Falha teste',1;END");
  await call(root(rollback)+'/pagamento',admin,{reciboId:rr.ReciboId,arquivo:file(),baixaAnteriorId:null},503);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].N),0);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoAnexo WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].N),0);assert.equal((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].PagoEmUtc,null);await db.query('DROP TRIGGER Seguranca.Fin03TestFail');
  const confirmationCount=async()=>Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade=N'Fin03' AND EntidadeId=${rollback.ContratacaoId} AND Acao=N'FIN03_CONFIRMAR'`))[0].N);
  assert.equal(await confirmationCount(),0);
  const recovered=(await call(root(rollback)+'/pagamento',admin,{reciboId:rr.ReciboId,arquivo:file(),baixaAnteriorId:null})).data;
  assert.ok(recovered.pagamento.BaixaId);assert.equal(recovered.anexos.length,1);assert.equal(await confirmationCount(),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].N),1);
  assert.ok((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].PagoEmUtc);
  t.diagnostic('Rollback comprovado: baixa/anexo/auditoria ausentes e PagoEmUtc NULL após falha; nova tentativa persistiu uma única confirmação');
  stage('anexo de 5 MB e concorrência de correção');
  const largePaid=(await call(root(b)+'/pagamento',actors.financeiro.cookie,{reciboId:rb.ReciboId,arquivo:largeFile,baixaAnteriorId:null})).data;assert.equal(Number(largePaid.anexos[0].Tamanho),5242880);const downloaded=await fetch(origin+root(b)+'/anexos/'+largePaid.anexos[0].AnexoId,{headers:{Cookie:admin}});assert.equal((await downloaded.arrayBuffer()).byteLength,5242880);
  const current=(await call(root(a)+'/pagamento',admin)).data.pagamento;
  const attempt=async suffix=>fetch(origin+root(a)+'/pagamento/anexo',{method:'POST',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',Cookie:admin},body:JSON.stringify({baixaId:current.BaixaId,anexoId:current.AnexoId,arquivo:file(suffix)})});
  const correctionRace=await Promise.all([attempt('race1'),attempt('race2')]);assert.deepEqual(correctionRace.map(r=>r.status).sort(),[200,409]);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.gestorA.id}`);await call(download,actors.gestorA.cookie,undefined,404);await call(root(a)+'/pagamento',actors.gestorA.cookie,undefined,404);
  await call('/api/pc08/pagamentos',admin,{itens:[]},409);
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();try{if(created){await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic('Banco sintético desta execução removido e ausência confirmada');}}finally{await master.close();}}
});
