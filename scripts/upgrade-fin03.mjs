// Explicit additive FIN03 upgrade; preserves every existing row and column value.
if(process.env.JETTA_FIN03_UPGRADE!=='YES')throw Error('Defina JETTA_FIN03_UPGRADE=YES para atualização local de baixas');
import fs from 'node:fs';
import net from 'node:net';
import assert from 'node:assert/strict';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {backupAndVerify,snapshot} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8')),cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Instancia local obrigatoria');
const listening=await new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port:cfg.port});socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',e=>e.code==='ECONNREFUSED'?resolve(false):reject(e));socket.once('timeout',()=>{socket.destroy();reject(Error('Confirme encerramento do piloto'));});});
if(listening)throw Error('Encerre o piloto antes da atualizacao');
await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;assert.equal(marker,cfg.pilotInstance);
 const before=await snapshot(db);
 await db.beginTransaction();try{
  const sql=fs.readFileSync(new URL('../pilot-local/fin03-payments.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  const after=await snapshot(db),map=new Map(after.map(t=>[t.table,t]));
  for(const table of before){assert.equal(map.get(table.table)?.rows,table.rows,'Linhas preservadas: '+table.table);assert.equal(map.get(table.table).sha256,table.sha256,'Conteudo preservado: '+table.table);}
  await db.commit();console.log(JSON.stringify({status:'PASS',tablesPreserved:before.length,backupVerified:true,individualSettlements:true}));
 }catch(e){try{await db.rollback();}catch{}throw e;}
}finally{await db.close();}
