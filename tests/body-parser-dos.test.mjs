import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {gzipSync,deflateSync} from 'node:zlib';
import {setTimeout as delay} from 'node:timers/promises';

// Isolate the real parser: an uncaught zlib error must fail this test, not its runner.
async function start(t){
 const entry=new URL('../src/server.js',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {createApp} from ${JSON.stringify(entry)};
  const cfg={host:'127.0.0.1',port:0,token:'seg01-test',mfaRequired:false};
  const app=createApp(cfg);
  const server=app.listen(0,'127.0.0.1',()=>{
   cfg.port=server.address().port;
   process.send({port:cfg.port,pid:process.pid});
  });
 `],{stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,NODE_ENV:'test'}});
 let errors='';child.stderr.on('data',chunk=>errors+=chunk);
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}});
 const ready=await Promise.race([
  once(child,'message').then(([value])=>value),
  once(child,'exit').then(([code])=>{throw Error(`Servidor encerrou (${code}): ${errors}`);}),
  delay(30000,undefined,{ref:false}).then(()=>{throw Error('Timeout ao iniciar servidor SEG-01');})
 ]);
 return {child,base:`http://127.0.0.1:${ready.port}`,port:ready.port,pid:ready.pid,errors:()=>errors};
}

async function healthy(server){
 assert.equal(server.child.exitCode,null,`Mesmo processo deve sobreviver: ${server.errors()}`);
 assert.equal(server.child.signalCode,null);
 assert.equal(server.child.pid,server.pid);
 const response=await fetch(server.base+'/api/health',{signal:AbortSignal.timeout(3000)});
 assert.equal(response.status,200);
 assert.equal((await response.json()).status,'UP');
}

test('SEG-01: anônimo não derruba createApp com bytes após gzip/deflate', {timeout:45000},async t=>{
 const server=await start(t);
 await healthy(server);
 for(const [encoding,compress] of [['gzip',gzipSync],['deflate',deflateSync]]){
  const first=Buffer.concat([compress('{"probe":true}'),Buffer.from([0])]);
  const trailing=Buffer.from('invalid-trailing-bytes');
  const socket=net.connect(server.port,'127.0.0.1');
  socket.on('error',()=>{}); // The peer may reset the malicious request; health decides survival.
  try{
   await once(socket,'connect');
   const response=once(socket,'data');
   socket.write(`POST /api/auth/me HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${first.length+trailing.length}\r\nConnection: keep-alive\r\n\r\n`);
   socket.write(first);
   const [data]=await Promise.race([response,delay(3000).then(()=>{throw Error('Parser não respondeu ao primeiro frame');})]);
   assert.match(data.toString(),/^HTTP\/1\.1 404/);
   socket.write(trailing);
   await delay(150);
   await healthy(server);
  }finally{socket.destroy();}
 }
});

test('SEG-01: JSON, compressão válida e recusas do parser preservados', {timeout:45000},async t=>{
 const server=await start(t);
 for(const [encoding,compress] of [['identity',x=>Buffer.from(x)],['gzip',gzipSync],['deflate',deflateSync]]){
  const response=await fetch(server.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':encoding,Origin:server.base,'X-Jetta-Request':'web'},body:compress('{}'),signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,400);
  assert.equal((await response.json()).erro,'Dados invalidos');
 }
 for(const [body,status] of [[gzipSync('{'),400],[Buffer.from('not-gzip'),400],[gzipSync(JSON.stringify({value:'x'.repeat(9000)})),413]]){
  const response=await fetch(server.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body,signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,status);
  await response.arrayBuffer();
  await healthy(server);
 }
});

