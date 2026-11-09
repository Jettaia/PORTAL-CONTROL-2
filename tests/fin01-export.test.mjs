import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import * as finance from '../src/fin01.js';

test('FIN01 export inclui todas as páginas, soma valor liberado e aplica escopo financeiro global',async t=>{
 const rows=Array.from({length:105},(_,i)=>({Numero:i+1,Prestador:'José',Deposito:'A',Tipo:'Carga',DataServico:'2026-11-09',ValorLiberado:'1.25',LiberadoEmUtc:'2026-11-09T13:00:00',Situacao:'AGUARDANDO_PAGAMENTO'}));
 const queue=[[],[{UsuarioId:1,Financeiro:1}],rows,[{Nome:'A'}],[{Nome:'José'}]],sql=[];
 t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);assert.ok(queue.length);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
 const result=await finance.exportData({exportNow:()=>new Date('2026-11-09T12:00:00Z')},1,{depositoId:'1',prestadorId:'1',situacao:'AGUARDANDO_PAGAMENTO',inicio:'2026-11-09',fim:'2026-11-09'});
 assert.equal(result.quantidade,105);assert.equal(result.total,'131.25');assert.match(result.filtrosTexto,/Aguardando pagamento/);assert.match(result.filtrosTexto,/José/);assert.match(result.geradoEm,/09:00/);assert.equal(queue.length,0);
 assert.match(sql[2],/TOP\(100001\)/);assert.match(sql[2],/ORDER BY c.LiberadoEmUtc,c.ContratacaoId/);assert.ok(!sql.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)));assert.ok(!sql[2].includes('UsuarioDeposito'));
});
test('FIN01 export rejeita cursor e filtros inválidos antes de SQL',async()=>{
 for(const q of [{cursor:'abc'},{situacao:'LIBERADA'},{inicio:'2026-02-30'},{inicio:'2026-11-10',fim:'2026-11-09'},{prestadorId:['1','2']},{depositoId:'1 OR 1=1'},{foo:'x'}])await assert.rejects(()=>finance.exportData({},1,q),e=>e.status===400);
});
test('FIN01 export nunca trunca e aplica vínculos do gestor',async t=>{
 const queue=[[],[{UsuarioId:2,Gestor:1}],[{ValorLiberado:'1.00'},{ValorLiberado:'1.00'}]],sql=[];
 t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
 await assert.rejects(()=>finance.exportData({},2,{},1),e=>e.status===413&&e.message==='EXPORTACAO_MUITOS_REGISTROS');assert.match(sql[2],/UsuarioDeposito/);
});
