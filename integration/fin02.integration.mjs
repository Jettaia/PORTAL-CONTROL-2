import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('FIN02: emissão/reimpressão HTTP, snapshot, concorrência, versão e acesso com SQL real',{skip:process.env.FIN02_SQL_TESTS!=='YES',timeout:240000},async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 let now='2026-10-31T01:30:00Z';
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true,fin02Now:()=>new Date(now)};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga e descarga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200,extra={})=>{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();assert.equal(response.status,status,raw);let data;try{data=JSON.parse(raw);}catch{data=raw;}return {data,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(depot,day,release=true)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}return c;};
  const a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02'),open=await create(1,'2026-11-03',false),rollback=await create(1,'2026-11-04');
  const receipt=c=>`/api/financeiro/contratacoes/${c.ContratacaoId}/recibo`;
  await call(receipt(a),null,{},401);await call(receipt(a),actors.gestorA.cookie,{},403);await call(receipt(b),actors.gestorA.cookie,{},403);
  await call(receipt(open),admin,{},404);await call(receipt(a),admin,{valor:'1'},400);await call(receipt(a),admin,{},403,{Origin:'https://example.test'});
  const results=await Promise.all([call(receipt(a),actors.financeiro.cookie,{}),call(receipt(a),admin,{})]);
  assert.deepEqual(results[0].data.recibo,results[1].data.recibo);const original=results[0].data.recibo;
  assert.equal(original.DataEmissao,'2026-10-30');assert.equal(original.Snapshot.ValorLiberado,'175.25');assert.equal(original.Snapshot.Prestador,'José da Silva');assert.equal(original.Snapshot.Cidade,'Campinas');assert.equal(original.Snapshot.CnpjPagador,'15.387.508/0001-61');assert.equal(Number(original.VersaoOrigem),Number(a.Versao));
  assert.equal(original.Snapshot.Deposito,'Depósito A');assert.equal(original.Snapshot.Rua,'Rua A');assert.equal(original.Snapshot.NumeroEndereco,'1');assert.equal(original.Snapshot.Bairro,'Centro');assert.equal(original.Snapshot.CEP,'13010000');
  const emittedB=(await call(receipt(b),admin,{})).data.recibo;assert.equal(emittedB.Snapshot.Cidade,'Santos');
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo'))[0].N),2);
  const detail=(await call('/api/financeiro/contratacoes/'+a.ContratacaoId,admin)).data.registro;assert.equal(detail.Situacao,'RECIBO_GERADO');assert.equal(detail.ValorLiberado,'175.25');assert.equal(Number(detail.ReciboCompativel),1);
  assert.equal((await call('/api/financeiro/contratacoes?situacao=RECIBO_GERADO',admin)).data.registros.length,2);assert.equal((await call('/api/financeiro/contratacoes?situacao=PAGO',admin)).data.registros.length,0);assert.equal((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${a.ContratacaoId}`))[0].PagoEmUtc,null);
  const printed=await call(receipt(a)+'/impressao',actors.gestorA.cookie),html=printed.data;const style=html.match(/<style>([\s\S]*?)<\/style>/)[1],hash=crypto.createHash('sha256').update(style).digest('base64');assert.ok(printed.headers.get('content-security-policy').includes("style-src 'sha256-"+hash+"'"),'CSP deve autorizar somente CSS emitido');assert.ok(!printed.headers.get('content-security-policy').includes('unsafe-inline'));assert.equal(printed.headers.get('cache-control'),'no-store');assert.equal(typeof html,'string');assert.match(html,/José da Silva/);assert.ok(!html.includes('12345678901'));
  assert.ok(!html.includes('data-manual="extenso"'));assert.match(html,/R\$ 175,25, referente/);assert.match(html,/Depósito A/);assert.match(html,/Centro de custo: A/);assert.match(html,/Rua A, 1/);assert.match(html,/Centro/);assert.match(html,/13010-000/);
  // Previously issued receipts have neither depot address in the snapshot nor the new layout.
  const legacy={...emittedB.Snapshot};for(const field of ['Deposito','Rua','NumeroEndereco','Bairro','CEP'])delete legacy[field];
  await db.query(`UPDATE Financeiro.ContratacaoRecibo SET SnapshotJson=N'${JSON.stringify(legacy).replaceAll("'","''")}',DocumentoHtml=N'<p>Legado (__________)</p>' WHERE ContratacaoId=${b.ContratacaoId}`);
  const legacyHtml=(await call(receipt(b)+'/impressao',admin)).data;assert.match(legacyHtml,/Depósito B/);assert.match(legacyHtml,/Rua B, 2/);assert.match(legacyHtml,/11010-000/);assert.ok(!legacyHtml.includes('__________'));assert.match(legacyHtml,/R\$ 175,25, referente/);assert.deepEqual((await call(receipt(b),admin)).data.recibo.Snapshot,legacy);
  now='2026-11-02T15:00:00Z';await db.query("UPDATE Cadastro.Prestador SET Nome=N'Nome alterado';UPDATE Cadastro.TipoServico SET Nome=N'Atividade alterada';UPDATE Cadastro.Deposito SET Nome=N'Depósito alterado',Rua=N'Rua alterada',Cidade=N'Cidade alterada'");
  assert.deepEqual((await call(receipt(a),admin,{})).data.recibo,original);assert.deepEqual((await call(receipt(a),actors.gestorA.cookie)).data.recibo,original);assert.equal((await call(receipt(a)+'/impressao',admin)).data,html);
  for(const suffix of ['', '/impressao'])await call(receipt(b)+suffix,actors.gestorA.cookie,undefined,404);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.gestorA.id}`);for(const suffix of ['', '/impressao'])await call(receipt(a)+suffix,actors.gestorA.cookie,undefined,404);
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1,Valor=200,ValorLiberado=200 WHERE ContratacaoId=${a.ContratacaoId}`);
  await call(receipt(a),admin,{},409);assert.equal(Number((await call('/api/financeiro/contratacoes/'+a.ContratacaoId,admin)).data.registro.ReciboCompativel),0);assert.deepEqual((await call(receipt(a),admin)).data.recibo,original);
  await db.query(`UPDATE Operacao.Contratacao SET Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL WHERE ContratacaoId=${a.ContratacaoId}`);await call(receipt(a),admin,{},404);assert.deepEqual((await call(receipt(a),admin)).data.recibo,original);
  // Audit failure must roll back the receipt too (real database failure injection).
  await db.query("CREATE TRIGGER Seguranca.Fin02TestFail ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'FIN02_EMITIR') THROW 55998,N'Falha de teste',1;END");
  await call(receipt(rollback),admin,{},503);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoRecibo WHERE ContratacaoId=${rollback.ContratacaoId}`))[0].N),0);await db.query('DROP TRIGGER Seguranca.Fin02TestFail');
  await call(receipt(rollback),actors.financeiro.cookie,{});await db.query(`UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${actors.financeiro.id}`);await call(receipt(rollback),actors.financeiro.cookie,undefined,401);
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();}
});
