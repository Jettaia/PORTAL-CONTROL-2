// HTTP-only entry point. Backup, schema changes and account provisioning run elsewhere.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pilotConfig,assertFinanceReady,assertContractExclusionReady} from './runtime-config.mjs';
import {createPilotApp} from './app.mjs';
import {withDb} from '../src/auth-db.js';
import {windowsPrincipal} from '../src/sql-runtime.js';
import {assertPrivateIsolation} from './private-isolation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const privateDir=path.join(root,'secrets/pilot-local');
const identity=JSON.parse(fs.readFileSync(path.join(privateDir,'runtime-identity.json'),'utf8'));
if(identity.status!=='PROVISIONED'||!/^S-1-5-21-(?:\d+-){3}\d+$/.test(identity.sid||''))throw Error('Identidade Windows restrita não provisionada');
const privateConfig=JSON.parse(fs.readFileSync(path.join(privateDir,'runtime.json'),'utf8'));
const cfg={...pilotConfig(privateConfig),sqlRuntimePrincipal:windowsPrincipal(identity.principal)};
process.env.JETTA_MFA_KEY_HEX=privateConfig.mfaKey;
process.env.JETTA_MFA_ENFORCE_CRITICAL='true';process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';
await withDb(cfg,async db=>{
 await assertFinanceReady(cfg,db);
 await assertContractExclusionReady(cfg,db);
 if(cfg.pc04&&!(await db.query("SELECT 1 V FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.Contratacao') AND name='UQ_PC04_DepositoNumero'")).length)throw Error('Numeração pendente; execute o upgrade administrativo com o piloto encerrado.');
});
// Fail closed if runtime ACLs accidentally expose launcher credentials or administrator data.
assertPrivateIsolation(privateDir);
const state=path.join(privateDir,'runtime-state'),stopFile=path.join(state,'encerrar.sinal');
if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);
const server=createPilotApp(cfg).listen(cfg.port,cfg.host);
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
fs.writeFileSync(path.join(state,'session.json'),JSON.stringify({pid:process.pid,url:`http://${cfg.host}:${cfg.port}/`,startedUtc:new Date().toISOString(),restricted:true})+'\n');
let stopping=false;
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);await new Promise(resolve=>server.close(resolve));console.log('HTTP restrito encerrado; backup pertence ao launcher administrativo.');}
const timer=setInterval(()=>{if(fs.existsSync(stopFile)){fs.unlinkSync(stopFile);stop().catch(()=>{process.exitCode=1;});}},1000);
process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log(`Piloto HTTP restrito: http://${cfg.host}:${cfg.port}/`);
