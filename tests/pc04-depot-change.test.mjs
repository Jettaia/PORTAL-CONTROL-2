import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountContracts} from '../src/pc04-routes.js';

test('PC04 HTTP: transferência valida escopos, vínculo, gestor, estado e numeração',async t=>{
 const app=express();app.use(express.json());mountContracts(app,{pc01:true,pc02:true,pc03:true,pc04:true,pc05:true},{session:(req,res,next)=>{req.user={id:1};req.rawSession='test';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const original={ContratacaoId:7,Numero:3,DepositoId:1,Deposito:'Origem',CentroCusto:'CC-1',PrestadorId:8,GestorResponsavelId:1,Versao:1,Status:'ABERTA',Valor:'180.00',InicioPrevisto:'2026-11-17T08:00',FimPrevisto:'2026-11-17T17:00',DataServico:'2026-11-17'};
 const body={versao:1,depositoId:2,gestorId:1,motivo:'Corrigir depósito informado na criação.'};
 async function run(options={}){
  const sql=[];let commits=0,rollbacks=0;
  const row={...original,...options.row},actor=options.actor||{UsuarioId:1,Gestor:1};
  const db={beginTransaction:async()=>{},commit:async()=>commits++,rollback:async()=>rollbacks++,close:async()=>{},query:async q=>{
   sql.push(q);
   if(q.includes('SELECT @r R'))return [{R:0}];
   if(q.includes('CASE WHEN')&&q.includes('END Adm'))return [actor];
   if(q.includes('FROM Seguranca.SessaoWeb'))return [{V:1}];
   if(q.startsWith('SELECT c.ContratacaoId'))return options.originDenied?[]:[row];
   if(q.startsWith('SELECT f.DepositoId')){assert.match(q,/f.Ativo=1/);assert.match(q,/uf.UsuarioId=1/);return options.targetDenied?[]:[{DepositoId:2,Nome:'Destino',CentroCusto:'CC-2'}];}
   if(q.startsWith('SELECT p.PrestadorId')){assert.match(q,/pf.DepositoId=2/);assert.match(q,/pf.RevogadoEmUtc IS NULL/);assert.match(q,/p.Ativo=1/);return options.unlinked?[]:[{PrestadorId:8}];}
   if(q.startsWith('SELECT u.UsuarioId')){assert.match(q,/u.Ativo=1/);assert.match(q,/rf.DepositoId=2/);return options.managerDenied?[]:[{UsuarioId:1}];}
   if(q.includes('MAX(Numero)')){assert.match(q,/ContratacaoNumeroExcluido/);assert.match(q,/ContratacaoNumeroTransferido/);assert.match(q,/DepositoId=2/);return [{Numero:12}];}
   if(q.startsWith('UPDATE Operacao.Contratacao SET'))Object.assign(row,{DepositoId:2,Deposito:'Destino',CentroCusto:'CC-2',Numero:12,Versao:2});
   if(options.auditFail&&q.startsWith('INSERT Seguranca.Auditoria'))throw Error('audit failure');
   return [];
  }};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/pc04/contratacoes/7/deposito`,{method:'POST',headers:{'content-type':'application/json',origin:'http://local.test'},body:JSON.stringify({...body,...options.body})});const data=await r.json();assert.equal(r.status,options.status||200,JSON.stringify(data));if(options.error)assert.equal(data.erro,options.error);if(r.ok){assert.equal(commits,1);assert.equal(rollbacks,0);assert.equal(data.resultado.DepositoId,2);assert.equal(data.resultado.Numero,12);assert.equal(data.resultado.Valor,original.Valor);const update=sql.find(q=>q.startsWith('UPDATE Operacao.Contratacao SET'));assert.doesNotMatch(update,/Valor=|InicioPrevisto=|FimPrevisto=|EntradaReal=|SaidaReal=|PrestadorId=/);assert.ok(sql.some(q=>q.startsWith('INSERT Operacao.ContratacaoNumeroTransferido')));assert.ok(sql.some(q=>q.includes("'DEPOSITO'")));assert.ok(sql.some(q=>q.startsWith('UPDATE Operacao.ContratacaoToken')));}else if(sql.length){assert.equal(commits,0);assert.equal(rollbacks,1);}return sql;}finally{mock.mock.restore();}
 }
 await t.test('sucesso preserva contrato, valor/horários e registra auditoria',()=>run());
 for(const [name,options]of [
  ['origem fora do acesso',{originDenied:true,status:404,error:'CONTRATACAO_INDISPONIVEL'}],
  ['destino fora do acesso ou inativo',{targetDenied:true,status:403,error:'DEPOSITO_NAO_AUTORIZADA'}],
  ['prestador inativo ou vínculo revogado',{unlinked:true,status:409,error:'PRESTADOR_SEM_VINCULO_ATIVO'}],
  ['gestor sem vínculo no destino',{managerDenied:true,status:403,error:'GESTOR_RESPONSAVEL_INDISPONIVEL'}],
  ['financeiro não altera',{actor:{UsuarioId:1,Financeiro:1},status:403,error:'PERMISSAO_NEGADA'}],
  ['gestor não atribui outro responsável',{body:{gestorId:9},status:403,error:'GESTOR_RESPONSAVEL_FIXO'}],
  ['mesmo depósito',{body:{depositoId:1},status:409,error:'DEPOSITO_INALTERADO'}],
  ['versão vencida',{body:{versao:2},status:409,error:'REGISTRO_ALTERADO_ATUALIZE'}],
  ['liberada',{row:{Status:'LIBERADA'},status:409,error:'CONTRATACAO_LIBERADA_BLOQUEADA'}],
  ['liberação histórica',{row:{LiberacaoBloqueada:1},status:409,error:'CONTRATACAO_LIBERADA_BLOQUEADA'}],
  ['paga',{row:{PagoEmUtc:'2026-11-17'},status:409,error:'CONTRATACAO_PAGA_PRESERVADA'}],
  ['cancelada',{row:{Status:'CANCELADA'},status:409,error:'CONTRATACAO_CANCELADA'}],
  ['horários pendentes',{row:{HorarioPendenteId:4},status:409,error:'HORARIOS_PENDENTES_APROVACAO'}],
  ['motivo vazio',{body:{motivo:' '},status:400,error:'MOTIVO_OBRIGATORIO'}],
  ['identificador hostil',{body:{depositoId:'2;DROP TABLE X'},status:400,error:'IDENTIFICADOR_INVALIDO'}],
  ['falha na auditoria reverte',{auditFail:true,status:503,error:'CONTRATACOES_INDISPONIVEIS'}]
 ])await t.test(name,()=>run(options));
});
