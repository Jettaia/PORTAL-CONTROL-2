import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountAdjustments} from '../src/pc10-routes.js';
import {mountContracts} from '../src/pc04-routes.js';
import {mountPayments} from '../src/pc08-routes.js';

test('PC10 HTTP: saldo, correção, estorno e regularização preservam origem',async t=>{
 const app=express();app.use(express.json());const middleware={session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1n};req.rawSession='test-token';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)};
 const cfg={pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true};mountAdjustments(app,cfg,middleware);mountContracts(app,cfg,middleware);mountPayments(app,cfg,middleware);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const finance={Adm:0,Gestor:0,Financeiro:1},manager={Adm:0,Gestor:1,Financeiro:0};
 const c={ContratacaoId:7,Numero:17,DepositoId:1,PrestadorId:3,Versao:3,Status:'LIBERADA',Valor:'150.00',ValorLiberado:'150.00',LiberadoEmUtc:'2026-10-01T10:00:00',PagoEmUtc:'2026-10-02T10:00:00',EntradaReal:'2026-10-01T08:00',SaidaReal:'2026-10-01T10:00'};
 const prefix=(user=finance)=>[[],[{R:0}],[user],[{V:1}]];
 async function run(path,body,queue,status=200,check,inspect){const sql=[];let commits=0,rollbacks=0;const mock=t.mock.method(odbc,'connect',async()=>({query:async q=>{sql.push(q);assert.ok(queue.length,'Unexpected SQL '+q);const result=queue.shift();if(result instanceof Error)throw result;return result;},beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,close:async()=>{}}));try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user':'1',origin:'http://local.test'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,status,await r.clone().text());await check?.(await r.json());assert.equal(queue.length,0);assert.equal(commits,status<400?1:0);assert.equal(rollbacks,sql.length&&status>=400?1:0);inspect?.(sql);}finally{mock.mock.restore();}}
 const body={versao:3,valor:'20.00',data:'2026-10-20',motivo:'Diferença entregue',anexo:{nome:'prova.txt',conteudo:Buffer.from('comprovante').toString('base64')}};
 await t.test('sessão e origem obrigatórias',async()=>{
  const url=`http://127.0.0.1:${server.address().port}/api/pc10/contratacoes/7`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url+'/regularizar',{method:'POST',headers:{'content-type':'application/json','x-user':'1',origin:'http://evil.test'},body:JSON.stringify(body)})).status,403);
 });
 await t.test('saldo financeiro e movimentos',()=>run('pc10/contratacoes/7',null,[[],[finance],[c],[{Saldo:'20.00'}],[],[{PagamentoId:9}],[]],200,r=>assert.equal(r.saldo,'20.00')));
 await t.test('gestor alheio não consulta',()=>run('pc10/contratacoes/7',null,[[],[manager],[]],404));
 await t.test('financeiro alheio não consulta contrato',()=>run('pc10/contratacoes/7',null,[[],[finance],[]],404,undefined,sql=>assert.match(sql.at(-1),/UsuarioDeposito/)));
 await t.test('inativo negado',()=>run('pc10/contratacoes/7',null,[[],[]],403));
 await t.test('regulariza diferença positiva',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(),[c],[{Saldo:'20.00'}],[],[],[]],200,r=>assert.equal(r.saldo,'0.00'),sql=>{assert.ok(sql.some(q=>q.includes('-20.00')));assert.ok(sql.every(q=>!q.startsWith('DELETE')));}));
 await t.test('devolução negativa compensa crédito',()=>run('pc10/contratacoes/7/regularizar',{...body,valor:'-50.00'},[...prefix(),[{...c,Status:'CANCELADA'}],[{Saldo:'-50.00'}],[],[],[]],200,r=>assert.equal(r.saldo,'0.00'),sql=>assert.ok(sql.some(q=>q.includes('50.00')))));
 await t.test('saldo/versão defasados não escrevem',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(),[c],[{Saldo:'30.00'}]],409));
 await t.test('versão antiga impede repetir regularização',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(),[{...c,Versao:4}]],409));
 await t.test('rascunho não permite baixa',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(),[{...c,Status:'ABERTA'}]],409));
 await t.test('gestor não regulariza',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(manager).slice(0,3)],403));
 await t.test('comprovante obrigatório',()=>run('pc10/contratacoes/7/regularizar',{...body,anexo:undefined},[],400));
 await t.test('data futura não escreve',()=>run('pc10/contratacoes/7/regularizar',{...body,data:'9998-01-01'},[],400));
 await t.test('MFA vencido',()=>run('pc10/contratacoes/7/regularizar',body,[[],[{R:0}],[finance],[]],403));
 await t.test('falha comprovante reverte tudo',()=>run('pc10/contratacoes/7/regularizar',body,[...prefix(),[c],[{Saldo:'20.00'}],[],Error('disk')],503));
 const pg={PagamentoId:9,RegistradoPor:1,DataPagamento:'2026-10-02'};
 await t.test('estorno próprio compensa grupo sem apagar baixa',()=>run('pc10/pagamentos/9/estornar',{motivo:'Baixa equivocada'},[...prefix(),[pg],[],[{ContratacaoId:7,Valor:'150.00',Versao:3}],[],[],[],[]],200,r=>assert.equal(r.estornado,true),sql=>{assert.ok(sql.every(q=>!/^DELETE|^UPDATE Financeiro.PC08/.test(q)));assert.ok(sql.some(q=>q.includes('150.00')));}));
 await t.test('outro financeiro não estorna',()=>run('pc10/pagamentos/9/estornar',{motivo:'Erro'},[...prefix(),[{...pg,RegistradoPor:2}]],403));
 await t.test('estorno repetido rejeitado',()=>run('pc10/pagamentos/9/estornar',{motivo:'Erro'},[...prefix(),[pg],[{PagamentoId:9}]],409));
 await t.test('grupo com depósito revogado não permite estorno parcial',()=>run('pc10/pagamentos/9/estornar',{motivo:'Erro'},[...prefix(),[pg],[],[]],409,undefined,sql=>{assert.match(sql.at(-1),/NOT EXISTS\(SELECT 1 FROM Financeiro.PC08Item ix/);assert.match(sql.at(-1),/uf.DepositoId=cx.DepositoId/);assert.ok(!sql.some(q=>q.startsWith('INSERT')));}));
 await t.test('ADM estorna baixa de outro autor',()=>run('pc10/pagamentos/9/estornar',{motivo:'Erro'},[...prefix({Adm:1}),[{...pg,RegistradoPor:2}],[],[{ContratacaoId:7,Valor:'150.00',Versao:3}],[],[],[],[]]));
 await t.test('anexo fora de escopo não expõe conteúdo',()=>run('pc10/movimentos/1/anexo',null,[[],[manager],[]],404));
 await t.test('cancelar pago é bloqueado sem retirar obrigação nem baixa',()=>run('pc04/contratacoes/7/cancelar',{versao:3,motivo:'Serviço cancelado'},[...prefix(manager),[c]],409,r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA'),sql=>assert.ok(!sql.some(q=>/^INSERT|^UPDATE/.test(q)))));
 const draft={...c,Status:'ABERTA',Valor:'180.00',ValorLiberado:null,Versao:4,LiberacaoBloqueada:1};
 await t.test('cancelar rascunho pago legado permanece bloqueado',()=>run('pc04/contratacoes/7/cancelar',{versao:4,motivo:'Cancelar revisão'},[...prefix(manager),[draft]],409,r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA'),sql=>assert.ok(!sql.some(q=>/^INSERT|^UPDATE/.test(q)))));
 await t.test('reconferência paga não duplica obrigação',()=>run('pc04/contratacoes/7/conferir',{versao:4},[...prefix(manager),[draft]],409,r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA'),sql=>assert.ok(!sql.some(q=>/^INSERT|^UPDATE/.test(q)))));
 await t.test('baixa PC08 escritura pagamento na mesma transação',()=>run('pc08/pagamentos',{dataPagamento:'2026-10-20',itens:[{contratacaoId:7,versao:3,valor:'150.00',anexo:body.anexo}]},[[],[{R:0}],[{Permitido:1}],[{V:1}],[{...c,PagoEmUtc:null,DataServico:'2026-10-01'}],[{PagamentoId:9}],[],[],[],[],[]],201,r=>assert.equal(r.resultado.ValorTotal,'150.00'),sql=>assert.ok(sql.some(q=>q.startsWith('INSERT Financeiro.PC10Movimento')&&q.includes('-150.00')))));
 await t.test('revisão paga é bloqueada sem alterar dinheiro ou obrigação',()=>run('pc04/contratacoes/7/revisar',{versao:3,valor:'180.00',motivo:'Valor combinado corrigido'},[...prefix(manager),[c]],409,r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA'),sql=>assert.ok(!sql.some(q=>/^INSERT|^UPDATE/.test(q)))));
});

