import test from 'node:test';
import assert from 'node:assert/strict';
import {planningInput} from '../src/b3.js';
import {filters} from '../src/b5-1.js';
import {scope,selection} from '../src/b5-3-f03-model.js';
import {b24Definition,validateB24} from '../src/b24a.js';
import {listB24} from '../src/b24a.js';
import odbc from 'odbc';
const activity={depositoId:2,tipoServicoId:1,dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00'};
test('planejamento exige somente depósito e recusa filial removida',()=>{assert.equal(planningInput(activity).depositoId,'2');assert.throws(()=>planningInput({...activity,filialId:1}));});
test('financeiro rejeita filtro filial removido',()=>{assert.deepEqual(filters({depositoId:'2'}),{depositoId:'2'});assert.throws(()=>filters({filialId:'1'}));});
test('políticas aceitam organização ou depósito sem filial',()=>{assert.deepEqual(scope({nivel:'ORGANIZACAO',depositoId:null}),{nivel:'ORGANIZACAO',depositoId:null});assert.deepEqual(scope({nivel:'DEPOSITO',depositoId:'2'}),{nivel:'DEPOSITO',depositoId:'2'});assert.throws(()=>scope({nivel:'FILIAL',filialId:'1',depositoId:null}));});
test('cadastro legado não expõe nem cria filiais',()=>{assert.equal(b24Definition('filiais'),null);assert.throws(()=>validateB24('filiais',{nome:'Removida',codigo:'X'}));});

test('consulta legada de prestadores usa o mesmo escopo real do PC03',async t=>{
 const queries=[],queue=[[{UsuarioId:1,Adm:0,Gestor:1}],[],[]];
 t.mock.method(odbc,'connect',async()=>({query:async sql=>{queries.push(sql);assert.ok(queue.length);return queue.shift();},close:async()=>{}}));
 assert.deepEqual(await listB24({driver:'test',server:'test',database:'test'},'chapas',1),[]);
 assert.match(queries[1],/PrestadorDeposito/);assert.match(queries[1],/UsuarioDeposito/);assert.match(queries[1],/RevogadoEmUtc IS NULL/);assert.equal(queue.length,0);
});
