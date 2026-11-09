import {Worker} from 'node:worker_threads';
let running=false;
function run(bytes,pages){
 if(running)return Promise.reject(Object.assign(Error('IMPORTACAO_OCUPADA'),{status:409}));
 running=true;
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./receipt-pdf-worker.js',import.meta.url),{workerData:{bytes:Buffer.from(bytes),pages},resourceLimits:{maxOldGenerationSizeMb:256}});
  let settled=false;
  const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().finally(()=>{running=false;error?reject(error):resolve(result);});};
  const timer=setTimeout(()=>done(Object.assign(Error('PDF_TEMPO_LIMITE'),{status:400})),600000);
  worker.once('message',m=>m.erro?done(Object.assign(Error(m.erro),{status:400})):done(null,m.paginas??Buffer.from(m.bytes)));
  worker.once('error',()=>done(Object.assign(Error('PDF_INVALIDO'),{status:400})));
  worker.once('exit',()=>{if(!settled)done(Object.assign(Error('PDF_INVALIDO'),{status:400}));});
 });
}
export const inspectPdf=bytes=>run(bytes);
export const splitPdf=(bytes,pages)=>run(bytes,pages);
