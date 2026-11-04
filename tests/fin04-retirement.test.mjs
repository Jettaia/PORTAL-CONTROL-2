import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';

test('SEG-02: arquivos aposentados não podem ser servidos por nomes de stream NTFS',async t=>{
 const server=createApp({mfaRequired:false,host:'127.0.0.1',port:0,token:'test',fin01:true,pc01:true,pc02:true,pc03:true,pc04:true}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 const urls=['/pc08.js','/pc08.js::$DATA','/pc08.js%3A%3A%24DATA','/%70c08.js::$DATA','/PC08.JS::$data','//pc08.js::$DATA','/%5Cpc08.js::$DATA','/pc08.js::$DATA?cache=1','/pc10.js::$DATA','/pc11.js::$DATA','/consolidacao.html::$DATA','/pc08.js:audit:$DATA','/pc08.js.','/pc08.js%20','/pc08.js.%20::$DATA'];
 for(const method of ['GET','HEAD'])for(const url of urls){
  const response=await fetch(base+url,{method});
  assert.equal(response.status,410,`${method} ${url}`);
  if(method==='GET')assert.deepEqual(await response.json(),{erro:'FINANCEIRO_LEGADO_DESATIVADO'});
  else assert.equal(await response.text(),'');
 }
 assert.equal((await fetch(base+'/fin01.js')).status,200);
 assert.equal((await fetch(base+'/%ZZ')).status,400);
});

test('SEG-02: flag financeira desligada preserva arquivo legado normal',async t=>{
 const server=createApp({mfaRequired:false,host:'127.0.0.1',port:0,token:'test',fin01:false}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const response=await fetch(`http://127.0.0.1:${server.address().port}/pc08.js`);
 assert.equal(response.status,200);
 assert.match(await response.text(),/./);
});

test('FIN04: retired financial APIs and standalone pages cannot be used in the new runtime',async t=>{
 const cfg={mfaRequired:false,host:'127.0.0.1',port:0,token:'test',database:'JETTA_CONTROL_B3_TEST_012345abcdef',b32:true,b33:true,b34:true,b41:true,b42:true,b43:true,fin01:true,pc01:true,pc02:true,pc03:true,pc04:true,pc08:true,pc10:true,pc11:true,b51:true,b52:true,b52a:true,b52b:true,b52c:true,b53f01:true,b53f03:true,b61:true,finalLab:true};
 const server=createApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const url of ['/api/pc08/pagamentos','/api/pc09/recibos','/api/pc10/ajustes','/api/pc11/extrato','/api/b51/carteira','/api/b52/autorizacoes','/api/b52a/carteira','/api/b52b/prontidao','/api/b52c/consolidacao','/api/b53f01/obrigacoes','/api/b53f03/recibos','/api/b61/carteira','/api/final-lab/gestao']){
  const response=await fetch(base+url);assert.equal(response.status,410,url);assert.equal((await response.json()).erro,'FINANCEIRO_LEGADO_DESATIVADO');
 }
 for(const url of ['/consolidacao.html','/%63onsolidacao.html','//consolidacao.html','/prontidao.html','/minuta-recibo.html','/regras-financeiras.html','/contratacao-financeira.html','/b5-1.js','/b5-2.js','/b5-2b.js','/b5-2c.js','/b5-3-f01.js','/b5-3-f03.js','/b6-1.js','/final-lab.js','/pc08.js','/pc09.js','/pc10.js','/pc11.js'])assert.equal((await fetch(base+url)).status,410,url);
 for(const url of ['/api/financeiro/catalogo','/api/pc04/catalogo'])assert.equal((await fetch(base+url)).status,401,url);
 assert.equal((await fetch(base+'/api/pc08/pagamentos',{method:'POST'})).status,401);
 assert.equal((await fetch(base+'/fin01.js')).status,200);
});
test('FIN04: pilot configuration always activates contracts finance and disables old finance even for old runtime files',()=>{
 const cfg=pilotConfig({database:'JETTA_CONTROL_PILOTO_LOCAL',host:'127.0.0.1',port:3211,finance:'SIMULADO',server:'localhost\\SQLEXPRESS',pilotInstance:'a'.repeat(64),mfaKey:'b'.repeat(64),token:'c'.repeat(64),pc04:true,pc08:true,pc10:true,pc11:true});
 assert.equal(cfg.fin01,true);for(const name of ['pc08','pc10','pc11','b51','b52','b52a','b52b','b52c','b53f01','b53f03','b61','finalLab'])assert.equal(cfg[name],false,name);
});





import {assertFinanceReady} from '../pilot-local/runtime-config.mjs';
test('FIN04: startup rejects missing receipt/payment schema or reset marker before opening the pilot',async()=>{
 const cfg={fin01:true};const ready={Recibo:1,Baixa:1,Reset:'1'};
 await assertFinanceReady(cfg,{query:async()=>[ready]});
 for(const patch of [{Recibo:0},{Baixa:0},{Reset:null}])await assert.rejects(()=>assertFinanceReady(cfg,{query:async()=>[{...ready,...patch}]}),/33.*34.*35/);
});
