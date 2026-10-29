import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountContracts} from '../src/pc04-routes.js';

test('PC-07 HTTP: comparação informativa autorizada e precisa',async t=>{
 const app=express();
 mountContracts(app,{pc01:true,pc02:true,pc03:true,pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};next();},sameOrigin:(_req,_res,next)=>next()});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/pc04/media`,input={filialId:'1',tipoServicoId:'2',dataServico:'2026-10-28',valor:'100.01'};
 const manager={UsuarioId:1,Adm:0,Gestor:1,Financeiro:0};
 async function run({query={},actor=manager,branch=true,rows=Array(5).fill({Valor:'100.00'}),status=200,check,existing}={}){
  const sql=[],queue=[[],actor?[actor]:[],...(actor&&(actor.Adm||actor.Gestor)?[branch?[{FilialId:1}]:[],...(branch?[...(existing===undefined?[]:[existing]),rows]:[])]:[])];let commits=0,rollbacks=0;
  const db={query:async statement=>{sql.push(statement);assert.ok(queue.length,'SQL inesperado '+statement);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await fetch(base+'?'+new URLSearchParams({...input,...query}),{headers:{'x-user':'1'}}),body=await response.json();assert.equal(response.status,status,JSON.stringify(body));check?.(body,sql);assert.equal(commits,status<400?1:0);assert.equal(rollbacks,status>=400?1:0);}finally{mock.mock.restore();}
 }
 await t.test('gestor vê média/amostra e aviso sem escrita',()=>run({check:(r,sql)=>{assert.equal(r.media,'100.00');assert.equal(r.quantidade,5);assert.equal(r.acima,true);assert.ok(sql.every(s=>!/^\s*(INSERT|UPDATE|DELETE)/i.test(s)));}}));
 await t.test('igual não avisa',()=>run({query:{valor:'100.00'},check:r=>assert.equal(r.acima,false)}));
 await t.test('abaixo não avisa',()=>run({query:{valor:'99.99'},check:r=>assert.equal(r.acima,false)}));
 for(const count of [0,4])await t.test('sem base '+count,()=>run({rows:Array(count).fill({Valor:'100.00'}),check:r=>{assert.equal(r.media,null);assert.equal(r.quantidade,count);assert.equal(r.acima,false);}}));
 await t.test('comparação exata antes do arredondamento',()=>run({rows:[{Valor:'100.01'},...Array(4).fill({Valor:'100.00'})],check:r=>{assert.equal(r.media,'100.00');assert.equal(r.acima,true);}}));
 await t.test('valores grandes não perdem centavos',()=>run({query:{valor:'9999999999999999.99'},rows:Array(20).fill({Valor:'9999999999999999.98'}),check:r=>{assert.equal(r.media,'9999999999999999.98');assert.equal(r.acima,true);assert.equal(r.quantidade,20);}}));
 await t.test('base zero é válida',()=>run({query:{valor:'0.01'},rows:Array(5).fill({Valor:'0.00'}),check:r=>{assert.equal(r.media,'0.00');assert.equal(r.acima,true);}}));
 await t.test('gestor alheio recusado',()=>run({branch:false,status:403,check:r=>assert.equal(r.erro,'FILIAL_NAO_AUTORIZADA')}));
 await t.test('financeiro isolado recusado',()=>run({actor:{...manager,Gestor:0,Financeiro:1},status:403}));
 await t.test('perfil misto não amplia filial',()=>run({actor:{...manager,Financeiro:1},branch:false,status:403}));
 await t.test('ator revogado recusado',()=>run({actor:null,status:403}));
 await t.test('ADM autorizado',()=>run({actor:{...manager,Adm:1},check:r=>assert.equal(r.quantidade,5)}));
 await t.test('revisão exclui própria e valida contexto',()=>run({query:{contratacaoId:'7'},existing:[{ContratacaoId:7,FilialId:1,TipoServicoId:2,DataServico:input.dataServico}],check:r=>assert.equal(r.quantidade,5)}));
 await t.test('id alheio não divulga base',()=>run({query:{contratacaoId:'7'},existing:[],status:404}));
 await t.test('contexto de revisão forjado recusado',()=>run({query:{contratacaoId:'7'},existing:[{ContratacaoId:7,FilialId:2,TipoServicoId:2,DataServico:input.dataServico}],status:400}));
 for(const query of [{dataServico:'2026-02-30'},{dataServico:'x'},{filialId:'1 OR 1=1'},{valor:'10.001'},{tipoServicoId:['2','3']},{extra:'x'}])await t.test('entrada inválida '+JSON.stringify(query),async()=>{
  const mock=t.mock.method(odbc,'connect',async()=>{throw Error('não deve conectar');});try{const response=await fetch(base+'?'+new URLSearchParams({...input,...query}),{headers:{'x-user':'1'}});assert.equal(response.status,400);}finally{mock.mock.restore();}
 });
 assert.equal((await fetch(base+'?'+new URLSearchParams(input))).status,401);
});
