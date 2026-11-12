import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {list} from '../src/pc04.js';

test('Diárias usa listagem autorizada/paginada e indicador PC05 sem expor códigos',async t=>{
 const queries=[],row={ContratacaoId:7,EntradaTokenUsada:1},queue=[[],[{UsuarioId:3,Gestor:1}],[row]];
 t.mock.method(odbc,'connect',async()=>({query:async sql=>{queries.push(sql);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
 const result=await list({pc05:true},3,'8',{dataServico:'2026-11-12',depositoId:'2'});
 assert.deepEqual(result.registros,[row]);const sql=queries.at(-1);assert.match(sql,/ConsumidoEmUtc IS NOT NULL/);assert.match(sql,/EntradaTokenUsada/);assert.match(sql,/uf.UsuarioId=3/);assert.match(sql,/c.DepositoId=2/);assert.match(sql,/c.DataServico='2026-11-12'/);assert.match(sql,/c.ContratacaoId<8/);assert.doesNotMatch(sql,/CodigoHash/);
 queue.push([],[{UsuarioId:3,Gestor:1}],[]);await list({pc05:false},3);assert.doesNotMatch(queries.at(-1),/ContratacaoToken/);
});
