import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountBranchCatalog} from '../src/pc02-routes.js';
import {normalizeCatalog,save} from '../src/pc02.js';
import odbc from 'odbc';

const branch={nome:'Depósito Norte',centroCusto:'CC-01',rua:'Rua das Flores',numero:'10',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010000'};
const type={nome:'Carga e descarga',descricao:''};
test('PC-02 HTTP: campos, edição, inativação e fronteiras ADM/origem/MFA',async t=>{
 const app=express();app.use(express.json());const rows={depositos:[],servicos:[]};let writes=0;
 const session=(req,res,next)=>{const role=req.get('x-role');if(!role)return res.sendStatus(401);req.user={id:1,perfil:role};req.rawSession='session';next();};
 const sameOrigin=(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403);
 const service={
  read:async(_cfg,actor,kind,role)=>({pc02:true,podeEditar:role==='ADMIN',registros:rows[kind]}),
  save:async(_cfg,actor,token,kind,body,id,role,mfa)=>{
   if(role!=='ADMIN')throw Object.assign(Error('SOMENTE_ADM'),{status:403});
   if(mfa!=='ok')throw Object.assign(Error('MFA_RECENTE_OBRIGATORIO'),{status:403});
   const v=normalizeCatalog(kind,body,id!==undefined);writes++;
   const row=kind==='depositos'?{DepositoId:id||1,Nome:v.nome,CentroCusto:v.centroCusto,Rua:v.rua,Numero:v.numero,Bairro:v.bairro,Cidade:v.cidade,Estado:v.estado,CEP:v.cep,Ativo:v.ativo}:{TipoServicoId:id||1,Nome:v.nome,Descricao:v.descricao,Ativo:v.ativo};rows[kind]=[row];return row;
  }
 };
 // Preserve service signature; test-only role/MFA derive from session middleware.
 const injected={read:(cfg,actor,kind,req)=>service.read(cfg,actor,kind,req.user.perfil),save:(cfg,actor,token,kind,body,id,req)=>service.save(cfg,actor,token,kind,body,id,req.user.perfil,req.get('x-mfa'))};
 mountBranchCatalog(app,{pc01:true,pc02:true},{session,sameOrigin},injected);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}/api/b24a`;
 const call=(kind,body,role='ADMIN',suffix='',headers={})=>fetch(base+'/'+kind+suffix,{method:body?(suffix?'PUT':'POST'):'GET',headers:{'Content-Type':'application/json',origin:'http://local.test','x-mfa':'ok',...(role?{'x-role':role}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('depositos',branch,null)).status,401);
 for(const role of ['GESTOR','FINANCEIRO'])for(const kind of ['depositos','servicos'])assert.equal((await call(kind,kind==='depositos'?branch:type,role)).status,403);
 assert.equal((await call('depositos',branch,'ADMIN','',{origin:'http://evil.test'})).status,403);
 assert.equal((await call('depositos',branch,'ADMIN','',{'x-mfa':'no'})).status,403);assert.equal(writes,0);
 const created=await call('depositos',branch);assert.equal(created.status,201);assert.equal((await created.json()).resultado.Rua,branch.rua);
 const data=await (await call('depositos')).json();assert.equal(data.pc02,true);assert.equal(data.registros[0].CentroCusto,'CC-01');
 const edit={...branch,nome:'Depósito Atualizado',ativo:false,original:{...branch,ativo:true}};
 assert.equal((await call('depositos',edit,'ADMIN','/1')).status,200);assert.equal(rows.depositos[0].Ativo,false);
 assert.equal((await call('depositos',edit,'GESTOR','/1')).status,403);
 assert.equal((await call('depositos',{...branch,rua:''})).status,400);
 assert.equal((await call('depositos',{...branch,perfil:'ADMIN'})).status,400);
 assert.equal((await call('servicos',type)).status,201);
 assert.equal((await call('servicos',{...type,descricao:'Equipe para descarga',ativo:false,original:{...type,ativo:true}},'ADMIN','/1')).status,200);
 assert.equal(rows.servicos[0].Descricao,'Equipe para descarga');assert.equal(rows.servicos[0].Ativo,false);
 assert.equal((await call('servicos',{...type,ativo:'false'})).status,400);
 assert.equal((await call('servicos',{...type,ativo:false,original:type},'ADMIN','/0')).status,400);
});
test('PC-02 valida campos estritamente e mantém descrição opcional',()=>{
 assert.equal(normalizeCatalog('servicos',{nome:'Frete'},false).descricao,'');
 for(const body of [null,[],{...branch,rua:1},{...branch,estado:'XX'},{...branch,cep:'123'},{...branch,centroCusto:''},{...branch,numero:''},{...branch,bairro:''},{...branch,rua:'x'.repeat(201)},{...branch,ativo:'true'},{...branch,filialId:1}])assert.throws(()=>normalizeCatalog('depositos',body,false));
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
  {name:'ADM revogado sem função de coordenador',responses:[[],[{R:0}],[],[]],error:'SOMENTE_ADM'},
  {name:'MFA expirado',responses:[[],[{R:0}],[{UsuarioId:1}],[]],error:'MFA_RECENTE_OBRIGATORIO'},
  {name:'edição desatualizada',editing:true,responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[{DepositoId:1,Nome:'Nome concorrente',Ativo:1}]],error:'REGISTRO_ALTERADO_ATUALIZE'},
  {name:'nome duplicado',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[{DepositoId:9}]],error:'NOME_DUPLICADO'},
  {name:'falha auditoria',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[],[{DepositoId:1,...branch}],[],Error('AUDIT_FAILURE')],error:'AUDIT_FAILURE'},
  {name:'sucesso',responses:[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[],[{DepositoId:1,Nome:branch.nome,Rua:branch.rua,Ativo:true}],[],[]]}
 ];
 for(const scenario of cases)await t.test(scenario.name,async()=>{
  let began=0,commits=0,rollbacks=0,closed=0;const responses=[...scenario.responses];
  const db={query:async()=>{assert.ok(responses.length,'Consulta inesperada');const result=responses.shift();if(result instanceof Error)throw result;return result;},beginTransaction:async()=>{began++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{closed++;}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{
   const body=scenario.editing?{...branch,ativo:false,original:{...branch,ativo:true}}:branch;
   const action=()=>save({driver:'test',server:'test',database:'test'},1,'session','depositos',body,scenario.editing?1:undefined);
   if(scenario.error)await assert.rejects(action,e=>e.message===scenario.error);else assert.equal((await action()).Rua,branch.rua);
   assert.equal(began,1);assert.equal(commits,scenario.error?0:1);assert.equal(rollbacks,scenario.error?1:0);assert.equal(closed,1);assert.equal(responses.length,0);
  }finally{mock.mock.restore();}
 });
});
