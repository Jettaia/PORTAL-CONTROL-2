import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {exportData} from '../src/pc04.js';
import {contractReportPdf,contractReportHtml} from '../src/pc04-export-pdf.js';
import {PlanningError} from '../src/b3.js';

test('PC04 exporta mais de uma página, soma valores e identifica filtros',async t=>{
 const rows=Array.from({length:205},(_,i)=>({ContratacaoId:i+1,Numero:i+1,Prestador:'José',Deposito:'Floripa',CentroCusto:'CC-20',GestorResponsavel:'Gestora',DataServico:'2026-11-09',Valor:'1.25',Status:'LIBERADA'}));
 const queue=[[],[{UsuarioId:1,Adm:1,Gestor:0,Financeiro:0}],rows,[{Nome:'Floripa'}]];
 let writes=0,commits=0;
 t.mock.method(odbc,'connect',async()=>({query:async sql=>{if(/^INSERT|^UPDATE|^DELETE/.test(sql))writes++;assert.ok(queue.length);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{},close:async()=>{}}));
 const result=await exportData({exportNow:()=>new Date('2026-11-09T12:00:00Z')},1,{depositoId:'1',situacao:'LIBERADA'});
 assert.equal(result.quantidade,205);assert.equal(result.registros.length,205);assert.equal(result.total,'256.25');assert.match(result.filtrosTexto,/Floripa/);assert.match(result.filtrosTexto,/LIBERADA/);assert.match(result.geradoEm,/09\/11\/2026/);assert.match(result.geradoEm,/09:00/);assert.equal(queue.length,0);assert.equal(writes,0);assert.equal(commits,1);
});
test('exportação rejeita cursor e filtros inválidos antes de consultar banco',async()=>{
 for(const filters of [{antes:'100'},{dataServico:'2026-02-30'},{valor:'1.001'},{situacao:'FORJADA'},{depositoId:['1','2']},{invasao:'x'}])await assert.rejects(()=>exportData({},1,filters),e=>e.status===400);
});
test('exportação não entrega arquivo truncado quando ultrapassa o limite',async t=>{
 const queue=[[],[{UsuarioId:1,Adm:1}],[{Valor:'1.00'},{Valor:'2.00'}]];
 t.mock.method(odbc,'connect',async()=>({query:async()=>queue.shift(),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
 await assert.rejects(()=>exportData({},1,{},1),e=>e.status===413&&e.message==='EXPORTACAO_MUITOS_REGISTROS');assert.equal(queue.length,0);
});

test('PDF em preparação recusa concorrente e libera recurso após erro',async()=>{
 let rejectLoad;const wait=new Promise((_,reject)=>rejectLoad=reject),first=contractReportPdf(()=>wait);
 await assert.rejects(()=>contractReportPdf(()=>({})),e=>e.status===503&&e.message==='EXPORTACAO_PDF_OCUPADA');
 rejectLoad(new PlanningError('FILTRO_INVALIDO',400));await assert.rejects(()=>first,e=>e.status===400);
 await assert.rejects(()=>contractReportPdf(()=>{throw new PlanningError('PERMISSAO_NEGADA',403);}),e=>e.status===403);
});
test('relatório PDF escapa dados e conserva apenas as oito colunas da tabela',()=>{
 const html=contractReportHtml({geradoEm:'09/11/2026',filtrosTexto:'<script>filtro</script>',quantidade:1,total:'100.00',registros:[{Numero:'1',Prestador:'<script>nome</script>',Deposito:'A',CentroCusto:'CC',GestorResponsavel:'Gestora',DataServico:'2026-11-09',Valor:'100.00',Status:'LIBERADA'}]});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;nome&lt;/script&gt;'));assert.ok(html.includes('&lt;script&gt;filtro&lt;/script&gt;'));assert.equal((html.match(/<th scope=/g)||[]).length,8);assert.ok(!html.includes('Editar'));assert.ok(html.includes('R$ 100,00'));
});
