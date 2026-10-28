import fs from 'node:fs';import assert from 'node:assert/strict';
import {makeB3Lab} from './b3-lab.mjs';import {withDb} from '../src/auth-db.js';import {safeSqlErrors} from '../src/observability.js';
if(process.env.UV_THREADPOOL_SIZE!=='4')throw Error('Reproduction requires isolated child UV_THREADPOOL_SIZE=4');
const lab=await makeB3Lab({b33:true}),user=await lab.user(),trace=[];
const report={node:process.version,workers:4,lockTimeoutMs:1200,database:lab.database,principalAccesses:0,cleaned:false};
try{
 const cfg={...lab.cfg,observe:e=>trace.push(e)};
 let release,held;const signal=new Promise(r=>held=r),unhold=new Promise(r=>release=r);
 const holder=withDb(cfg,async db=>{await db.beginTransaction();await db.query(`UPDATE Seguranca.Usuario SET Nome=Nome WHERE UsuarioId=${user.id}`);held();await unhold;const start=performance.now();await db.commit();return performance.now()-start;});
 await signal;
 let started=0,allStarted;const submitted=new Promise(r=>allStarted=r);cfg.observe=e=>{trace.push(e);if(e.event==='sql.begin'&&e.stage==='SQL_READ'&&++started===4)allStarted();};
 const readers=Array.from({length:4},()=>withDb(cfg,async db=>{await db.query('SET LOCK_TIMEOUT 1200');return db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE UsuarioId=${user.id}`);}).then(()=>({ok:true}),e=>({ok:false,errors:safeSqlErrors(e)})));
 await submitted;await new Promise(r=>setTimeout(r,100));release();
 report.commitDurationMs=Math.round(await holder);report.readers=await Promise.all(readers);
 assert.ok(report.readers.every(r=>r.ok));
 report.hypothesis='Worker starvation not reproduced; no mitigation justified by this experiment';
 console.log(JSON.stringify(report));
}finally{await lab.close();report.cleaned=true;fs.mkdirSync('docs/b3-4',{recursive:true});fs.writeFileSync('docs/b3-4/starvation-before.json',JSON.stringify({report,trace},null,2)+'\n');}
