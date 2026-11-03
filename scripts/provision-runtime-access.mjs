import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectPilot} from '../pilot-local/database.mjs';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {verifyPilotDatabase} from '../src/pilot-target.js';
import {runtimeGrantsSql,windowsPrincipal} from '../src/sql-runtime.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'secrets/pilot-local');
const config=JSON.parse(fs.readFileSync(path.join(dir,'runtime.json'),'utf8')),cfg=pilotConfig(config);
const pending=JSON.parse(fs.readFileSync(path.join(dir,'launcher/pending-identity.json'),'utf8').replace(/^\uFEFF/,''));
const principal=windowsPrincipal(pending.principal);
if(!principal.toLowerCase().startsWith(process.env.COMPUTERNAME.toLowerCase()+'\\')||!/^S-1-5-21-(?:\d+-){3}\d+$/.test(pending.sid||''))throw Error('Conta Windows local inválida');
const quote=value=>'['+value.replaceAll(']',']]')+']',text=value=>"N'"+value.replaceAll("'","''")+"'";
const db=await connectPilot(cfg.database,cfg.server);
try{
 await verifyPilotDatabase(cfg,db);
 const unsafe=(await db.query(`SELECT SUSER_ID(${text(principal)}) LoginId`))[0];
 if(unsafe.LoginId!==null)throw Error('Login Windows já existe; nenhum privilégio foi alterado. Revise a instalação parcial.');
 await db.beginTransaction();
 try{
  await db.query(`CREATE LOGIN ${quote(principal)} FROM WINDOWS WITH DEFAULT_DATABASE=${quote(cfg.database)};`);
  await db.query(runtimeGrantsSql(principal));
  await db.commit();
 }catch(error){await db.rollback();throw error;}
 fs.writeFileSync(path.join(dir,'runtime-identity.json'),JSON.stringify({...pending,status:'PROVISIONED',createdUtc:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'SQL_RUNTIME_PROVISIONED',database:cfg.database,privilegeScope:'DML_EXECUTE_SCHEMAS',serverRolesGranted:0}));
}finally{await db.close();}
