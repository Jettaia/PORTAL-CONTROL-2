import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import odbc from 'odbc';
import {mountTokens} from '../src/pc05-routes.js';

const cfg={pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,mfaRequired:false,token:'a'.repeat(64)};
async function server(t){const app=express();app.set('trust proxy','loopback');app.use(express.json());mountTokens(app,cfg,{sameOrigin:(_q,_r,next)=>next(),session:(req,res,next)=>{req.user={id:1};req.rawSession='test';next();}});const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));t.after(()=>s.close());let ip=1;return async(path,body,address)=>{const r=await fetch(`http://127.0.0.1:${s.address().port}/api/pc05/`+path,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':address||'192.0.2.'+(ip++)},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};}

test('PC05: código curto gera, evita colisão, ativa uma vez e mantém sessão longa',async t=>{
 const sql=[],rows=[];let next=1,expired=false;
 const db={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{},query:async q=>{
  sql.push(q);
  if(q.includes('SELECT @r R'))return [{R:0}];
  if(q.includes('END Adm'))return [{UsuarioId:1,Adm:1}];
  if(q.includes('FROM Seguranca.SessaoWeb'))return [{V:1}];
  if(q.startsWith('SELECT CONVERT(varchar(23),SYSUTCDATETIME()'))return [{AgoraUtc:'2026-11-17T15:00:00.000',AgoraLocal:'2026-11-17T12:00:00'}];
  if(q.startsWith('SELECT f.DepositoId'))return [{DepositoId:1}];
  if(q.startsWith('SELECT DepositoId'))return [];
  if(q.startsWith('INSERT Operacao.TabletPC05(')){const hash=q.match(/,'([a-f0-9]{64})',CONVERT/)[1];const row={TabletId:next++,DepositoId:1,EmissorId:1,Falhas:0,ExpiraEmUtc:null,RevogadoEmUtc:null,AtivadoEmUtc:null,PareamentoExpiraEmUtc:'2026-11-17T15:05:00.000',hash};rows.push(row);return [{TabletId:row.TabletId}];}
  if(q.startsWith('SELECT TabletId FROM Operacao.TabletPC05')){const hash=q.match(/PareamentoHash='([a-f0-9]{64})'/)[1];return rows.filter(r=>r.hash===hash);}
  if(q.startsWith('SELECT t.TabletId')){const match=q.match(/PareamentoHash='([a-f0-9]{64})'/);const row=match?rows.find(r=>r.hash===match[1]):rows.find(r=>r.TabletId===Number(q.match(/t.TabletId=(\d+)/)[1]));return row?[{...row,PareamentoExpiraEmUtc:expired?'2026-11-17T14:59:00.000':row.PareamentoExpiraEmUtc}]:[];}
  if(q.startsWith('UPDATE Operacao.TabletPC05 SET SessaoHash=')){const row=rows.find(r=>r.TabletId===Number(q.match(/WHERE TabletId=(\d+)/)[1]));row.hash=null;row.AtivadoEmUtc='2026-11-17T15:00:00.000';}
  if(q.startsWith('UPDATE Operacao.TabletPC05 SET EmissorId=')){const row=rows.find(r=>r.TabletId===Number(q.match(/WHERE TabletId=(\d+)/)[1]));row.hash=q.match(/PareamentoHash='([a-f0-9]{64})'/)[1];row.AtivadoEmUtc=null;}
  return [];
 }};
 t.mock.method(odbc,'connect',async()=>db);const call=await server(t);
 const draws=[1234567,1234567,987654321,76543210,111222333,444555666];t.mock.method(crypto,'randomInt',()=>draws.shift()??999888777);
 const pair=await call('tablets',{nome:'Portaria',depositoId:1});assert.equal(pair.status,200);assert.equal(pair.data.pareamento,'001-234-567');assert.equal(pair.data.expiraEmUtc,'2026-11-17T15:05:00.000Z');
 const collision=await call('tablets',{nome:'Portaria 2',depositoId:1});assert.equal(collision.status,200);assert.equal(collision.data.pareamento,'987-654-321');assert.notEqual(rows[0].hash,crypto.createHash('sha256').update('001234567').digest('hex'));
 const active=await call('tablet/habilitar',{pareamento:'001-234-567'});assert.equal(active.status,200);assert.match(active.cookie,/jetta_pc05_tablet=[a-f0-9]{64};.*HttpOnly/);
 assert.equal((await call('tablet/habilitar',{pareamento:'001234567'})).status,401);
 const plain=await call('tablet/habilitar',{pareamento:'987654321'});assert.equal(plain.status,200);
 const fresh=await call('tablets',{nome:'Portaria 3',depositoId:1});const renewed=await call('tablets/'+fresh.data.tabletId+'/pareamento',{});assert.equal(renewed.status,200);assert.notEqual(renewed.data.pareamento,fresh.data.pareamento);assert.equal((await call('tablet/habilitar',{pareamento:fresh.data.pareamento})).status,401);
 expired=true;assert.equal((await call('tablet/habilitar',{pareamento:renewed.data.pareamento})).status,401);expired=false;
 const beforeInvalid=sql.length;for(const invalid of ['12345678','1234567890','001-23-4567','001 234 567','abc'])assert.equal((await call('tablet/habilitar',{pareamento:invalid})).status,401);assert.equal(sql.length,beforeInvalid);
 let collisions=0;t.mock.method(crypto,'randomInt',()=>{collisions++;return 111222333;});const beforeRows=rows.length;
 const exhausted=await call('tablets',{nome:'Não persistir',depositoId:1});assert.equal(exhausted.status,409);assert.equal(exhausted.data.erro,'OPERACAO_OCUPADA');assert.equal(collisions,10);assert.equal(rows.length,beforeRows);
 for(const command of sql)for(const raw of ['001234567','001-234-567','987654321','987-654-321'])assert.ok(!command.includes(raw),'Número puro não deve chegar ao SQL');
});

test('PC05: cinco tentativas por IP e limite global bloqueiam antes de consultar SQL',async t=>{
 let calls=0;t.mock.method(odbc,'connect',async()=>{calls++;throw Error('No pairing');});const call=await server(t);
 for(let i=0;i<5;i++)assert.notEqual((await call('tablet/habilitar',{pareamento:'123456789'},'198.51.100.1')).status,429);
 const before=calls;const limited=await call('tablet/habilitar',{pareamento:'123456789'},'198.51.100.1');assert.equal(limited.status,429);assert.equal(limited.data.erro,'TENTATIVAS_EXCEDIDAS');assert.equal(calls,before);
 for(let i=0;i<44;i++)assert.notEqual((await call('tablet/habilitar',{pareamento:'123456789'})).status,429);
 assert.equal((await call('tablet/habilitar',{pareamento:'123456789'})).status,429);
});
