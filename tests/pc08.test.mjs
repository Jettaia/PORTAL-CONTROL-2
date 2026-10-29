import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountPayments} from '../src/pc08-routes.js';

const attachment={nome:'evidencia.html',conteudo:Buffer.from('<script>teste</script>').toString('base64')};
const item={contratacaoId:7,versao:3,valor:'150.00',anexo:attachment};
const body={dataPagamento:'2026-10-01',itens:[item]};
const row={ContratacaoId:7,PrestadorId:2,FilialId:1,DataServico:'2026-09-30',Versao:3,ValorLiberado:'150.00',Status:'LIBERADA',PagoEmUtc:null};
test('PC08: contrato HTTP e transação da baixa',async t=>{
 const app=express();app.use(express.json({limit:'15mb'}));mountPayments(app,{pc08:true,pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};req.rawSession='test';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(path='',payload,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/pc08${path}`,{method:payload?'POST':'GET',headers:{'content-type':'application/json','x-user':'1',origin:'http://local.test',...headers},...(payload?{body:JSON.stringify(payload)}:{})});
 const prefix=(allowed=1)=>[[],[{R:0}],[{Permitido:allowed}],[{V:1}]];
 async function run({payload=body,path='/pagamentos',status=201,queue=[],inspect,check}){
  let commits=0,rollbacks=0;const sql=[];
  const mock=t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);assert.ok(queue.length,'SQL inesperado '+q);const v=queue.shift();if(v instanceof Error)throw v;return v;},beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,close:async()=>{}}));
  try{const r=await call(path,payload);assert.equal(r.status,status,await r.clone().text());check?.(await r.json());assert.equal(queue.length,0);assert.equal(commits,status<400?1:0);if(sql.length)assert.equal(rollbacks,status>=400?1:0);inspect?.(sql);}finally{mock.mock.restore();}
 }
 assert.equal((await call('/pagamentos',body,{'x-user':''})).status,401);
 assert.equal((await call('/pagamentos',body,{origin:'http://evil.test'})).status,403);
 await t.test('financeiro registra cabeçalho, item, anexo, marca e auditoria',()=>run({queue:[...prefix(),[row],[{PagamentoId:9}],[],[],[],[]],inspect:sql=>{assert.ok(sql.some(q=>q.includes("@Resource='JettaControl.PC04'")));assert.ok(sql.some(q=>q.includes('0x3c736372697074')));},check:r=>assert.equal(r.resultado.PagamentoId,9)}));
 await t.test('gestor não quita',()=>run({queue:[[],[{R:0}],[{Permitido:0}]],status:403}));
 await t.test('MFA sem confirmação recente não escreve',()=>run({queue:[[],[{R:0}],[{Permitido:1}],[]],status:403}));
 await t.test('lock recusado não escreve',()=>run({queue:[[],[{R:-1}]],status:409}));
 await t.test('grupo integral de filiais diferentes do mesmo prestador',()=>run({payload:{...body,itens:[item,{...item,contratacaoId:8}]},queue:[...prefix(),[row,{...row,ContratacaoId:8,FilialId:2}],[{PagamentoId:10}],[],[],[],[],[],[],[]],check:r=>assert.equal(r.resultado.ValorTotal,'300.00')}));
 for(const anexo of [{...attachment,nome:'../arquivo'},{...attachment,conteudo:'!inválido!'},{...attachment,conteudo:''},{...attachment,conteudo:Buffer.alloc(1048577).toString('base64')}])await t.test('arquivo inválido recusado antes de escrita',()=>run({payload:{...body,itens:[{...item,anexo}]},status:400}));
 for(const [name,change,status] of [['sem anexo',{itens:[{...item,anexo:undefined}]},400],['data impossível',{dataPagamento:'2026-02-30'},400],['data futura',{dataPagamento:'9998-12-31'},400],['duplicado',{itens:[item,item]},400],['parcial',{itens:[{...item,valor:'149.00'}]},409]])await t.test(name,()=>run({payload:{...body,...change},status,queue:status===409?[...prefix(),[row]]:[]}));
 for(const [name,changed] of [['já paga',{PagoEmUtc:'2026-10-01'}],['revisada',{Status:'ABERTA'}],['versão obsoleta',{Versao:4}],['valor obsoleto',{ValorLiberado:'151.00'}],['data anterior ao serviço',{DataServico:'2026-10-02'}]])await t.test(name,()=>run({queue:[...prefix(),[{...row,...changed}]],status:409}));
 await t.test('prestadores misturados',()=>run({payload:{...body,itens:[item,{...item,contratacaoId:8}]},queue:[...prefix(),[row,{...row,ContratacaoId:8,PrestadorId:3}]],status:409}));
 await t.test('falha ao salvar anexo não confirma baixa',()=>run({queue:[...prefix(),[row],[{PagamentoId:9}],[],new Error('storage failure')],status:503}));
 await t.test('filtros inválidos recusados',()=>run({payload:null,path:'/painel?situacao=ATRASADO',queue:[],status:400}));
 await t.test('download nega gestor antes de ler conteúdo',()=>run({payload:null,path:'/anexos/7',queue:[[],[{Permitido:0}]],status:403}));
 await t.test('listagem filtra e pagina sem blobs',()=>run({payload:null,path:'/painel?filialId=1&prestadorId=2&inicio=2026-09-01&fim=2026-10-28&situacao=PAGO',queue:[[],[{Permitido:1}],[row]],status:200,inspect:sql=>{const q=sql.at(-1);assert.match(q,/c.FilialId=1/);assert.match(q,/c.PrestadorId=2/);assert.match(q,/PagoEmUtc IS NOT NULL/);assert.doesNotMatch(q,/Conteudo/);}}));
 await t.test('download preserva bytes e força arquivo inerte',async()=>{
  const queue=[[],[{Permitido:1}],[{Nome:attachment.nome,Conteudo:Buffer.from(attachment.conteudo,'base64')}]];
  const mock=t.mock.method(odbc,'connect',async()=>({query:async()=>queue.shift(),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
  try{const r=await call('/anexos/7');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/^attachment;/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-security-policy'),/sandbox/);assert.equal(await r.text(),Buffer.from(attachment.conteudo,'base64').toString());assert.equal(queue.length,0);}finally{mock.mock.restore();}
 });
});
