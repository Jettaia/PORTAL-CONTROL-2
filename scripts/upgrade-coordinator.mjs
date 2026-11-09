// Local-only additive upgrade. Stop runtime, verify backup and preserve existing rows.
import fs from 'node:fs';
import net from 'node:net';
import assert from 'node:assert/strict';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {backupAndVerify,snapshot} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8')),cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Instância local obrigatória');
const listening=await new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port:cfg.port});socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',e=>e.code==='ECONNREFUSED'?resolve(false):reject(e));socket.once('timeout',()=>{socket.destroy();reject(Error('Confirme encerramento do piloto'));});});
if(listening)throw Error('Encerre o piloto antes da atualização');
await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 assert.equal((await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V,cfg.pilotInstance);
 await db.beginTransaction();try{
  await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC01.Usuarios',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;IF @r<0 THROW 55980,N'Usuários ocupados',1;");
  const before=await snapshot(db),catalog=await db.query("SELECT PerfilId,Codigo,Nome,Sistema,Ativo FROM Seguranca.PerfilAcesso WHERE Codigo<>'PC01_COORDENADOR' ORDER BY PerfilId");
  const sql=fs.readFileSync(new URL('../pilot-local/coordinator-access.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  const after=new Map((await snapshot(db)).map(t=>[t.table,t]));
  for(const table of before)if(table.table!=='Seguranca.PerfilAcesso')assert.deepEqual(after.get(table.table),table,'Tabela preservada: '+table.table);
  assert.deepEqual(await db.query("SELECT PerfilId,Codigo,Nome,Sistema,Ativo FROM Seguranca.PerfilAcesso WHERE Codigo<>'PC01_COORDENADOR' ORDER BY PerfilId"),catalog);
  assert.equal(Number((await db.query("SELECT COUNT(*) N FROM Seguranca.PerfilAcesso WHERE Codigo='PC01_COORDENADOR' AND Ativo=1"))[0].N),1);
  await db.commit();console.log(JSON.stringify({status:'PASS',backupVerified:true,tablesPreserved:before.length,coordinatorReady:true}));
 }catch(e){try{await db.rollback();}catch{}throw e;}
}finally{await db.close();}
