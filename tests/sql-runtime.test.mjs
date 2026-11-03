import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {withDb} from '../src/auth-db.js';

test('runtime restrito valida identidade e privilégios antes de chamar negócio',async t=>{
 const cfg={driver:'ODBC Driver 18 for SQL Server',server:'localhost\\SQLEXPRESS',database:'JETTA_CONTROL_B3_TEST_012345abcdef',sqlRuntimePrincipal:'MACHINE\\JettaControlRuntime'};
 const names=['Sysadmin','DbOwner','ControlServer','AlterAnyLogin','ControlDatabase','AlterAnySchema','CreateTable','AlterAnyUser','BackupDatabase','AlterAnyRole','AlterSettings','AlterAnyDatabase','ImpersonateAnyLogin','AlterAnyConnection','AlterAnyLinkedServer','BulkOperations','AlterCadastro','AlterSeguranca','AlterOperacao','AlterFinanceiro'];
 const safe={LoginName:cfg.sqlRuntimePrincipal,...Object.fromEntries(names.map(name=>[name,0]))};
 for(const patch of [{},{LoginName:'MACHINE\\Human'},...names.flatMap(name=>[{[name]:1},{[name]:null}])]){
  let ran=false,closed=false,queries=0;
  const mock=t.mock.method(odbc,'connect',async()=>({query:async()=>{queries++;return [{...safe,...patch}];},close:async()=>{closed=true;}}));
  try{const work=()=>withDb(cfg,async()=>{ran=true;return 42;});if(Object.keys(patch).length)await assert.rejects(work,/Identidade SQL restrita/);else assert.equal(await work(),42);assert.equal(ran,Object.keys(patch).length===0);assert.equal(queries,1);assert.equal(closed,true);}finally{mock.mock.restore();}
 }
});
