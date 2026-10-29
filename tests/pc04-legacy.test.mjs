import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountPlanning} from '../src/b3-routes.js';

test('PC-04 ativo bloqueia inclusão legada pela API antes de acessar SQL',async t=>{
 const app=express();app.use(express.json());
 mountPlanning(app,{pc04:true},{session:(req,res,next)=>{req.user={id:1};next();},sameOrigin:(req,res,next)=>next()});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 for(const path of ['/api/b3/atividades','/api/b3/atividades/1/participantes']){
  const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});
  assert.equal(response.status,409);assert.equal((await response.json()).erro,'UTILIZE_CONTRATACOES_PC04');
 }
});
