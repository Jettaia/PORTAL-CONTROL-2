import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountReceipts} from '../src/pc09-routes.js';
import {amountWords,renderReceipt,localityFromAddress} from '../src/pc09-document.js';

test('PC09 documento: centavos exatos, extenso, localidade e campos manuais',()=>{
 assert.equal(amountWords('150.50'),'cento e cinquenta reais e cinquenta centavos');
 assert.equal(amountWords('1000000.01'),'um milhão de reais e um centavo');
 assert.equal(amountWords('0.00'),'zero reais');
 assert.equal(amountWords('1.01'),'um real e um centavo');
 assert.equal(amountWords('100.00'),'cem reais');
 assert.equal(localityFromAddress('Rua A, 20 - Centro - Campinas/SP, CEP 13000-000'),'Campinas/SP');
 assert.equal(localityFromAddress('endereço incompleto'),null);
 const html=renderReceipt({numero:'91',valor:'150.50',servico:'Descarga <script>',dataServico:'2026-10-01',localidade:'Campinas/SP',dataQuitacao:null});
 assert.match(html,/RECIBO 91/);assert.match(html,/15\.387\.508\/0001-61/);assert.match(html,/Descarga &lt;script&gt;/);assert.match(html,/01\/10\/2026/);assert.match(html,/Campinas\/SP/);assert.doesNotMatch(html,/<script>/);
});

test('PC09 HTTP: emissão e reimpressão preservam snapshot sem baixa',async t=>{
 const app=express();app.use(express.json());mountReceipts(app,{pc09:true,pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};req.rawSession='token';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(path,body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/pc09${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user':'1',origin:'http://local.test',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const contract={ContratacaoId:7,Numero:77,Versao:3,Status:'LIBERADA',ValorLiberado:'150.50',Tipo:'Descarga',DataServico:'2026-10-01',Endereco:'Rua A - Campinas/SP',DataPagamento:null};
 const snapshot={numero:'91',contratacao:'77',versao:3,valor:'150.50',servico:'Descarga',dataServico:'2026-10-01',localidade:'Campinas/SP',dataQuitacao:null};
 async function run(path,body,queue,status=200,check){let commits=0,rollbacks=0;const sql=[];const mock=t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);assert.ok(queue.length,'SQL inesperado '+q);const r=queue.shift();if(r instanceof Error)throw r;return r;},beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,close:async()=>{}}));try{const r=await call(path,body);assert.equal(r.status,status,await r.clone().text());await check?.(r);assert.equal(queue.length,0);assert.equal(commits,status<400?1:0);if(sql.length)assert.equal(rollbacks,status>=400?1:0);assert.ok(sql.every(q=>!/(UPDATE Operacao.Contratacao|INSERT Financeiro.PC08)/i.test(q)));}finally{mock.mock.restore();}}
 const prefix=[[],[{Permitido:1}],[{R:0}],[{V:1}]];
 assert.equal((await call('/contratacoes/7',{}, {'x-user':''})).status,401);
 assert.equal((await call('/contratacoes/7',{}, {origin:'http://evil.test'})).status,403);
 await t.test('emite documento pré-pagamento',()=>run('/contratacoes/7',{localidade:'Campinas/SP'},[...prefix,[],[contract],[{Numero:91}],[],[]],201,async r=>{const data=await r.json();assert.equal(data.documento.numero,'91');assert.equal(data.documento.dataQuitacao,null);}));
 await t.test('reemitir retorna mesmo snapshot',()=>run('/contratacoes/7',{localidade:'Campinas/SP'},[...prefix,[{ConteudoJson:JSON.stringify(snapshot)}]],201,async r=>assert.deepEqual((await r.json()).documento,snapshot)));
 await t.test('gestor não emite',()=>run('/contratacoes/7',{localidade:'Campinas/SP'},[[],[{Permitido:0}]],403));
 await t.test('gestor não lê documento',()=>run('/contratacoes/7/impressao',null,[[],[{Permitido:0}]],403));
 await t.test('não liberada',()=>run('/contratacoes/7',{localidade:'Campinas/SP'},[...prefix,[],[{...contract,Status:'ABERTA'}]],409));
 await t.test('confirmação divergente não grava',()=>run('/contratacoes/7',{localidade:'Sumaré/SP'},[...prefix,[],[contract]],409));
 await t.test('campo não permitido não grava',()=>run('/contratacoes/7',{localidade:'Campinas/SP',valor:'1.00'},[],400));
 await t.test('falha ao gravar faz rollback',()=>run('/contratacoes/7',{localidade:'Campinas/SP'},[...prefix,[],[contract],[{Numero:92}],new Error('storage failure')],503));
 await t.test('impressão original',()=>run('/contratacoes/7/impressao',null,[[],[{Permitido:1}],[{ConteudoJson:JSON.stringify(snapshot)}]],200,async r=>{assert.match(r.headers.get('content-type'),/text\/html/);assert.match(await r.text(),/RECIBO 91/);}));
});
