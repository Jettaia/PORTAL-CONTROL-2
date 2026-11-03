import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertReleaseReady,runtimeInputs} from './release-gate.mjs';
import {regressionInputs,regressionTests,testSummary} from './release-regression.mjs';

test('resumo de node:test distingue execução real, skip e TODO mesmo com exit zero',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 for(const [options,expected] of [['',0],[',{skip:true}',1],[',{todo:true}',1]]){
  const source=`import test from 'node:test';test('prova'${options},()=>{});`;
  const result=spawnSync(process.execPath,['--test-reporter=tap','--input-type=module','-e',source],{encoding:'utf8',windowsHide:true,env});
  assert.equal(result.status,0);
  const summary=testSummary(result.stdout);
  assert.equal(summary.tests,1);assert.equal(summary.skipped+summary.todo,expected);
 }
 assert.throws(()=>testSummary('sem resumo de testes'));
});

test('liberação real exige regressão FULL atual e integração limpa',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'portal-release-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const inputs=runtimeInputs(),tests=regressionTests();
 const counts={tests:1,pass:1,fail:0,cancelled:0,skipped:0,todo:0};
 const regression={status:'REGRESSIONS_PASS',scope:'FULL',excludedTests:[],tests,inputs:regressionInputs(inputs),steps:['tests','syntax','pilot-unit'].map(name=>({name,exitCode:0,...(name==='syntax'?{}:{summary:counts})}))};
 const integration={status:'PASS',cleanupVerified:true,inputs};
 const release={status:'READY_FOR_INITIAL_SETUP',scope:'FULL',regressionReport:'regression.json'};
 const write=(r=release,g=regression,i=integration)=>{
  for(const [file,data] of [['release.json',r],['regression.json',g],['integration-evidence.json',i]])fs.writeFileSync(path.join(directory,file),JSON.stringify(data));
 };
 write();assert.doesNotThrow(()=>assertReleaseReady(directory));
 for(const patch of [
  {status:'FAIL'},{scope:'LOCAL_PILOT_WITHOUT_PC09'},{excludedTests:['tests/pc08.test.mjs']},
  {tests:tests.slice(1)},{tests:[...tests,'tests/removed.test.mjs']},{inputs:[]},
  {inputs:regression.inputs.map((entry,index)=>index?entry:{...entry,sha256:'old'})},
  {steps:[]},{steps:[{name:'tests',exitCode:0}]},
  {steps:regression.steps.map(s=>({...s,exitCode:s.name==='syntax'?1:0}))},
  ...['tests','pilot-unit'].flatMap(name=>[
   undefined,{...counts,tests:0,pass:0},{...counts,skipped:1},{...counts,todo:1},
   {...counts,cancelled:1},{...counts,fail:1},{...counts,pass:0}
  ].map(summary=>({steps:regression.steps.map(s=>s.name===name?{...s,summary}:s)})))
 ]){write(release,{...regression,...patch});assert.throws(()=>assertReleaseReady(directory),/Regressao integral/);}
 for(const patch of [{scope:'LOCAL_PILOT_WITHOUT_PC09'},{status:'FAIL'}]){
  write({...release,...patch});assert.throws(()=>assertReleaseReady(directory));
 }
 for(const patch of [{status:'FAIL'},{cleanupVerified:false},{cleanupVerified:'true'},{inputs:[]}]){
  write(release,regression,{...integration,...patch});assert.throws(()=>assertReleaseReady(directory));
 }
 write();assert.doesNotThrow(()=>assertReleaseReady(directory));
});
