import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('piloto oculta segundo fator e envia escrita sem código ou modal',async()=>{
 const calls=[],elements={};let load;const element=id=>elements[id]??={hidden:false,isConnected:true,append(){},prepend(){},addEventListener(){},classList:{add(){}},showModal(){throw Error('Modal não deve abrir');}};
 const context={document:{body:element('body'),getElementById:element,createElement:tag=>element(tag),addEventListener(){}},window:{addEventListener:(name,fn)=>{if(name==='load')load=fn;}},MutationObserver:class{observe(){}},setTimeout:fn=>fn(),fetch:async(url,opt)=>{calls.push({url,opt});return {ok:true,status:200,json:async()=>url.endsWith('/me')?{mfa:{necessarioParaAcoesSensiveis:false}}:{enabled:false}};}};
 vm.runInNewContext(fs.readFileSync('public/mfa-b2b.js','utf8'),context);load();await new Promise(r=>setImmediate(r));assert.equal(element('section').hidden,true);
 await context.window.jettaProtectedFetch('/api/pc01/usuarios',{method:'POST',body:'{}'});assert.equal(calls.at(-1).url,'/api/pc01/usuarios');assert.ok(!calls.some(c=>/enroll|verify/.test(c.url)));
});
