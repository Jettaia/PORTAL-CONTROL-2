import {receiptCompatible,receiptScope,receiptEligible} from './fin02.js';
import {intLiteral as n} from './auth-db.js';
import {transaction} from './pc04.js';
import {PlanningError} from './b3.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
function id(value){if(!['string','number','bigint'].includes(typeof value)||! /^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function day(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
const scope=receiptScope;
// Legacy PagoEmUtc alone never establishes settlement in the rebuilt flow.
const state="CAST(CASE WHEN b.BaixaId IS NOT NULL THEN 'PAGO' WHEN r.ReciboId IS NULL THEN 'AGUARDANDO_PAGAMENTO' ELSE 'RECIBO_GERADO' END AS varchar(30))";
const eligible=receiptEligible;
const joins=` JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId
 JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId
 JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId
 JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId
 LEFT JOIN Seguranca.Usuario l ON l.UsuarioId=c.ConferidoPor
 LEFT JOIN Financeiro.ContratacaoRecibo r ON r.ContratacaoId=c.ContratacaoId
 LEFT JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL`;
const columns=`c.ContratacaoId,c.Numero,c.DepositoId,c.PrestadorId,c.TipoServicoId,c.Versao,
 d.Nome Deposito,d.CentroCusto,d.Cidade,d.Estado,p.Nome Prestador,t.Nome Tipo,g.Nome GestorResponsavel,c.ConferidoPor,l.Nome LiberadoPor,
 CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,
 CONVERT(varchar(27),c.LiberadoEmUtc,126) LiberadoEmUtc,${state} Situacao,r.ReciboId,CONVERT(varchar(10),r.DataEmissao,23) DataEmissao,CAST(CASE WHEN ${receiptCompatible} THEN 1 ELSE 0 END AS bit) ReciboCompativel`;
function cursor(raw){
 if(typeof raw!=='string'||raw.length>200||! /^[A-Za-z0-9_-]+$/.test(raw))fail('CURSOR_INVALIDO');
 let parsed;try{parsed=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}catch{fail('CURSOR_INVALIDO');}
 if(!Array.isArray(parsed)||parsed.length!==2||typeof parsed[0]!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?$/.test(parsed[0]))fail('CURSOR_INVALIDO');
 day(parsed[0].slice(0,10));return [parsed[0],id(parsed[1])];
}
function filters(q){
 const allowed=['situacao','depositoId','prestadorId','inicio','fim','numero','cursor'];
 if(!q||Object.keys(q).some(k=>!allowed.includes(k)||typeof q[k]!=='string'))fail('FILTRO_INVALIDO');
 const where=[];
 for(const [key,column] of [['depositoId','DepositoId'],['prestadorId','PrestadorId'],['numero','Numero']])if(q[key])where.push(`c.${column}=${id(q[key])}`);
 if(q.situacao){if(!['AGUARDANDO_PAGAMENTO','RECIBO_GERADO','PAGO'].includes(q.situacao))fail('SITUACAO_INVALIDA');where.push(`${state}='${q.situacao}'`);}
 if(q.inicio)where.push(`c.DataServico>='${day(q.inicio)}'`);if(q.fim)where.push(`c.DataServico<='${day(q.fim)}'`);
 if(q.inicio&&q.fim&&q.inicio>q.fim)fail('PERIODO_INVALIDO');
 if(q.cursor){const [time,key]=cursor(q.cursor);where.push(`(c.LiberadoEmUtc>'${time}' OR (c.LiberadoEmUtc='${time}' AND c.ContratacaoId>${key}))`);}
 return where;
}
// GET /api/financeiro/contratacoes: 100 rows, release datetime2 ASC + ID ASC.
// Keep the same filters when sending opaque proximaPagina as cursor.
export async function list(cfg,actor,q={}){
 const predicates=filters(q);return transaction(cfg,actor,null,false,async(db,user)=>{
  const rows=await db.query(`SELECT TOP(101) ${columns} FROM Operacao.Contratacao c${joins} WHERE ${[eligible,scope(actor,user),...predicates].join(' AND ')} ORDER BY c.LiberadoEmUtc,c.ContratacaoId`);
  const registros=rows.slice(0,100),last=registros.at(-1);
  return {registros,proximaPagina:rows.length>100?Buffer.from(JSON.stringify([last.LiberadoEmUtc,String(last.ContratacaoId)])).toString('base64url'):null,podeOperar:user.admin||user.finance};
 });
}
// GET /api/financeiro/contratacoes/:ContratacaoId: same eligibility/access.
export async function detail(cfg,actor,key){id(key);return transaction(cfg,actor,null,false,async(db,user)=>{
 const registro=(await db.query(`SELECT ${columns},c.Status,CONVERT(varchar(40),c.Valor) Valor,
 CONVERT(varchar(16),c.InicioPrevisto,126) InicioPrevisto,CONVERT(varchar(16),c.FimPrevisto,126) FimPrevisto,
 CONVERT(varchar(16),c.EntradaReal,126) EntradaReal,CONVERT(varchar(16),c.SaidaReal,126) SaidaReal,
 c.EntradaOrigem,c.SaidaOrigem,c.CriadoPor,CONVERT(varchar(27),c.CriadoEmUtc,126) CriadoEmUtc
 FROM Operacao.Contratacao c${joins} WHERE c.ContratacaoId=${id(key)} AND ${eligible} AND ${scope(actor,user)}`))[0];
 if(!registro)fail('CONTRATACAO_INDISPONIVEL',404);return {registro,podeOperar:user.admin||user.finance};
});}
export async function catalog(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 const where=`${eligible} AND ${scope(actor,user)}`;
 return {podeOperar:user.admin||user.finance,
  depositos:await db.query(`SELECT DISTINCT d.DepositoId,d.Nome FROM Operacao.Contratacao c JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId WHERE ${where} ORDER BY d.Nome,d.DepositoId`),
  prestadores:await db.query(`SELECT DISTINCT p.PrestadorId,p.Nome FROM Operacao.Contratacao c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId WHERE ${where} ORDER BY p.Nome,p.PrestadorId`)};
});}
