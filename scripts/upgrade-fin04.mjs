// Explicit local FIN04 data reset. No deploy; the caller must explicitly opt in.
if(process.env.JETTA_FIN04_UPGRADE!=='YES')throw Error('Defina JETTA_FIN04_UPGRADE=YES para o reset FIN04 local');
import fs from 'node:fs';
import net from 'node:net';
import assert from 'node:assert/strict';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {backupAndVerify} from '../pilot-local/recovery.mjs';
import {resetFin04} from '../pilot-local/fin04-reset.mjs';
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8'));
const cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Instancia local obrigatoria');
const listening=await new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port:cfg.port});socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',e=>e.code==='ECONNREFUSED'?resolve(false):reject(e));socket.once('timeout',()=>{socket.destroy();reject(Error('Confirme encerramento do piloto'));});});
if(listening)throw Error('Encerre o piloto antes do reset FIN04');
const backup=await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;
 assert.equal(marker,cfg.pilotInstance,'Identidade do banco divergente');
 await db.beginTransaction();try{
  const result=await resetFin04(db);
  await db.commit();
  console.log(JSON.stringify({status:'PASS',backup:backup.file,backupVerified:backup.verifyOnly==='PASS',...result}));
 }catch(error){try{await db.rollback();}catch{}throw error;}
}finally{await db.close();}
