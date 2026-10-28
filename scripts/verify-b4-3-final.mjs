import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {connect,safeName} from '../integration/b3-lab.mjs';
if(process.env.JETTA_B3_RUN_SQL_TESTS!=='YES'||!process.env.JETTA_PLAYWRIGHT_ROOT)throw Error('Somente laboratorio autorizado');
const gate=JSON.parse(fs.readFileSync('docs/b4-3/gate-run.json','utf8'));
if(!['PASS_LAB_NOT_DEPLOYED','PASS_LAB_WITH_REEXECUTION'].includes(gate.status)||gate.steps.length!==20||gate.steps.some(s=>s.exitCode!==0))throw Error('Gate integral pendente');
for(const flag of ['JETTA_B43_EVIDENCE','JETTA_B42_EVIDENCE','JETTA_B41_EVIDENCE','JETTA_B34_EVIDENCE'])process.env[flag]='YES';
const report={utc:new Date().toISOString(),reason:'Revalidacao da resposta idempotente com dados posteriores e ajuste visual; isolamento e integridade finais',principalAccesses:0,steps:[]};
for(const[name,args]of [['sql',['--test','integration/b4-3.integration.mjs']],['ui',['integration/b4-3.visual.mjs']],['syntax',['scripts/check-all.mjs']]]){
 const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:50*1024*1024}),output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync('docs/b4-3/final-'+name+'.txt',output);process.stdout.write(output);report.steps.push({name,exitCode:r.status,pass:Number(output.match(/\bpass (\d+)/)?.[1]||[...output.matchAll(/^VISUAL PASS:/gm)].length)});
 if(r.error||r.status!==0){report.status='FAIL';fs.writeFileSync('docs/b4-3/final-validation.json',JSON.stringify(report,null,2)+'\n');process.exit(r.status||1);}
}
const names=new Set();function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.json'))for(const m of fs.readFileSync(p,'utf8').matchAll(/JETTA_CONTROL_B3_TEST_[a-f0-9]{12}/g))names.add(m[0]);}}scan('docs/b4-3');
const master=await connect('master');try{report.laboratories=[];for(const database of names){if(!safeName(database))throw Error('Nome recusado');const absent=(await master.query(`SELECT DB_ID('${database}') D`))[0].D==null;report.laboratories.push({database,removed:absent});if(!absent)throw Error('Laboratorio residual identificado');}}finally{await master.close();}
const files=['package.json','package-lock.json'];function sources(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.posix.join(dir,e.name);if(e.isDirectory())sources(file);else if(e.isFile())files.push(file);}}for(const root of ['src','public','integration','scripts','tests','sql'])sources(root);
const manifest={utc:new Date().toISOString(),version:'4.0.0-b4.3.lab.1',base:'dd099d4',branch:'codex/b4-3-fechamento',files:files.sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/b4-3/source-integrity.json',JSON.stringify(manifest,null,2)+'\n');report.sealedFiles=manifest.files.length;report.gateUtc=gate.utc;report.gateStatus=gate.status;report.deployed=false;report.status=gate.status;fs.writeFileSync('docs/b4-3/final-validation.json',JSON.stringify(report,null,2)+'\n');
