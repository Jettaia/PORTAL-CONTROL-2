import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountUserAdmin} from '../src/pc01-routes.js';
import {normalizeAccount} from '../src/pc01.js';

const account={nome:'Pessoa Teste',email:'  PESSOA@EXAMPLE.TEST ',funcoes:['GESTOR','FINANCEIRO'],filiais:[1,2],ativo:true,senha:'SenhaSomenteDeTeste!123'};
test('conta mantém funções explícitas e normaliza e-mail; recusa campos forjados',()=>{
 assert.equal(normalizeAccount(account,true).email,'pessoa@example.test');
 for(const patch of [{funcoes:[]},{funcoes:['DIRETORIA']},{funcoes:['GESTOR','GESTOR']},{filiais:[0]},{filiais:[1,1]},{ativo:'false'},{senha:'fraca'},{raiz:true},{nome:''}])assert.throws(()=>normalizeAccount({...account,...patch},true));
 assert.throws(()=>normalizeAccount({...account,senha:undefined},true));
 assert.throws(()=>normalizeAccount(account,false)); // edição não redefine senha
});

test('HTTP: ADM cria e edita; nega anônimo, gestor, financeiro, origem e MFA ausente',async t=>{
 const app=express();app.use(express.json());let calls=0;
 const session=(req,res,next)=>{const role=req.get('x-test-role');if(!role)return res.sendStatus(401);req.user={id:1,perfil:role};req.rawSession='test';next();};
 const sameOrigin=(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403);
 const service={
  assertAdmin:async(_cfg,id,token,role)=>{if(role!=='ADMIN')throw Object.assign(Error('SOMENTE_ADM'),{status:403});if(token!=='test')throw Error('token');},
  assertMfa:async(_cfg,_id,_token,req)=>{if(req.get('x-test-mfa')!=='ok')throw Object.assign(Error('MFA_RECENTE_OBRIGATORIO'),{status:403});},
  catalog:async()=>({usuarios:[],filiais:[]}),
  save:async(_cfg,_actor,_token,body,id)=>{calls++;normalizeAccount(body,!id);return {usuarioId:id||2};}
 };
 mountUserAdmin(app,{pc01:true},{session,sameOrigin},service);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const url=`http://127.0.0.1:${server.address().port}/api/pc01/usuarios`;
 const call=(role,patch={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',origin:'http://local.test','x-test-mfa':'ok',...(role?{'x-test-role':role}:{}),...patch},body:JSON.stringify(account)});
 assert.equal((await call()).status,401);
 for(const role of ['GESTOR','FINANCEIRO'])assert.equal((await call(role)).status,403);
 assert.equal((await call('ADMIN',{origin:'http://evil.test'})).status,403);
 assert.equal((await call('ADMIN',{'x-test-mfa':'no'})).status,403);
 assert.equal(calls,0);
 const good=await call('ADMIN');assert.equal(good.status,201);assert.equal((await good.json()).usuarioId,2);
 const {senha,...edit}=account;
 const update=await fetch(url+'/2',{method:'PUT',headers:{'Content-Type':'application/json',origin:'http://local.test','x-test-role':'ADMIN','x-test-mfa':'ok'},body:JSON.stringify({...edit,ativo:false})});
 assert.equal(update.status,200);assert.equal(calls,2);
 const bad=await fetch(url+'/0',{method:'PUT',headers:{'Content-Type':'application/json',origin:'http://local.test','x-test-role':'ADMIN','x-test-mfa':'ok'},body:JSON.stringify(edit)});assert.equal(bad.status,400);assert.equal(calls,2);
});

test('rotas PC-01 indisponíveis sem ativação explícita',async t=>{
 const app=express();mountUserAdmin(app,{},{});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/pc01/usuarios`)).status,404);
});
