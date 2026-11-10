import {parentPort,workerData} from 'node:worker_threads';
import {createCanvas,DOMMatrix,Path2D,ImageData} from '@napi-rs/canvas';
import jsQR from 'jsqr';
import {createWorker} from 'tesseract.js';
import {createRequire} from 'node:module';
import path from 'node:path';
import {PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const input=parentPort?workerData:await new Promise(resolve=>process.once('message',resolve));
let ocr,result;
try{
 if(input.pages){
  const {PDFDocument}=await import('pdf-lib');
  const original=await PDFDocument.load(input.bytes),doc=await PDFDocument.create();
  for(const page of await doc.copyPages(original,input.pages.map(n=>n-1)))doc.addPage(page);
  result={bytes:await doc.save()};
 }else{
 const preflight=await PDFDocument.load(input.bytes);
 for(const [,object] of preflight.context.enumerateIndirectObjects()){
  const dict=object.dict;
  if(dict?.get(PDFName.of('Subtype'))?.toString()==='/Image'){
   const width=dict.lookup(PDFName.of('Width'),PDFNumber).asNumber(),height=dict.lookup(PDFName.of('Height'),PDFNumber).asNumber();
   if(!Number.isFinite(width*height)||width<=0||height<=0||width*height>25000000)throw Error('PDF_IMAGEM_LIMITE');
  }
 }
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(input.bytes),isEvalSupported:false,stopAtErrors:true,maxImageSize:25000000,useSystemFonts:true,disableFontFace:true});
 const doc=await task.promise;
 if(doc.numPages<1||doc.numPages>100)throw Error('PDF_LIMITE_100_PAGINAS');
 const paginas=[];let size=0;
 for(let i=1;i<=doc.numPages;i++){
  const page=await doc.getPage(i),base=page.getViewport({scale:1}),scale=Math.min(1.8,2400/Math.max(base.width,base.height));
  if(!Number.isFinite(scale)||scale<=0)throw Error('PDF_INVALIDO');
  const viewport=page.getViewport({scale}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
  await page.render({canvasContext:ctx,viewport}).promise;
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'}),png=canvas.toBuffer('image/png');
  size+=png.length;if(size>200*1024*1024)throw Error('PDF_IMAGENS_MUITO_GRANDES');
  let text=(await page.getTextContent()).items.map(x=>x.str).join(' '),origem='TEXTO',identity={};
  const match=qr?.data.match(/^JC1:([1-9]\d*):([1-9]\d*)$/);
  if(match){identity={contratacaoId:match[1],versao:match[2]};origem='QR';}
  else{
   let numbers=[...text.matchAll(/contrata[çc][ãa]o\s*[:#-]?\s*([1-9]\d*)/gi)].map(m=>m[1]);
   if(!numbers.length){
    if(!ocr){const require=createRequire(import.meta.url);ocr=await createWorker('por',1,{langPath:path.join(path.dirname(require.resolve('@tesseract.js-data/por/package.json')),'4.0.0'),cacheMethod:'none',gzip:true});}
    text=(await ocr.recognize(png)).data.text;origem='OCR';numbers=[...text.matchAll(/contrata[çc][ãa]o\s*[:#-]?\s*([1-9]\d*)/gi)].map(m=>m[1]);
   }
   numbers=[...new Set(numbers)];if(numbers.length===1)identity={numero:numbers[0]};
  }
  paginas.push({pagina:i,png,...identity,origem});page.cleanup();
 }
 await task.destroy();result={paginas};
 }
}catch(e){result={erro:/Image exceeded maximum/.test(e.message)?'PDF_IMAGEM_LIMITE':/^PDF_/.test(e.message)?e.message:'PDF_INVALIDO'};}
finally{if(ocr)await ocr.terminate();if(parentPort)parentPort.postMessage(result);else process.send(result,()=>process.disconnect());}
