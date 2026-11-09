import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {receiptUploadBody} from '../src/receipt-upload.js';

test('large upload authorizes before parsing and bounds simultaneous bodies',async()=>{
 const app=express();let release,entered;
 const held=new Promise(r=>entered=r);
 app.post('/upload',...receiptUploadBody({sameOrigin:(_q,_s,next)=>next(),session:(q,s,next)=>q.headers.authorization?next():s.status(401).end(),authorize:async q=>{if(q.headers.authorization!=='finance')throw Object.assign(Error('PERMISSAO_NEGADA'),{status:403});}}),async(q,s)=>{
  if(q.body.hold){entered();await new Promise(r=>release=r);}
  s.json({length:q.body.data?.length||0});
 });
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/upload`;
 const send=(body,authorization)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{authorization}:{})},body});
 try{
  assert.equal((await send('{invalid')).status,401);
  assert.equal((await send('{invalid','reader')).status,403);
  const pending=send(JSON.stringify({data:'x'.repeat(16*1024*1024),hold:true}),'finance');
  await held;assert.equal((await send('{invalid','finance')).status,409);
  release();const result=await pending;assert.equal(result.status,200);assert.equal((await result.json()).length,16*1024*1024);
  assert.equal((await send('{}','finance')).status,200);
 }finally{release?.();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
