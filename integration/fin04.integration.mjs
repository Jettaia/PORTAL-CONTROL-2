import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('FIN04: liberação HTTP sem ledger legado, isolamento e fluxo financeiro integrado',{skip:process.env.FIN04_SQL_TESTS!=='YES',timeout:180000},async()=>{
 const database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex'),instance=crypto.randomBytes(32).toString('hex');
 const cfg={server:'localhost\\SQLEXPRESS',database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:false,fin01:true};
 const master=await connectPilot('master',cfg.server);let db,server;
 try{
  await master.query(`CREATE DATABASE [${database}]`);db=await connectPilot(database,cfg.server);await installSchema(db,instance,{test:true});await seedCatalog(db);
  const password='SyntheticOnly!Pass123',token=crypto.randomBytes(32).toString('hex');
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(token)}','admin@example.test',N'Admin teste')`);await completeSetup(cfg,{token,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;const origin=`http://127.0.0.1:${cfg.port}`;
  const call=async(path,cookie,body,status=200)=>{const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();assert.equal(response.status,status,raw);let data;try{data=JSON.parse(raw)}catch{data=raw}return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]]]){await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]=await login(name+'@example.test');}
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(day)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:1,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;return c;};
  let c=await create('2026-11-01');
  c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;
  // Even stale configuration cannot reactivate the retired ledger side effects.
  cfg.pc10=true;let second=await create('2026-11-02');second=(await call(`/api/pc04/contratacoes/${second.ContratacaoId}/conferir`,admin,{versao:Number(second.Versao)})).data.resultado;
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC10Movimento'))[0].N),0);
  const root=`/api/financeiro/contratacoes/${c.ContratacaoId}`;
  assert.equal((await call(root,actors.gestorA)).data.registro.Situacao,'AGUARDANDO_PAGAMENTO');await call(root,actors.gestorB,undefined,404);
  const receipt=(await call(root+'/recibo',actors.financeiro,{})).data.recibo;
  const print=await call(root+'/recibo/impressao',actors.gestorA);assert.match(print.data,/Campinas/);await call(root+'/recibo/impressao',actors.gestorB,undefined,404);
  const file={nome:'assinado.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nassinado\n%%EOF').toString('base64')};
  await call(root+'/pagamento',actors.gestorA,{reciboId:receipt.ReciboId,arquivo:file},403);
  let payment=(await call(root+'/pagamento',actors.financeiro,{reciboId:receipt.ReciboId,arquivo:file,baixaAnteriorId:null})).data.pagamento;
  assert.equal((await call(root,admin)).data.registro.Situacao,'PAGO');assert.equal(payment.DataPagamento,receipt.DataEmissao);
  await call(`/api/pc04/contratacoes/${c.ContratacaoId}/cancelar`,admin,{versao:Number(c.Versao),motivo:'indevido'},409);
  payment=(await call(root+'/pagamento/anexo',admin,{baixaId:payment.BaixaId,anexoId:payment.AnexoId,arquivo:file})).data.pagamento;
  await call(root+'/anexos/'+payment.AnexoId,actors.gestorA);await call(root+'/anexos/'+payment.AnexoId,actors.gestorB,undefined,404);
  await call(root+'/pagamento/desfazer',actors.financeiro,{baixaId:payment.BaixaId,anexoId:payment.AnexoId,motivo:'Correção de registro'});
  assert.equal((await call(root,admin)).data.registro.Situacao,'RECIBO_GERADO');assert.equal((await call(root+'/recibo',admin,{})).data.recibo.DataEmissao,receipt.DataEmissao);
  for(const route of ['/api/pc08/painel','/api/pc10/painel','/api/pc11/extrato','/api/b51/carteira','/api/final-lab/painel']){const r=await fetch(origin+route,{headers:{Cookie:admin}});assert.equal(r.status,410,route+': '+await r.text());}
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.PC10Movimento'))[0].N),0);
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();await master.query(`IF DB_ID('${database}') IS NOT NULL BEGIN ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}];END`);await master.close();}
});
