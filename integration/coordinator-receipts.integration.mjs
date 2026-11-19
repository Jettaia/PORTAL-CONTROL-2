import test from 'node:test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('Coordenador emite recibo no escopo sem receber poderes de correção financeira',{skip:process.env.COORD_RECEIPTS_SQL_TESTS!=='YES',timeout:240000},async()=>{
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
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]],['coord','COORDENADOR',[1]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const create=async(depot,day,release=true)=>{let c=(await call('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;if(release){c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados reais'})).data.resultado;c=(await call(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;}return c;};
  const a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02'),c=await create(1,'2026-11-03');
  const root=c=>`/api/financeiro/contratacoes/${c.ContratacaoId}`;
  const issued=(await call(root(a)+'/recibo',actors.coord.cookie,{})).data.recibo;
  assert.equal(Number(issued.EmitidoPor),Number(actors.coord.id));
  assert.equal((await call(root(a),actors.coord.cookie)).data.podeEmitirRecibo,true);
  assert.equal((await call(root(a),actors.coord.cookie)).data.podeOperar,false);
  await call(root(b)+'/recibo',actors.coord.cookie,{},404);
  await call(root(a)+'/recibo',actors.gestorA.cookie,{},403);
  const repeated=(await call(root(a)+'/recibo',actors.coord.cookie,{})).data;
  assert.equal(repeated.jaExistia,true);assert.equal(String(repeated.recibo.ReciboId),String(issued.ReciboId));
  const preview=(await call('/api/financeiro/recibos/previa?inicio=2026-11-01&fim=2026-11-30',actors.coord.cookie)).data;
  assert.equal(preview.quantidade,1);assert.equal(String(preview.registros[0].ContratacaoId),String(c.ContratacaoId));
  const batch=(await call('/api/financeiro/recibos/gerar',actors.coord.cookie,{previa:preview.previa})).data;
  assert.equal(batch.gerados,1);assert.equal(batch.falhas,0);
  await call('/api/financeiro/recibos/impressao',actors.coord.cookie,{contratacaoIds:[String(a.ContratacaoId),String(c.ContratacaoId)]});
  await call('/api/financeiro/recibos/impressao',actors.coord.cookie,{contratacaoIds:[String(b.ContratacaoId)]},404);
  const signed={nome:'assinado.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from('%PDF-1.4\nassinado\n%%EOF').toString('base64')};
  const payload={reciboId:issued.ReciboId,baixaAnteriorId:null,arquivo:signed};
  await call(root(a)+'/pagamento',actors.gestorA.cookie,payload,403);
  await call(root(b)+'/pagamento',actors.coord.cookie,payload,404);
  await call(root(a)+'/pagamento',actors.coord.cookie,{...payload,arquivo:{...signed,conteudoBase64:Buffer.from('invalido').toString('base64')}},400);
  cfg.mfaRequired=true;await call(root(a)+'/pagamento',actors.coord.cookie,payload,403);cfg.mfaRequired=false;
  const paid=(await call(root(a)+'/pagamento',actors.coord.cookie,payload)).data;
  assert.equal(paid.podeOperar,false);assert.equal(paid.podeConfirmarPagamento,true);
  assert.equal(Number(paid.pagamento.ConfirmadoPor),Number(actors.coord.id));
  assert.equal(paid.pagamento.Valor,'175.25');
  assert.equal((await call(root(a),actors.coord.cookie)).data.registro.Situacao,'PAGO');
  const download=await call(root(a)+'/anexos/'+paid.pagamento.AnexoId,actors.coord.cookie);assert.ok(download.data.startsWith('%PDF-'));
  assert.equal(String((await call(root(a)+'/pagamento',actors.coord.cookie,payload)).data.pagamento.BaixaId),String(paid.pagamento.BaixaId));
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoBaixa'))[0].N),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Financeiro.ContratacaoAnexo'))[0].N),1);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Contratacao '+c.Numero,{x:40,y:700,font,size:20});
  const file={nome:'assinados.pdf',tipo:'application/pdf',conteudoBase64:Buffer.from(await pdf.save()).toString('base64')};
  const prefix='/api/financeiro/recibos/importacao';
  const imported=(await call(prefix+'/previa',actors.coord.cookie,{arquivo:file})).data;
  await call(prefix+'/vincular',actors.coord.cookie,{previa:imported.previa,paginas:[1],numero:String(b.Numero),depositoId:'2'},404);
  const bound=(await call(prefix+'/vincular',actors.coord.cookie,{previa:imported.previa,paginas:[1],numero:String(c.Numero),depositoId:'1'})).data.item;
  const confirmed=(await call(prefix+'/confirmar',actors.coord.cookie,{previa:imported.previa,itens:[{paginas:[1],contratacaoId:bound.contratacaoId,reciboId:bound.reciboId,baixaAnteriorId:bound.baixaAnteriorId}]})).data;
  assert.equal(confirmed.pagos,1);assert.equal(confirmed.falhas,0);
  assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Acao='FIN03_CONFIRMAR' AND AtorUsuarioId=${actors.coord.id}`))[0].N),2);
  await call(root(a)+'/pagamento/desfazer',actors.coord.cookie,{},403);
  await call(root(a)+'/pagamento/anexo',actors.coord.cookie,{},403);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.coord.id}`);
  await call(root(a)+'/recibo',actors.coord.cookie,{},404);
  await call(root(a)+'/pagamento',actors.coord.cookie,payload,404);
 }finally{
  if(server)await new Promise(r=>server.close(r));if(db)await db.close();await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();
 }
});
