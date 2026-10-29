import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountBranchCatalog} from '../src/pc02-routes.js';
import {normalizeCatalog,save} from '../src/pc02.js';
import odbc from 'odbc';

const branch={nome:'Filial Norte',codigo:' n-01 ',endereco:'Rua das Flores, 10 — Campinas/SP'};
const type={nome:'Carga e descarga',descricao:''};
test('PC-02 HTTP: campos, edição, inativação e fronteiras ADM/origem/MFA',async t=>{
 const app=express();app.use(express.json());const rows={filiais:[],servicos:[]};let writes=0;
 const session=(req,res,next)=>{const role=req.get('x-role');if(!role)return res.sendStatus(401);req.user={id:1,perfil:role};req.rawSession='session';next();};
 const sameOrigin=(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403);
 const service={
  read:async(_cfg,actor,kind,role)=>({pc02:true,podeEditar:role==='ADMIN',registros:rows[kind]}),
  save:async(_cfg,actor,token,kind,body,id,role,mfa)=>{
   if(role!=='ADMIN')throw Object.assign(Error('SOMENTE_ADM'),{status:403});
   if(mfa!=='ok')throw Object.assign(Error('MFA_RECENTE_OBRIGATORIO'),{status:403});
   const v=normalizeCatalog(kind,body,id!==undefined);writes++;
   const row=kind==='filiais'?{FilialId:id||1,Nome:v.nome,Codigo:v.codigo,Endereco:v.endereco,Ativo:v.ativo}:{TipoServicoId:id||1,Nome:v.nome,Descricao:v.descricao,Ativo:v.ativo};rows[kind]=[row];return row;
  }
 };
 // Preserve service signature; test-only role/MFA derive from session middleware.
 const injected={read:(cfg,actor,kind,req)=>service.read(cfg,actor,kind,req.user.perfil),save:(cfg,actor,token,kind,body,id,req)=>service.save(cfg,actor,token,kind,body,id,req.user.perfil,req.get('x-mfa'))};
 mountBranchCatalog(app,{pc01:true,pc02:true},{session,sameOrigin},injected);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/b24a`;
 const call=(kind,body,role='ADMIN',suffix='',headers={})=>fetch(base+'/'+kind+suffix,{method:body?(suffix?'PUT':'POST'):'GET',headers:{'Content-Type':'application/json',origin:'http://local.test','x-mfa':'ok',...(role?{'x-role':role}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('filiais',branch,null)).status,401);
 for(const role of ['GESTOR','FINANCEIRO'])for(const kind of ['filiais','servicos'])assert.equal((await call(kind,kind==='filiais'?branch:type,role)).status,403);
 assert.equal((await call('filiais',branch,'ADMIN','',{origin:'http://evil.test'})).status,403);
 assert.equal((await call('filiais',branch,'ADMIN','',{'x-mfa':'no'})).status,403);assert.equal(writes,0);
 const created=await call('filiais',branch);assert.equal(created.status,201);assert.equal((await created.json()).resultado.Endereco,branch.endereco);
 const data=await (await call('filiais')).json();assert.equal(data.pc02,true);assert.equal(data.registros[0].Codigo,'N-01');
 const edit={...branch,nome:'Filial Atualizada',ativo:false,original:{...branch,codigo:'N-01',ativo:true}};
 assert.equal((await call('filiais',edit,'ADMIN','/1')).status,200);assert.equal(rows.filiais[0].Ativo,false);
 assert.equal((await call('filiais',edit,'GESTOR','/1')).status,403);
 assert.equal((await call('filiais',{...branch,endereco:''})).status,400);
 assert.equal((await call('filiais',{...branch,perfil:'ADMIN'})).status,400);
 assert.equal((await call('servicos',type)).status,201);
 assert.equal((await call('servicos',{...type,descricao:'Equipe para descarga',ativo:false,original:{...type,ativo:true}},'ADMIN','/1')).status,200);
 assert.equal(rows.servicos[0].Descricao,'Equipe para descarga');assert.equal(rows.servicos[0].Ativo,false);
 assert.equal((await call('servicos',{...type,ativo:'false'})).status,400);
 assert.equal((await call('servicos',{...type,ativo:false,original:type},'ADMIN','/0')).status,400);
});
test('PC-02 valida campos estritamente e mantém descrição opcional',()=>{
 assert.equal(normalizeCatalog('servicos',{nome:'Frete'},false).descricao,'');
 for(const body of [null,[],{...branch,endereco:1},{...branch,codigo:'A B'},{...branch,endereco:'x'.repeat(401)},{...branch,ativo:'true'}])assert.throws(()=>normalizeCatalog('filiais',body,false));
 assert.throws(()=>normalizeCatalog('servicos',{...type,original:{}},true));
});
test('PC-02 requer ativação explícita e PC-01',()=>{
 const app=express();assert.throws(()=>mountBranchCatalog(app,{pc02:true},{}));
 assert.doesNotThrow(()=>mountBranchCatalog(app,{pc01:true},{}));
});
test('PC-02 serviço real revalida ADM/MFA, rejeita estado antigo e reverte falha de auditoria',async t=>{
 // Script only the ODBC transport. Execute production save/assertAdminDb/assertMfa.
 // This protects orchestration and rollback; actual SQL semantics are opt-in E2E.
 const cases=[
  {name:'ADM revogado',responses:[[],[{R:0}],[]],error:'SOMENTE_ADM'},
  {name:'MFA expirado',responses:[[],[{R:0}],[{UsuarioId:1}],[]],error:'MFA_RECENTE_OBRIGATORIO'},
  {name:'edição desatualizada',editing:true,responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[{FilialId:1,Codigo:'N-01',Nome:'Nome concorrente',Endereco:branch.endereco,Ativo:1}]],error:'REGISTRO_ALTERADO_ATUALIZE'},
  {name:'código duplicado',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[{FilialId:9}]],error:'CODIGO_DUPLICADO'},
  {name:'falha auditoria',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[],[{FilialId:1,...branch}],Error('AUDIT_FAILURE')],error:'AUDIT_FAILURE'},
  {name:'sucesso',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[],[{FilialId:1,Nome:branch.nome,Codigo:'N-01',Endereco:branch.endereco,Ativo:true}],[]]}
 ];
 for(const scenario of cases)await t.test(scenario.name,async()=>{
  let began=0,commits=0,rollbacks=0,closed=0;const responses=[...scenario.responses];
  const db={query:async()=>{assert.ok(responses.length,'Consulta inesperada');const result=responses.shift();if(result instanceof Error)throw result;return result;},beginTransaction:async()=>{began++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{closed++;}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{
   const body=scenario.editing?{...branch,ativo:false,original:{...branch,codigo:'N-01',ativo:true}}:branch;
   const action=()=>save({driver:'test',server:'test',database:'test'},1,'session','filiais',body,scenario.editing?1:undefined);
   if(scenario.error)await assert.rejects(action,e=>e.message===scenario.error);else assert.equal((await action()).Endereco,branch.endereco);
   assert.equal(began,1);assert.equal(commits,scenario.error?0:1);assert.equal(rollbacks,scenario.error?1:0);assert.equal(closed,1);assert.equal(responses.length,0);
  }finally{mock.mock.restore();}
 });
});
