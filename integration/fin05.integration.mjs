import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('FIN05: extrato HTTP/SQL real, totais exatos, criação local, pagamento e isolamento por persona',{skip:process.env.FIN05_SQL_TESTS!=='YES',timeout:240000},async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,fin01:true,fin02Now:()=>new Date('2026-10-28T15:00:00Z')};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Descarga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901'),(N'Maria Santos','12345678902');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1),(2,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200)=>{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();assert.equal(response.status,status,raw);return {data:JSON.parse(raw),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const endpoint='/api/financeiro/extrato',read=async(cookie=admin,q='')=>(await call(endpoint+q,cookie)).data;
  await call(endpoint,null,undefined,401);
  assert.deepEqual((await read()).totais,{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'});
  const create=async(depot,provider,day,value,release=true)=>{
   let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:provider,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:value},201)).data.resultado;
   if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}
   return c;
  };
  const a=await create(1,1,'2026-11-01','100.10'),b=await create(2,1,'2026-11-02','200.20'),c=await create(2,2,'2026-11-03','50.05');
  const open=await create(1,1,'2026-11-04','999.00',false),cancelled=await create(1,1,'2026-11-05','888.00',false);
  await call(`/api/pc04/contratacoes/${cancelled.ContratacaoId}/cancelar`,admin,{versao:Number(cancelled.Versao),motivo:'Cancelada'});
  await db.query(`UPDATE Operacao.Contratacao SET CriadoEmUtc='2026-10-30T02:59:59.999' WHERE ContratacaoId=${a.ContratacaoId};UPDATE Operacao.Contratacao SET CriadoEmUtc='2026-10-30T03:00:00.000' WHERE ContratacaoId=${b.ContratacaoId};UPDATE Operacao.Contratacao SET CriadoEmUtc='2026-10-31T02:59:59.999' WHERE ContratacaoId=${c.ContratacaoId}`);
  const base='/api/financeiro/contratacoes/'+a.ContratacaoId;
  const receipt=(await call(base+'/recibo',actors.financeiro.cookie,{})).data.recibo;
  const paymentBody={reciboId:receipt.ReciboId,arquivo:{nome:'recibo.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nSynthetic').toString('base64')},baixaAnteriorId:null};
  const payment=(await call(base+'/pagamento',actors.financeiro.cookie,paymentBody)).data.pagamento;
  await db.query(`UPDATE Financeiro.ContratacaoBaixa SET ConfirmadoEmUtc='2026-10-31T12:34:56.123' WHERE ContratacaoId=${a.ContratacaoId}`);
  // A receipt alone is not payment, and a legacy marker must not count either.
  await call('/api/financeiro/contratacoes/'+b.ContratacaoId+'/recibo',admin,{});
  await db.query(`UPDATE Operacao.Contratacao SET PagoEmUtc='2026-10-31T12:00:00' WHERE ContratacaoId=${c.ContratacaoId}`);
  const before=(await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Auditoria) AuditCount,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) PaymentCount'))[0];
  for(const cookie of [admin,actors.financeiro.cookie]){
   const result=await read(cookie);assert.equal(result.totalRegistros,2);assert.equal(result.proximaPagina,null);assert.deepEqual(result.contratacoes,[]);
   assert.deepEqual(result.totais,{ValorDevido:'350.35',ValorPago:'100.10',Saldo:'250.25'});
   assert.deepEqual(result.prestadores.map(p=>[p.Prestador,p.ValorDevido,p.ValorPago,p.Saldo]),[['José da Silva','300.30','100.10','200.20'],['Maria Santos','50.05','0.00','50.05']]);
  }
  const individual=await read(admin,'?prestadorId=1');assert.equal(individual.totalRegistros,2);assert.deepEqual(individual.prestadores,[]);assert.deepEqual(individual.totais,{ValorDevido:'300.30',ValorPago:'100.10',Saldo:'200.20'});
  assert.deepEqual(individual.contratacoes.map(r=>Number(r.ContratacaoId)),[Number(a.ContratacaoId),Number(b.ContratacaoId)]);
  const paid=individual.contratacoes[0];assert.equal(paid.DataCriacao,'2026-10-30T02:59:59.999');assert.equal(paid.DataPagamento,'2026-10-31T12:34:56.123');assert.equal(paid.CentroCusto,'CC-A');assert.equal(paid.Atividade,'Descarga');assert.equal(paid.ValorPago,'100.10');assert.ok(!Object.hasOwn(paid,'Saldo'));
  assert.equal(individual.contratacoes[1].DataPagamento,null);assert.equal(individual.contratacoes[1].ValorPago,'0.00');
  assert.deepEqual((await read(actors.gestorA.cookie)).totais,{ValorDevido:'100.10',ValorPago:'100.10',Saldo:'0.00'});
  assert.deepEqual((await read(actors.gestorB.cookie)).totais,{ValorDevido:'250.25',ValorPago:'0.00',Saldo:'250.25'});
  for(const q of ['?depositoId=2','?prestadorId=2','?prestadorId=1&depositoId=2']){const denied=await read(actors.gestorA.cookie,q);assert.equal(denied.totalRegistros,0);assert.deepEqual(denied.totais,{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'});}
  const day=await read(admin,'?inicio=2026-10-30&fim=2026-10-30');assert.deepEqual(day.totais,{ValorDevido:'250.25',ValorPago:'0.00',Saldo:'250.25'});assert.equal(day.totalRegistros,2);
  assert.equal((await read(admin,'?prestadorId=1&depositoId=2&inicio=2026-10-30&fim=2026-10-30')).contratacoes.length,1);
  assert.equal((await read(admin,'?prestadorId=1&inicio=2026-10-29&fim=2026-10-29')).contratacoes.length,1);
  assert.equal((await read(admin,'?inicio=2026-11-01')).totalRegistros,0,'Filtrar criação, não data do serviço');
  for(const q of ['?inicio=2026-02-30','?inicio=2026-11-03&fim=2026-11-01','?situacao=PAGO','?depositoId=2%20OR%201=1','?prestadorId=1&prestadorId=2','?pagina=0','?pagina=1.5','?pagina=1000000000000','?fim[]=2026-10-30'])await call(endpoint+q,admin,undefined,400);
  assert.equal((await call(endpoint,admin)).headers.get('cache-control'),'no-store');
  assert.deepEqual((await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Auditoria) AuditCount,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) PaymentCount'))[0],before);
  // Existing corrections must never duplicate a contract or count inactive settlements.
  await call(base+'/pagamento/desfazer',admin,{baixaId:payment.BaixaId,anexoId:payment.AnexoId,motivo:'Correção de confirmação'});
  const pending=await read(admin,'?prestadorId=1');assert.equal(pending.totalRegistros,2);assert.equal(pending.contratacoes[0].DataPagamento,null);assert.deepEqual(pending.totais,{ValorDevido:'300.30',ValorPago:'0.00',Saldo:'300.30'});
  await call(base+'/pagamento',actors.financeiro.cookie,{...paymentBody,baixaAnteriorId:payment.BaixaId});
  assert.deepEqual((await read(admin,'?prestadorId=1')).totais,individual.totais);
  // Bound pages, aggregate all filtered contracts, exact cents, deterministic ties.
  await db.query("DECLARE @i int=0;WHILE @i<105 BEGIN INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,ValorLiberado,LiberadoEmUtc,ConferidoPor,CriadoEmUtc,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem) VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),1,1,1,1,DATEADD(day,@i,'2027-01-01'),DATEADD(day,@i,'2027-01-01T08:00:00'),DATEADD(day,@i,'2027-01-01T12:00:00'),0.01,1,'LIBERADA',0.01,'2026-11-01T10:00:00',1,'2026-11-01T10:00:00',DATEADD(day,@i,'2027-01-01T08:00:00'),DATEADD(day,@i,'2027-01-01T12:00:00'),'MANUAL','MANUAL');SET @i+=1;END");
  const page1=await read(admin,'?prestadorId=1'),page2=await read(admin,'?prestadorId=1&pagina=2');
  assert.equal(page1.totalRegistros,107);assert.equal(page1.contratacoes.length,100);assert.equal(page1.proximaPagina,2);assert.equal(page2.contratacoes.length,7);assert.equal(page2.proximaPagina,null);assert.deepEqual(page1.totais,{ValorDevido:'301.35',ValorPago:'100.10',Saldo:'201.25'});assert.deepEqual(page2.totais,page1.totais);assert.equal(new Set([...page1.contratacoes,...page2.contratacoes].map(r=>String(r.ContratacaoId))).size,107);
  // Summary pagination must not truncate its global totals either.
  await db.query("DECLARE @i int=0;WHILE @i<101 BEGIN INSERT Cadastro.Prestador(Nome,CPF) VALUES(CONCAT(N'ZZ Prestador ',RIGHT('000'+CONVERT(varchar(3),@i),3)),RIGHT('00000000000'+CONVERT(varchar(11),@i),11));DECLARE @p bigint=SCOPE_IDENTITY();INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,ValorLiberado,LiberadoEmUtc,ConferidoPor,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem) VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),2,@p,1,1,'2027-01-01','2027-01-01T08:00:00','2027-01-01T12:00:00',0.01,1,'LIBERADA',0.01,'2026-11-01T10:00:00',1,'2027-01-01T08:00:00','2027-01-01T12:00:00','MANUAL','MANUAL');SET @i+=1;END");
  const summary1=await read(),summary2=await read(admin,'?pagina=2');assert.equal(summary1.totalRegistros,103);assert.equal(summary1.prestadores.length,100);assert.equal(summary2.prestadores.length,3);assert.deepEqual(summary1.totais,{ValorDevido:'352.41',ValorPago:'100.10',Saldo:'252.31'});assert.deepEqual(summary1.totais,summary2.totais);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.gestorA.id}`);assert.equal((await read(actors.gestorA.cookie)).totalRegistros,0);
  await db.query(`DELETE Seguranca.UsuarioPerfil WHERE UsuarioId=${actors.gestorB.id};UPDATE Seguranca.Usuario SET Perfil='DIRETORIA' WHERE UsuarioId=${actors.gestorB.id}`);await call(endpoint,actors.gestorB.cookie,undefined,403);
  await db.query(`UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${actors.financeiro.id}`);await call(endpoint,actors.financeiro.cookie,undefined,401);
  assert.ok(open.ContratacaoId); // Open and cancelled fixtures never contributed.
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();}
});
