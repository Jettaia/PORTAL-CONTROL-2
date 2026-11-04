import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {regressionTests} from '../pilot-local/release-regression.mjs';
import {regressionInputs} from '../pilot-local/release-regression.mjs';
import crypto from 'node:crypto';

test('QA-01: runner principal executa integration/ e propaga sua falha',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'portal-test-discovery-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 for(const name of ['scripts','pilot-local','tests','integration'])fs.mkdirSync(path.join(directory,name));
 for(const name of ['scripts/test-all.mjs','pilot-local/release-regression.mjs'])fs.copyFileSync(new URL('../'+name,import.meta.url),path.join(directory,name));
 fs.writeFileSync(path.join(directory,'tests/pass.test.mjs'),"import test from 'node:test';test('sentinela tests PASS',()=>{});");
 fs.writeFileSync(path.join(directory,'integration/fail.test.mjs'),"import test from 'node:test';test('sentinela integration FAIL',()=>{throw Error('QA01_SENTINEL');});");
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['scripts/test-all.mjs'],{cwd:directory,env,encoding:'utf8',windowsHide:true});
 assert.ifError(result.error);
 assert.equal(result.status,1,'falha de integration deve reprovar runner');
 assert.match(result.stdout+result.stderr,/QA01_SENTINEL/);
 assert.match(result.stdout,/sentinela tests PASS/);
});

test('QA-01: inventário do gate inclui os testes locais de integration',()=>{
 const files=regressionTests();
 const expected=fs.readdirSync(new URL('../integration/',import.meta.url)).filter(file=>/\.test\.(js|mjs)$/.test(file)).map(file=>'integration/'+file);
 assert.ok(expected.length>0);
 for(const file of expected)assert.ok(files.includes(file),file);
 assert.equal(new Set(files).size,files.length);
});

test('QA-01: evidência inclui o servidor real usado pela prévia',()=>{
 const entry=regressionInputs([]).find(file=>file.path==='scripts/preview-ui.mjs');
 assert.ok(entry,'alterar o servidor da prévia deve invalidar evidência');
 assert.equal(entry.sha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('../scripts/preview-ui.mjs',import.meta.url))).digest('hex'));
});

test('QA-04: evidência vincula dependências do navegador ao manifesto e lockfile',()=>{
 const inputs=regressionInputs([]);
 for(const file of ['package.json','package-lock.json']){
  const entry=inputs.find(input=>input.path===file);assert.ok(entry,file);
  assert.equal(entry.sha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'));
 }
});
