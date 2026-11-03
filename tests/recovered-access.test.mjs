import test from 'node:test';
import assert from 'node:assert/strict';
import {invalidateRecoveredAccess} from '../pilot-local/recovered-access.mjs';
import {rehearseRestore} from '../pilot-local/recovery.mjs';

test('invalidação de ensaio recusa banco operacional ou identidade divergente antes de escrever',async()=>{
 const instance='a'.repeat(64),good={D:'JETTA_CONTROL_B3_TEST_012345abcdef',InstanceId:instance,Test:'1'};
 for(const patch of [{D:'JETTA_CONTROL_PILOTO_LOCAL'},{D:'JETTA_CONTROL'},{InstanceId:'b'.repeat(64)},{Test:null}]){
  let calls=0;const db={query:async sql=>{calls++;assert.match(sql,/^SELECT /);return [{...good,...patch}];}};
  await assert.rejects(()=>invalidateRecoveredAccess(db,instance),/ensaio sintético/);assert.equal(calls,1);
 }
 await assert.rejects(()=>invalidateRecoveredAccess({},''),/Identidade/);
});

test('restore recusa manifesto operacional apresentado como origem sintética antes de tocar arquivos/SQL',async()=>{
 await assert.rejects(()=>rehearseRestore({database:'JETTA_CONTROL_B3_TEST_012345abcdef',pilotInstance:'a'.repeat(64)},{database:'JETTA_CONTROL_PILOTO_LOCAL'}),/origem sintetica/);
});
