import crypto from 'node:crypto';
import {transaction} from './pc04.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
import {receiptId as id,receiptScope,receiptCompatible,receiptEligible} from './fin02.js';
import * as payments from './fin03.js';
import {inspectPdf,splitPdf} from './receipt-pdf.js';
const previews=new Map(),TTL=15*60000,MAX_BYTES=50*1024*1024;
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const operator=user=>{if(!user.admin&&!user.finance)fail('PERMISSAO_NEGADA',403);};
function prune(){for(const [key,value] of previews)if(value.expires<Date.now()&&!value.busy)previews.delete(key);}
async function gate(cfg,actor,session){await transaction(cfg,actor,null,false,async(db,user)=>{operator(user);await assertMfa(db,actor,session,cfg);});}
export {gate as authorizeImport};
function owned(cfg,actor,token){prune();const p=previews.get(token);if(!p||p.cfg!==cfg||p.actor!==String(actor))fail('PREVIA_INVALIDA',404);return p;}
function fields(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');}
function pageList(value,p){if(!Array.isArray(value)||!value.length||value.length>100||value.some(n=>!Number.isInteger(n)||n<1||n>p.pages.length)||new Set(value).size!==value.length)fail('PAGINAS_INVALIDAS');return [...value].sort((a,b)=>a-b);}
const shape=row=>row?{contratacaoId:String(row.ContratacaoId),numero:String(row.Numero),depositoId:String(row.DepositoId),reciboId:row.ReciboId?String(row.ReciboId):null,deposito:row.Deposito,prestador:row.Prestador,valor:row.Valor,baixaAnteriorId:row.UltimaBaixaId==null?null:String(row.UltimaBaixaId),estado:row.PagoEmUtc?'PAGO':!row.ReciboId?'SEM_RECIBO':!row.Compativel?'DIVERGENTE':'PRONTO',versao:String(row.VersaoOrigem)}:{estado:'NAO_IDENTIFICADO'};
async function lookup(cfg,actor,selector){return transaction(cfg,actor,null,false,async(db,user)=>{
 operator(user);const where=selector.contratacaoId?`c.ContratacaoId=${id(selector.contratacaoId)}`:`c.Numero=${id(selector.numero)}`;
 const rows=await db.query(`SELECT c.ContratacaoId,c.Numero,c.DepositoId,c.PagoEmUtc,r.ReciboId,r.VersaoOrigem,d.Nome Deposito,p.Nome Prestador,CONVERT(varchar(40),r.ValorLiberado) Valor,CASE WHEN ${receiptEligible} AND ${receiptCompatible} THEN 1 ELSE 0 END Compativel,(SELECT MAX(b.BaixaId) FROM Financeiro.ContratacaoBaixa b WHERE b.ContratacaoId=c.ContratacaoId) UltimaBaixaId FROM Operacao.Contratacao c JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId LEFT JOIN Financeiro.ContratacaoRecibo r ON r.ContratacaoId=c.ContratacaoId WHERE ${where}${selector.depositoId?` AND c.DepositoId=${id(selector.depositoId)}`:''} AND ${receiptScope(actor,user)}`);
 if(rows.length!==1)return {estado:'NAO_IDENTIFICADO'};const result=shape(rows[0]);if(selector.versao&&selector.versao!==result.versao)result.estado='DIVERGENTE';return result;
});}
export async function preview(cfg,actor,session,body){
 await gate(cfg,actor,session);fields(body,['arquivo']);const f=body.arquivo;
 if(!f||f.tipo!=='application/pdf'||typeof f.nome!=='string'||!f.nome.toLowerCase().endsWith('.pdf')||f.nome.length>180||/[\x00-\x1f/\\]/.test(f.nome)||typeof f.conteudoBase64!=='string'||f.conteudoBase64.length>Math.ceil(MAX_BYTES/3)*4)fail('PDF_INVALIDO');
 const bytes=Buffer.from(f.conteudoBase64,'base64');if(!bytes.length||bytes.length>MAX_BYTES||bytes.toString('base64')!==f.conteudoBase64||bytes.subarray(0,5).toString()!=='%PDF-')fail('PDF_INVALIDO');
 prune();if(previews.size>=2)fail('IMPORTACAO_OCUPADA',409);const pages=await inspectPdf(bytes),records=[];
 for(const page of pages){const record=page.contratacaoId||page.numero?await lookup(cfg,actor,page):{estado:'NAO_IDENTIFICADO'};records.push({pagina:page.pagina,origem:page.origem,...record});}
 await gate(cfg,actor,session);prune();if(previews.size>=2)fail('IMPORTACAO_OCUPADA',409);
 const token=crypto.randomBytes(24).toString('hex'),expires=Date.now()+TTL;
 previews.set(token,{cfg,actor:String(actor),bytes,pages,records,expires,busy:false,completed:new Set()});
 const timer=setTimeout(()=>{const p=previews.get(token);if(p&&!p.busy)previews.delete(token);},TTL);timer.unref();
 return {previa:token,expiraEm:new Date(expires).toISOString(),paginas:records,limites:{tamanhoMiB:50,paginas:100}};
}
export async function bind(cfg,actor,session,body){
 await gate(cfg,actor,session);fields(body,['previa','paginas','numero','depositoId']);const p=owned(cfg,actor,body.previa);if(p.busy)fail('IMPORTACAO_OCUPADA',409);
 const pages=pageList(body.paginas,p);if(pages.some(n=>p.completed.has(n)))fail('PAGINA_JA_CONFIRMADA',409);
 p.busy=true;try{
 const record=await lookup(cfg,actor,{numero:body.numero,depositoId:body.depositoId});if(!record.contratacaoId)fail('CONTRATACAO_INDISPONIVEL',404);
 for(const n of pages){const page=p.pages[n-1];if(page.contratacaoId&&(page.contratacaoId!==record.contratacaoId||page.versao!==record.versao))fail('QR_VINCULO_DIVERGENTE',409);}
 for(const n of pages)p.records[n-1]={pagina:n,origem:'MANUAL',...record};return {item:{paginas:pages,...record,origem:'MANUAL'}};
 }finally{p.busy=false;}
}
export async function image(cfg,actor,session,token,page){await gate(cfg,actor,session);const p=owned(cfg,actor,token),pages=pageList([Number(page)],p);return Buffer.from(p.pages[pages[0]-1].png);}
export async function discard(cfg,actor,session,token){await gate(cfg,actor,session);const p=owned(cfg,actor,token);if(p.busy)fail('IMPORTACAO_OCUPADA',409);previews.delete(token);return {ok:true};}
export async function confirm(cfg,actor,session,body){
 await gate(cfg,actor,session);fields(body,['previa','itens']);const p=owned(cfg,actor,body.previa);if(p.busy)fail('IMPORTACAO_OCUPADA',409);
 if(!Array.isArray(body.itens)||!body.itens.length||body.itens.length>100)fail('ITENS_INVALIDOS');const seenPages=new Set(),seenContracts=new Set();
 const items=body.itens.map(item=>{
  fields(item,['paginas','contratacaoId','reciboId','baixaAnteriorId']);const pages=pageList(item.paginas,p),contract=id(item.contratacaoId),receipt=id(item.reciboId);
  if(seenContracts.has(contract))fail('CONTRATACAO_DUPLICADA');seenContracts.add(contract);
  for(const n of pages){if(seenPages.has(n)||p.completed.has(n))fail('PAGINA_DUPLICADA');seenPages.add(n);const r=p.records[n-1];if(r.estado!=='PRONTO'||r.contratacaoId!==contract||r.reciboId!==receipt||r.baixaAnteriorId!==(item.baixaAnteriorId??null))fail('VINCULO_INVALIDO');}
  return {...item,contratacaoId:contract,reciboId:receipt,paginas:pages};
 });
 p.busy=true;
 try{return await settleSelected(items,async item=>{
  const bytes=await splitPdf(p.bytes,item.paginas);if(bytes.length>5242880)fail('ARQUIVO_LIMITE_5MB');
  await payments.confirm(cfg,actor,session,item.contratacaoId,{reciboId:item.reciboId,baixaAnteriorId:item.baixaAnteriorId??null,arquivo:{nome:'recibo-'+item.contratacaoId+'-assinado.pdf',tipo:'application/pdf',conteudoBase64:bytes.toString('base64')}});
  for(const n of item.paginas){p.completed.add(n);p.records[n-1].estado='PAGO';}
 });}finally{p.busy=false;}
}
// The same sequential coordinator is used by real confirmations and interruption tests.
export async function settleSelected(items,attempt){
 const resultados=[];let interrupted=null;
 for(const item of items){
  const base={contratacaoId:item.contratacaoId,paginas:item.paginas};
  if(interrupted){resultados.push({...base,estado:'FALHA',erro:interrupted});continue;}
  try{await attempt(item);resultados.push({...base,estado:'PAGO'});}
  catch(e){const erro=e.status?e.message:'PAGAMENTO_INDISPONIVEL';resultados.push({...base,estado:'FALHA',erro});if(e.status===401||e.status===403)interrupted=erro;}
 }
 return {resultados,pagos:resultados.filter(r=>r.estado==='PAGO').length,falhas:resultados.filter(r=>r.estado==='FALHA').length};
}
