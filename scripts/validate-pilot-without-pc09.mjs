import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runtimeInputs} from '../pilot-local/release-gate.mjs';
import {selectTests,regressionInputs,scope} from '../pilot-local/release-scope.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=selectTests(fs.readdirSync(path.join(root,'tests')).filter(f=>/\.test\.(js|mjs)$/.test(f)).sort().map(f=>'tests/'+f),scope);
const report={scope,excludedTests:['tests/pc09.test.mjs'],tests,inputs:regressionInputs(runtimeInputs()),steps:[],status:'RUNNING',utc:new Date().toISOString()};
for(const [name,args] of [['tests',['--test',...tests]],['syntax',['scripts/check-all.mjs']],['pilot-unit',['--test','pilot-local/unit.test.mjs','pilot-local/release-scope.test.mjs','pilot-local/connection.integration.mjs']]]){
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 fs.writeFileSync(path.join(root,'pilot-local',`without-pc09-${name}.txt`),(result.stdout||'')+(result.stderr||''));
 report.steps.push({name,exitCode:result.status??1});console.log(JSON.stringify(report.steps.at(-1)));
 if(result.status!==0)break;
}
report.status=report.steps.length===3&&report.steps.every(s=>s.exitCode===0)?'SCOPED_REGRESSIONS_PASS':'FAIL';
fs.writeFileSync(path.join(root,'pilot-local/regression-without-pc09.json'),JSON.stringify(report,null,2)+'\n');
process.exitCode=report.status==='SCOPED_REGRESSIONS_PASS'?0:1;
