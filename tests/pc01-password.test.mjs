import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountUserAdmin} from '../src/pc01-routes.js';
import {normalizePasswordChange} from '../src/pc01.js';

test('troca de senha valida limite, composição, confirmação e contrato fechado',()=>{
 assert.deepEqual(normalizePasswordChange({senha:'Aa1!bc',confirmacao:'Aa1!bc'}),{senha:'Aa1!bc'});
 assert.deepEqual(normalizePasswordChange({senhaAtual:'anterior',senha:'Aa1!bc',confirmacao:'Aa1!bc'},true),{senha:'Aa1!bc',senhaAtual:'anterior'});
 for(const body of [null,[],{senha:'Aa1!b',confirmacao:'Aa1!b'},{senha:'abcdef',confirmacao:'abcdef'},{senha:'Aa1!bc',confirmacao:'Aa1!bd'},{senha:'Aa1!bc',confirmacao:'Aa1!bc',usuarioId:2},{senha:'Aa1!'+'b'.repeat(125),confirmacao:'Aa1!'+'b'.repeat(125)}])assert.throws(()=>normalizePasswordChange(body));
 assert.throws(()=>normalizePasswordChange({senha:'Aa1!bc',confirmacao:'Aa1!bc'},true));
 assert.throws(()=>normalizePasswordChange({senhaAtual:[],senha:'Aa1!bc',confirmacao:'Aa1!bc'},true));
});

test('HTTP troca de senha: usuário altera só a própria; reset exige ADM, origem e MFA',async t=>{
 const app=express();app.use(express.json());let writes=[];
 const session=(req,res,next)=>{const role=req.get('x-role');if(!role)return res.sendStatus(401);req.user={id:7,perfil:role};req.rawSession='token';next();};
 const sameOrigin=(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403);
 const service={
  assertAdmin:async(_cfg,_id,_token,role)=>{if(role!=='ADMIN')throw Object.assign(Error('SOMENTE_ADM'),{status:403});},
  assertMfa:async(_cfg,_id,_token,req)=>{if(req.get('x-mfa')!=='ok')throw Object.assign(Error('MFA_RECENTE_OBRIGATORIO'),{status:403});},
  changeOwnPassword:async(_cfg,actor,_token,body)=>{normalizePasswordChange(body,true);writes.push({actor});return {usuarioId:String(actor),sessoesRevogadas:true};},
  resetPassword:async(_cfg,actor,_token,body,id)=>{normalizePasswordChange(body);writes.push({actor,id});return {usuarioId:id,sessoesRevogadas:true};}
 };
 mountUserAdmin(app,{pc01:true},{session,sameOrigin},service);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 const body={senha:'Aa1!bc',confirmacao:'Aa1!bc'};
 const call=(path,role,patch={},data=body)=>fetch(base+path,{method:'POST',headers:{origin:'http://local.test','content-type':'application/json','x-mfa':'ok',...(role?{'x-role':role}:{}),...patch},body:JSON.stringify(data)});
 assert.equal((await call('/api/pc01/minha-senha')).status,401);
 assert.equal((await call('/api/pc01/minha-senha','GESTOR',{}, {...body,senhaAtual:'Anterior!1'})).status,200);
 assert.deepEqual(writes,[{actor:7}]);
 for(const role of ['GESTOR','FINANCEIRO'])assert.equal((await call('/api/pc01/usuarios/9/senha',role)).status,403);
 assert.equal((await call('/api/pc01/usuarios/9/senha','ADMIN',{origin:'http://evil.test'})).status,403);
 assert.equal((await call('/api/pc01/usuarios/9/senha','ADMIN',{'x-mfa':'no'})).status,403);
 assert.equal((await call('/api/pc01/usuarios/0/senha','ADMIN')).status,400);
 assert.equal((await call('/api/pc01/minha-senha','FINANCEIRO',{}, {...body,senhaAtual:'anterior',usuarioId:9})).status,400);
 assert.equal(writes.length,1);
 assert.equal((await call('/api/pc01/usuarios/9/senha','ADMIN')).status,200);
 assert.deepEqual(writes.at(-1),{actor:7,id:'9'});
});
