import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {hostname} from 'node:os';
import fs from 'node:fs';
import {snapshot} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';

test('Exclusão: autorização, financeiro e solicitações HTTP com SQL real',{skip:process.env.CONTRACT_EXCLUSION_SQL_TESTS!=='YES',timeout:240000},async t=>{
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
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[1]],['coordenador','COORDENADOR',[1]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(depot,day,release=true)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}return c;};
  const erase=c=>`/api/pc04/contratacoes/${c.ContratacaoId}/excluir`;
  const request=c=>`/api/pc04/contratacoes/${c.ContratacaoId}/solicitar-exclusao`;
  const payload=c=>({versao:Number(c.Versao),motivo:'Registro duplicado confirmado',confirmar:true});
  const open=await create(1,'2026-11-01',false);
  await call(erase(open),admin,payload(open)); // Principal red: missing route must fail here.
  const assertGone=async c=>{
   await call(`/api/pc04/contratacoes/${c.ContratacaoId}`,admin,undefined,404);
   for(const table of ['Operacao.Contratacao','Operacao.ContratacaoEvento','Operacao.ContratacaoToken','Operacao.ContratacaoHorarioSolicitacao','Operacao.ContratacaoExclusaoSolicitacao','Financeiro.ContratacaoRecibo','Financeiro.ContratacaoAnexo','Financeiro.ContratacaoBaixa','Financeiro.PC08Item','Financeiro.PC08Anexo','Financeiro.PC10Movimento','Financeiro.PC10DocumentoEstado'])assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM ${table} WHERE ContratacaoId=${c.ContratacaoId}`))[0].N),0,table);
  };
  await assertGone(open);
  const next=await create(1,'2026-11-02',false);assert.ok(BigInt(next.Numero)>BigInt(open.Numero),'deleted number cannot be reused');
  await call(erase(next),null,payload(next),401);
  const canceled=(await call(`/api/pc04/contratacoes/${next.ContratacaoId}/cancelar`,admin,{versao:Number(next.Versao),motivo:'Cancelada para teste'})).data.resultado;
  await call(erase(canceled),admin,payload(canceled));await assertGone(canceled);
  const released=await create(1,'2026-11-03');
  for(const role of ['gestorA','coordenador','financeiro'])await call(erase(released),actors[role].cookie,payload(released),403);
  await call(erase(released),admin,{...payload(released),confirmar:false},400);
  await call(erase(released),admin,{...payload(released),versao:1},409);
  await call(erase(released),admin,{...payload(released),motivo:' '},400);
  await call(erase(released),admin,payload(released),403,{Origin:'http://evil.test'});
  await call(request(released),actors.gestorB.cookie,{versao:Number(released.Versao),motivo:'Fora do escopo'},404);
  const sent=(await call(request(released),actors.coordenador.cookie,{versao:Number(released.Versao),motivo:'Solicitação do coordenador'})).data.resultado;
  await call(request(released),actors.gestorA.cookie,{versao:Number(released.Versao),motivo:'Pedido duplicado'},409);
  let pending=(await call('/api/pc04/exclusoes-pendentes',admin)).data.registros;assert.equal(pending.length,1);
  assert.equal(String(pending[0].SolicitacaoId),String(sent.SolicitacaoId));assert.equal(pending[0].Solicitante,'coordenador');
  const rejection=`/api/pc04/contratacoes/${released.ContratacaoId}/exclusao/${sent.SolicitacaoId}/recusar`;
  await call(rejection,actors.coordenador.cookie,{versao:Number(released.Versao),motivo:'Não autorizado'},403);
  await call(rejection,admin,{versao:Number(released.Versao),motivo:'Contrato válido, manter'});
  await call(`/api/pc04/contratacoes/${released.ContratacaoId}`,admin);
  await call(request(released),actors.financeiro.cookie,{versao:Number(released.Versao),motivo:'Solicitação do financeiro'});
  await call(erase(released),admin,payload(released));await assertGone(released);
  const a=await create(1,'2026-11-04'),b=await create(1,'2026-11-05'),root=c=>`/api/financeiro/contratacoes/${c.ContratacaoId}`;
  const receipt=async c=>(await call(root(c)+'/recibo',admin,{})).data.recibo;
  const ra=await receipt(a);await receipt(b);
  // Receipt generated, without a payment.
  await call(erase(b),admin,payload(b));await assertGone(b);
  const file={nome:'assinado.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nrecibo assinado\n%%EOF').toString('base64')};
  await call(root(a)+'/pagamento',admin,{reciboId:ra.ReciboId,baixaAnteriorId:null,arquivo:file});
  assert.equal((await call('/api/financeiro/contratacoes',admin)).data.registros[0].Situacao,'PAGO');
  // Reapplying the additive migration cannot alter a live financial record.
  const beforeMigration=await snapshot(db),migration=fs.readFileSync(new URL('../pilot-local/contract-exclusion.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(let i=0;i<2;i++){await db.beginTransaction();try{for(const batch of migration.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);assert.deepEqual(await snapshot(db),beforeMigration);await db.commit();}catch(e){await db.rollback();throw e;}}
  stage('dependências operacionais');
  await db.query(`INSERT Operacao.ContratacaoHorarioSolicitacao(ContratacaoId,EntradaReal,SaidaReal,Motivo,SolicitanteId) VALUES(${a.ContratacaoId},CONVERT(datetime2(0),'2026-11-04T08:00:00',126),CONVERT(datetime2(0),'2026-11-04T12:00:00',126),N'Teste de dependencia',1);DECLARE @h bigint=SCOPE_IDENTITY();INSERT Seguranca.NotificacaoLeitura(UsuarioId,SolicitacaoId,Tipo) VALUES(1,@h,'SOLICITACAO');INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc) VALUES(${a.ContratacaoId},'ENTRADA','${'e'.repeat(64)}',1,DATEADD(hour,1,SYSUTCDATETIME()));INSERT Financeiro.PC10DocumentoEstado(ContratacaoId,Versao,Estado,ExigeNovaAssinatura,Motivo,AtorUsuarioId) VALUES(${a.ContratacaoId},1,'SUBSTITUIDO',1,N'Teste',1);`);
  // Force a failure at the final parent deletion: all financial deletions must roll back.
  await db.query("CREATE TRIGGER Operacao.TestExclusionRollback ON Operacao.Contratacao AFTER DELETE AS THROW 55999,N'rollback de exclusao',1;");
  await call(erase(a),admin,payload(a),503);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${a.ContratacaoId}`))[0].N),1);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Operacao.Contratacao WHERE ContratacaoId=${a.ContratacaoId}`))[0].N),1);
  await db.query('DROP TRIGGER Operacao.TestExclusionRollback');
  await call(erase(a),admin,payload(a));await assertGone(a);assert.equal((await call('/api/financeiro/contratacoes',admin)).data.registros.length,0);
  const shared1=await create(1,'2026-11-06'),shared2=await create(1,'2026-11-07');
  await db.query(`INSERT Financeiro.PC08Pagamento(PrestadorId,DataPagamento,RegistradoPor,ValorTotal) VALUES(1,'2026-11-07',1,350.50);DECLARE @p bigint=SCOPE_IDENTITY();INSERT Financeiro.PC08Item(ContratacaoId,PagamentoId,VersaoLiberada,Valor) VALUES(${shared1.ContratacaoId},@p,${shared1.Versao},175.25),(${shared2.ContratacaoId},@p,${shared2.Versao},175.25);INSERT Financeiro.PC08Anexo(ContratacaoId,Nome,Conteudo) VALUES(${shared1.ContratacaoId},N'teste',0x01);INSERT Financeiro.PC10Movimento(ContratacaoId,Chave,Tipo,Valor,DataEfetiva,Versao,AtorUsuarioId,PagamentoId) VALUES(${shared1.ContratacaoId},N'teste:1','PAGAMENTO',-175.25,'2026-11-07',${shared1.Versao},1,@p),(${shared2.ContratacaoId},N'teste:2','PAGAMENTO',-175.25,'2026-11-07',${shared2.Versao},1,@p);`);
  await call(erase(shared1),admin,payload(shared1));await assertGone(shared1);
  assert.equal((await db.query('SELECT CONVERT(varchar(40),ValorTotal) V FROM Financeiro.PC08Pagamento'))[0].V,'175.25');
  await call(`/api/pc04/contratacoes/${shared2.ContratacaoId}`,admin);
  await call(erase(shared2),admin,payload(shared2));await assertGone(shared2);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC08Pagamento'))[0].N),0);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.NotificacaoLeitura'))[0].N),0);
  assert.ok(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Acao=N'PC04_EXCLUIR'"))[0].N)>=7);
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();
  if(created)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);
  await master.close();
 }
});
