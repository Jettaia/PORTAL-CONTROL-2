import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import crypto from 'node:crypto';
import {mountTokens} from '../src/pc05-routes.js';

const clock={AgoraUtc:'2026-11-16T15:00:00.000',AgoraLocal:'2026-11-16T12:00:00'};
const tablet={TabletId:5,DepositoId:1,EmissorId:1,Falhas:0,AtivadoEmUtc:clock.AgoraUtc,ExpiraEmUtc:null};
const row={ContratacaoId:7,DepositoId:1,DataServico:'2026-11-16',EntradaReal:null,SaidaReal:null,Status:'ABERTA',Versao:1};
test('PC05 código CPF fixo: HTTP, estado, escopo, duplicação e auditoria',async t=>{
 const app=express();app.set('trust proxy','loopback');app.use(express.json());let number=0;
 mountTokens(app,{pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,token:'a'.repeat(64)},{session:(q,r,next)=>{q.user={id:1};next();},sameOrigin:(q,r,next)=>q.get('origin')==='http://local.test'?next():r.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 async function run({matches=[row],now=clock,device=tablet,body={codigo:'0123'},extra=[],status=200,inspect,check,path='tablet/apontar',replay,failAudit=false}){
  const queue=path==='tablet/apontar'?[[],[{R:0}],[now],[device],...extra]:[],sql=[];let writes=0,rollback=0;
  if(path==='tablet/apontar'&&device&&device.Falhas<5){
   if(body.requisicaoId)queue.push(replay?[replay]:[]);
   if(!replay){
   if(/^\d{4}$/.test(body.codigo))queue.push(matches);
   if(!/^\d{4}$/.test(body.codigo)||matches.length!==1)queue.push([]);
   else if(!matches[0].EntradaReal||new Date(now.AgoraLocal+'Z')-new Date(matches[0].EntradaReal+'Z')>=10000)queue.push([],[],failAudit?Error('audit unavailable'):[]);
   if(body.requisicaoId&&matches.length===1&&!failAudit)queue.push([]);
   }else if(replay.CodigoHash!==crypto.createHmac('sha256','a'.repeat(64)).update('PC05:'+body.codigo).digest('hex'))queue.push([]);
  }
  t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);if(q.startsWith('UPDATE Operacao.Contratacao SET'))writes++;assert.ok(queue.length,'SQL inesperado '+q);const out=queue.shift();if(out instanceof Error)throw out;return out;},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>rollback++,close:async()=>{}}));
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/pc05/${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'http://local.test',cookie:'jetta_pc05_tablet='+'b'.repeat(64),'x-forwarded-for':'192.0.2.'+(++number)},body:JSON.stringify(body)}),out=await response.json();assert.equal(response.status,status,JSON.stringify(out));assert.equal(queue.length,0);check?.(out);inspect?.({sql,writes,rollback});}finally{t.mock.restoreAll();}
 }
 await t.test('prefixo com zero registra entrada sem emissão e sem expor pessoa',()=>run({check:o=>assert.deepEqual(o,{ok:true,mensagem:'Token aceito'}),inspect:({sql,writes})=>{assert.equal(writes,1);assert.ok(!sql.some(q=>q.includes('ContratacaoToken')));assert.match(sql.find(q=>q.startsWith('SELECT TOP(2)')),/3000310032003300/);assert.match(sql.find(q=>q.startsWith('UPDATE Operacao.Contratacao SET')),/EntradaReal=.*EntradaOrigem='TOKEN'/);assert.match(sql.find(q=>q.includes('INSERT Operacao.ContratacaoEvento')),/4300500046005f004600490058004f00/);}}));
 await t.test('próxima leitura registra saída inclusive entrada manual',()=>run({matches:[{...row,EntradaReal:'2026-11-16T08:00:00'}],inspect:({sql})=>{const q=sql.find(q=>q.startsWith('UPDATE Operacao.Contratacao SET'));assert.match(q,/SaidaReal=.*SaidaOrigem='TOKEN'/);assert.doesNotMatch(q,/Valor=|LiberadoEmUtc=/);}}));
 await t.test('repetição imediata não transforma entrada em saída',()=>run({matches:[{...row,EntradaReal:'2026-11-16T11:59:55'}],inspect:({writes})=>assert.equal(writes,0)}));
 await t.test('repetição imediata com id próprio persiste recibo sem criar saída',()=>run({body:{codigo:'0123',requisicaoId:'22222222-2222-4222-8222-222222222222'},matches:[{...row,EntradaReal:'2026-11-16T11:59:55'}],inspect:({sql,writes})=>{assert.equal(writes,0);assert.ok(sql.some(q=>q.startsWith('INSERT Seguranca.Auditoria')));assert.ok(!sql.some(q=>q.startsWith('INSERT Operacao.ContratacaoEvento')));}}));
 await t.test('saída no dia seguinte',()=>run({matches:[{...row,DataServico:'2026-11-15',EntradaReal:'2026-11-15T22:00:00'}]}));
 for(const matches of [[],[row,{...row,ContratacaoId:8}]])await t.test('ausência/coincidência não aponta pessoa arbitrária '+matches.length,()=>run({matches,status:409,inspect:({writes})=>assert.equal(writes,0)}));
 for(const codigo of ['123','12345','12345678','abcd','01;3'])await t.test('formato recusado '+codigo,()=>run({body:{codigo},status:409}));
 await t.test('consulta mantém tablet, escopo, datas e pendências',()=>run({inspect:({sql})=>{const q=sql.find(q=>q.startsWith('SELECT TOP(2)'));for(const p of [/TabletPC05Deposito/,/ud.UsuarioId=1/,/ud.RevogadoEmUtc IS NULL/,/hs.Status='PENDENTE'/,/c.Status='ABERTA'/,/c.SaidaReal IS NULL/,/DATEADD\(day,-1/])assert.match(q,p);}}));
 await t.test('emissão antiga desativada',()=>run({path:'contratacoes/7/tokens',body:{versao:1,tipo:'ENTRADA'},status:410}));
 const requestId='11111111-1111-4111-8111-111111111111',digest=crypto.createHmac('sha256','a'.repeat(64)).update('PC05:0123').digest('hex');
 await t.test('retry após saída devolve sucesso sem nova consulta/escrita',()=>run({body:{codigo:'0123',requisicaoId:requestId},replay:{CodigoHash:digest},inspect:({sql,writes})=>{assert.equal(writes,0);assert.ok(!sql.some(q=>q.startsWith('SELECT TOP(2)')));}}));
 await t.test('request id não pode trocar código',()=>run({body:{codigo:'0124',requisicaoId:requestId},replay:{CodigoHash:digest},status:409,inspect:({writes})=>assert.equal(writes,0)}));
 await t.test('auditoria falha reverte horário',()=>run({failAudit:true,status:503,inspect:({rollback})=>assert.equal(rollback,1)}));
 await t.test('quinta tentativa inválida bloqueia aparelho',()=>run({device:{...tablet,Falhas:4},matches:[],status:401}));
 await t.test('requisição forjada não chega ao banco',async()=>{t.mock.method(odbc,'connect',()=>assert.fail('SQL indevido'));const r=await fetch(`http://127.0.0.1:${server.address().port}/api/pc05/tablet/apontar`,{method:'POST',headers:{origin:'http://forged.test','content-type':'application/json'},body:JSON.stringify({codigo:'0123'})});assert.equal(r.status,403);t.mock.restoreAll();});
});
