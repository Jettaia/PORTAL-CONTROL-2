import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const scope='LOCAL_PILOT_WITHOUT_PC09';
export function regressionInputs(runtime){
 const files=fs.readdirSync(path.join(root,'tests')).filter(f=>/\.test\.(js|mjs)$/.test(f)).sort().map(f=>'tests/'+f);
 files.push('scripts/validate-pilot-without-pc09.mjs','scripts/check-all.mjs');
 return [...runtime,...files.map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))];
}
export function selectTests(files,profile){
 if(profile==='FULL')return [...files];
 if(profile!==scope)throw Error('Perfil de regressao desconhecido');
 return files.filter(f=>f!=='tests/pc09.test.mjs');
}
export function validateScopedRegression(report,inputs,files){
 if(report.scope!==scope||report.status!=='SCOPED_REGRESSIONS_PASS'||
 JSON.stringify(report.excludedTests)!==JSON.stringify(['tests/pc09.test.mjs'])||
 JSON.stringify(report.tests)!==JSON.stringify(selectTests(files,scope))||
 JSON.stringify(report.inputs)!==JSON.stringify(inputs)||
 !['tests','syntax','pilot-unit'].every(name=>report.steps?.some(s=>s.name===name&&s.exitCode===0))||
 report.steps.some(s=>s.exitCode!==0))throw Error('Regressao sem PC09 pendente ou divergente');
}
