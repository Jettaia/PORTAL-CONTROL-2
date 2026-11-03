import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function testSummary(output){
 const summary={};
 for(const name of ['tests','pass','fail','cancelled','skipped','todo']){
  const match=output.match(new RegExp('^# '+name+' (\\d+)\\r?$','m'));
  if(!match)throw Error('Resumo de testes ausente: '+name);
  summary[name]=Number(match[1]);
 }
 return summary;
}
export function completeTestRun(summary){
 return summary&&Number.isInteger(summary.tests)&&summary.tests>0&&summary.pass===summary.tests&&
 ['fail','cancelled','skipped','todo'].every(name=>summary[name]===0);
}
export function regressionTests(){
 return fs.readdirSync(path.join(root,'tests')).filter(f=>/\.test\.(js|mjs)$/.test(f)).sort().map(f=>'tests/'+f);
}
export function regressionInputs(runtime){
 const files=[...regressionTests(),'scripts/test-all.mjs','scripts/validate-pilot.mjs','scripts/check-all.mjs'];
 return [...runtime,...files.map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))];
}
export function validateFullRegression(report,inputs,files){
 if(report.scope!=='FULL'||report.status!=='REGRESSIONS_PASS'||!files.length||
 JSON.stringify(report.excludedTests)!=='[]'||
 JSON.stringify(report.tests)!==JSON.stringify(files)||
 JSON.stringify(report.inputs)!==JSON.stringify(inputs)||
 !Array.isArray(report.steps)||
 !['tests','syntax','pilot-unit'].every(name=>report.steps.some(s=>s.name===name&&s.exitCode===0))||
 !['tests','pilot-unit'].every(name=>report.steps.filter(s=>s.name===name).every(s=>completeTestRun(s.summary)))||
 report.steps.some(s=>s.exitCode!==0))throw Error('Regressao integral pendente ou divergente');
}
