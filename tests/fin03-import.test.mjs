import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReceipt} from '../src/fin02-document.js';
import {PDFDocument,StandardFonts,PDFName,PDFNumber} from 'pdf-lib';
import {inspectPdf,splitPdf} from '../src/receipt-pdf.js';
import {chromium} from 'playwright';
import {createCanvas} from '@napi-rs/canvas';
import {settleSelected} from '../src/fin03-import.js';
test('authorization interruption reports every selection and stops further writes',async()=>{
 const items=[1,2,3].map(n=>({contratacaoId:String(n),paginas:[n]})),attempts=[];
 const result=await settleSelected(items,async item=>{attempts.push(item.contratacaoId);if(item.contratacaoId==='2')throw Object.assign(Error('PERMISSAO_NEGADA'),{status:403});});
 assert.deepEqual(attempts,['1','2']);assert.equal(result.pagos,1);assert.equal(result.falhas,2);
 assert.deepEqual(result.resultados.map(r=>r.estado),['PAGO','FALHA','FALHA']);
 assert.equal(result.resultados[2].erro,'PERMISSAO_NEGADA');assert.deepEqual(result.resultados[2].paginas,[3]);
});
test('QR origin is present in real receipt and PDF text pages are identified and split',async()=>{
 const html=renderReceipt({ContratacaoId:'71',VersaoOrigem:3,DataEmissao:'2026-11-09',Snapshot:{Numero:'88',ValorLiberado:'175.25',Cidade:'Campinas',Estado:'SP',DataServico:'2026-11-09'}});
 assert.match(html,/data-receipt-qr="JC1:71:3"/);
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(const n of [88,89])doc.addPage().drawText('Contratacao '+n,{x:40,y:700,font,size:20});
 const bytes=Buffer.from(await doc.save()),pages=await inspectPdf(bytes);
 assert.equal(pages.length,2);assert.equal(pages[0].numero,'88');assert.equal(pages[1].numero,'89');
 const split=await PDFDocument.load(await splitPdf(bytes,[2]));assert.equal(split.getPageCount(),1);
 await assert.rejects(inspectPdf(Buffer.from('%PDF-invalid')));
});
test('large batches accept 100 pages, split page 100 and reject 101 pages',async()=>{
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
 for(let n=1;n<=100;n++)doc.addPage([180,240]).drawText('Contratacao '+n,{x:10,y:200,font,size:10});
 const bytes=Buffer.from(await doc.save()),pages=await inspectPdf(bytes);
 assert.equal(pages.length,100);assert.equal(pages[99].numero,'100');
 assert.equal((await PDFDocument.load(await splitPdf(bytes,[1,50,100]))).getPageCount(),3);
 doc.addPage([180,240]);await assert.rejects(inspectPdf(Buffer.from(await doc.save())),/PDF_LIMITE_100_PAGINAS/);
});

test('oversized embedded image rejects the PDF rather than dropping its evidence',async()=>{
 const doc=await PDFDocument.create(),canvas=createCanvas(1,1),image=await doc.embedPng(canvas.toBuffer('image/png'));
 const page=doc.addPage();page.drawImage(image,{x:0,y:0,width:100,height:100});
 await doc.flush();const imageStream=doc.context.lookup(image.ref);
 imageStream.dict.set(PDFName.of('Width'),PDFNumber.of(6000));imageStream.dict.set(PDFName.of('Height'),PDFNumber.of(6000));
 await assert.rejects(inspectPdf(Buffer.from(await doc.save())),/PDF_IMAGEM_LIMITE/);
});
test('51 scanned receipt pages are recognized by QR plus a legacy page by offline OCR',async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:1200}});
  await page.setContent(renderReceipt({ContratacaoId:'71',VersaoOrigem:3,DataEmissao:'2026-11-09',Snapshot:{Numero:'88',ValorLiberado:'175.25',Cidade:'Campinas',Estado:'SP',DataServico:'2026-11-09'}}));
  const qrImage=await page.locator('.receipt').screenshot(),canvas=createCanvas(1000,1400),ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,1000,1400);ctx.fillStyle='black';ctx.font='36px Arial';ctx.fillText('Contratacao 91',70,100);ctx.fillText('Recibo assinado',70,180);
  const doc=await PDFDocument.create();
  const qr=await doc.embedPng(qrImage),legacy=await doc.embedPng(canvas.toBuffer('image/png'));
 for(const img of [...Array(51).fill(qr),legacy])doc.addPage([img.width,img.height]).drawImage(img,{x:0,y:0,width:img.width,height:img.height});
  const records=await inspectPdf(Buffer.from(await doc.save()));
  assert.equal(records[0].origem,'QR');assert.equal(records[0].contratacaoId,'71');assert.equal(records[0].versao,'3');
  assert.equal(records.length,52);assert.ok(records.slice(0,51).every(r=>r.origem==='QR'&&r.contratacaoId==='71'));
 assert.equal(records[51].origem,'OCR');assert.equal(records[51].numero,'91');
 }finally{await browser.close();}
});
