import fs from 'node:fs';import {spawnSync} from 'node:child_process';
if(process.env.JETTA_B3_RUN_SQL_TESTS!=='YES'||!process.env.JETTA_PLAYWRIGHT_ROOT)throw Error('Somente laboratorio autorizado');
for(const flag of ['JETTA_B43_EVIDENCE','JETTA_B42_EVIDENCE','JETTA_B41_EVIDENCE','JETTA_B34_EVIDENCE'])process.env[flag]='YES';
const path='docs/b4-3/gate-run.json',report=JSON.parse(fs.readFileSync(path,'utf8'));
if(report.status!=='FAIL'||report.steps.length!==20||report.steps.slice(0,-1).some(s=>s.exitCode!==0)||report.steps.at(-1).exitCode===0)throw Error('Retomada limitada a ultima etapa falhada');
const name=report.steps.at(-1).name;fs.copyFileSync(path,'docs/b4-3/gate-run-first-attempt.json');fs.copyFileSync('docs/b4-3/'+name+'.txt','docs/b4-3/last-ui-first-attempt.txt');
const result=spawnSync(process.execPath,['integration/b4-3-regression-b4-2-regression-b4-1-regression-b3-4.visual.mjs'],{encoding:'utf8',windowsHide:true,maxBuffer:50*1024*1024}),output=(result.stdout||'')+(result.stderr||'');process.stdout.write(output);fs.writeFileSync('docs/b4-3/'+name+'.txt',output);
report.reexecution={utc:new Date().toISOString(),name,initialExitCode:report.steps.at(-1).exitCode,reason:'Timeout SQL 1222 na ultima jornada; repeticao isolada sem alterar timeout ou assercoes',exitCode:result.status};
if(result.error||result.status!==0){report.status='FAIL';fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');process.exit(result.status||1);}
report.steps[report.steps.length-1]={name,exitCode:result.status,pass:[...output.matchAll(/^VISUAL PASS:/gm)].length,fail:0,reexecuted:true};report.status='PASS_LAB_WITH_REEXECUTION';fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');
