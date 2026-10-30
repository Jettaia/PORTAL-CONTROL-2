import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';

test('categorias de prestador não possuem mais rotas; sessão continua protegida',async()=>{
 const cfg={mfaRequired:false,host:'127.0.0.1',port:0};
 const server=createApp(cfg).listen(0,cfg.host);await new Promise(resolve=>server.once('listening',resolve));cfg.port=server.address().port;
 const base=`http://${cfg.host}:${cfg.port}`;
 try{
  for(const route of ['tipos','vinculos'])for(const method of ['GET','POST']){
   const response=await fetch(`${base}/api/b24b/${route}`,{method,headers:{Origin:base,'x-jetta-request':'web'}});
   assert.equal(response.status,404,`${method} ${route}`);
  }
  assert.equal((await fetch(`${base}/api/auth/me`)).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
import {updateCatalog} from '../src/b24a.js';
test('edição genérica rejeita catálogo de categoria removido antes de abrir banco',async()=>{
 await assert.rejects(()=>updateCatalog({},'tiposprestador',1,{},1),error=>error.status===404);
});
