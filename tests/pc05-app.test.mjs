import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {createApp} from '../src/server.js';

test('PC05 integrado ao app: tablet isolado passa pelos gates corretos e flag preserva legado',async t=>{
 const names=['JETTA_MFA_KEY_HEX','JETTA_MFA_REQUIRE_PRIVILEGED','JETTA_MFA_ENFORCE_CRITICAL'],old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 process.env.JETTA_MFA_KEY_HEX='a'.repeat(64);process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';process.env.JETTA_MFA_ENFORCE_CRITICAL='true';
 t.after(()=>{for(const k of names)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});
 const mock=t.mock.method(odbc,'connect',async()=>({query:async q=>q.startsWith('DECLARE @r')?[{R:0}]:q.startsWith('SELECT CONVERT(varchar(23),SYSUTCDATETIME()')?[{AgoraUtc:'2026-10-28T15:00:00.000',AgoraLocal:'2026-10-28T12:00:00'}]:[],beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
 t.after(()=>mock.mock.restore());
 for(const active of [true,false]){
  const cfg={host:'127.0.0.1',port:0,token:'c'.repeat(64),pc01:true,pc02:true,pc03:true,pc04:true,pc05:active};
  const server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));cfg.port=server.address().port;
  try{
   const base=`http://127.0.0.1:${cfg.port}`,html=await (await fetch(base+'/tablet.html')).text();
   assert.ok(html.includes(active?'/tablet-pc05.js':'/tablet.js'));
   if(!active){assert.equal((await fetch(base+'/api/pc05/status')).status,401);continue;}
   const denied=await fetch(base+'/api/pc05/tablet/status');assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{erro:'AUTORIZACAO_TABLET_INVALIDA'});
   const management=await fetch(base+'/api/pc05/tablets');assert.equal(management.status,401);
   const forged=await fetch(base+'/api/pc05/tablet/habilitar',{method:'POST',headers:{Origin:'http://forged.test','content-type':'application/json','x-jetta-request':'web'},body:JSON.stringify({pareamento:'a'.repeat(64)})});assert.equal(forged.status,403);
   const mixed=await fetch(base+'/api/pc05/tablet/status',{headers:{cookie:'jetta_session='+'a'.repeat(64)}});assert.equal(mixed.status,403);assert.equal((await mixed.json()).erro,'UTILIZE_PERFIL_EXCLUSIVO_TABLET');
  }finally{await new Promise(r=>server.close(r));}
 }
});
