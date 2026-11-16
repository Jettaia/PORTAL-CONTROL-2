import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountTokens} from '../src/pc05-routes.js';
import {mountContracts} from '../src/pc04-routes.js';

const cfg={pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,token:'a'.repeat(64)};
const actor={UsuarioId:1,Adm:0,Gestor:1,Financeiro:0};
const clock={AgoraUtc:'2026-10-28T15:00:00.000',AgoraLocal:'2026-10-28T12:00:00'};
const row={ContratacaoId:7,Numero:17,DepositoId:1,DataServico:'2026-10-28',EntradaReal:null,SaidaReal:null,Status:'ABERTA',PagoEmUtc:null,Versao:1,Valor:'150.00'};
const tablet={TabletId:5,DepositoId:1,EmissorId:1,ExpiraEmUtc:'2026-10-28T23:00:00.000',RevogadoEmUtc:null,Falhas:0,AtivadoEmUtc:clock.AgoraUtc};
const token={TokenId:8,ContratacaoId:7,Tipo:'ENTRADA',EmissorId:1,ExpiraEmUtc:'2026-10-28T16:00:00.000',ConsumidoEmUtc:null,InvalidadoEmUtc:null};
const prefix=(user=actor)=>[[],[{R:0}],[user],[{V:1}], [clock]];
const pointPrefix=(t=tablet)=>[[],[{R:0}],[clock],[t]];

test('PC05 HTTP com serviço real: tokens, autorização e horários',async t=>{
 const app=express();app.set('trust proxy','loopback');app.use(express.json());let requestNumber=0;
 mountTokens(app,cfg,{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};req.rawSession='session';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 mountContracts(app,cfg,{session:(req,res,next)=>{req.user={id:1};req.rawSession='session';next();},sameOrigin:(req,res,next)=>next()});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(path,body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path.startsWith('/')?path:'/api/pc05/'+path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',origin:'http://local.test','x-user':'1','x-forwarded-for':'192.0.2.'+(++requestNumber),cookie:'jetta_pc05_tablet='+ 'b'.repeat(64),...headers},...(body?{body:JSON.stringify(body)}:{})});
 async function run({path='contratacoes/7/tokens',body={versao:1,tipo:'ENTRADA'},queue,status=200,check,inspect,headers}){
  const sql=[];let commits=0,rollbacks=0;
  const db={query:async q=>{sql.push(q);assert.ok(queue.length,'SQL inesperado '+q);const next=queue.shift();if(next instanceof Error)throw next;return next;},beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await call(path,body,headers),out=await response.json();assert.equal(response.status,status,JSON.stringify(out));assert.equal(queue.length,0);check?.(out,response);inspect?.(sql);if(sql.length){assert.equal(commits+rollbacks,1);if(['TOKEN_INVALIDO','TABLET_BLOQUEADO'].includes(out.erro))assert.equal(commits,1,'falha de token precisa persistir');if(status===503)assert.equal(rollbacks,1,'falha técnica reverte transação');}if(out.codigo)assert.ok(sql.every(q=>!q.includes("'"+out.codigo+"'")),'código puro não pode chegar ao SQL');}finally{mock.mock.restore();}
 }
 assert.equal((await call('contratacoes/7/tokens',{versao:1,tipo:'ENTRADA'},{'x-user':''})).status,401);
 assert.equal((await call('contratacoes/7/tokens',{versao:1,tipo:'ENTRADA'},{origin:'http://evil.test'})).status,403);
 assert.equal((await call('tablet/apontar',{codigo:'12345678'},{cookie:'jetta_session='+'c'.repeat(64)})).status,403);
 await t.test('pareamento forte e tempo limitado',()=>run({path:'tablets',body:{nome:'Recepção',depositoId:'1'},queue:[...prefix(),[{DepositoId:1}],[{TabletId:5}],[]],check:o=>{assert.match(o.pareamento,/^[a-f0-9]{64}$/);assert.equal(o.expiraEmUtc,'2026-10-28T15:05:00.000Z');}}));
 await t.test('habilitação única gera cookie separado',()=>run({path:'tablet/habilitar',body:{pareamento:'d'.repeat(64)},queue:[[],[{R:0}],[clock],[{...tablet,AtivadoEmUtc:null,PareamentoExpiraEmUtc:'2026-10-28T15:05:00.000'}],[],[]],check:(o,r)=>{assert.deepEqual(o,{ok:true});assert.match(r.headers.get('set-cookie'),/jetta_pc05_tablet=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/api\/pc05\/tablet; Max-Age=34560000/);}}));
 await t.test('reuso pareamento negado',()=>run({path:'tablet/habilitar',body:{pareamento:'d'.repeat(64)},queue:[[],[{R:0}],[clock],[{...tablet,PareamentoExpiraEmUtc:'2026-10-28T15:05:00.000'}]],status:401}));
 await t.test('gestor não revoga tablet fora do depósito autorizado',()=>run({path:'tablets/5/revogar',body:{},queue:[...prefix(),[]],status:404}));
 for(const [name,user,entry,status,error] of [
  ['gestor não exclui tablet revogado',actor,{...tablet,RevogadoEmUtc:clock.AgoraUtc},403,'SOMENTE_ADM'],
  ['admin não exclui tablet inexistente',{...actor,Adm:1},null,404,'TABLET_INDISPONIVEL']
 ])await t.test(name,()=>run({path:'tablets/5/excluir',body:{},queue:[...prefix(user).slice(0,4),...(status===403?[]:[entry?[entry]:[]])],status,check:o=>assert.equal(o.erro,error)}));
 await t.test('admin exclui ativo revogando na mesma escrita',()=>run({path:'tablets/5/excluir',body:{},queue:[...prefix({...actor,Adm:1}).slice(0,4),[tablet],[],[]],inspect:sql=>{const update=sql.find(q=>q.startsWith('UPDATE Operacao.TabletPC05 SET ExcluidoEmUtc='));assert.match(update,/RevogadoEmUtc=COALESCE\(RevogadoEmUtc,SYSUTCDATETIME\(\)\)/);assert.match(update,/SessaoHash=NULL,PareamentoHash=NULL/);assert.ok(!sql.some(q=>/^DELETE|UPDATE Operacao.ContratacaoToken/.test(q)));}}));
 await t.test('admin exclui revogado e audita sem apagar tokens',()=>run({path:'tablets/5/excluir',body:{},queue:[...prefix({...actor,Adm:1}).slice(0,4),[{...tablet,RevogadoEmUtc:clock.AgoraUtc}],[],[]],inspect:sql=>{assert.ok(sql.some(q=>q.startsWith('UPDATE Operacao.TabletPC05 SET ExcluidoEmUtc=')));assert.ok(sql.some(q=>q.includes('INSERT Seguranca.Auditoria')));assert.ok(!sql.some(q=>/DELETE|UPDATE Operacao.ContratacaoToken/.test(q)));}}));
 await t.test('auditoria falha e exclusão reverte',()=>run({path:'tablets/5/excluir',body:{},queue:[...prefix({...actor,Adm:1}).slice(0,4),[{...tablet,RevogadoEmUtc:clock.AgoraUtc}],[],Error('audit failure')],status:503}));
 await t.test('MFA vencido bloqueia exclusão',()=>run({path:'tablets/5/excluir',body:{},queue:[[],[{R:0}],[{...actor,Adm:1}],[]],status:403}));
 assert.equal((await call('tablets/5/excluir',{}, {'x-user':''})).status,401);
 assert.equal((await call('tablets/5/excluir',{}, {origin:'http://evil.test'})).status,403);
 await t.test('emissor revoga imediatamente',()=>run({path:'tablets/5/revogar',body:{},queue:[...prefix(),[tablet],[],[]]}));
 await t.test('autorização permanente não vence depois de oito horas',()=>run({path:'tablet/status',body:null,queue:[...pointPrefix({...tablet,ExpiraEmUtc:null,AtivadoEmUtc:'2026-01-01T00:00:00.000'})],check:(o,r)=>{assert.equal(o.ok,true);assert.match(r.headers.get('set-cookie'),/Max-Age=34560000/);}}));
 await t.test('cadastro exige depósito válido antes do SQL',()=>run({path:'tablets',body:{nome:'Tablet'},queue:[],status:400}));
 await t.test('status não divulga dados',()=>run({path:'tablet/status',body:null,queue:[...pointPrefix()],check:o=>assert.deepEqual(o,{ok:true})}));
 await t.test('tablet não pode revogar a própria autorização pela rota antiga',async()=>{
  const mock=t.mock.method(odbc,'connect',async()=>{assert.fail('rota removida não pode acessar SQL');});
  try{const r=await call('tablet/sair',{}, {'x-user':''});assert.equal(r.status,404);assert.equal(r.headers.get('set-cookie'),null);assert.equal(mock.mock.callCount(),0);}finally{mock.mock.restore();}
 });
 assert.equal((await call('tablets/5/revogar',{}, {'x-user':''})).status,401);
 await t.test('horários manuais ADMIN invalidam tokens na mesma transação',()=>run({path:'/api/pc04/contratacoes/7/horarios',body:{versao:1,entradaReal:'2026-10-28T10:00',saidaReal:'2026-10-28T11:00',motivo:'Esquecimento'},queue:[...prefix({...actor,Adm:1}).slice(0,4),[row],[],[],[],[],[{...row,EntradaReal:'2026-10-28T10:00',SaidaReal:'2026-10-28T11:00'}]],inspect:sql=>assert.ok(sql.some(q=>q.startsWith('UPDATE Operacao.ContratacaoToken')&&q.includes('InvalidadoEmUtc')))}));
 await t.test('gestor solicita horários e invalida tokens sem gravar o real',()=>run({path:'/api/pc04/contratacoes/7/horarios',body:{versao:1,entradaReal:'2026-10-28T10:00',saidaReal:'2026-10-28T11:00',motivo:'Esquecimento'},queue:[...prefix().slice(0,4),[row],[{SolicitacaoId:5}],[],[],[],[],[{...row,Versao:2,HorarioPendenteId:5}]],check:r=>assert.equal(r.resultado.HorarioSolicitado,true),inspect:sql=>assert.ok(sql.some(q=>q.startsWith('UPDATE Operacao.ContratacaoToken')&&q.includes('InvalidadoEmUtc')))}));
 await t.test('cancelamento invalida tokens sem excluir histórico',()=>run({path:'/api/pc04/contratacoes/7/cancelar',body:{versao:1,motivo:'Cancelamento'},queue:[...prefix().slice(0,4),[row],[],[],[],[],[{...row,Status:'CANCELADA'}]],inspect:sql=>assert.ok(sql.some(q=>q.startsWith('UPDATE Operacao.ContratacaoToken')))}));
});
