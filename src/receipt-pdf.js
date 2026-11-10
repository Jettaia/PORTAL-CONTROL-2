import {fork} from 'node:child_process';
import {Worker} from 'node:worker_threads';
let running=false;
function run(bytes,pages){
 if(running)return Promise.reject(Object.assign(Error('IMPORTACAO_OCUPADA'),{status:409}));
 running=true;
 return new Promise((resolve,reject)=>{
  const url=new URL('./receipt-pdf-worker.js',import.meta.url),data={bytes:Buffer.from(bytes),pages},external=process.env.RECEIPT_PDF_NODE;
  const worker=external?fork(url,[],{execPath:external,windowsHide:true,execArgv:['--max-old-space-size=256'],serialization:'advanced',stdio:['ignore','ignore','ignore','ipc']}):new Worker(url,{workerData:data,resourceLimits:{maxOldGenerationSizeMb:256}});
  let settled=false;
  const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);(external?new Promise(resolve=>{if(!worker.pid||worker.exitCode!==null||worker.signalCode!==null)return resolve();worker.once('exit',resolve);worker.kill();}):worker.terminate()).finally(()=>{running=false;error?reject(error):resolve(result);});};
  const timer=setTimeout(()=>done(Object.assign(Error('PDF_TEMPO_LIMITE'),{status:400})),600000);
  worker.once('message',m=>m.erro?done(Object.assign(Error(m.erro),{status:400})):done(null,m.paginas??Buffer.from(m.bytes)));
  worker.once('error',()=>done(Object.assign(Error('PDF_INVALIDO'),{status:400})));
  worker.once('exit',()=>{if(!settled)done(Object.assign(Error('PDF_INVALIDO'),{status:400}));});
  if(external)worker.send(data,error=>{if(error)done(Object.assign(Error('PDF_INVALIDO'),{status:400}));});
 });
}
export const inspectPdf=bytes=>run(bytes);
export const splitPdf=(bytes,pages)=>run(bytes,pages);
