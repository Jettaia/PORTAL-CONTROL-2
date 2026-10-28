import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {connect,safeName} from '../integration/b3-lab.mjs';
if(process.env.JETTA_B3_RUN_SQL_TESTS!=='YES'||!process.env.JETTA_PLAYWRIGHT_ROOT)throw Error('Somente laboratorio autorizado');
process.env.JETTA_B41_EVIDENCE='YES';process.env.JETTA_B34_EVIDENCE='YES';
const report={utc:new Date().toISOString(),reason:'Negativa adicional de fator/permissao e revisao final de limpeza da interface',steps:[]};
for(const[name,args]of [['sql',['--test','integration/b4-1.integration.mjs']],['ui',['integration/b4-1.visual.mjs']],['syntax',['scripts/check-all.mjs']]]){
 const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:50*1024*1024}),output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync('docs/b4-1/final-'+name+'.txt',output);process.stdout.write(output);report.steps.push({name,exitCode:r.status,pass:Number(output.match(/\bpass (\d+)/)?.[1]||[...output.matchAll(/^VISUAL PASS:/gm)].length)});
 if(r.error||r.status!==0){report.status='FAIL';fs.writeFileSync('docs/b4-1/final-validation.json',JSON.stringify(report,null,2)+'\n');process.exit(r.status||1);}
}
const names=new Set();function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(p.endsWith('.json'))for(const m of fs.readFileSync(p,'utf8').matchAll(/JETTA_CONTROL_B3_TEST_[a-f0-9]{12}/g))names.add(m[0]);}}scan('docs/b4-1');
const master=await connect('master');try{report.laboratories=[];for(const database of names){if(!safeName(database))throw Error('Nome recusado');const absent=(await master.query(`SELECT DB_ID('${database}') D`))[0].D==null;report.laboratories.push({database,removed:absent});if(!absent)throw Error('Laboratorio residual identificado');}}finally{await master.close();}
report.status='PASS_LAB_NOT_DEPLOYED';report.principalAccesses=0;fs.writeFileSync('docs/b4-1/final-validation.json',JSON.stringify(report,null,2)+'\n');
