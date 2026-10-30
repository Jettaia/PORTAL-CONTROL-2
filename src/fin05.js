import {transaction} from './pc04.js';
import {receiptId,receiptScope,receiptEligible} from './fin02.js';
import {PlanningError} from './b3.js';

const fail=message=>{throw new PlanningError(message,400);};
function day(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
function filters(query){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>!['prestadorId','depositoId','inicio','fim','pagina'].includes(k)||typeof query[k]!=='string'))fail('FILTRO_INVALIDO');
 const result={pagina:1};
 for(const key of ['prestadorId','depositoId'])if(query[key])result[key]=receiptId(query[key]);
 for(const key of ['inicio','fim'])if(query[key])result[key]=day(query[key]);
 if(result.inicio&&result.fim&&result.inicio>result.fim)fail('PERIODO_INVALIDO');
 if(query.pagina){if(!/^[1-9]\d{0,6}$/.test(query.pagina)||Number(query.pagina)>1000000)fail('PAGINA_INVALIDA');result.pagina=Number(query.pagina);}
 return result;
}
// Convert the local calendar boundary on the constant side, so the indexed UTC
// creation column stays searchable. The zone also handles historical DST.
const boundary=(value,next=false)=>`CAST((${next?`DATEADD(day,1,CAST('${value}' AS datetime2))`:`CAST('${value}' AS datetime2)`} AT TIME ZONE 'E. South America Standard Time' AT TIME ZONE 'UTC') AS datetime2)`;
const monetary=expression=>`CONVERT(varchar(40),${expression})`;

export async function statement(cfg,actor,query={}){
 const f=filters(query);
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const where=[receiptEligible,receiptScope(actor,user)];
  for(const [key,column] of [['prestadorId','PrestadorId'],['depositoId','DepositoId']])if(f[key])where.push(`c.${column}=${f[key]}`);
  if(f.inicio)where.push(`c.CriadoEmUtc>=${boundary(f.inicio)}`);
  if(f.fim)where.push(`c.CriadoEmUtc<${boundary(f.fim,true)}`);
  // Only current FIN03 settlements count. Receipt issuance and legacy paid
  // markers do not establish a payment. All queries share the read transaction.
  const base=`WITH Extrato AS (SELECT c.ContratacaoId,c.Numero,c.PrestadorId,p.Nome Prestador,c.CriadoEmUtc,d.Nome Deposito,d.CentroCusto,t.Nome Atividade,c.ValorLiberado ValorDevido,b.ConfirmadoEmUtc DataPagamento,COALESCE(b.Valor,CAST(0 AS decimal(18,2))) ValorPago
   FROM Operacao.Contratacao c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId
   LEFT JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL WHERE ${where.join(' AND ')})`;
  const total=(await db.query(`${base} SELECT ${f.prestadorId?'COUNT(*)':'COUNT(DISTINCT PrestadorId)'} TotalRegistros,${monetary('COALESCE(SUM(ValorDevido),0)')} ValorDevido,${monetary('COALESCE(SUM(ValorPago),0)')} ValorPago,${monetary('COALESCE(SUM(ValorDevido-ValorPago),0)')} Saldo FROM Extrato`))[0];
  const offset=(f.pagina-1)*100;
  const rows=await db.query(f.prestadorId?
   `${base} SELECT ContratacaoId,Numero,PrestadorId,Prestador,CONVERT(varchar(23),CriadoEmUtc,126) DataCriacao,Deposito,CentroCusto,Atividade,${monetary('ValorDevido')} ValorDevido,CONVERT(varchar(23),DataPagamento,126) DataPagamento,${monetary('ValorPago')} ValorPago FROM Extrato ORDER BY CriadoEmUtc,ContratacaoId OFFSET ${offset} ROWS FETCH NEXT 100 ROWS ONLY`:
   `${base} SELECT PrestadorId,Prestador,${monetary('SUM(ValorDevido)')} ValorDevido,${monetary('SUM(ValorPago)')} ValorPago,${monetary('SUM(ValorDevido-ValorPago)')} Saldo FROM Extrato GROUP BY PrestadorId,Prestador ORDER BY Prestador,PrestadorId OFFSET ${offset} ROWS FETCH NEXT 100 ROWS ONLY`);
  const totalRegistros=Number(total.TotalRegistros);
  return {prestadores:f.prestadorId?[]:rows,contratacoes:f.prestadorId?rows:[],totais:{ValorDevido:total.ValorDevido,ValorPago:total.ValorPago,Saldo:total.Saldo},totalRegistros,proximaPagina:offset+rows.length<totalRegistros?f.pagina+1:null};
 });
}
