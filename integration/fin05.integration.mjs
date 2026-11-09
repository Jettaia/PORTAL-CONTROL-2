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
  // This full HTTP suite exceeds the application's 90 requests/minute limit.
  // Honor its reset once; only a rejected 429 is retried, never a completed write.
  const request=async(path,options)=>{let response=await fetch(origin+path,options);if(response.status===429){const reset=Number(response.headers.get('retry-after'));assert.ok(Number.isInteger(reset)&&reset>=0&&reset<=60,'valid limiter reset');await response.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,Math.min(60000,reset*1000+50)));response=await fetch(origin+path,options);}return response;};
  const call=async(path,cookie,body,status=200)=>{const response=await request(path,{method:body?'POST':'GET',headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();assert.equal(response.status,status,raw);return {data:JSON.parse(raw),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};};
  const login=async email=>(await call('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[]],['coordenadorA','COORDENADOR',[1]],['coordenadorFinanceiroA',['COORDENADOR','FINANCEIRO'],[1]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:Array.isArray(role)?role:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  const endpoint='/api/financeiro/extrato',read=async(cookie=admin,q='')=>(await call(endpoint+q,cookie)).data;
  const exportEndpoint=endpoint+'/exportar.xlsx';
  const workbook=async(cookie=admin,q='',status=200)=>{
   const response=await request(exportEndpoint+q,{headers:cookie?{Cookie:cookie}:{}}),buffer=Buffer.from(await response.arrayBuffer());assert.equal(response.status,status,buffer.toString().slice(0,300));
   if(status!==200){assert.equal(response.headers.get('content-disposition'),null);return {buffer};}
   assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-disposition'),/attachment; filename="extrato-.*\.xlsx"/);assert.equal(response.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   const files={};let i=0;while(buffer.readUInt32LE(i)===0x04034b50){const size=buffer.readUInt32LE(i+18),n=buffer.readUInt16LE(i+26),e=buffer.readUInt16LE(i+28),start=i+30+n+e;files[buffer.subarray(i+30,i+30+n).toString()]=buffer.subarray(start,start+size).toString();i=start+size;}
   assert.equal(buffer.readUInt32LE(i),0x02014b50);return {buffer,sheet:files['xl/worksheets/sheet1.xml']};
  };
  const pdf=async(cookie=admin,q='',status=200)=>{
   const response=await request(endpoint+'/exportar.pdf'+q,{headers:cookie?{Cookie:cookie}:{}}),buffer=Buffer.from(await response.arrayBuffer());assert.equal(response.status,status,buffer.toString().slice(0,300));
   if(status!==200){assert.equal(response.headers.get('content-disposition'),null);return {buffer};}
   assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('content-type'),'application/pdf');assert.match(response.headers.get('content-disposition'),/attachment; filename="extrato-.*\.pdf"/);assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
   const {DOMMatrix,Path2D,ImageData}=await import('@napi-rs/canvas');Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(buffer),isEvalSupported:false}),document=await task.promise;
   try{const text=[];for(let i=1;i<=document.numPages;i++)text.push((await (await document.getPage(i)).getTextContent()).items.map(item=>item.str).join(' '));return {buffer,pages:document.numPages,text:text.join(' ')};}finally{await task.destroy();}
  };
  await pdf(null,'',401);
  await workbook(null,'',401);
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
  // Grouped statements keep a provider's balances in its own depot, including zero-movement active links.
  await db.query("INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Zélia sem movimento','01234567890');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(3,1,1)");
  const groupedQuery='?agrupamento=deposito',grouped=await read(admin,groupedQuery);
  assert.equal(grouped.totalRegistros,3);assert.deepEqual(grouped.contratacoes,[]);assert.deepEqual(grouped.totais,{ValorDevido:'350.35',ValorPago:'100.10',Saldo:'250.25'});
  assert.deepEqual(grouped.prestadores.map(p=>[Number(p.DepositoId),Number(p.PrestadorId),Number(p.QuantidadeContratacoes),p.ValorDevido,p.ValorPago,p.Saldo]),[[1,1,1,'100.10','100.10','0.00'],[2,1,1,'200.20','0.00','200.20'],[2,2,1,'50.05','0.00','50.05']]);
  assert.deepEqual(grouped.depositos.map(d=>[Number(d.DepositoId),Number(d.QuantidadePrestadores),d.ValorDevido,d.ValorPago,d.Saldo]),[[1,1,'100.10','100.10','0.00'],[2,2,'250.25','0.00','250.25']]);
  assert.equal(grouped.prestadores[0].CPF,'12345678901');
  assert.equal((await read(admin,groupedQuery+'&prestadorId=1')).totalRegistros,2,'provider filter must remain grouped');
  const allLinked=await read(admin,groupedQuery+'&somenteMovimentacao=0');assert.equal(allLinked.totalRegistros,4);
  assert.deepEqual(allLinked.prestadores.find(p=>Number(p.PrestadorId)===3),{PrestadorId:3,Prestador:'Zélia sem movimento',CPF:'01234567890',DepositoId:1,Deposito:'Depósito A',QuantidadeContratacoes:0,ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'});
  const emptyPeriod=await read(admin,groupedQuery+'&somenteMovimentacao=0&inicio=2030-01-01');assert.equal(emptyPeriod.totalRegistros,4);assert.ok(emptyPeriod.prestadores.every(p=>p.ValorDevido==='0.00'&&Number(p.QuantidadeContratacoes)===0));
  const managerGrouped=await read(actors.gestorA.cookie,groupedQuery+'&somenteMovimentacao=0');assert.equal(managerGrouped.totalRegistros,2);assert.ok(managerGrouped.prestadores.every(p=>Number(p.DepositoId)===1));
  const deniedGrouped=await read(actors.gestorA.cookie,groupedQuery+'&somenteMovimentacao=0&depositoId=2');assert.deepEqual(deniedGrouped.prestadores,[]);assert.deepEqual(deniedGrouped.depositos,[]);assert.equal(deniedGrouped.totalRegistros,0);
  const groupedDay=await read(admin,groupedQuery+'&inicio=2026-10-30&fim=2026-10-30');assert.equal(groupedDay.totalRegistros,2);assert.deepEqual(groupedDay.totais,{ValorDevido:'250.25',ValorPago:'0.00',Saldo:'250.25'});
  for(const cookie of [admin,actors.financeiro.cookie]){const cat=(await call(endpoint+'/catalogo',cookie)).data;assert.equal(cat.depositos.length,2);assert.ok(cat.prestadores.some(p=>Number(p.PrestadorId)===3));}
  const managerCatalog=(await call(endpoint+'/catalogo',actors.gestorA.cookie)).data;assert.deepEqual(managerCatalog.depositos.map(d=>Number(d.DepositoId)),[1]);assert.ok(!managerCatalog.prestadores.some(p=>Number(p.PrestadorId)===2));
  for(const name of ['coordenadorA','coordenadorFinanceiroA']){
   const cookie=actors[name].cookie,scoped=await read(cookie,groupedQuery+'&somenteMovimentacao=0');
   assert.equal(scoped.totalRegistros,2,name+' only sees own depot, including the zero-movement provider');
   assert.deepEqual(scoped.prestadores.map(p=>Number(p.PrestadorId)),[1,3]);assert.ok(scoped.prestadores.every(p=>Number(p.DepositoId)===1));
   assert.deepEqual(scoped.totais,{ValorDevido:'100.10',ValorPago:'100.10',Saldo:'0.00'});assert.deepEqual(scoped.depositos.map(d=>Number(d.DepositoId)),[1]);
   const cat=(await call(endpoint+'/catalogo',cookie)).data;assert.deepEqual(cat.depositos.map(d=>Number(d.DepositoId)),[1]);assert.deepEqual(cat.prestadores.map(p=>Number(p.PrestadorId)),[1,3]);
   const outside=await read(cookie,groupedQuery+'&somenteMovimentacao=0&prestadorId=1&depositoId=2');assert.equal(outside.totalRegistros,0);assert.deepEqual(outside.prestadores,[]);assert.deepEqual(outside.depositos,[]);assert.deepEqual(outside.totais,{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'});
   const outsideDetails=await read(cookie,'?prestadorId=1&depositoId=2');assert.equal(outsideDetails.totalRegistros,0);assert.deepEqual(outsideDetails.contratacoes,[]);
  }
  await call(endpoint+'/catalogo',null,undefined,401);
  const initialFile=await workbook(admin,'?agrupamento=deposito');assert.ok(initialFile.sheet.includes('José da Silva'));assert.ok(initialFile.sheet.includes('123.456.789-01'));assert.ok(initialFile.sheet.includes('Depósito A'));assert.ok(initialFile.sheet.includes('Depósito B'));assert.ok(!initialFile.sheet.includes('Zélia sem movimento'));
  const zeroFile=await workbook(admin,'?agrupamento=deposito&somenteMovimentacao=0');assert.ok(zeroFile.sheet.includes('Zélia sem movimento'));assert.ok(zeroFile.sheet.includes('012.345.678-90'));
  for(const name of ['gestorA','coordenadorA','coordenadorFinanceiroA']){
   const scopedFile=await workbook(actors[name].cookie,'?agrupamento=deposito&somenteMovimentacao=0');assert.ok(scopedFile.sheet.includes('Depósito A'));assert.ok(scopedFile.sheet.includes('Zélia sem movimento'));assert.ok(!scopedFile.sheet.includes('Depósito B'));assert.ok(!scopedFile.sheet.includes('Maria Santos'));
   const foreignFile=await workbook(actors[name].cookie,'?agrupamento=deposito&somenteMovimentacao=0&prestadorId=1&depositoId=2');assert.ok(!foreignFile.sheet.includes('Depósito B'));assert.ok(!foreignFile.sheet.includes('José da Silva'));
  }
  for(const q of ['?pagina=1','?pagina=','?agrupamento=x','?somenteMovimentacao=2','?inicio=2026-02-30','?inicio=2026-11-01&fim=2026-10-01','?prestadorId=1&prestadorId=2','?depositoId=2%20OR%201=1'])await workbook(admin,q,400);
  for(const q of ['?pagina=1','?agrupamento=x','?inicio=2026-02-30'])await pdf(admin,q,400);
  const scopedPdf=await pdf(actors.coordenadorFinanceiroA.cookie,'?agrupamento=deposito&depositoId=1&prestadorId=1&inicio=2026-10-29&fim=2026-10-29');assert.match(scopedPdf.text,/José da Silva/);assert.match(scopedPdf.text,/Depósito A/);assert.match(scopedPdf.text,/123\.456\.789-01/);assert.match(scopedPdf.text,/100,10/);assert.ok(!scopedPdf.text.includes('Depósito B'));assert.ok(!scopedPdf.text.includes('Maria Santos'));
  const foreignPdf=await pdf(actors.gestorA.cookie,'?agrupamento=deposito&somenteMovimentacao=0&depositoId=2&prestadorId=1');assert.ok(!foreignPdf.text.includes('Depósito B'));assert.ok(!foreignPdf.text.includes('José da Silva'));assert.match(foreignPdf.text,/0,00/);
  // Revocation removes the unused link but never erases financial history.
  await db.query('UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE PrestadorId IN(1,3) AND DepositoId=1');
  const revoked=await read(admin,groupedQuery+'&somenteMovimentacao=0');assert.equal(revoked.totalRegistros,3);assert.ok(revoked.prestadores.some(p=>Number(p.DepositoId)===1&&Number(p.PrestadorId)===1));assert.ok(!revoked.prestadores.some(p=>Number(p.PrestadorId)===3));
  for(const q of ['?agrupamento=x','?agrupamento=','?somenteMovimentacao=1','?agrupamento=deposito&somenteMovimentacao=2','?agrupamento=deposito&somenteMovimentacao=true','?agrupamento=deposito&agrupamento=deposito'])await call(endpoint+q,admin,undefined,400);
  const individual=await read(admin,'?prestadorId=1');assert.equal(individual.totalRegistros,2);assert.deepEqual(individual.prestadores,[]);assert.deepEqual(individual.totais,{ValorDevido:'300.30',ValorPago:'100.10',Saldo:'200.20'});
  assert.deepEqual(individual.contratacoes.map(r=>Number(r.ContratacaoId)),[Number(a.ContratacaoId),Number(b.ContratacaoId)]);
  const paid=individual.contratacoes[0];assert.equal(paid.DataServico,'2026-11-01');assert.equal(paid.DataCriacao,'2026-10-30T02:59:59.999');assert.equal(paid.DataPagamento,'2026-10-31T12:34:56.123');assert.equal(paid.CentroCusto,'CC-A');assert.equal(paid.Atividade,'Descarga');assert.equal(paid.ValorPago,'100.10');assert.ok(!Object.hasOwn(paid,'Saldo'));
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
  const grouped1=await read(admin,'?agrupamento=deposito'),grouped2=await read(admin,'?agrupamento=deposito&pagina=2');assert.equal(grouped1.totalRegistros,104);assert.equal(grouped1.prestadores.length,100);assert.equal(grouped2.prestadores.length,4);assert.equal(grouped1.proximaPagina,2);assert.equal(grouped2.proximaPagina,null);assert.deepEqual(grouped1.depositos,grouped2.depositos);assert.deepEqual(grouped1.totais,summary1.totais);assert.equal(new Set([...grouped1.prestadores,...grouped2.prestadores].map(p=>p.DepositoId+':'+p.PrestadorId)).size,104);assert.equal(Number(grouped1.depositos.find(d=>Number(d.DepositoId)===2).QuantidadePrestadores),103);
  // Export must include unloaded summary pages and contracts of collapsed providers.
  const {statementExportData}=await import('../src/fin05.js');
  const fullExport=await statementExportData({...cfg,exportNow:()=>new Date('2026-11-09T12:00:00Z')},1,{});assert.equal(fullExport.prestadores.length,104);assert.equal(fullExport.contratacoes.length,209);assert.equal(new Set(fullExport.contratacoes.map(c=>String(c.ContratacaoId))).size,209);assert.deepEqual(fullExport.totais,summary1.totais);assert.equal(fullExport.depositos.length,2);assert.equal(fullExport.geradoEmUtc,'2026-11-09T12:00:00.000Z');assert.match(fullExport.geradoEm,/09:00:00/);
  assert.ok(fullExport.contratacoes.every(c=>c.DataServico&&c.DataCriacao&&c.CentroCusto&&c.Atividade&&c.Saldo!==undefined));
  const fullFile=await workbook();assert.ok(fullFile.sheet.includes('ZZ Prestador 100'));assert.equal((fullFile.sheet.match(/<row\b[^>]*><c r="A\d+"[^>]*t="inlineStr"><is><t[^>]*>\d+<\/t>/g)||[]).length,209,'workbook includes every contract beyond the first page');assert.equal((fullFile.sheet.match(/<t[^>]*>Prestador: /g)||[]).length,104,'workbook includes every provider/depot pair');assert.ok(fullFile.sheet.includes('352.41'));
  const beforePdf=(await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Auditoria) AuditCount,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) PaymentCount'))[0];
  const fullPdf=await pdf();assert.ok(fullPdf.pages>1,'complete PDF must be multipage');for(const text of ['Depósito A','Depósito B','José da Silva','Maria Santos','ZZ Prestador 100','123.456.789-01','352,41','252,31'])assert.ok(fullPdf.text.includes(text),text);assert.match(fullPdf.text.slice(fullPdf.text.lastIndexOf('ZZ Prestador 100')),/209/,'last unloaded provider contract is present');
  assert.deepEqual((await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Auditoria) AuditCount,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) PaymentCount'))[0],beforePdf);
  const financeFile=await workbook(actors.financeiro.cookie);assert.ok(financeFile.sheet.includes('ZZ Prestador 100'));assert.ok(financeFile.sheet.includes('Depósito A'));
  const filteredExport=await statementExportData(cfg,1,{depositoId:'2',prestadorId:'1',inicio:'2026-10-30',fim:'2026-10-30'});assert.equal(filteredExport.prestadores.length,1);assert.equal(filteredExport.contratacoes.length,1);assert.equal(String(filteredExport.contratacoes[0].ContratacaoId),String(b.ContratacaoId));assert.deepEqual(filteredExport.totais,{ValorDevido:'200.20',ValorPago:'0.00',Saldo:'200.20'});assert.match(filteredExport.filtrosTexto,/30\/10\/2026/);
  await assert.rejects(()=>statementExportData(cfg,1,{},2),e=>e.status===413&&e.message==='EXPORTACAO_MUITOS_REGISTROS');
  await assert.rejects(()=>statementExportData(cfg,1,{depositoId:'1',prestadorId:'1'},1),e=>e.status===413&&e.message==='EXPORTACAO_MUITOS_REGISTROS');
  await assert.rejects(()=>statementExportData(cfg,1,{},0),e=>e.status===400);
  await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${actors.gestorA.id}`);assert.equal((await read(actors.gestorA.cookie)).totalRegistros,0);
  await db.query(`DELETE Seguranca.UsuarioPerfil WHERE UsuarioId=${actors.gestorB.id};UPDATE Seguranca.Usuario SET Perfil='DIRETORIA' WHERE UsuarioId=${actors.gestorB.id}`);await call(endpoint,actors.gestorB.cookie,undefined,403);
  await db.query(`UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${actors.financeiro.id}`);await call(endpoint,actors.financeiro.cookie,undefined,401);
  assert.ok(open.ContratacaoId); // Open and cancelled fixtures never contributed.
 }finally{if(server)await new Promise(r=>server.close(r));if(db)await db.close();if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);await master.close();}
});
