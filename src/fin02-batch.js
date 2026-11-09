import crypto from 'node:crypto';
import {transaction} from './pc04.js';
import {issue,receiptId,receiptEligible,receiptScope} from './fin02.js';
import {renderReceipt} from './fin02-document.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';

export const printStyle=renderReceipt({DataEmissao:'2000-01-01',Snapshot:{ValorLiberado:'0.00'}}).match(/<style>([\s\S]*?)<\/style>/)[1]+'\n@media print{.receipt{break-after:page;page-break-after:always}.receipt:last-child{break-after:auto;page-break-after:auto}}';
const fail=(code,status=400)=>{throw new PlanningError(code,status);};
const fields=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
const operator=user=>{if(!user.admin&&!user.finance)fail('PERMISSAO_NEGADA',403);};
const clock=cfg=>cfg.fin02BatchNow?cfg.fin02BatchNow():Date.now();
function day(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
function predicates(query){
 fields(query,['inicio','fim','depositoId','prestadorId','numero']);
 const start=day(query.inicio),end=day(query.fim);if(start>end)fail('PERIODO_INVALIDO');
 const where=[`c.DataServico>='${start}'`,`c.DataServico<='${end}'`];
 for(const [key,column]of [['depositoId','DepositoId'],['prestadorId','PrestadorId'],['numero','Numero']]){
  if(query[key]!==undefined&&typeof query[key]!=='string')fail('FILTRO_INVALIDO');
  if(query[key])where.push(`c.${column}=${receiptId(query[key])}`);
 }return where;
}
function signature(cfg,text){if(typeof cfg.token!=='string'||cfg.token.length<40)throw Error('Chave privada indisponivel');return crypto.createHmac('sha256',cfg.token).update('FIN02_BATCH:'+text).digest('hex');}
function encode(cfg,payload){const text=Buffer.from(JSON.stringify(payload)).toString('base64url');return text+'.'+signature(cfg,text);}
function decode(cfg,token,actor){
 if(typeof token!=='string'||token.length>1800000||!/^[-\w]+\.[a-f0-9]{64}$/.test(token))fail('PREVIA_INVALIDA');
 const [text,mac]=token.split('.');if(!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(signature(cfg,text))))fail('PREVIA_INVALIDA');
 let value;try{value=JSON.parse(Buffer.from(text,'base64url').toString('utf8'));}catch{fail('PREVIA_INVALIDA');}
 if(value.actor!==String(receiptId(actor)))fail('PREVIA_DE_OUTRO_USUARIO',403);
 if(!Number.isFinite(value.expires)||clock(cfg)>=value.expires)fail('PREVIA_EXPIRADA',409);
 if(!Array.isArray(value.rows))fail('PREVIA_INVALIDA');return value;
}
function total(rows){const sum=rows.reduce((sum,row)=>sum+BigInt(String(row.ValorLiberado).replace('.','')),0n);return (sum/100n)+'.'+String(sum%100n).padStart(2,'0');}
export async function preview(cfg,actor,query){
 const where=predicates(query);
 return transaction(cfg,actor,null,false,async(db,user)=>{
  operator(user);
  // No TOP/pagination: preview and signed confirmation cover the entire selected period.
  const rows=await db.query(`SELECT c.ContratacaoId,c.Numero,c.DepositoId,c.PrestadorId,c.TipoServicoId,c.Versao,p.Nome Prestador,d.Nome Deposito,
   CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,
   CONVERT(varchar(27),c.LiberadoEmUtc,126) LiberadoEmUtc,r.ReciboId
   FROM Operacao.Contratacao c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId
   LEFT JOIN Financeiro.ContratacaoRecibo r ON r.ContratacaoId=c.ContratacaoId
   WHERE ${[receiptEligible,receiptScope(actor,user),...where].join(' AND ')} ORDER BY c.DataServico,c.DepositoId,c.Numero,c.ContratacaoId`);
  const registros=rows.filter(r=>r.ReciboId==null),expires=clock(cfg)+15*60000;
  const payload={actor:String(receiptId(actor)),expires,rows:registros.map(r=>({id:String(r.ContratacaoId),numero:String(r.Numero),versao:Number(r.Versao),depositoId:String(r.DepositoId),prestadorId:String(r.PrestadorId),tipoServicoId:String(r.TipoServicoId),dataServico:r.DataServico,valor:r.ValorLiberado,liberadoEmUtc:r.LiberadoEmUtc}))};
  const previa=encode(cfg,payload);if(previa.length>1800000)fail('PERIODO_MUITO_EXTENSO');
  return {registros,quantidade:registros.length,total:total(registros),jaEmitidos:rows.length-registros.length,previa,expiraEmUtc:new Date(expires).toISOString()};
 });
}
export async function generate(cfg,actor,session,body){
 fields(body,['previa']);
 // Gate current authorization/MFA before processing any signed IDs.
 await transaction(cfg,actor,null,false,async(db,user)=>{operator(user);await assertMfa(db,actor,session,cfg);});
 const payload=decode(cfg,body.previa,actor),resultados=[];let denied=null;
 for(const expected of payload.rows){
  if(denied){resultados.push({contratacaoId:expected.id,numero:expected.numero,estado:'FALHA',erro:denied});continue;}
  try{
   const result=await issue(cfg,actor,session,expected.id,{},expected);
   resultados.push({contratacaoId:expected.id,numero:expected.numero,estado:result.jaExistia?'JA_EMITIDO':'GERADO'});
  }catch(error){
   const code=error.status?error.message:'RECIBO_INDISPONIVEL';
   resultados.push({contratacaoId:expected.id,numero:expected.numero,estado:'FALHA',erro:code});
   if(error.status===401||error.status===403)denied=code;
  }
 }
 return {resultados,gerados:resultados.filter(r=>r.estado==='GERADO').length,ignorados:resultados.filter(r=>r.estado==='JA_EMITIDO').length,falhas:resultados.filter(r=>r.estado==='FALHA').length};
}
export async function printMany(cfg,actor,body){
 fields(body,['contratacaoIds']);if(!Array.isArray(body.contratacaoIds)||!body.contratacaoIds.length)fail('CONTRATACOES_OBRIGATORIAS');
 const ids=[...new Set(body.contratacaoIds.map(receiptId).map(String))];
 return transaction(cfg,actor,null,false,async(db,user)=>{
  operator(user);
  // Fetch all snapshots/address fallbacks together, rather than N authorization/ODBC round trips.
  const rows=await db.query(`SELECT r.ContratacaoId,CONVERT(varchar(10),r.DataEmissao,23) DataEmissao,
   d.Nome Deposito,d.Rua,d.Numero NumeroEndereco,d.Bairro,d.CEP,r.SnapshotJson
   FROM Financeiro.ContratacaoRecibo r JOIN Operacao.Contratacao c ON c.ContratacaoId=r.ContratacaoId
   JOIN Cadastro.Deposito d ON d.DepositoId=r.DepositoId WHERE c.ContratacaoId IN(${ids.join(',')}) AND ${receiptScope(actor,user)}`);
  if(rows.length!==ids.length)fail('RECIBO_INDISPONIVEL',404);
  const indexed=new Map(rows.map(row=>[String(row.ContratacaoId),row]));
  const documents=ids.map(id=>{const row=indexed.get(id),Snapshot=JSON.parse(row.SnapshotJson);for(const key of ['Deposito','Rua','NumeroEndereco','Bairro','CEP'])if(!Object.hasOwn(Snapshot,key))Snapshot[key]=row[key];return renderReceipt({DataEmissao:row.DataEmissao,Snapshot});});
  // A network stylesheet also works in a print window inheriting the portal's style-src self CSP.
  const csp="default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><title>Recibos do período</title><link rel="stylesheet" href="/api/financeiro/recibos/estilo.css"></head><body>'+documents.map(doc=>doc.match(/<main class="receipt">[\s\S]*?<\/main>/)[0]).join('\n')+'</body></html>';
  return {html,csp};
 });
}
