import fs from 'node:fs';
import path from 'node:path';
import {productionConfig} from './config.mjs';
import {createProductionApp} from './app.mjs';
import {withDb} from '../src/auth-db.js';
import {assertFinanceReady,assertContractExclusionReady} from '../pilot-local/runtime-config.mjs';

const privateConfig=JSON.parse(fs.readFileSync(process.env.CHAPA_CONFIG||'/run/secrets/chapa-runtime.json','utf8'));
const cfg={...productionConfig(privateConfig),publicRoot:path.resolve(process.env.CHAPA_PUBLIC_ROOT||'/app/chapa-public')};
if(!fs.existsSync(path.join(cfg.publicRoot,'index.html')))throw Error('Assets de produção não preparados');
await withDb(cfg,async db=>{
 await assertFinanceReady(cfg,db);
 await assertContractExclusionReady(cfg,db);
 const numbering=await db.query("SELECT 1 V FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.Contratacao') AND name='UQ_PC04_DepositoNumero'");
 if(!numbering.length)throw Error('Schema de produção incompleto');
});
const server=createProductionApp(cfg).listen(cfg.port,'0.0.0.0');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
console.log('Portal Control: runtime de produção iniciado');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),20000).unref();});
