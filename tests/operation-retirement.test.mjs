import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';

test('Operação retirada: endpoints antigos não existem, Contratações e políticas permanecem',async t=>{
 const cfg={mfaRequired:false,host:'127.0.0.1',port:0,token:'test',database:'JETTA_CONTROL_B3_TEST_012345abcdef',b41:true,b42:true,b43:true,b32:true,b33:true,pc01:true,pc02:true,pc03:true,pc04:true};
 const server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const [method,url] of [['GET','/api/b3/atividades'],['POST','/api/b3/atividades'],['POST','/api/b3/atividades/1/participantes'],['GET','/api/b3/excecoes'],['POST','/api/b3/disponibilidade'],['GET','/api/b4/depositos/1/apontamentos'],['POST','/api/b4/tablets'],['GET','/api/b42/participacoes/1'],['POST','/api/b42/participacoes/1/conferencia'],['GET','/api/b43/participacoes/1'],['POST','/api/b43/participacoes/1/fechamento'],['POST','/api/tablet/apontar']]){
  const response=await fetch(base+url,{method,headers:{origin:'http://127.0.0.1:0','x-jetta-request':'web'}});
  assert.equal(response.status,404,`${method} ${url}`);
 }
 for(const url of ['/api/pc04/catalogo','/api/b3/catalogo','/api/b3/politicas'])assert.equal((await fetch(base+url)).status,401,url);
 for(const url of ['/b3.js','/b4.js','/b4-2.js','/b4-3.js','/b4-3-section.html','/tablet.js','/tablet.html'])assert.equal((await fetch(base+url)).status,404,url);
});
