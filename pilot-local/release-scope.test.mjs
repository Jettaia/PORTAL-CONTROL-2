import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTests,validateScopedRegression,regressionInputs,scope} from './release-scope.mjs';
test('evidencia inclui hashes dos testes, runner e verificador de sintaxe',()=>{
 const inputs=regressionInputs([]);
 for(const file of ['tests/pc08.test.mjs','tests/pc09.test.mjs','scripts/validate-pilot-without-pc09.mjs','scripts/check-all.mjs'])assert.ok(inputs.some(i=>i.path===file&&/^[a-f0-9]{64}$/.test(i.sha256)));
});
test('perfil sem recibos exclui exatamente PC09 e preserva selecao integral',()=>{
 const files=['tests/pc08.test.mjs','tests/pc09.test.mjs','tests/pc10.test.mjs'];
 assert.deepEqual(selectTests(files,scope),[files[0],files[2]]);
 assert.deepEqual(selectTests(files,'FULL'),files);
 assert.throws(()=>selectTests(files,'qualquer'));
});
test('gate recusa falha, escopo incorreto, omissao adicional ou prova desatualizada',()=>{
 const inputs=[{path:'src/server.js',sha256:'abc'}],files=['tests/pc08.test.mjs','tests/pc09.test.mjs','tests/pc10.test.mjs'];
 const good={status:'SCOPED_REGRESSIONS_PASS',scope,excludedTests:['tests/pc09.test.mjs'],tests:selectTests(files,scope),inputs,steps:[{name:'tests',exitCode:0},{name:'syntax',exitCode:0},{name:'pilot-unit',exitCode:0}]};
 assert.doesNotThrow(()=>validateScopedRegression(good,inputs,files));
 for(const patch of [{status:'FAIL'},{scope:'FULL'},{excludedTests:[]},{tests:[files[0]]},{inputs:[]},{steps:[]},{steps:[{name:'tests',exitCode:1}]}])assert.throws(()=>validateScopedRegression({...good,...patch},inputs,files));
});
