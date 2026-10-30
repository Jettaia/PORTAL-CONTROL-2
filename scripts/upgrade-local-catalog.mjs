// Explicit, idempotent canonical-depot upgrade. Never clears business data.
import fs from 'node:fs';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {backupAndVerify} from '../pilot-local/recovery.mjs';
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8'));
const cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Servidor local obrigatório');
await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;
 if(marker!==cfg.pilotInstance)throw Error('Identidade do piloto divergente');
 await db.beginTransaction();
 try{
  const fields=fs.readFileSync(new URL('../pilot-local/depot-model.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(const batch of fields.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  await db.commit();console.log('Upgrade local PASS: modelo de depósitos atualizado; backup verificado.');
 }catch(e){await db.rollback();throw e;}
}finally{await db.close();}
