import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {statementReportHtml,statementReportPdf} from '../src/fin05-export-pdf.js';
import {PlanningError} from '../src/b3.js';
const values={ValorDevido:'100.25',ValorPago:'0.00',Saldo:'100.25'};
const report={geradoEm:'09/11/2026 17:00:00',filtrosTexto:'Criação desde: 01/11/2026',depositos:[{DepositoId:1,Deposito:'Sumaré',...values},{DepositoId:2,Deposito:'Floripa',...values}],prestadores:[{DepositoId:1,PrestadorId:1,Prestador:'João <b>Silva</b>',CPF:'01234567890',QuantidadeContratacoes:106,...values},{DepositoId:2,PrestadorId:2,Prestador:'Empresa sem movimento',CPF:'00123456000199',QuantidadeContratacoes:0,...values}],contratacoes:Array.from({length:106},(_,i)=>({DepositoId:1,PrestadorId:1,Numero:String(1000+i),DataServico:'2026-11-09',DataCriacao:'2026-11-09T15:00:00.000',CentroCusto:'CC-01',Atividade:i===105?'Última contratação validada':'Descarga de materiais',DataPagamento:null,...values})),totais:values};
test('HTML do PDF agrupa extrato, mascara CPF/CNPJ e mantém valores escapados e totais',()=>{
 const html=statementReportHtml(report);assert.match(html,/<h1>Extrato<\/h1>/);assert.match(html,/012\.345\.678-90/);assert.match(html,/00\.123\.456\/0001-99/);assert.match(html,/João &lt;b&gt;Silva&lt;\/b&gt;/);assert.doesNotMatch(html,/<b>Silva/);assert.ok(html.indexOf('Sumaré')<html.indexOf('Última contratação validada'));assert.ok(html.indexOf('Última contratação validada')<html.indexOf('Floripa'));assert.match(html,/Total geral/);assert.match(html,/Subtotal do prestador/);assert.match(html,/R\$ 100,25/);assert.match(html,/Nenhuma contratação/);
});
test('PDF real contém todas as páginas, contexto repetido e última contratação',{timeout:60000},async()=>{
 const {buffer}=await statementReportPdf(async()=>report);assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const doc=await getDocument({data:new Uint8Array(buffer),useSystemFonts:true}).promise;
 try{assert.ok(doc.numPages>1);const pages=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();pages.push(content.items.map(item=>item.str||'').join(' '));}
 assert.match(pages.join(' '),/Última contratação validada/);assert.match(pages.join(' '),/1105/);assert.match(pages[1],/Sumaré/);assert.match(pages[1],/012\.345\.678-90/);assert.match(pages.join(' '),/Floripa/);assert.match(pages.join(' '),/Total geral/);
 }finally{await doc.loadingTask.destroy();}
 fs.mkdirSync('artifacts/fin05-pdf',{recursive:true});fs.writeFileSync('artifacts/fin05-pdf/extrato-agrupado.pdf',buffer);
});
test('PDF compartilha bloqueio e libera recursos em falha de autorização',async()=>{
 let reject;const first=statementReportPdf(()=>new Promise((_,r)=>reject=r));await assert.rejects(()=>statementReportPdf(()=>report),e=>e.message==='EXPORTACAO_PDF_OCUPADA');reject(new PlanningError('PERMISSAO_NEGADA',403));await assert.rejects(()=>first,e=>e.status===403);await assert.rejects(()=>statementReportPdf(()=>{throw new PlanningError('FILTRO_INVALIDO',400);}),e=>e.status===400);
});
