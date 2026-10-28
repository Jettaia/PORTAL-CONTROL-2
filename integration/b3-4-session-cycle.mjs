import fs from 'node:fs';import assert from 'node:assert/strict';
import {fixture} from './b3-3-fixture.mjs';import {createApp} from '../src/server.js';import {connect} from './b3-lab.mjs';
const revoked=process.argv.includes('--revoke');
const fixed=process.argv.includes('--fixed'),run=process.argv.find(a=>/^--run=[123]$/.test(a))?.slice(-1);
const trace=[],f=await fixture({b34:fixed,observe:e=>trace.push(e)}),{lab,g}=f;
const server=createApp(lab.cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));lab.cfg.port=server.address().port;
const control=await connect(lab.database),report={database:lab.database,principalAccesses:0,fixed,revoked,cleaned:false,waits:[]};
try{
 await control.query('SET DEADLOCK_PRIORITY HIGH');await control.beginTransaction();await control.query(`UPDATE Seguranca.Usuario SET Nome=Nome WHERE UsuarioId=${g.id}`);
 const pending=fetch('http://127.0.0.1:'+lab.cfg.port+'/api/auth/me',{headers:{Cookie:'jetta_session='+g.token}});
 for(let i=0;i<30;i++){const rows=await lab.db.query('SELECT session_id,blocking_session_id,wait_type,wait_time FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND blocking_session_id>0');report.waits.push(...rows);if(rows.length)break;await new Promise(r=>setTimeout(r,50));}
 const start=performance.now();await control.query(`UPDATE Seguranca.SessaoWeb SET ${revoked?'RevogadoEmUtc=SYSUTCDATETIME()':'ExpiraEmUtc=ExpiraEmUtc'} WHERE UsuarioId=${g.id}`);await control.commit();
 const response=await pending;report.status=response.status;report.durationMs=Math.round(performance.now()-start);report.nativeErrors=trace.flatMap(e=>e.errors||[]);report.correlation=response.headers.get('X-Jetta-Correlation');
 assert.equal(report.status,fixed?(revoked?401:200):503);assert.equal(report.nativeErrors.some(e=>e.code===1205),!fixed);console.log(JSON.stringify(report));
}finally{try{await control.rollback();}catch{}await control.close();server.closeAllConnections();await new Promise(r=>server.close(r));await lab.close();report.cleaned=true;fs.mkdirSync('docs/b3-4',{recursive:true});fs.writeFileSync('docs/b3-4/session-cycle-'+(fixed?'after'+(revoked?'-revoke':run?'-'+run:''):'before')+'.json',JSON.stringify({report,trace},null,2)+'\n');}
