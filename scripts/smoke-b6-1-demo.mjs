import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const child=spawn(process.execPath,['scripts/demo-b6-1.mjs','--synthetic-lab'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
let data='',errors='',ready=false,failure=null;const report={tipo:'DEMONSTRACAO_EXPLICITA_SINTETICA',status:'RUNNING',credenciaisRegistradas:false};
const timer=setTimeout(()=>{failure=Error('Demonstração não encerrou dentro do limite do verificador');child.stdin.end('sair\n');},60000);
child.stderr.on('data',b=>errors+=b);child.stdout.on('data',async b=>{data+=b;const m=data.match(/LAB SINTÉTICO: (http:\/\/127\.0\.0\.1:\d+)\/ \| (JETTA_CONTROL_B3_TEST_[a-f0-9]{12})/);if(!m||ready)return;ready=true;try{report.database=m[2];assert.equal((await fetch(m[1]+'/api/health')).status,200);assert.equal((await fetch(m[1]+'/api/b61/carteira')).status,401);report.httpSaudavel=true;report.acessoAnonimoNegado=true;}catch(e){failure=e;}finally{child.stdin.end('sair\n');}});
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});clearTimeout(timer);
try{if(failure)throw failure;assert.equal(code,0,errors);assert.ok(ready);assert.ok(data.includes('banco sintético próprio removido'));report.cleanupVerified=true;report.status='PASS';}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;}
fs.writeFileSync('docs/b6-1/demo-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
