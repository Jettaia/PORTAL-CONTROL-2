import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountProviders} from '../src/pc03-routes.js';
import {addParticipant} from '../src/b3.js';

const person={PrestadorId:7,Nome:'Pessoa Teste',CPF:'12345678901',Telefone:'',CNPJ:'',Ativo:1,Versao:1};
const body={nome:'Pessoa Teste',cpf:'123.456.789-01',telefone:'',cnpj:'',filiais:[1]};
// Execute actual HTTP routes + production service. Only SQL transport is scripted.
test('PC-03 API e serviço real: CPF único, escopo, edição, vínculo e rollback',async t=>{
 const app=express();app.use(express.json());
 mountProviders(app,{pc01:true,pc02:true,pc03:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:req.get('x-user')};req.rawSession='test-session';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(suffix='',data,method=data?'POST':'GET',headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/b24a/chapas${suffix}`,{method,headers:{'content-type':'application/json',origin:'http://local.test','x-user':'1',...headers},...(data?{body:JSON.stringify(data)}:{})});
 assert.equal((await call('',body,'POST',{'x-user':''})).status,401);
 assert.equal((await call('',body,'POST',{origin:'http://evil.test'})).status,403);
 const manager={UsuarioId:1,Adm:0,Gestor:1},admin={UsuarioId:1,Adm:1,Gestor:1};
 const scenarios=[
  {name:'criação sem filial',data:{...body,filiais:[]},status:400,sql:[]},
  {name:'campo de bloqueio local recusado',data:{...body,bloqueado:true},status:400,sql:[]},
  {name:'CPF inválido recusado',data:{...body,cpf:'abc12345678901'},status:400,sql:[]},
  {name:'CNPJ não textual recusado',data:{...body,cnpj:0},status:400,sql:[]},
  {name:'sessão revogada no banco',data:body,status:403,sql:[[],[{R:0}],[]]},
  {name:'timeout da trava sem escrita',data:body,status:409,sql:[[],[{R:-1}]]},
  {name:'nome incompleto',data:{...body,nome:'Pessoa'},status:400,sql:[]},
  {name:'financeiro isolado',data:body,status:403,sql:[[],[{R:0}],[{UsuarioId:1,Adm:0,Gestor:0}]]},
  {name:'filial forjada',data:{...body,filiais:[2]},status:403,sql:[[],[{R:0}],[manager],[{V:1}],[]]},
  {name:'CPF existente não sobrescreve',data:body,status:409,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[person]]},
  {name:'criação opcionais vazios',data:body,status:201,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[],[person],[],[]],check:r=>assert.equal(r.resultado.PrestadorId,7)},
  {name:'MFA expirado',data:body,status:403,sql:[[],[{R:0}],[manager],[]]},
  {name:'gestor não corrige CPF',suffix:'/7',method:'PUT',data:{nome:person.Nome,cpf:'12345678902',telefone:'',cnpj:'',ativo:true,versao:1},status:403,sql:[[],[{R:0}],[manager],[{V:1}],[person],[{V:1}]]},
  {name:'gestor não inativa',suffix:'/7',method:'PUT',data:{nome:person.Nome,cpf:person.CPF,ativo:false,versao:1},status:403,sql:[[],[{R:0}],[manager],[{V:1}],[person],[{V:1}]]},
  {name:'gestor sem vínculo não edita dados comuns',suffix:'/7',method:'PUT',data:{nome:'Pessoa Nova',cpf:person.CPF,ativo:true,versao:1},status:403,sql:[[],[{R:0}],[manager],[{V:1}],[person],[]]},
  {name:'edição desatualizada',suffix:'/7',method:'PUT',data:{nome:'Pessoa Nova',cpf:person.CPF,ativo:true,versao:2},status:409,sql:[[],[{R:0}],[manager],[{V:1}],[person],[{V:1}]]},
  {name:'edição comum auditada',suffix:'/7',method:'PUT',data:{nome:'Pessoa Nova',cpf:person.CPF,ativo:true,versao:1},status:200,sql:[[],[{R:0}],[manager],[{V:1}],[person],[{V:1}],[],[{...person,Nome:'Pessoa Nova',Versao:2}],[]]},
  {name:'ADM corrige CPF sem duplicar',suffix:'/7',method:'PUT',data:{nome:person.Nome,cpf:'12345678902',ativo:true,versao:1},status:409,sql:[[],[{R:0}],[admin],[{V:1}],[person],[{PrestadorId:9}]]},
  {name:'ADM corrige e inativa preservando ID',suffix:'/7',method:'PUT',data:{nome:person.Nome,cpf:'12345678902',ativo:false,versao:1},status:200,sql:[[],[{R:0}],[admin],[{V:1}],[person],[],[{...person,CPF:'12345678902',Ativo:0,Versao:2}],[]],check:r=>{assert.equal(r.resultado.PrestadorId,7);assert.equal(r.resultado.Ativo,0);}},
  {name:'remoção último vínculo permitida',suffix:'/7/filiais/1',method:'PUT',data:{vinculado:false},status:200,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[person],[],[]]},
  {name:'adicionar vínculo existente é idempotente',suffix:'/7/filiais/1',method:'PUT',data:{vinculado:true},status:200,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[person],[],[]]},
  {name:'gestor não remove vínculo alheio',suffix:'/7/filiais/2',method:'PUT',data:{vinculado:false},status:403,sql:[[],[{R:0}],[manager],[{V:1}],[]]},
  {name:'prestador inativo não recebe vínculo novo',suffix:'/7/filiais/1',method:'PUT',data:{vinculado:true},status:409,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[{...person,Ativo:0}]]},
  {name:'falha de auditoria reverte vínculo',suffix:'/7/filiais/1',method:'PUT',data:{vinculado:false},status:503,sql:[[],[{R:0}],[manager],[{V:1}],[{FilialId:1}],[person],[],Error('audit fail')]},
  {name:'busca CPF global sem expor outras filiais',suffix:'?cpf=12345678901',status:200,sql:[[manager],[person],[{FilialId:1,Nome:'Filial A',Ativo:1}],[]],check:r=>{assert.equal(r.registros[0].PrestadorId,7);assert.deepEqual(r.vinculos,[]);}},
 ];
 for(const scenario of scenarios)await t.test(scenario.name,async()=>{
  const queue=[...scenario.sql];let commits=0,rollbacks=0,began=0;const statements=[];
  const db={query:async sql=>{statements.push(sql);assert.ok(queue.length,'SQL inesperado: '+sql);const v=queue.shift();if(v instanceof Error)throw v;return v;},beginTransaction:async()=>{began++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await call(scenario.suffix,scenario.data,scenario.method);const result=await response.json();assert.equal(response.status,scenario.status,JSON.stringify(result));scenario.check?.(result);assert.equal(queue.length,0);assert.equal(commits,began&&scenario.status<400?1:0);assert.equal(rollbacks,began&&scenario.status>=400?1:0);
   if(scenario.name==='remoção último vínculo permitida')assert.ok(statements.some(s=>s.startsWith('UPDATE Cadastro.PrestadorFilial')));
  }finally{mock.mock.restore();}
 });
});

test('PC-03 inclusão operacional não aceita pessoa sem vínculo atual na filial',async t=>{
 let execution=false;
 const db={query:async sql=>{
  if(sql.includes('EXEC Operacao.sp_AdicionarParticipantePlanejado')){execution=true;return [{ParticipacaoId:1}];}
  if(sql.includes('Cadastro.PrestadorFilial'))return [];
  if(sql.includes('AS Pode'))return [{Pode:1}];
  if(sql.startsWith('SELECT a.AtividadeId'))return [{AtividadeId:1,FilialId:1}];
  return [];
 },beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}};
 t.mock.method(odbc,'connect',async()=>db);
 await assert.rejects(()=>addParticipant({pc03:true},1,1,{prestadorId:7,valorContratado:'100.00'}),e=>e.message==='PRESTADOR_SEM_VINCULO_ATIVO');
 assert.equal(execution,false);
});

test('PC-03 inclusão operacional aceita pessoa ativa vinculada à filial',async t=>{
 let execution=false;
 const db={query:async sql=>{
  if(sql.includes('EXEC Operacao.sp_AdicionarParticipantePlanejado')){execution=true;return [{ParticipacaoId:8}];}
  if(sql.includes('Cadastro.PrestadorFilial'))return [{PrestadorId:7}];
  if(sql.includes('AS Pode'))return [{Pode:1}];
  if(sql.startsWith('SELECT a.AtividadeId'))return [{AtividadeId:1,FilialId:1}];
  return [];
 },beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{}};
 t.mock.method(odbc,'connect',async()=>db);
 assert.equal((await addParticipant({pc03:true},1,1,{prestadorId:7,valorContratado:'100.00'})).participacaoId,8);
 assert.equal(execution,true);
});
