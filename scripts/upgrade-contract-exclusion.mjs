// Additive contract-exclusion migration; preserves every existing row. May run online under the PC04 lock.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {backupAndVerify,snapshot} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8')),cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Instancia local obrigatoria');
await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;assert.equal(marker,cfg.pilotInstance);
 await db.query('SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
 await db.beginTransaction();try{
  const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];assert.ok(lock&&Number(lock.R)>=0,'Contratações ocupadas');
  const before=await snapshot(db);
  const sql=fs.readFileSync(new URL('../pilot-local/contract-exclusion.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  const after=new Map((await snapshot(db)).map(t=>[t.table,t]));for(const table of before)assert.deepEqual(after.get(table.table),table,'Tabela preservada: '+table.table);
  await db.commit();console.log(JSON.stringify({status:'PASS',contractExclusionReady:true,tablesPreserved:before.length,backupVerified:true}));
 }catch(e){try{await db.rollback();}catch{}throw e;}
}finally{await db.close();}
