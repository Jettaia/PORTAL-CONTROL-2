import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountStatements} from '../src/pc11-routes.js';

test('PC11 HTTP: ledger efetivo, saldos exatos e escopo sem escrita',async t=>{
 const app=express();const cfg={pc11:true,pc04:true,pc08:true,pc10:true};
 mountStatements(app,cfg,{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:req.get('x-user')};next();}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/pc11`;
 const row=(id,type,value,day,contract=7)=>({MovimentoId:String(id),ContratacaoId:String(contract),Numero:17,PrestadorId:3,Prestador:'Pessoa',FilialId:1,Filial:'A',Gestor:'Gestor A',Atividade:'Diária',DataServico:'2026-10-01',Tipo:type,Valor:value,DataEfetiva:day,RegistradoEmUtc:`2026-10-20T10:00:0${id}`,PagamentoId:type==='PAGAMENTO'||type==='ESTORNO'?9:null,TemAnexo:0,TemAnexoPagamento:1,Recibo:null});
 // Payment recorded later but effective BEFORE its release: negative opening is legitimate.
 const rows=[row(2,'PAGAMENTO','-150.00','2026-10-02'),row(1,'LIBERACAO','150.00','2026-10-03'),row(3,'RETIRADA','-150.00','2026-10-04'),row(4,'LIBERACAO','180.00','2026-10-05'),row(5,'ESTORNO','150.00','2026-10-06'),row(6,'QUITACAO','-180.00','2026-10-07'),row(7,'LIBERACAO','50.00','2026-10-07',8)];
 async function run(path,queue,status=200,check,inspect){const sql=[];let committed=0,rolled=0;
  const mock=t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE)\b/i.test(q),'read only');assert.ok(queue.length,'Unexpected SQL '+q);return queue.shift();},beginTransaction:async()=>{},commit:async()=>committed++,rollback:async()=>rolled++,close:async()=>{}}));
  try{const r=await fetch(base+path,{headers:{'x-user':'1'}});assert.equal(r.status,status,await r.clone().text());await check?.(await r.json());assert.equal(queue.length,0);assert.equal(committed,status<400?1:0);assert.equal(rolled,sql.length&&status>=400?1:0);inspect?.(sql);}finally{mock.mock.restore();}
 }
 const finance={Adm:0,Financeiro:1,Gestor:0},manager={Adm:0,Financeiro:0,Gestor:1};
 await t.test('flag explícita e dependências obrigatórias',async()=>{
  const off=express();mountStatements(off,{},{});assert.throws(()=>mountStatements(express(),{pc11:true},{}),/PC11 exige/);
  const inactive=off.listen(0,'127.0.0.1');await new Promise(r=>inactive.once('listening',r));try{assert.equal((await fetch(`http://127.0.0.1:${inactive.address().port}/api/pc11/extrato`)).status,404);}finally{inactive.close();}
 });
 await t.test('anônimo negado',async()=>assert.equal((await fetch(base+'/extrato')).status,401));
 await t.test('financeiro concilia retroativo, revisão e estorno',()=>run('/extrato?prestadorId=3&inicio=2026-10-03&fim=2026-10-07',[[],[finance],rows],200,r=>{assert.equal(r.saldoAnterior,'-150.00');assert.equal(r.saldoFinal,'50.00');assert.equal(r.totalPago,'30.00');assert.equal(r.totalAberto,'50.00');assert.equal(r.totalDevolver,'0.00');assert.deepEqual(r.movimentos.map(m=>m.Saldo),['0.00','-150.00','30.00','180.00','0.00','50.00']);assert.equal(r.movimentos[0].DataServico,'2026-10-01');assert.equal(r.integracaoRecibos,'PENDENTE_PC09');}));
 await t.test('gestor não soma outra filial: restrição SQL em todos os fatos',()=>run('/extrato?nome=Pessoa&filialId=1',[[],[manager],rows.slice(0,2)],200,r=>assert.equal(r.saldoFinal,'0.00'),sql=>{assert.match(sql[2],/UsuarioFilial/);assert.match(sql[2],/RevogadoEmUtc IS NULL/);assert.match(sql[2],/c\.FilialId=1/);assert.match(sql[2],/ORDER BY m\.DataEfetiva,m\.RegistradoEmUtc,m\.MovimentoId/);}));
 await t.test('ADM global',()=>run('/extrato',[[],[{Adm:1}],[]],200,r=>assert.equal(r.saldoFinal,'0.00')));
 await t.test('inativo ou sem papel não lê ledger',()=>run('/extrato',[[],[]],403));
 for(const query of ['inicio=2026-02-30','inicio=2026-10-20&fim=2026-10-01','filialId=0','prestadorId=1%20OR%201=1','nome[x]=abc','campo=desconhecido'])await t.test('inválido '+query,()=>run('/extrato?'+query,[],400));
 await t.test('nome literal não injeta wildcard ou SQL',()=>run('/extrato?nome=%25%27%5B_',[[],[finance],[]],200,undefined,sql=>{assert.ok(!sql[2].includes("%'[_"));assert.match(sql[2],/ESCAPE '~'/);}));
 await t.test('grupo somente itens do escopo sem total global',()=>run('/pagamentos/9',[[],[manager],[{ContratacaoId:7,Valor:'150.00',Recibo:null}]],200,r=>{assert.equal(r.total,'150.00');assert.equal(r.itens.length,1);},sql=>{assert.match(sql[2],/UsuarioFilial/);assert.ok(!sql[2].includes('ValorTotal'));}));
 await t.test('grupo inexistente ou alheio',()=>run('/pagamentos/9',[[],[manager],[]],404));
 await t.test('anexo PC08 alheio',()=>run('/contratacoes/7/anexo',[[],[manager],[]],404,undefined,sql=>assert.match(sql[2],/UsuarioFilial/)));
 await t.test('anexo PC10 alheio',()=>run('/movimentos/7/anexo',[[],[manager],[]],404,undefined,sql=>assert.match(sql[2],/UsuarioFilial/)));
 await t.test('não trunca silenciosamente',()=>run('/extrato',[[],[finance],Array(10001).fill(rows[0])],422));
 await t.test('centavos acima da precisão float e crédito a devolver',()=>run('/extrato',[[],[finance],[row(1,'PAGAMENTO','-9007199254740993.01','2026-10-02')]],200,r=>{assert.equal(r.saldoFinal,'-9007199254740993.01');assert.equal(r.totalDevolver,'9007199254740993.01');assert.equal(r.totalPago,'9007199254740993.01');}));
 await t.test('período sem movimento mantém saldo anterior',()=>run('/extrato?inicio=2026-10-10',[[],[manager],rows],200,r=>{assert.equal(r.saldoAnterior,'50.00');assert.equal(r.saldoFinal,'50.00');assert.equal(r.movimentos.length,0);assert.equal(r.totalPago,'0.00');assert.equal(r.totalAberto,'50.00');}));
 await t.test('anexo permitido preserva bytes e headers inertes',async()=>{
  const queue=[[],[manager],[{Nome:'evidência.html',Conteudo:Buffer.from('<script>unsafe</script>')}]];
  const mock=t.mock.method(odbc,'connect',async()=>({query:async()=>queue.shift(),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}}));
  try{const r=await fetch(base+'/contratacoes/7/anexo',{headers:{'x-user':'1'}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.match(r.headers.get('content-disposition'),/^attachment/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/sandbox/);assert.equal(await r.text(),'<script>unsafe</script>');assert.equal(queue.length,0);}finally{mock.mock.restore();}
 });
});
