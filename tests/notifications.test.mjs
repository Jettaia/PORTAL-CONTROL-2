import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountNotifications} from '../src/notifications-routes.js';

test('notificações HTTP: autenticação, escopo atual e leitura individual',async t=>{
 const app=express();app.use(express.json());
 mountNotifications(app,{pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(suffix='',body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/notificacoes${suffix}`,{method:body?'POST':'GET',headers:{'x-user':'1',origin:'http://local.test','content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('',null,{'x-user':''})).status,401);
 assert.equal((await call('/5-SOLICITACAO/lida',{}, {origin:'http://evil.test'})).status,403);
 async function run(suffix,body,queue,status,inspect){const sql=[];const db={query:async q=>{sql.push(q);assert.ok(queue.length,'SQL inesperado');return queue.shift();},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}};const mock=t.mock.method(odbc,'connect',async()=>db);try{const response=await call(suffix,body);assert.equal(response.status,status,JSON.stringify(await response.clone().json()));assert.equal(queue.length,0);inspect?.(sql,await response.json());}finally{mock.mock.restore();}}
 const coord={Adm:0,Coordenador:1,Gestor:0};
 await run('',null,[[],[coord],[{NaoLidas:2}],[{SolicitacaoId:5,Tipo:'SOLICITACAO',Lida:0}]],200,(sql,b)=>{assert.equal(b.naoLidas,2);assert.match(sql.at(-1),/uf.UsuarioId=1/);assert.match(sql.at(-1),/RevogadoEmUtc IS NULL/);});
 await run('?antes=5-SOLICITACAO',null,[[],[{Adm:1}],[{NaoLidas:0}],[]],200,(sql)=>assert.match(sql.at(-1),/b.SolicitacaoId=5/));
 await run('/5-SOLICITACAO/lida',{},[[],[coord],[]],404);
 await run('/5-SOLICITACAO/lida',{},[[],[coord],[{SolicitacaoId:5}],[]],200,sql=>{assert.match(sql.at(-1),/UsuarioId=1/);assert.match(sql.at(-1),/UPDLOCK,HOLDLOCK/);assert.ok(!sql.some(q=>q.startsWith('UPDATE Operacao.Contratacao')));});
 await run('',null,[[],[]],403);
 await run('?antes=oops',null,[],400);
 await run('/5-FORJADO/lida',{},[],400);
 await run('/5-SOLICITACAO/lida',{usuarioId:2},[],400);
});
