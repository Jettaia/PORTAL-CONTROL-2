import {parentPort,workerData} from 'node:worker_threads';import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(import.meta.url);
try{const b=Buffer.from(workerData.bytes),root=workerData.toolsRoot;let meta;
 if(workerData.mime==='application/pdf'){
  if(!/^%PDF-(?:1\.[0-7]|2\.0)/.test(b.subarray(0,9).toString('ascii')))throw Error();
  const {PDFDocument}=require(path.join(root,'pdf-lib')),doc=await PDFDocument.load(b,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
  const objects=doc.context.enumerateIndirectObjects();if(objects.length>3000||doc.getPageCount()<1||doc.getPageCount()>10)throw Error();
  for(const [,obj]of objects)if(/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|AcroForm|XFA|URI|SubmitForm|GoToR)\b/.test(String(obj)))throw Error();
  meta={paginas:doc.getPageCount(),formato:'PDF_RESTRITO'};
 }else{const sharp=require(path.join(root,'sharp')),image=sharp(b,{limitInputPixels:4000000,failOn:'warning'}),info=await image.metadata();if(workerData.mime==='image/png'&&info.format!=='png'||workerData.mime==='image/jpeg'&&info.format!=='jpeg')throw Error();if(info.pages&&info.pages!==1)throw Error();if(!info.width||!info.height||info.width*info.height>4000000)throw Error();await image.raw().toBuffer();meta={largura:info.width,altura:info.height,formato:info.format};}
 parentPort.postMessage({ok:true,meta});
}catch{parentPort.postMessage({ok:false});}
