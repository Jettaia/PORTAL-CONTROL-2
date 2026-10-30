import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('FIN01: fila HTTP autenticada, escopo, liberação, filtros e paginação SQL real',{skip:process.env.FIN01_SQL_TESTS!=='YES',timeout:240000},async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200)=>{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const queue=async(cookie,q='')=>(await call('/api/financeiro/contratacoes'+q,cookie)).data;
  assert.deepEqual((await queue(actors.financeiro.cookie)).registros,[]);
  await call('/api/financeiro/contratacoes',null,undefined,401);
  const create=async(depot,day)=>{const actor=depot===1?actors.gestorA:actors.gestorB;return (await call('/api/pc04/contratacoes',actor.cookie,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:Number(actor.id),dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;};
  const change=async(c,action,body,cookie=admin)=>(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/${action}`,cookie,{versao:Number(c.Versao),...body})).data.resultado;
  let a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02'),open=await create(1,'2026-11-03');
  a=await change(a,'horarios',{entradaReal:a.DataServico+'T08:00',saidaReal:a.DataServico+'T10:00',motivo:'Horários reais'});
  a=await change(a,'conferir',{},actors.gestorA.cookie);
  b=await change(b,'horarios',{entradaReal:b.DataServico+'T08:00',saidaReal:b.DataServico+'T10:00',motivo:'Horários reais'});b=await change(b,'conferir',{});
  for(const cookie of [admin,actors.financeiro.cookie]){const r=await queue(cookie);assert.equal(r.registros.length,2);assert.equal(r.registros[0].Situacao,'AGUARDANDO_PAGAMENTO');assert.equal(r.registros[0].ValorLiberado,'175.25');assert.deepEqual((await queue(cookie)).registros,r.registros);}
  assert.equal((await queue(actors.gestorA.cookie)).registros.length,1);
  assert.equal((await queue(actors.gestorA.cookie,'?depositoId=2')).registros.length,0);
  const detail='/api/financeiro/contratacoes/';
  await call(detail+b.ContratacaoId,actors.gestorA.cookie,undefined,404);
  await call(detail+open.ContratacaoId,admin,undefined,404);
  const d=(await call(detail+b.ContratacaoId,actors.financeiro.cookie)).data;
  assert.equal(d.registro.LiberadoPor,'Admin teste');assert.equal(d.podeOperar,true);assert.equal(d.registro.Cidade,'Santos');
  assert.equal((await call(detail+a.ContratacaoId,actors.gestorA.cookie)).data.podeOperar,false);
  assert.equal((await queue(admin,`?depositoId=2&prestadorId=1&inicio=2026-11-02&fim=2026-11-02&numero=${b.Numero}&situacao=AGUARDANDO_PAGAMENTO`)).registros.length,1);
  for(const state of ['RECIBO_GERADO','PAGO'])assert.equal((await queue(admin,'?situacao='+state)).registros.length,0);
  for(const q of ['?inicio=2026-02-30','?inicio=2026-11-03&fim=2026-11-01','?situacao=ABERTO','?depositoId=2%20OR%201=1','?cursor=bad','?numero=1&numero=2'])await call('/api/financeiro/contratacoes'+q,admin,undefined,400);
  const catalog=(await call('/api/financeiro/catalogo',actors.gestorA.cookie)).data;assert.deepEqual(catalog.depositos.map(x=>Number(x.DepositoId)),[1]);
  await call('/api/pc04/contratacoes/'+b.ContratacaoId,actors.financeiro.cookie,undefined,404);
  for(const cookie of [admin,actors.financeiro.cookie,actors.gestorA.cookie])for(const path of ['/api/pc08/pagamentos','/api/pc10/pagamentos/1/estornar','/api/final-lab/anexos','/api/b52/autorizacoes'])await call(path,cookie,{itens:[]},409);
  for(const path of ['/API/PC08/PAGAMENTOS','/Api/pC10/pagamentos/1/estornar','/API/FINAL-LAB/ANEXOS'])await call(path,actors.financeiro.cookie,{itens:[]},409);
  // Existing contract revisions/cancellation remain governed by PC04. Inject a restored
  // pre-lock record to exercise its supported revision path, rather than weaken that lock.
  await db.query(`UPDATE Operacao.Contratacao SET LiberacaoBloqueada=0,Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL WHERE ContratacaoId=${a.ContratacaoId}`);
  a=await change(a,'revisar',{valor:'190.00',motivo:'Revisão admitida na origem'});
  assert.equal((await queue(admin)).registros.length,1);await call(detail+a.ContratacaoId,admin,undefined,404);
  open=await change(open,'cancelar',{motivo:'Cancelamento operacional'});assert.equal((await queue(admin)).registros.length,1);
  // More than one page, tied timestamps with sub-millisecond precision; old paid
  // markers cannot masquerade as new payments before FIN02/03/04.
  await db.query(`DECLARE @i int=0;WHILE @i<205 BEGIN INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor,Status,ValorLiberado,LiberadoEmUtc,ConferidoPor,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem) VALUES((SELECT COALESCE(MAX(Numero),0)+1 FROM Operacao.Contratacao),2,1,1,1,DATEADD(day,@i,'2027-01-01'),DATEADD(day,@i,'2027-01-01T08:00:00'),DATEADD(day,@i,'2027-01-01T12:00:00'),120,1,'LIBERADA',120,'2026-10-01T10:00:00.1234567',1,DATEADD(day,@i,'2027-01-01T08:00:00'),DATEADD(day,@i,'2027-01-01T12:00:00'),'MANUAL','MANUAL');SET @i+=1;END`);
  const all=[];let cursor;do{const page=await queue(actors.financeiro.cookie,cursor?'?cursor='+encodeURIComponent(cursor):'');all.push(...page.registros);cursor=page.proximaPagina;}while(cursor);
  assert.equal(all.length,206);assert.equal(new Set(all.map(x=>String(x.ContratacaoId))).size,206);assert.equal(String(all.at(-1).ContratacaoId),String(b.ContratacaoId));
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.gestorA.id}`);assert.equal((await queue(actors.gestorA.cookie)).registros.length,0);
  await db.query(`UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${actors.financeiro.id}`);await call('/api/financeiro/contratacoes',actors.financeiro.cookie,undefined,401);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();
 }
});
