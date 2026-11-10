import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {inspectPdf,splitPdf} from '../src/receipt-pdf.js';

test('PDF isolated runtime identifies pages, splits, rejects corruption and recovers after startup failure',async()=>{
 const previous=process.env.RECEIPT_PDF_NODE;
 try{
  process.env.RECEIPT_PDF_NODE=process.execPath;
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  for(const n of [81,82])doc.addPage().drawText('Contratacao '+n,{x:40,y:700,font,size:20});
  const bytes=Buffer.from(await doc.save()),pages=await inspectPdf(bytes);
  assert.deepEqual(pages.map(p=>p.numero),['81','82']);
  assert.equal((await PDFDocument.load(await splitPdf(bytes,[2]))).getPageCount(),1);
  await assert.rejects(inspectPdf(Buffer.from('%PDF-invalid')),/PDF_INVALIDO/);
  process.env.RECEIPT_PDF_NODE=process.execPath+'.missing';
  await assert.rejects(inspectPdf(bytes),/PDF_INVALIDO/);
  process.env.RECEIPT_PDF_NODE=process.execPath;
  assert.equal((await inspectPdf(bytes))[0].numero,'81');
 }finally{if(previous===undefined)delete process.env.RECEIPT_PDF_NODE;else process.env.RECEIPT_PDF_NODE=previous;}
});
