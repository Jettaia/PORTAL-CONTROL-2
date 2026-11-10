// Real authenticated HTTP and disposable SQL. Never writes test data to the installed pilot.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {snapshot} from '../pilot-local/recovery.mjs';
import {setTimeout as delay} from 'node:timers/promises';

test('COORDENADOR: cadastro, depósitos explícitos, supervisão, financeiro e revogação',{
 skip:process.env.COORDINATOR_SQL_TESTS!=='YES',timeout:240000
},async()=>{
 const sqlServer=process.env.COORDINATOR_SQL_SERVER;assert.match(sqlServer||'',/^(?:localhost|\.)(?:\\[A-Za-z0-9_]+)?$/);
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,sqlServer);await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin sintético')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','CC-A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','CC-B',N'Rua B','2',N'Centro',N'Campinas','SP','13010000'),('C',N'Depósito C','CC-C',N'Rua C','3',N'Centro',N'Campinas','SP','13010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Diária');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador Teste','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1),(1,3,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  let requests=0;const requestWindowStart=Date.now();
  const call=async(path,cookie,body,status=200,method=body?'POST':'GET')=>{
   // Keep the real 90 requests/minute protection enabled as coverage grows.
   if(++requests===70)await delay(Math.min(59000,Math.max(0,60100-(Date.now()-requestWindowStart))));
   const r=await fetch(origin+path,{method,headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const response=await r.text();assert.equal(r.status,status,`${method} ${path}: ${response}`);const data=JSON.parse(response);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=async name=>(await call('/api/auth/login',null,{email:name+'@example.test',senha:password})).cookie;
  const admin=await login('admin');
  const make=async(name,funcoes,depositos,authenticate=true)=>{
   const body={nome:name+' Teste',email:name+'@example.test',funcoes,depositos,ativo:true,senha:password};
   const {data}=await call('/api/pc01/usuarios',admin,body,201);return {id:Number(data.usuarioId),cookie:authenticate?await login(name):null,body};
  };
  const coord=await make('coord',['COORDENADOR'],[1,2]); // RED before implementation: FUNCOES_INVALIDAS.
  const manager=await make('gestor',['GESTOR'],[1,2]),outside=await make('externo',['GESTOR'],[3]),none=await make('vazio',['COORDENADOR'],[]),finance=await make('financeiro',['FINANCEIRO'],[]);
  const me=(await call('/api/auth/me',coord.cookie)).data.usuario;assert.equal(me.perfil,'COORDENADOR');assert.deepEqual(me.funcoes,['COORDENADOR']);assert.deepEqual(me.depositos,['1','2']);
  assert.deepEqual((await call('/api/depositos/permitidos',coord.cookie)).data.depositos.map(d=>Number(d.DepositoId)).sort(),[1,2]);
  assert.equal((await call('/api/pc04/catalogo',none.cookie)).data.depositos.length,0);
  const beforeAdminDenials=await snapshot(db);
  for(const path of ['/api/pc01/usuarios','/api/pc01/solicitacoes','/api/admin/diagnostico','/api/b23/catalogo'])await call(path,coord.cookie,undefined,403);
  await call('/api/pc01/usuarios',coord.cookie,coord.body,403);
  const {senha:managerPassword,...managerUpdate}=manager.body;
  await call('/api/pc01/usuarios/'+manager.id,coord.cookie,{...managerUpdate,funcoes:['ADMIN'],depositos:[1,2,3]},403,'PUT');
  await call('/api/pc01/usuarios/'+manager.id,coord.cookie,{},403,'DELETE');
  const depotBody={nome:'Depósito Novo',centroCusto:'CC-N',rua:'Rua Nova',numero:'4',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010000',ativo:true};
  const serviceBody={nome:'Tipo sem autorização',descricao:'',ativo:true};
  assert.deepEqual(await snapshot(db),beforeAdminDenials,'Tentativas administrativas negadas não alteram dados, credenciais, sessões nem permissões');
  await call('/api/b24a/depositos',admin,depotBody,201);
  assert.deepEqual((await call('/api/depositos/permitidos',coord.cookie)).data.depositos.map(d=>Number(d.DepositoId)).sort(),[1,2]);
  const create=async(actor,depot,gestor,day,status=201)=>(await call('/api/pc04/contratacoes',actor,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:gestor,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'100.00'},status)).data.resultado;
  const base=c=>'/api/pc04/contratacoes/'+c.ContratacaoId;
  const detail=async(c,cookie=coord.cookie)=>(await call(base(c),cookie)).data;
  const change=async(c,cookie,action,body={},status=200)=>(await call(base(c)+'/'+action,cookie,{versao:Number(c.Versao),...body},status)).data.resultado;
  const hours=c=>({entradaReal:c.DataServico+'T08:10',saidaReal:c.DataServico+'T12:10',motivo:'Correção supervisionada'});
  let a=await create(coord.cookie,1,manager.id,'2026-11-10'),b=await create(coord.cookie,2,manager.id,'2026-11-11'),c=await create(outside.cookie,3,outside.id,'2026-11-12');
  assert.equal(Number(a.GestorResponsavelId),manager.id);assert.equal(Number(a.CriadoPor),coord.id);
  const beforeScopeDenials=await snapshot(db);
  await create(coord.cookie,3,outside.id,'2026-11-13',403);await create(coord.cookie,1,outside.id,'2026-11-14',403);await create(manager.cookie,1,coord.id,'2026-11-15',403);
  await call(base(c),coord.cookie,undefined,404);await change(c,coord.cookie,'cancelar',{motivo:'Fora do escopo'},404);
  assert.deepEqual(await snapshot(db),beforeScopeDenials,'Tentativas fora do escopo não alteram contratações nem geram efeitos indevidos');
  const visibleContracts=(await call('/api/pc04/contratacoes',coord.cookie)).data.registros;
  assert.deepEqual(visibleContracts.map(r=>Number(r.DepositoId)).sort(),[1,2]);
  assert.equal((await call('/api/pc04/contratacoes?depositoId=3',coord.cookie)).data.registros.length,0);
  const cat=(await call('/api/pc04/catalogo',coord.cookie)).data;assert.equal(cat.podeAprovarHorarios,true);assert.ok(cat.gestores.some(g=>Number(g.UsuarioId)===manager.id));assert.ok(!cat.gestores.some(g=>Number(g.UsuarioId)===outside.id));
  a=await change(a,manager.cookie,'horarios',hours(a));c=await change(c,outside.cookie,'horarios',hours(c));
  let queue=(await call('/api/pc04/horarios-pendentes',coord.cookie)).data.registros;assert.deepEqual(queue.map(r=>Number(r.ContratacaoId)),[Number(a.ContratacaoId)]);
  const decide=async(record,request,cookie=coord.cookie,status=200)=>(await call(base(record)+'/horarios/'+request.SolicitacaoId+'/decidir',cookie,{versao:Number(record.Versao),aprovar:true},status)).data.resultado;
  const pending=(await detail(a)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');a=await decide(a,pending);assert.equal(a.EntradaReal,hours(a).entradaReal);
  b=await change(b,coord.cookie,'horarios',hours(b));assert.equal(b.HorarioSolicitado,true);assert.equal(b.EntradaReal,null);
  let own=(await detail(b)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');
  b=(await call(base(b)+'/horarios/'+own.SolicitacaoId+'/decidir',coord.cookie,{versao:Number(b.Versao),aprovar:false})).data.resultado;assert.equal(b.EntradaReal,null);
  b=await change(b,coord.cookie,'horarios',hours(b));own=(await detail(b)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');b=await decide(b,own);assert.equal(b.EntradaReal,hours(b).entradaReal);
  a=await change(a,coord.cookie,'conferir');b=await change(b,coord.cookie,'conferir');
  own=(await detail(c,admin)).solicitacoesHorarios.find(r=>r.Status==='PENDENTE');c=await decide(c,own,admin);c=await change(c,admin,'conferir');
  await change(a,coord.cookie,'revisar',{valor:'200.00',motivo:'Bloqueada após liberação'},409);
  const released=(await call('/api/financeiro/contratacoes?situacao=',coord.cookie)).data;
  assert.equal(released.registros.length,2);assert.ok(released.registros.every(r=>[1,2].includes(Number(r.DepositoId))));
  const totals=(await call('/api/financeiro/extrato',coord.cookie)).data.totais;assert.equal(totals.ValorDevido,'200.00');
  for(const path of ['/api/pc04/contratacoes/exportar.xlsx','/api/financeiro/contratacoes/exportar.xlsx']){
   const response=await fetch(origin+path,{headers:{Cookie:coord.cookie}});assert.equal(response.status,200);
   const workbook=Buffer.from(await response.arrayBuffer()).toString('utf8');assert.ok(workbook.includes('Depósito A'));assert.ok(workbook.includes('Depósito B'));assert.ok(!workbook.includes('Depósito C'));
  }
  await call('/api/financeiro/contratacoes/'+c.ContratacaoId,coord.cookie,undefined,404);
  await call('/api/financeiro/contratacoes/'+a.ContratacaoId+'/recibo',coord.cookie,{},403);
  await call('/api/financeiro/contratacoes/'+a.ContratacaoId+'/pagamento',coord.cookie,{},403);
  // FINANCEIRO retains its existing global reach; COORDENADOR + FINANCEIRO remains scoped.
  assert.equal((await call('/api/financeiro/contratacoes?situacao=',finance.cookie)).data.registros.length,3);
  const combo=await make('combinado',['COORDENADOR','GESTOR','FINANCEIRO'],[1]);assert.equal((await call('/api/auth/me',combo.cookie)).data.usuario.perfil,'COORDENADOR');
  assert.equal((await call('/api/financeiro/contratacoes?situacao=',combo.cookie)).data.registros.length,1);
  await call('/api/financeiro/contratacoes/'+c.ContratacaoId+'/recibo',combo.cookie,{},404);
  const financePath=record=>'/api/financeiro/contratacoes/'+record.ContratacaoId;
  const receipt=(await call(financePath(a)+'/recibo',admin,{})).data.recibo;
  await call(financePath(c)+'/recibo',admin,{});
  assert.equal((await call(financePath(a)+'/recibo',coord.cookie)).data.podeOperar,false);
  await call(financePath(c)+'/recibo',coord.cookie,undefined,404);
  const payment=(await call(financePath(a)+'/pagamento',admin,{reciboId:receipt.ReciboId,baixaAnteriorId:null,arquivo:{nome:'comprovante.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nSintético').toString('base64')}})).data;
  const attachment=payment.pagamento.AnexoId;
  const downloaded=await fetch(origin+financePath(a)+'/anexos/'+attachment,{headers:{Cookie:coord.cookie}});assert.equal(downloaded.status,200);assert.ok((await downloaded.text()).startsWith('%PDF-'));
  await call(financePath(c)+'/anexos/'+attachment,coord.cookie,undefined,404);
  await call(financePath(a)+'/pagamento/desfazer',coord.cookie,{baixaId:payment.pagamento.BaixaId,anexoId:attachment,motivo:'Sem permissão financeira'},403);
  const provider=(await call('/api/b24a/chapas',coord.cookie)).data;assert.equal(provider.adm,false);assert.ok(provider.depositos.every(d=>[1,2].includes(Number(d.DepositoId))));
  await call('/api/b24a/chapas/1',coord.cookie,{nome:'Prestador Teste',cpf:'12345678902',telefone:'',cnpj:'',ativo:true,versao:1,depositos:[1]},403,'PUT');
  const tablet=(await call('/api/pc05/tablets',coord.cookie,{nome:'Tablet coordenador',depositoId:1})).data;
  await call('/api/pc05/tablets',coord.cookie,{nome:'Fora escopo',depositoId:3},404);
  const today=(await db.query("SELECT CONVERT(varchar(10),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS date),23) D"))[0].D;
  const live=await create(coord.cookie,1,manager.id,today);
  const entry=(await call('/api/pc05/contratacoes/'+live.ContratacaoId+'/tokens',coord.cookie,{versao:Number(live.Versao),tipo:'ENTRADA'})).data;
  const activated=await call('/api/pc05/tablet/habilitar',null,{pareamento:tablet.pareamento});
  await call('/api/pc05/tablet/apontar',activated.cookie,{codigo:entry.codigo});
  assert.ok((await detail(live)).registro.EntradaReal);
  await call('/api/pc05/tablet/apontar',activated.cookie,{codigo:entry.codigo},409);
  await call('/api/pc05/tablets/'+tablet.tabletId+'/excluir',coord.cookie,{});
  await call('/api/pc05/tablet/status',activated.cookie,undefined,401);
  // Coordinator catalog writes are scoped; only the creator inherits a new depot.
  const createdDepot=(await call('/api/b24a/depositos',coord.cookie,{...depotBody,nome:'Depósito do Coordenador'},201)).data.resultado;
  const depotId=Number(createdDepot.DepositoId);
  assert.ok((await call('/api/b24a/depositos',coord.cookie)).data.registros.some(d=>Number(d.DepositoId)===depotId));
  assert.ok(!(await call('/api/depositos/permitidos',none.cookie)).data.depositos.some(d=>Number(d.DepositoId)===depotId));
  assert.ok(!(await call('/api/depositos/permitidos',manager.cookie)).data.depositos.some(d=>Number(d.DepositoId)===depotId));
  const ownDepot={...depotBody,nome:'Depósito do Coordenador'};
  const updatedDepot={...ownDepot,centroCusto:'CC-COORD',original:ownDepot};
  assert.equal((await call('/api/b24a/depositos/'+depotId,coord.cookie,updatedDepot,200,'PUT')).data.resultado.CentroCusto,'CC-COORD');
  await call('/api/b24a/depositos/'+depotId,coord.cookie,updatedDepot,409,'PUT');
  const foreignBefore=await snapshot(db);
  await call('/api/b24a/depositos/3',coord.cookie,{...depotBody,original:depotBody},404,'PUT');
  for(const actor of [manager.cookie,finance.cookie])await call('/api/b24a/servicos',actor,serviceBody,403);
  assert.deepEqual(await snapshot(db),foreignBefore);
  const createdType=(await call('/api/b24a/servicos',coord.cookie,serviceBody,201)).data.resultado;
  assert.equal((await call('/api/b24a/servicos/'+createdType.TipoServicoId,coord.cookie,{...serviceBody,nome:'Atividade coordenada',original:serviceBody},200,'PUT')).data.resultado.Nome,'Atividade coordenada');
  // Password authority is a strict subset of the coordinator's depot scope.
  const localFinance=await make('financeirolocal',['FINANCEIRO'],[2],false),mixed=await make('gestormisto',['GESTOR'],[1,3],false),elevated=await make('gestorcoordenador',['GESTOR','COORDENADOR'],[1],false);
  const eligible=(await call('/api/pc01/senhas-usuarios',coord.cookie)).data.usuarios;
  assert.ok(eligible.some(u=>Number(u.UsuarioId)===manager.id));assert.ok(eligible.some(u=>Number(u.UsuarioId)===localFinance.id));
  for(const denied of [1,coord.id,outside.id,mixed.id,elevated.id,finance.id])assert.ok(!eligible.some(u=>Number(u.UsuarioId)===denied));
  const nextPassword='ChangedOnly!Pass456',resetBody={senha:nextPassword,confirmacao:nextPassword};
  const protectedBefore=await snapshot(db);
  for(const denied of [1,coord.id,outside.id,mixed.id,elevated.id,finance.id])await call('/api/pc01/usuarios/'+denied+'/senha',coord.cookie,resetBody,403);
  await call('/api/pc01/senhas-usuarios',manager.cookie,undefined,403);
  assert.deepEqual(await snapshot(db),protectedBefore,'Reset negado não altera credenciais, sessões ou acessos');
  const grantsBefore=await db.query('SELECT UsuarioId,PerfilId FROM Seguranca.UsuarioPerfil ORDER BY UsuarioId,PerfilId');
  await call('/api/pc01/usuarios/'+manager.id+'/senha',coord.cookie,resetBody);
  await call('/api/auth/me',manager.cookie,undefined,401);
  await call('/api/auth/login',null,{email:manager.body.email,senha:password},401);
  await call('/api/auth/login',null,{email:manager.body.email,senha:nextPassword});
  await call('/api/pc01/usuarios/'+localFinance.id+'/senha',coord.cookie,resetBody);
  await call('/api/auth/login',null,{email:localFinance.body.email,senha:nextPassword});
  assert.deepEqual(await db.query('SELECT UsuarioId,PerfilId FROM Seguranca.UsuarioPerfil ORDER BY UsuarioId,PerfilId'),grantsBefore);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE AtorUsuarioId=${coord.id} AND Acao='PC01_REDEFINIR_SENHA'`))[0].N),2);
  // The additive SQL upgrade may be reapplied without changing operational data or user grants.
  const before=await db.query('SELECT UsuarioId,Perfil,Ativo FROM Seguranca.Usuario ORDER BY UsuarioId');
  const sql=fs.readFileSync(new URL('../pilot-local/coordinator-access.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(let i=0;i<2;i++){await db.beginTransaction();try{for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);await db.commit();}catch(e){await db.rollback();throw e;}}
  assert.deepEqual(await db.query('SELECT UsuarioId,Perfil,Ativo FROM Seguranca.Usuario ORDER BY UsuarioId'),before);
  const {senha,...update}=coord.body;await call('/api/pc01/usuarios/'+coord.id,admin,{...update,depositos:[2]},200,'PUT');
  await call('/api/auth/me',coord.cookie,undefined,401);coord.cookie=await login('coord');
  await call(base(a),coord.cookie,undefined,404);assert.equal((await call('/api/financeiro/contratacoes?situacao=',coord.cookie)).data.registros.length,1);
  assert.ok(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE AtorUsuarioId=${coord.id}`))[0].N)>0);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  assert.match(database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);await master.query(`IF DB_ID('${database}') IS NOT NULL BEGIN ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}];END`);await master.close();
 }
});
