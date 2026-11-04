import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('MFA inicial força cadastro e trata 429 sem ler JSON nem repetir requisição',async()=>{
 const handlers={},elements={},calls=[];let load;
 const element=id=>elements[id]??=( {hidden:false,value:'',textContent:'',disabled:false,isConnected:true,append(){},addEventListener(){},open:false,showModal(){this.open=true;},close(){this.open=false;},prepend(){},querySelector(){return element('submitButton');},querySelectorAll(){return ['ENROLL','LOGIN','STEPUP'].map(value=>({value}));}} );
 const context={document:{body:{append(){}},getElementById:element,createElement:tag=>element(tag==='section'?'host':'modal'),addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);}},window:{addEventListener:(name,fn)=>{if(name==='load')load=fn;}},MutationObserver:class{observe(){}},setTimeout:fn=>fn(),Date,Error,Number,Math,JSON,fetch:async(url,opt)=>{calls.push({url,opt});if(url.endsWith('/me'))return {ok:true,status:200,json:async()=>({})};if(url.endsWith('/status'))return {ok:true,status:200,json:async()=>({enrolled:false})};return {ok:false,status:429,headers:{get:()=> '900'},json:async()=>{throw Error('JSON must not be parsed');}};}};
 vm.runInNewContext(fs.readFileSync('public/mfa-b2b.js','utf8'),context);load();await new Promise(r=>setImmediate(r));
 element('mfaPurpose').value='STEPUP';element('mfaCode').value='000000';
 const form={id:'mfaVerifyForm',querySelector:()=>element('submitButton')};const event={target:form,preventDefault(){}};
 await handlers.submit[0](event);assert.equal(JSON.parse(calls.at(-1).opt.body).purpose,'ENROLL');assert.match(element('mfaMessage').textContent,/900 segundos/);assert.equal(element('mfaCode').value,'');assert.equal(element('submitButton').disabled,false);
 const count=calls.length;await handlers.submit[0](event);assert.equal(calls.length,count);assert.doesNotMatch(element('mfaMessage').textContent,/Unexpected token/);
});

test('sessão protegida recolhe formulário e ação aguarda STEPUP antes de continuar',async()=>{
 const handlers={},elements={},calls=[];let load,stepUp=false;
 const element=id=>elements[id]??=({hidden:false,value:'',textContent:'',disabled:false,isConnected:true,append(){},addEventListener(){},open:false,showModal(){this.open=true;},close(){this.open=false;},prepend(){},scrollIntoView(){},focus(){},querySelector(){return element('submitButton');},querySelectorAll(){return ['ENROLL','LOGIN','STEPUP'].map(value=>({value}));}});
 const context={document:{body:{append(){}},getElementById:element,createElement:tag=>element(tag==='section'?'host':'modal'),addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);}},window:{addEventListener:(name,fn)=>{if(name==='load')load=fn;}},MutationObserver:class{observe(){}},setTimeout:fn=>fn(),Date,Error,Number,Math,JSON,Promise,fetch:async(url,opt)=>{calls.push({url,opt});if(url.endsWith('/verify'))stepUp=true;return {ok:true,status:200,json:async()=>url.endsWith('/status')?{enrolled:true,verified:true,stepUp}:{ok:true}};}};
 vm.runInNewContext(fs.readFileSync('public/mfa-b2b.js','utf8'),context);load();await new Promise(r=>setImmediate(r));assert.equal(element('mfaVerifyForm').hidden,true);
 let saved=false;const waiting=context.window.jettaEnsureRecentMfa().then(()=>{saved=true;});await new Promise(r=>setImmediate(r));assert.equal(saved,false);assert.equal(element('mfaVerifyForm').hidden,false);assert.equal(element('mfaPurpose').value,'STEPUP');assert.match(element('mfaMessage').textContent,/dados preenchidos foram mantidos/);
 element('mfaCode').value='000000';await handlers.submit[0]({target:{id:'mfaVerifyForm',querySelector:()=>element('submitButton')},preventDefault(){}});await waiting;assert.equal(saved,true);assert.equal(JSON.parse(calls.find(c=>c.url.endsWith('/verify')).opt.body).purpose,'STEPUP');assert.equal(element('mfaVerifyForm').hidden,true);
 const before=calls.filter(c=>c.url.endsWith('/verify')).length;await context.window.jettaEnsureRecentMfa();assert.equal(calls.filter(c=>c.url.endsWith('/verify')).length,before);
});

test('cadastro mantém campos e aguarda confirmação ou cancelamento pelo wrapper real',async t=>{
 for(const confirm of [true,false])await t.test(confirm?'confirmação envia uma única escrita':'cancelamento preserva campos sem escrita',async()=>{
  const handlers={},elements={},calls=[];let decision,confirmations=0;
  const element=id=>elements[id]??=({value:'',hidden:false,disabled:false,textContent:'',isConnected:true,
   addEventListener:(name,fn)=>{handlers[id+name]=fn;},querySelector:()=>element('saveButton'),
   reset(){this.resets=(this.resets||0)+1;},replaceChildren(){},append(){},prepend(){},before(){}
  });
  const context={document:{body:element('body'),getElementById:element,createElement:()=>element('generated'+Object.keys(elements).length),addEventListener(){}},window:{addEventListener(){}},
   Option:class{constructor(text,value){this.text=text;this.value=value;}},MutationObserver:class{observe(){}},
   fetch:async(url,opt)=>{calls.push({url,opt});return {ok:true,json:async()=>({registros:[],podeEditar:true})};}
  };
  const vmContext=vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/mfa-b2b.js','utf8'),vmContext);
  // Keep the production protected-fetch wrapper; control only the user's decision.
  context.window.jettaEnsureRecentMfa=()=>{confirmations++;return new Promise((resolve,reject)=>{decision={resolve,reject};});};
  vm.runInContext(fs.readFileSync('public/b24a.js','utf8'),vmContext);
  element('b24Nome').value='Carga e descarga';element('b24Descricao').value='Equipe para descarga';
  const event={preventDefault(){},currentTarget:element('b24Form')};
  const saving=handlers.b24Formsubmit(event);await new Promise(r=>setImmediate(r));
  await handlers.b24Formsubmit(event); // double submit must not duplicate a pending action
  assert.equal(confirmations,1);assert.equal(calls.length,0);
  assert.equal(element('b24Nome').value,'Carga e descarga');assert.equal(element('b24Descricao').value,'Equipe para descarga');
  assert.equal(element('b24Form').resets||0,0);assert.equal(element('saveButton').disabled,true);
  if(confirm)decision.resolve();else decision.reject(Error('Operação cancelada.'));
  await saving;assert.equal(element('saveButton').disabled,false);
  if(confirm){
   const writes=calls.filter(call=>call.opt?.method==='POST');assert.equal(writes.length,1);
   assert.equal(writes[0].url,'/api/b24a/servicos');assert.deepEqual(JSON.parse(writes[0].opt.body),{nome:'Carga e descarga',descricao:'Equipe para descarga'});
   assert.equal(element('b24Message').textContent,'Cadastro realizado.');assert.equal(element('b24Form').resets,1);
  }else{
   assert.equal(calls.length,0);assert.equal(element('b24Form').resets||0,0);
   assert.equal(element('b24Nome').value,'Carga e descarga');assert.equal(element('b24Descricao').value,'Equipe para descarga');
   assert.equal(element('b24Message').textContent,'Operação cancelada.');
  }
 });
});
