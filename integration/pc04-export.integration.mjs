import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('PC04 export: Excel/PDF completos, filtros e escopos HTTP/SQL',{skip:process.env.PC04_EXPORT_SQL_TESTS!=='YES',timeout:300000},async()=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 let now='2026-10-31T01:30:00Z';
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:'chave-de-teste-com-quarenta-caracteres-nao-hex',mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true,exportNow:()=>new Date('2026-11-09T12:00:00Z')};
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
  for(const [name,role,depots] of [['gestorA','GESTOR',[1]],['gestorB','GESTOR',[2]],['financeiro','FINANCEIRO',[1]]]){
   const r=await call('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:[role],depositos:depots,ativo:true,senha:password},201);actors[name]={id:r.data.usuarioId,cookie:await login(name+'@example.test')};
  }
  await db.query('UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=1');
  await db.query("INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'=SOMA(1;1) <b>Texto</b>','12345678902')");
  await db.query(`WITH nums AS(SELECT TOP(207) ROW_NUMBER() OVER(ORDER BY object_id) N FROM sys.all_objects)
   INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,EntradaReal,SaidaReal,EntradaOrigem,SaidaOrigem,Valor,Status,Versao,CriadoPor,ConferidoPor,LiberadoEmUtc,ValorLiberado,LiberacaoBloqueada)
   SELECT CASE WHEN N>205 THEN N-205 ELSE N END,CASE WHEN N>205 THEN 2 ELSE 1 END,CASE WHEN N%2=0 THEN 2 ELSE 1 END,1,1,'2026-11-09','2026-11-09T08:00:00','2026-11-09T12:00:00','2026-11-09T08:00:00','2026-11-09T12:00:00','MANUAL','MANUAL',10,CASE WHEN N%3=0 THEN 'LIBERADA' WHEN N%3=1 THEN 'ABERTA' ELSE 'CANCELADA' END,1,1,CASE WHEN N%3=0 THEN 1 ELSE NULL END,CASE WHEN N%3=0 THEN CONVERT(datetime2,'2026-11-09T13:00:00') ELSE NULL END,CASE WHEN N%3=0 THEN 10 ELSE NULL END,CASE WHEN N%3=0 THEN 1 ELSE 0 END FROM nums;`);
  await db.query("UPDATE Operacao.Contratacao SET DataServico=DATEADD(day,CASE WHEN Numero=1 THEN -1 ELSE 1 END,DataServico),InicioPrevisto=DATEADD(day,CASE WHEN Numero=1 THEN -1 ELSE 1 END,InicioPrevisto),FimPrevisto=DATEADD(day,CASE WHEN Numero=1 THEN -1 ELSE 1 END,FimPrevisto),EntradaReal=DATEADD(day,CASE WHEN Numero=1 THEN -1 ELSE 1 END,EntradaReal),SaidaReal=DATEADD(day,CASE WHEN Numero=1 THEN -1 ELSE 1 END,SaidaReal) WHERE DepositoId=1 AND Numero IN(1,2,205)");
  const snapshot=async()=>JSON.stringify(await db.query('SELECT (SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) J FROM Operacao.Contratacao c ORDER BY ContratacaoId'));
  const before=await snapshot(),audits=Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria'))[0].N);
  const get=async(format,cookie,query='',status=200)=>{const r=await fetch(origin+'/api/pc04/contratacoes/exportar.'+format+(query?'?'+query:''),{headers:cookie?{Cookie:cookie}:{}}),buffer=Buffer.from(await r.arrayBuffer());assert.equal(r.status,status,buffer.toString('utf8').slice(0,300));if(status===200){assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-disposition'),/attachment/);}return {buffer,headers:r.headers};};
  const unzip=buffer=>{const result={};let i=0;while(i+30<buffer.length&&buffer.readUInt32LE(i)===0x04034b50){const size=buffer.readUInt32LE(i+18),nameLength=buffer.readUInt16LE(i+26),extra=buffer.readUInt16LE(i+28),start=i+30+nameLength+extra;result[buffer.subarray(i+30,i+30+nameLength).toString()]=buffer.subarray(start,start+size).toString();i=start+size;}return result;};
  const sheet=buffer=>unzip(buffer)['xl/worksheets/sheet1.xml'],count=buffer=>(sheet(buffer).match(/<row /g)||[]).length-6;
  for(const format of ['xlsx','pdf'])await get(format,null,'',401);
  const adminFile=(await get('xlsx',admin,'depositoId=1')).buffer;assert.equal(count(adminFile),205);assert.match(sheet(adminFile),/Quantidade: 205/);assert.ok(!sheet(adminFile).includes('<f>'));assert.ok(sheet(adminFile).includes('&lt;b&gt;Texto&lt;/b&gt;'));assert.ok(sheet(adminFile).includes('2050.00'));
  for(const [query,expected] of [['inicio=2026-11-08&fim=2026-11-10',205],['inicio=2026-11-08&fim=2026-11-09',203],['inicio=2026-11-09&fim=2026-11-09',202],['inicio=2026-11-10',2],['fim=2026-11-08',1],['inicio=2026-11-11',0]])assert.equal(count((await get('xlsx',admin,'depositoId=1&'+query)).buffer),expected);
  const rangedList=await fetch(origin+'/api/pc04/contratacoes?depositoId=1&inicio=2026-11-08&fim=2026-11-09',{headers:{Cookie:admin}});assert.equal(rangedList.status,200);const rangedRows=await rangedList.json();assert.equal(rangedRows.registros.length,200);assert.ok(rangedRows.proximaPagina);assert.ok(rangedRows.registros.every(r=>r.DataServico>='2026-11-08'&&r.DataServico<='2026-11-09'));
  await get('xlsx',admin,'inicio=2026-11-10&fim=2026-11-09',400);await get('xlsx',admin,'inicio=2026-02-30',400);
  assert.equal(count((await get('xlsx',admin)).buffer),207);
  assert.equal(count((await get('xlsx',actors.gestorA.cookie)).buffer),205);
  assert.equal(count((await get('xlsx',actors.gestorB.cookie)).buffer),2);
  const finance=(await get('xlsx',actors.financeiro.cookie)).buffer;assert.equal(count(finance),68);assert.ok(!sheet(finance).includes('ABERTA'));assert.ok(!sheet(finance).includes('CANCELADA'));
  const foreign=(await get('xlsx',actors.gestorB.cookie,'depositoId=1')).buffer;assert.equal(count(foreign),0);assert.ok(!sheet(foreign).includes('Depósito A'));
  const filters=new URLSearchParams({numero:'3',prestador:'José',depositoId:'1',centroCusto:'A',gestor:'Admin',dataServico:'2026-11-09',valor:'10,00',situacao:'LIBERADA'});assert.equal(count((await get('xlsx',admin,filters.toString())).buffer),1);
  assert.equal(count((await get('xlsx',admin,'numero=99999')).buffer),0);
  for(const query of ['antes=8','dataServico=2026-02-30','valor=1.001','depositoId=1x','situacao=FORJADA','prestador=a&prestador=b'])await get('xlsx',admin,query,400);
  assert.equal(count((await get('xlsx',admin,'prestador='+encodeURIComponent("'; DROP TABLE X--"))).buffer),0);
  const pdf=await get('pdf',admin,'depositoId=1&inicio=2026-11-08&fim=2026-11-10');assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.ok((pdf.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length>1);
  const smallPdf=await get('pdf',actors.gestorB.cookie,'depositoId=1');assert.equal(smallPdf.buffer.subarray(0,5).toString(),'%PDF-');
  fs.mkdirSync('artifacts/pc04-export',{recursive:true});fs.writeFileSync('artifacts/pc04-export/contratacoes.xlsx',adminFile);fs.writeFileSync('artifacts/pc04-export/contratacoes.pdf',pdf.buffer);fs.writeFileSync('artifacts/pc04-export/vazio.pdf',smallPdf.buffer);
  assert.equal(await snapshot(),before);assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria'))[0].N),audits);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.close();try{if((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id)await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);}finally{await master.close();}}
});
