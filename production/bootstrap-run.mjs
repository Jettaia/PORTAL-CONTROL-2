// One-time deployment bootstrap; never starts HTTP and never drops a database.
import fs from 'node:fs';
import odbc from 'odbc';
import {seedNewChapa} from './bootstrap.mjs';
import {productionConfig} from './config.mjs';
import {connectionString,withDb} from '../src/auth-db.js';
if(!process.argv.includes('--new-empty-chapa'))throw Error('Explicit new deployment flag required');
const input=JSON.parse(fs.readFileSync('/run/bootstrap/bootstrap.json','utf8'));
const cfg=productionConfig(input.runtime);
const adminCfg={...cfg,sqlAuth:{user:'sa',password:input.saPassword}};
const master=await odbc.connect(connectionString({...adminCfg,database:'master'}));
try{
 const edition=String((await master.query("SELECT SERVERPROPERTY('Edition') E"))[0].E);
 if(!edition.includes('Express'))throw Error('Only licensed Express deployment accepted');
 if((await master.query("SELECT DB_ID('JETTA_CONTROL_PILOTO_LOCAL') D"))[0].D!==null)throw Error('Destination already exists; refusing overwrite');
 await master.query('CREATE DATABASE [JETTA_CONTROL_PILOTO_LOCAL]');
}finally{await master.close();}
const db=await odbc.connect(connectionString(adminCfg));
try{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');
 const result=await seedNewChapa(db,{pilotInstance:cfg.pilotInstance,admin:input.admin});
 const literal=v=>"N'"+v.replaceAll("'","''")+"'";
 await db.query(`CREATE LOGIN [JettaChapaRuntime] WITH PASSWORD=${literal(cfg.sqlAuth.password)},CHECK_POLICY=ON,CHECK_EXPIRATION=OFF;CREATE USER [JettaChapaRuntime] FOR LOGIN [JettaChapaRuntime];CREATE ROLE [JettaPortalRuntime] AUTHORIZATION dbo;GRANT CONNECT TO [JettaChapaRuntime];ALTER ROLE [JettaPortalRuntime] ADD MEMBER [JettaChapaRuntime];`);
 for(const schema of ['Cadastro','Seguranca','Operacao','Financeiro'])await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE,EXECUTE ON SCHEMA::[${schema}] TO [JettaPortalRuntime];`);
 await withDb(cfg,async restricted=>{
  const spid=Number((await restricted.query("SELECT @@SPID Id"))[0].Id);
  const row=(await db.query(`SELECT encrypt_option E FROM sys.dm_exec_connections WHERE session_id=${spid}`))[0];
  if(row?.E!=='TRUE')throw Error('SQL connection encryption not confirmed');
 });
 console.log(JSON.stringify({...result,sqlTlsValidated:true,runtimePrivilegesRestricted:true}));
}finally{await db.close();}
