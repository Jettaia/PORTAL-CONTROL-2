import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import odbc from 'odbc';

// Read-only preparation. This script cannot install, migrate, start or erase a database.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plan=JSON.parse(fs.readFileSync(path.join(root,'pilot-local/plan.json'),'utf8'));
if(plan.host!=='127.0.0.1'||plan.database!=='JETTA_CONTROL_PILOTO_LOCAL'||plan.finance!=='SIMULADO')throw Error('Plano local divergente');
const inputs=['src/config.js','src/b4-codes.js','src/db.js','scripts/demo-final-lab.mjs',
 'integration/b3-common.sql','integration/b3-rbac.sql','integration/b3-operation.sql',
 'integration/b3-mfa.sql','integration/b3-2-patch.sql','integration/b3-3-availability.sql',
 'integration/b3-3-patch.sql','integration/b4-1-schema.sql','integration/b4-2-schema.sql',
 'integration/b4-3-schema.sql','integration/b5-1-schema.sql','integration/b5-2-schema.sql',
 'integration/b5-2a-schema.sql','integration/b5-2b-schema.sql','integration/b5-2c-schema.sql',
 'integration/b5-3-f01-schema.sql','integration/b5-3-f03-schema.sql',
 'integration/final-lab-schema.sql','integration/final-lab-admin.sql','integration/b6-1-uat-cadastro.sql'];
const report={utc:new Date().toISOString(),kind:'READ_ONLY_INSTALLATION_ASSESSMENT',
 status:'NOT_READY_FOR_REAL_DATA',plan,principalDatabaseAccesses:0,databaseWrites:0,
 inputs:inputs.map(relative=>{const bytes=fs.readFileSync(path.join(root,relative));const source=bytes.toString('utf8');return {path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),databaseGuardLines:source.split(/\r?\n/).flatMap((line,i)=>/DB_NAME\(\)|SOMENTE_LABORATORIO|database!==|banco esperado/.test(line)?[i+1]:[])};}),
 blockers:[]};
const required=['pilot-local/runtime-config.mjs','pilot-local/database.mjs','pilot-local/install.mjs','pilot-local/start.mjs','pilot-local/recovery.mjs','pilot-local/setup.html','src/pilot-target.js'];
report.components=required.map(file=>({path:file,present:fs.existsSync(path.join(root,file))}));
if(report.components.some(item=>!item.present))report.blockers.push('Componentes do piloto ausentes');
const releaseFile=path.join(root,'pilot-local/release.json');const release=fs.existsSync(releaseFile)?JSON.parse(fs.readFileSync(releaseFile,'utf8')):null;report.releaseStatus=release?.status||'NOT_PREPARED';
if(release?.status!=='READY_FOR_INITIAL_SETUP')report.blockers.push('Candidata ainda em validacao: regressao e recuperacao devem estar aprovadas');
report.privateConfigurationPresent=fs.existsSync(path.join(root,'secrets/pilot-local/runtime.json'));
if(!report.privateConfigurationPresent)report.blockers.push('Instalacao persistente ainda nao executada');
const manifestPath=path.join(root,'pilot-local/sql/manifest.json');if(fs.existsSync(manifestPath)){const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));report.pilotMigrations=manifest.files.length;for(const file of manifest.files){const bytes=fs.readFileSync(path.join(root,'pilot-local/sql',file.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)report.blockers.push('Integridade da migracao divergente: '+file.file);}}else report.blockers.push('Manifesto de migracoes ausente');

if(process.argv.includes('--sql-readonly')){
 const connection=await odbc.connect(`Driver={ODBC Driver 18 for SQL Server};Server=Ferretti\\SQLEXPRESS;Database=master;Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;Connection Timeout=8;`);
 try{const row=(await connection.query("SELECT CONVERT(varchar(128),SERVERPROPERTY('ServerName')) ServerName,CONVERT(varchar(128),SERVERPROPERTY('ProductVersion')) ProductVersion,CASE WHEN DB_ID('JETTA_CONTROL_PILOTO_LOCAL') IS NULL THEN 0 ELSE 1 END PilotDatabaseExists"))[0];report.sql={connectedDatabase:'master',server:row.ServerName,productVersion:row.ProductVersion,pilotDatabaseExists:Number(row.PilotDatabaseExists)===1};}
 finally{await connection.close();}
}
if(report.sql&&!report.sql.pilotDatabaseExists)report.blockers.push('Banco persistente separado ainda nao existe');
report.status=report.blockers.length?'NOT_READY_FOR_REAL_DATA':'READY_FOR_USER_SETUP';
const output=path.join(root,'pilot-local/installation-assessment.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,inputs:report.inputs.length,blockers:report.blockers.length,sql:report.sql,report:output}));
