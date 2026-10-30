// User-authorized local reset. Refuses to run without an explicit CLI operation.
import fs from 'node:fs';
import net from 'node:net';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
import {backupAndVerify} from '../pilot-local/recovery.mjs';
import {targetGuard} from '../pilot-local/build-schema.mjs';
import {resetPilotData} from '../pilot-local/depot-reset.mjs';
if(!process.argv.includes('--reset-data-preserve-admin'))throw Error('Operacao explicita --reset-data-preserve-admin obrigatoria');
const privateConfig=JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8')),cfg=pilotConfig(privateConfig);
if(!/^(localhost|\.)(\\[A-Za-z0-9_]+)?$/.test(cfg.server))throw Error('Instancia local obrigatoria');
const listening=await new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port:cfg.port});socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',e=>e.code==='ECONNREFUSED'?resolve(false):reject(e));socket.once('timeout',()=>{socket.destroy();reject(Error('Nao foi possivel confirmar encerramento do piloto'));});});
if(listening)throw Error('Encerre o piloto antes da manutencao');
await backupAndVerify(privateConfig);
const db=await connectPilot(cfg.database,cfg.server);
try{
 await db.beginTransaction();
 try{
  const result=await resetPilotData(db,{preserveEmail:'guilherme.ribeiro@jettatransportes.com.br',pilotInstance:cfg.pilotInstance});
  const sql=fs.readFileSync(new URL('../pilot-local/depot-model.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
  for(const batch of sql.split(/^\s*GO\s*$/im).filter(s=>s.trim()))await db.query(batch);
  if(Number((await db.query("SELECT COUNT(*) N FROM sys.tables WHERE name='Filial'"))[0].N)!==0)throw Error('Entidade antiga ainda presente');
  await db.commit();console.log(JSON.stringify({status:'PASS',...result,model:'DEPOSITO',backupVerified:true}));
 }catch(e){try{await db.rollback();}catch{}throw e;}
}finally{await db.close();}
