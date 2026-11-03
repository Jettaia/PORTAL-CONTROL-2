import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runtimeInputs} from '../pilot-local/release-gate.mjs';
import {regressionTests,regressionInputs,testSummary,completeTestRun} from '../pilot-local/release-regression.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report={scope:'FULL',excludedTests:[],tests:regressionTests(),inputs:regressionInputs(runtimeInputs()),steps:[],status:'RUNNING',utc:new Date().toISOString()};
for(const [name,args] of [
 ['tests',['--test','--test-reporter=tap',...report.tests]],
 ['syntax',['scripts/check-all.mjs']],
 ['pilot-unit',['--test','--test-reporter=tap','pilot-local/unit.test.mjs','pilot-local/release-gate.test.mjs','pilot-local/connection.integration.mjs']]
]){
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 fs.writeFileSync(path.join(root,'pilot-local',`regression-${name}.txt`),(result.stdout||'')+(result.stderr||'')+(result.error?'\n'+result.error.message:''));
 const step={name,exitCode:result.status??1};
 if(name!=='syntax')try{step.summary=testSummary(result.stdout||'');if(!completeTestRun(step.summary))step.exitCode=1;}catch(error){step.exitCode=1;step.error=error.message;}
 report.steps.push(step);console.log(JSON.stringify(step));
 if(step.exitCode!==0)break;
}
report.status=report.steps.length===3&&report.steps.every(s=>s.exitCode===0)?'REGRESSIONS_PASS':'FAIL';
fs.writeFileSync(path.join(root,'pilot-local/regression.json'),JSON.stringify(report,null,2)+'\n');
process.exitCode=report.status==='REGRESSIONS_PASS'?0:1;
