import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountContracts} from '../src/pc04-routes.js';

test('Exclusão HTTP: ADMIN real, MFA recente, sessão e lock obrigatórios',async t=>{
 const cfg={pc01:true,pc02:true,pc03:true,pc04:true,mfaRequired:true},app=express();app.use(express.json());
 mountContracts(app,cfg,{session:(req,res,next)=>{req.user={id:1};req.rawSession='test-session';next();},sameOrigin:(_req,_res,next)=>next()});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const admin={UsuarioId:1,Adm:1,Coordenador:0,Gestor:0,Financeiro:0},body={versao:1,motivo:'Duplicidade confirmada',confirmar:true};
 async function denied({suffix='excluir',payload=body,queue,status,error}){
  let rollback=0;const sql=[],db={query:async q=>{sql.push(q);assert.ok(queue.length,'Consulta inesperada: '+q);return queue.shift();},beginTransaction:async()=>{},commit:async()=>assert.fail('Não deve confirmar escrita recusada'),rollback:async()=>{rollback++;},close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/pc04/contratacoes/7/${suffix}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));assert.equal(data.erro,error);assert.equal(queue.length,0);assert.ok(!sql.some(q=>/^\s*(DELETE|INSERT|UPDATE)/.test(q)));assert.equal(rollback,sql.length?1:0);}finally{mock.mock.restore();}
 }
 for(const role of ['Coordenador','Gestor','Financeiro'])await t.test(role+' não vira ADMIN mesmo com payload/header manipulado',()=>denied({queue:[[],[{...admin,Adm:0,[role]:1}]],status:403,error:'SOMENTE_ADM'}));
 await t.test('ADMIN com MFA expirado não apaga',()=>denied({queue:[[],[admin],[]],status:403,error:'MFA_RECENTE_OBRIGATORIO'}));
 await t.test('solicitação também exige MFA quando habilitado',()=>denied({suffix:'solicitar-exclusao',payload:{versao:1,motivo:'Solicito exclusão'},queue:[[],[{...admin,Adm:0,Gestor:1}],[]],status:403,error:'MFA_RECENTE_OBRIGATORIO'}));
 await t.test('sem MFA obrigatório, sessão revogada continua impedida',async()=>{cfg.mfaRequired=false;await denied({queue:[[],[admin],[]],status:401,error:'SESSAO_INVALIDA'});cfg.mfaRequired=true;});
 await t.test('lock ocupado não altera financeiro nem contratação',()=>denied({queue:[[],[admin],[{V:1}],[{R:-1}]],status:409,error:'OPERACAO_OCUPADA'}));
 await t.test('checkbox deve ser booleano true',()=>denied({payload:{...body,confirmar:'true'},queue:[],status:400,error:'CONFIRMACAO_EXCLUSAO_OBRIGATORIA'}));
 await t.test('usuário inativo/revogado não consulta contrato',()=>denied({queue:[[],[]],status:403,error:'PERMISSAO_NEGADA'}));
});
