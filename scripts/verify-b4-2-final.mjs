import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {connect,safeName} from '../integration/b3-lab.mjs';
if(process.env.JETTA_B3_RUN_SQL_TESTS!=='YES'||!process.env.JETTA_PLAYWRIGHT_ROOT)throw Error('Somente laboratorio autorizado');
process.env.JETTA_B42_EVIDENCE='YES';process.env.JETTA_B41_EVIDENCE='YES';process.env.JETTA_B34_EVIDENCE='YES';
const isolationOnly=process.argv.includes('--isolation-only');
const report={utc:new Date().toISOString(),reason:isolationOnly?'Encerramento do gate integral sem repetir suites aprovadas':'Auditoria da aprovacao, revogacao concorrente, expiracao e negativa HTTP de aplicacao; verificacao final',steps:[]};
if(isolationOnly){const gate=JSON.parse(fs.readFileSync('docs/b4-2/gate-run.json','utf8'));if(gate.status!=='PASS_LAB_NOT_DEPLOYED'||gate.steps.length!==17||gate.steps.some(s=>s.exitCode!==0))throw Error('Gate integral ainda nao aprovado');report.steps=gate.steps;report.gateUtc=gate.utc;}
if(!isolationOnly)for(const[name,args]of [['sql',['--test','integration/b4-2.integration.mjs']],['ui',['integration/b4-2.visual.mjs']],['syntax',['scripts/check-all.mjs']]]){
 const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:50*1024*1024}),output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync('docs/b4-2/final-'+name+'.txt',output);process.stdout.write(output);report.steps.push({name,exitCode:r.status,pass:Number(output.match(/\bpass (\d+)/)?.[1]||[...output.matchAll(/^VISUAL PASS:/gm)].length)});
 if(r.error||r.status!==0){report.status='FAIL';fs.writeFileSync('docs/b4-2/final-validation.json',JSON.stringify(report,null,2)+'\n');process.exit(r.status||1);}
}
const names=new Set();function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.json'))for(const m of fs.readFileSync(p,'utf8').matchAll(/JETTA_CONTROL_B3_TEST_[a-f0-9]{12}/g))names.add(m[0]);}}scan('docs/b4-2');
const master=await connect('master');try{report.laboratories=[];for(const database of names){if(!safeName(database))throw Error('Nome recusado');const absent=(await master.query(`SELECT DB_ID('${database}') D`))[0].D==null;report.laboratories.push({database,removed:absent});if(!absent)throw Error('Laboratorio residual identificado');}}finally{await master.close();}
report.status='PASS_LAB_NOT_DEPLOYED';report.principalAccesses=0;fs.writeFileSync('docs/b4-2/final-validation.json',JSON.stringify(report,null,2)+'\n');
