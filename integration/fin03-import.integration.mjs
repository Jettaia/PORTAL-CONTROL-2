import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {hostname} from 'node:os';
import {chromium} from 'playwright';
import {connectPilot,installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {completeSetup} from '../pilot-local/app.mjs';
import {createApp} from '../src/server.js';
import {hashToken} from '../src/security.js';

test('FIN03 importação: QR digitalizado, prévia sem escrita, vínculos, autorização e baixa real por contratação',{
 skip:process.env.FIN03_IMPORT_SQL_TESTS!=='YES',timeout:300000
},async t=>{
 const sqlServer='localhost\\SQLEXPRESS',database='JETTA_CONTROL_B3_TEST_'+crypto.randomBytes(6).toString('hex');
 const cfg={server:sqlServer,database,host:'127.0.0.1',port:0,driver:'ODBC Driver 18 for SQL Server',trust:true,token:crypto.randomBytes(32).toString('hex'),mfaRequired:false,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,fin01:true};
 const master=await connectPilot('master',sqlServer);let db,server,browser,created=false;
 const stage=name=>console.log('FIN03 importação etapa: '+name);
 try{
  stage('banco sintético local');
  assert.equal((await master.query("SELECT CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')) MachineName"))[0].MachineName.toLowerCase(),hostname().toLowerCase());
  await master.query(`CREATE DATABASE [${database}]`);created=true;db=await connectPilot(database,sqlServer);
  await installSchema(db,crypto.randomBytes(32).toString('hex'),{test:true});
  const password='SyntheticOnly!Pass123',setupToken=crypto.randomBytes(32).toString('hex');
  await db.beginTransaction();try{await seedCatalog(db);await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome) VALUES(1,'${hashToken(setupToken)}','admin@example.test',N'Admin teste')`);await db.commit();}catch(e){await db.rollback();throw e;}
  await completeSetup(cfg,{token:setupToken,password});
  await db.query("INSERT Cadastro.Deposito(Codigo,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP) VALUES('A',N'Depósito A','A',N'Rua A','1',N'Centro',N'Campinas','SP','13010000'),('B',N'Depósito B','B',N'Rua B','2',N'Centro',N'Santos','SP','11010000');INSERT Cadastro.TipoServico(Nome) VALUES(N'Carga e descarga');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'José da Silva','12345678901');INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(1,1,1),(1,2,1);");
  server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;
  const origin=`http://127.0.0.1:${cfg.port}`,prefix='/api/financeiro/recibos/importacao';
  const request=async(path,cookie,body,status=200,method=body?'POST':'GET',extra={})=>{
   const response=await fetch(origin+path,{signal:AbortSignal.timeout(120000),method,headers:{Origin:origin,'x-jetta-request':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
   const raw=await response.text();assert.equal(response.status,status,`${method} ${path}: ${raw.slice(0,1600)}`);
   let data;try{data=JSON.parse(raw);}catch{data=raw;}return {data,response,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=async email=>(await request('/api/auth/login',null,{email,senha:password})).cookie;
  const admin=await login('admin@example.test'),actors={};
  for(const [name,roles,depots] of [['financeiro',['FINANCEIRO'],[]],['gestorA',['GESTOR'],[1]],['gestorB',['GESTOR'],[2]],['coordFinanceiro',['COORDENADOR','FINANCEIRO'],[1]]]){
   const {data}=await request('/api/pc01/usuarios',admin,{nome:name,email:name+'@example.test',funcoes:roles,depositos:depots,ativo:true,senha:password},201);
   actors[name]={id:data.usuarioId,cookie:await login(name+'@example.test')};
  }
  const root=c=>`/api/financeiro/contratacoes/${c.ContratacaoId}`;
  const create=async(depot,day)=>{
   let c=(await request('/api/pc04/contratacoes',admin,{depositoId:depot,prestadorId:1,tipoServicoId:1,gestorId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T12:00',valor:'175.25'},201)).data.resultado;
   c=(await request(`/api/pc04/contratacoes/${c.ContratacaoId}/horarios`,admin,{versao:Number(c.Versao),entradaReal:day+'T08:00',saidaReal:day+'T10:00',motivo:'Dados sintéticos'})).data.resultado;
   return (await request(`/api/pc04/contratacoes/${c.ContratacaoId}/conferir`,admin,{versao:Number(c.Versao)})).data.resultado;
  };
  const a=await create(1,'2026-11-01'),b=await create(2,'2026-11-02'),stale=await create(1,'2026-11-03');
  const ra=(await request(root(a)+'/recibo',admin,{})).data.recibo;
  const rb=(await request(root(b)+'/recibo',admin,{})).data.recibo;
  const rs=(await request(root(stale)+'/recibo',admin,{})).data.recibo;
  // Test the public endpoint first: a missing implementation fails before PDF fixtures/dependencies are needed.
  await request(prefix+'/previa',null,{arquivo:{}},401);
  await request(prefix+'/previa',actors.gestorA.cookie,{arquivo:{}},403);
  await request(prefix+'/previa',admin,{arquivo:{}},403,'POST',{Origin:'https://foreign.test'});
  const {PDFDocument,StandardFonts}=await import('pdf-lib');
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  let page=await browser.newPage({viewport:{width:900,height:1300}});
  const imageReceipt=async c=>{
   const html=(await request(root(c)+'/recibo/impressao',admin)).data;
   assert.match(html,/svg/,'documento deve trazer QR vetorial imprimível');
   await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
   const printed=await PDFDocument.load(await page.pdf({preferCSSPageSize:true,printBackground:true}));
   assert.equal(printed.getPageCount(),1,'recibo com QR deve continuar em uma única página A4');
   // Synthetic visual mark stands in for handwritten signature; the feature does not certify signature authenticity.
   await page.locator('[data-manual="assinatura"]').evaluate(el=>{el.textContent='Assinatura sintética para teste';});
   return page.locator('.receipt').screenshot();
  };
  const pngA=await imageReceipt(a),pngB=await imageReceipt(b),pngStale=await imageReceipt(stale);
  fs.mkdirSync('artifacts/fin03-import-integrated',{recursive:true});
  fs.writeFileSync('artifacts/fin03-import-integrated/receipt-qr.png',pngA);
  const makePdf=async(images,{continuation=false}={})=>{
   const pdf=await PDFDocument.create();
   for(const png of images){const image=await pdf.embedPng(png),p=pdf.addPage([595.28,841.89]);p.drawImage(image,{x:0,y:0,width:595.28,height:841.89});}
   if(continuation){const p=pdf.addPage([595.28,841.89]),font=await pdf.embedFont(StandardFonts.Helvetica);p.drawText('Pagina adicional assinada - vinculo manual',{x:40,y:760,size:13,font});}
   return Buffer.from(await pdf.save());
  };
  const file=bytes=>({nome:'recibos-assinados.pdf',tipo:'application/pdf',conteudoBase64:bytes.toString('base64')});
  const bytes=await makePdf([pngA,pngB],{continuation:true}),arquivo=file(bytes);
  const counts=async()=>{
   const result={};
   for(const table of ['ContratacaoBaixa','ContratacaoAnexo'])result[table]=Number((await db.query(`SELECT COUNT(*) N FROM Financeiro.${table}`))[0].N);
   return result;
  };
  const baseline=await counts();
  stage('lote ampliado: 51 páginas e 17 MiB via HTTP autenticado');
  const largeDoc=await PDFDocument.create(),largeFont=await largeDoc.embedFont(StandardFonts.Helvetica);
  for(let n=0;n<51;n++)largeDoc.addPage([180,240]).drawText('Contratacao '+stale.Numero,{x:10,y:200,size:10,font:largeFont});
  const largeBytes=Buffer.concat([Buffer.from(await largeDoc.save()),Buffer.alloc(17*1024*1024,32)]);
  const largePreview=(await request(prefix+'/previa',admin,{arquivo:file(largeBytes)})).data;
  assert.equal(largePreview.paginas.length,51);assert.deepEqual(largePreview.limites,{tamanhoMiB:50,paginas:100});
  const allPages=Array.from({length:51},(_,i)=>i+1);
  const largeBound=(await request(prefix+'/vincular',admin,{previa:largePreview.previa,paginas:allPages,numero:String(stale.Numero),depositoId:String(stale.DepositoId)})).data.item;
  assert.deepEqual(largeBound.paginas,allPages);assert.equal(String(largeBound.contratacaoId),String(stale.ContratacaoId));
  await request(prefix+'/'+largePreview.previa,admin,undefined,200,'DELETE');
  assert.deepEqual(await counts(),baseline,'lote grande e descarte não geram baixa');
  // Legacy digital receipts without a QR keep their searchable printed contract number.
  const legacyHtml=(await request(root(stale)+'/recibo/impressao',admin)).data.replace(/<div class="receipt-qr"[\s\S]*?<\/div>/g,'');
  await page.setContent(legacyHtml);
  const legacy=(await request(prefix+'/previa',admin,{arquivo:file(await page.pdf({format:'A4',printBackground:true}))})).data;
  assert.equal(String(legacy.paginas[0].contratacaoId),String(stale.ContratacaoId));
  assert.equal(legacy.paginas[0].origem,'TEXTO');
  await request(prefix+'/'+legacy.previa,admin,undefined,200,'DELETE');
  stage('prévia pela interface integrada autenticada');
  await page.setViewportSize({width:1440,height:1000});
  const separator=admin.indexOf('=');
  await page.context().addCookies([{name:admin.slice(0,separator),value:admin.slice(separator+1),url:origin}]);
  await page.goto(origin);await page.locator('#dashboard').waitFor({state:'visible'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'pagamentos'})));
  await page.getByRole('button',{name:'Importar recibos assinados',exact:true}).click();
  await page.getByLabel('PDF com recibos assinados').setInputFiles({name:'assinados.pdf',mimeType:'application/pdf',buffer:bytes});
  await page.getByRole('button',{name:'Analisar PDF',exact:true}).click();
  await page.getByRole('heading',{name:'Conferir recibos assinados',exact:true}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'Conferir páginas 1',exact:true}).click();
  await page.locator('#fin03ImportViewer img').first().waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('#fin03ImportViewer img')].every(img=>img.complete&&img.naturalWidth>0));
  await page.locator('#fin03Import').screenshot({path:'artifacts/fin03-import-integrated/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#fin03Import').screenshot({path:'artifacts/fin03-import-integrated/mobile.png'});
  await page.getByRole('button',{name:'Descartar importação',exact:true}).click();
  assert.deepEqual(await counts(),baseline,'conferir e descartar pela UI não produz pagamento');
  stage('prévia QR em PDF sem camada de texto');
  const preview=(await request(prefix+'/previa',admin,{arquivo})).data;
  assert.ok(preview.previa);assert.equal(preview.paginas.length,3);
  const pa=preview.paginas[0],pb=preview.paginas[1];
  assert.equal(String(pa.contratacaoId),String(a.ContratacaoId));assert.equal(String(pb.contratacaoId),String(b.ContratacaoId));
  assert.equal(pa.origem,'QR');assert.equal(pb.origem,'QR');
  assert.match(pa.deposito,/Depósito A/);assert.match(pb.deposito,/Depósito B/);
  assert.equal(String(pa.reciboId),String(ra.ReciboId));assert.equal(String(pb.reciboId),String(rb.ReciboId));
  assert.deepEqual(await counts(),baseline,'prévia não cria baixa nem anexo');
  const scoped=(await request(prefix+'/previa',actors.coordFinanceiro.cookie,{arquivo})).data;
  assert.equal(String(scoped.paginas[0].contratacaoId),String(a.ContratacaoId));
  assert.ok(!scoped.paginas[1].contratacaoId,'coordenador financeiro não recebe vínculo/dados do outro depósito');
  await request(prefix+'/vincular',actors.coordFinanceiro.cookie,{previa:scoped.previa,paginas:[2],numero:String(b.Numero),depositoId:String(b.DepositoId)},404);
  await request(prefix+'/'+scoped.previa,actors.coordFinanceiro.cookie,undefined,200,'DELETE');
  const getImage=await fetch(origin+prefix+'/'+preview.previa+'/paginas/1',{headers:{Cookie:admin}});
  assert.equal(getImage.status,200);assert.match(getImage.headers.get('content-type'),/^image\/png/);assert.ok((await getImage.arrayBuffer()).byteLength>100);
  await request(prefix+'/vincular',actors.financeiro.cookie,{previa:preview.previa,paginas:[1],numero:String(a.Numero),depositoId:String(a.DepositoId)},404);
  await request(prefix+'/confirmar',actors.gestorA.cookie,{previa:preview.previa,itens:[]},403);
  assert.equal(String(a.Numero),String(b.Numero),'fixture protege numeração repetida entre depósitos');
  await request(prefix+'/vincular',admin,{previa:preview.previa,paginas:[1],numero:String(a.Numero)},404);
  await request(prefix+'/vincular',admin,{previa:preview.previa,paginas:[1],numero:String(b.Numero),depositoId:String(b.DepositoId)},409);
  const linked=(await request(prefix+'/vincular',admin,{previa:preview.previa,paginas:[1,3],numero:String(a.Numero),depositoId:String(a.DepositoId)})).data.item;
  assert.deepEqual(linked.paginas,[1,3]);assert.equal(String(linked.reciboId),String(ra.ReciboId));
  const item=(row,paginas)=>({paginas,contratacaoId:row.contratacaoId,reciboId:row.reciboId,baixaAnteriorId:row.baixaAnteriorId??null});
  stage('seleção, separação e persistência real');
  const selected=item(linked,[1,3]);
  await request(prefix+'/confirmar',admin,{previa:preview.previa,itens:[selected,selected]},400);
  assert.deepEqual(await counts(),baseline,'grupos duplicados não podem produzir escrita parcial');
  const result=(await request(prefix+'/confirmar',admin,{previa:preview.previa,itens:[selected]})).data;
  assert.equal(result.pagos,1);assert.equal(result.falhas,0);
  assert.equal((await request(root(a),admin)).data.registro.Situacao,'PAGO');
  assert.equal((await request(root(b),admin)).data.registro.Situacao,'RECIBO_GERADO','não selecionado permanece pendente');
  assert.deepEqual(await counts(),{ContratacaoBaixa:1,ContratacaoAnexo:1});
  const payment=(await request(root(a)+'/pagamento',admin)).data;
  const download=root(a)+'/anexos/'+payment.pagamento.AnexoId;
  const attached=await fetch(origin+download,{headers:{Cookie:admin}});
  const saved=await PDFDocument.load(await attached.arrayBuffer());assert.equal(saved.getPageCount(),2,'anexo contém somente páginas escolhidas para a contratação');
  await request(download,actors.gestorB.cookie,undefined,404);
  // Repeating a successful selection cannot create another payment/attachment.
  await request(prefix+'/confirmar',admin,{previa:preview.previa,itens:[selected]},400);
  assert.deepEqual(await counts(),{ContratacaoBaixa:1,ContratacaoAnexo:1});
  await request(prefix+'/'+preview.previa,admin,undefined,200,'DELETE');
  stage('descarte sem escrita e divergência após prévia');
  const discard=(await request(prefix+'/previa',actors.financeiro.cookie,{arquivo:file(await makePdf([pngB]))})).data;
  await request(prefix+'/'+discard.previa,actors.financeiro.cookie,undefined,200,'DELETE');
  await request(prefix+'/vincular',actors.financeiro.cookie,{previa:discard.previa,paginas:[1],numero:String(b.Numero),depositoId:String(b.DepositoId)},404);
  assert.deepEqual(await counts(),{ContratacaoBaixa:1,ContratacaoAnexo:1});
  const mixed=(await request(prefix+'/previa',actors.financeiro.cookie,{arquivo:file(await makePdf([pngB,pngStale]))})).data;
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${stale.ContratacaoId}`);
  const partial=(await request(prefix+'/confirmar',actors.financeiro.cookie,{previa:mixed.previa,itens:mixed.paginas.map(row=>item(row,[row.pagina]))})).data;
  assert.equal(partial.pagos,1);assert.equal(partial.falhas,1);
  assert.equal((await request(root(b),admin)).data.registro.Situacao,'PAGO');
  assert.equal((await request(root(stale),admin)).data.registro.Situacao,'RECIBO_GERADO');
  assert.deepEqual(await counts(),{ContratacaoBaixa:2,ContratacaoAnexo:2});
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.Auditoria WHERE Entidade=N'Fin03' AND Acao=N'FIN03_CONFIRMAR'"))[0].N),2);
  assert.equal(String(rs.ReciboId),String(mixed.paginas[1].reciboId));
  await request(prefix+'/'+mixed.previa,actors.financeiro.cookie,undefined,200,'DELETE');
  stage('revogação de autorização no meio do lote');
  const interruptedContracts=[];
  for(const day of ['2026-11-04','2026-11-05','2026-11-06']){
   const contract=await create(1,day);await request(root(contract)+'/recibo',admin,{});interruptedContracts.push(contract);
  }
  // A fresh about:blank page avoids inheriting the portal's HTTP CSP, which
  // intentionally blocks inline styles; receipt HTML has its own hashed CSP.
  page=await browser.newPage({viewport:{width:900,height:1300}});
  const interruptedImages=[];for(const contract of interruptedContracts)interruptedImages.push(await imageReceipt(contract));
  const interrupted=(await request(prefix+'/previa',actors.financeiro.cookie,{arquivo:file(await makePdf(interruptedImages))})).data;
  assert.equal(interrupted.paginas.filter(row=>row.estado==='PRONTO').length,3);
  await db.query(`CREATE TRIGGER Seguranca.Fin03ImportRevoke ON Seguranca.Auditoria AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE Acao=N'FIN03_CONFIRMAR' AND AtorUsuarioId=${actors.financeiro.id}) UPDATE Seguranca.Usuario SET Ativo=0 WHERE UsuarioId=${actors.financeiro.id};END`);
  let interruption;
  try{interruption=(await request(prefix+'/confirmar',actors.financeiro.cookie,{previa:interrupted.previa,itens:interrupted.paginas.map(row=>item(row,[row.pagina]))})).data;}
  finally{await db.query('DROP TRIGGER Seguranca.Fin03ImportRevoke');}
  assert.equal(interruption.resultados.length,3,'todos os selecionados recebem resultado após interrupção');
  assert.equal(interruption.pagos,1);assert.equal(interruption.falhas,2);
  assert.deepEqual(interruption.resultados.map(row=>row.estado),['PAGO','FALHA','FALHA']);
  assert.deepEqual(await counts(),{ContratacaoBaixa:3,ContratacaoAnexo:3});
  for(const [index,contract] of interruptedContracts.entries())assert.equal((await request(root(contract),admin)).data.registro.Situacao,index===0?'PAGO':'RECIBO_GERADO');
  assert.equal(Number((await db.query(`SELECT Ativo FROM Seguranca.Usuario WHERE UsuarioId=${actors.financeiro.id}`))[0].Ativo),0);
  t.diagnostic('PDF image-only de recibos reais: QR reconhecido por contratação/depósito; prévia/descarte sem escrita; confirmação só dos selecionados; anexo separado com 2 páginas; duplicação impedida; divergência manteve pendência e lote informou resultado parcial.');
 }finally{
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));if(db)await db.close();
  try{if(created){await master.query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE [${database}]`);assert.equal((await master.query(`SELECT DB_ID('${database}') Id`))[0].Id,null);t.diagnostic('Banco sintético removido e ausência confirmada');}}finally{await master.close();}
 }
});
