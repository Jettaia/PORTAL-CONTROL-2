import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {list,exportData} from '../src/pc04.js';
test('PC04 período inclusivo, aberto e igual chega a listagem e exportação sem perder paginação',async t=>{
 for(const filters of [{inicio:'2026-11-01',fim:'2026-11-09'},{inicio:'2026-11-09'},{fim:'2026-11-09'},{inicio:'2026-11-09',fim:'2026-11-09'},{}]){
  const queries=[],queue=[[],[{UsuarioId:1,Adm:1}],[]];t.mock.method(odbc,'connect',async()=>({query:async sql=>{queries.push(sql);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
  await list({},1,'99',filters);const sql=queries.at(-1);assert.match(sql,/c.ContratacaoId<99/);if(filters.inicio)assert.ok(sql.includes("c.DataServico>='"+filters.inicio+"'"));if(filters.fim)assert.ok(sql.includes("c.DataServico<='"+filters.fim+"'"));
  queue.push([],[{UsuarioId:1,Adm:1}],[]);const report=await exportData({},1,filters);assert.ok(!queries.at(-1).includes('c.ContratacaoId<'));assert.deepEqual(report.filtros,filters);if(filters.inicio)assert.ok(report.filtrosTexto.includes('Serviço desde: '+filters.inicio.split('-').reverse().join('/')));if(filters.fim)assert.ok(report.filtrosTexto.includes('Serviço até: '+filters.fim.split('-').reverse().join('/')));t.mock.restoreAll();
 }
});
test('PC04 período inválido não abre SQL',async t=>{t.mock.method(odbc,'connect',()=>{assert.fail('Não consultar SQL');});for(const f of [{inicio:'2026-02-30'},{fim:'2026-13-01'},{inicio:'2026-11-10',fim:'2026-11-09'},{inicio:['2026-11-01','2026-11-02']}]){await assert.rejects(()=>list({},1,undefined,f),e=>e.status===400&&e.message!=='CAMPOS_INVALIDOS');await assert.rejects(()=>exportData({},1,f),e=>e.status===400&&e.message!=='CAMPOS_INVALIDOS');}});
