import {transaction} from './pc04.js';
import {receiptId,receiptScope,receiptEligible} from './fin02.js';
import {PlanningError} from './b3.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
function day(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
function filters(query){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>!['prestadorId','depositoId','inicio','fim','pagina','agrupamento','somenteMovimentacao'].includes(k)||typeof query[k]!=='string'))fail('FILTRO_INVALIDO');
 const result={pagina:1};
 if(Object.hasOwn(query,'agrupamento')){if(query.agrupamento!=='deposito')fail('FILTRO_INVALIDO');result.agrupamento='deposito';}
 if(Object.hasOwn(query,'somenteMovimentacao')&&(!result.agrupamento||!['0','1'].includes(query.somenteMovimentacao)))fail('FILTRO_INVALIDO');
 result.somenteMovimentacao=query.somenteMovimentacao!=='0';
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

const totalFields=`${monetary('COALESCE(SUM(ValorDevido),0)')} ValorDevido,${monetary('COALESCE(SUM(ValorPago),0)')} ValorPago,${monetary('COALESCE(SUM(ValorDevido-ValorPago),0)')} Saldo`;
const providerFields=`PrestadorId,Prestador,CPF,DepositoId,Deposito,QuantidadeContratacoes,${monetary('ValorDevido')} ValorDevido,${monetary('ValorPago')} ValorPago,${monetary('ValorDevido-ValorPago')} Saldo`;
const depotFields=`DepositoId,Deposito,COUNT(*) QuantidadePrestadores,${monetary('SUM(ValorDevido)')} ValorDevido,${monetary('SUM(ValorPago)')} ValorPago,${monetary('SUM(ValorDevido-ValorPago)')} Saldo`;

function statementBase(actor,user,f){
  const where=[receiptEligible,receiptScope(actor,user)];
  for(const [key,column] of [['prestadorId','PrestadorId'],['depositoId','DepositoId']])if(f[key])where.push(`c.${column}=${f[key]}`);
  if(f.inicio)where.push(`c.CriadoEmUtc>=${boundary(f.inicio)}`);
  if(f.fim)where.push(`c.CriadoEmUtc<${boundary(f.fim,true)}`);
  // Only current FIN03 settlements count. Receipt issuance and legacy paid
  // markers do not establish a payment. All queries share the read transaction.
  return `WITH Extrato AS (SELECT c.ContratacaoId,c.Numero,c.PrestadorId,p.Nome Prestador,p.CPF,c.DepositoId,c.DataServico,c.CriadoEmUtc,d.Nome Deposito,d.CentroCusto,t.Nome Atividade,c.ValorLiberado ValorDevido,b.ConfirmadoEmUtc DataPagamento,COALESCE(b.Valor,CAST(0 AS decimal(18,2))) ValorPago
   FROM Operacao.Contratacao c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId
   LEFT JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL WHERE ${where.join(' AND ')})`;
}

export async function statement(cfg,actor,query={}){
 const f=filters(query);
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const base=statementBase(actor,user,f);
  if(f.agrupamento)return groupedStatement(db,actor,user,f,base);
  const total=(await db.query(`${base} SELECT ${f.prestadorId?'COUNT(*)':'COUNT(DISTINCT PrestadorId)'} TotalRegistros,${totalFields} FROM Extrato`))[0];
  const offset=(f.pagina-1)*100;
  const rows=await db.query(f.prestadorId?
   `${base} SELECT ContratacaoId,Numero,PrestadorId,Prestador,CONVERT(varchar(10),DataServico,23) DataServico,CONVERT(varchar(23),CriadoEmUtc,126) DataCriacao,Deposito,CentroCusto,Atividade,${monetary('ValorDevido')} ValorDevido,CONVERT(varchar(23),DataPagamento,126) DataPagamento,${monetary('ValorPago')} ValorPago FROM Extrato ORDER BY CriadoEmUtc,ContratacaoId OFFSET ${offset} ROWS FETCH NEXT 100 ROWS ONLY`:
   `${base} SELECT PrestadorId,Prestador,${monetary('SUM(ValorDevido)')} ValorDevido,${monetary('SUM(ValorPago)')} ValorPago,${monetary('SUM(ValorDevido-ValorPago)')} Saldo FROM Extrato GROUP BY PrestadorId,Prestador ORDER BY Prestador,PrestadorId OFFSET ${offset} ROWS FETCH NEXT 100 ROWS ONLY`);
  const totalRegistros=Number(total.TotalRegistros);
  return {prestadores:f.prestadorId?[]:rows,contratacoes:f.prestadorId?rows:[],totais:{ValorDevido:total.ValorDevido,ValorPago:total.ValorPago,Saldo:total.Saldo},totalRegistros,proximaPagina:offset+rows.length<totalRegistros?f.pagina+1:null};
 });
}

// Live links supplement the financial history only when explicitly requested.
// Both sides keep exactly the financial depot authorization predicate.
function livePairs(actor,user,f={}){
 const where=['c.RevogadoEmUtc IS NULL',receiptScope(actor,user)];
 for(const [key,column]of [['prestadorId','PrestadorId'],['depositoId','DepositoId']])if(f[key])where.push(`c.${column}=${f[key]}`);
 return `SELECT c.PrestadorId,c.DepositoId FROM Cadastro.PrestadorDeposito c WHERE ${where.join(' AND ')}`;
}
function groupedSource(actor,user,f,base){
 return `${base}, Pares AS (SELECT PrestadorId,DepositoId FROM Extrato${f.somenteMovimentacao?'':` UNION ${livePairs(actor,user,f)}`}),
  Movimentos AS (SELECT PrestadorId,DepositoId,COUNT(*) QuantidadeContratacoes,SUM(ValorDevido) ValorDevido,SUM(ValorPago) ValorPago FROM Extrato GROUP BY PrestadorId,DepositoId),
  Resumo AS (SELECT DISTINCT c.PrestadorId,p.Nome Prestador,p.CPF,c.DepositoId,d.Nome Deposito,COALESCE(m.QuantidadeContratacoes,0) QuantidadeContratacoes,
   COALESCE(m.ValorDevido,CAST(0 AS decimal(18,2))) ValorDevido,COALESCE(m.ValorPago,CAST(0 AS decimal(18,2))) ValorPago
   FROM Pares c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId
   LEFT JOIN Movimentos m ON m.PrestadorId=c.PrestadorId AND m.DepositoId=c.DepositoId)`;
}
async function groupedStatement(db,actor,user,f,base){
 const source=groupedSource(actor,user,f,base);
 const total=(await db.query(`${source} SELECT COUNT(*) TotalRegistros,${totalFields} FROM Resumo`))[0];
 const offset=(f.pagina-1)*100;
 const rows=await db.query(`${source} SELECT ${providerFields} FROM Resumo ORDER BY Deposito,DepositoId,Prestador,PrestadorId OFFSET ${offset} ROWS FETCH NEXT 100 ROWS ONLY`);
 const depositos=await db.query(`${source} SELECT ${depotFields} FROM Resumo GROUP BY DepositoId,Deposito ORDER BY Deposito,DepositoId`);
 const totalRegistros=Number(total.TotalRegistros);
 return {prestadores:rows,contratacoes:[],depositos,totais:{ValorDevido:total.ValorDevido,ValorPago:total.ValorPago,Saldo:total.Saldo},totalRegistros,proximaPagina:offset+rows.length<totalRegistros?f.pagina+1:null};
}
export async function statementCatalog(cfg,actor){
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const pairs=`WITH Pares AS (${livePairs(actor,user)} UNION SELECT c.PrestadorId,c.DepositoId FROM Operacao.Contratacao c WHERE ${receiptEligible} AND ${receiptScope(actor,user)})`;
  return {
   depositos:await db.query(`${pairs} SELECT DISTINCT d.DepositoId,d.Nome FROM Pares c JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId ORDER BY d.Nome,d.DepositoId`),
   prestadores:await db.query(`${pairs} SELECT DISTINCT p.PrestadorId,p.Nome FROM Pares c JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId ORDER BY p.Nome,p.PrestadorId`),
  };
 });
}

// A bounded, consistent full export. Never chase UI pages or issue a query per provider.
export async function statementExportData(cfg,actor,query={},maxRows=100000){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.hasOwn(query,'pagina'))fail('FILTRO_INVALIDO');
 const f=filters({...query,agrupamento:query.agrupamento??'deposito'});
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>100000)fail('LIMITE_INVALIDO');
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const base=statementBase(actor,user,f),source=groupedSource(actor,user,f,base);
  const prestadores=await db.query(`${source} SELECT TOP(${maxRows+1}) ${providerFields} FROM Resumo ORDER BY Deposito,DepositoId,Prestador,PrestadorId`);
  if(prestadores.length>maxRows)fail('EXPORTACAO_MUITOS_REGISTROS',413);
  const contratacoes=await db.query(`${base} SELECT TOP(${maxRows+1}) ContratacaoId,Numero,PrestadorId,DepositoId,CONVERT(varchar(10),DataServico,23) DataServico,CONVERT(varchar(23),CriadoEmUtc,126) DataCriacao,CentroCusto,Atividade,${monetary('ValorDevido')} ValorDevido,CONVERT(varchar(23),DataPagamento,126) DataPagamento,${monetary('ValorPago')} ValorPago,${monetary('ValorDevido-ValorPago')} Saldo FROM Extrato ORDER BY Deposito,DepositoId,Prestador,PrestadorId,CriadoEmUtc,ContratacaoId`);
  if(contratacoes.length>maxRows)fail('EXPORTACAO_MUITOS_REGISTROS',413);
  const depositos=await db.query(`${source} SELECT ${depotFields} FROM Resumo GROUP BY DepositoId,Deposito ORDER BY Deposito,DepositoId`);
  const totais=(await db.query(`${source} SELECT ${totalFields} FROM Resumo`))[0];
  const instant=cfg.exportNow?cfg.exportNow():new Date(),geradoEmUtc=instant.toISOString();
  const geradoEm=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(instant)+' (Brasília)';
  const labels=[];
  if(f.depositoId)labels.push('Depósito: '+(depositos.find(d=>String(d.DepositoId)===f.depositoId)?.Deposito||'selecionado, sem registros autorizados'));
  if(f.prestadorId)labels.push('Prestador: '+(prestadores.find(p=>String(p.PrestadorId)===f.prestadorId)?.Prestador||'selecionado, sem registros autorizados'));
  if(f.inicio)labels.push('Criação desde: '+f.inicio.split('-').reverse().join('/'));
  if(f.fim)labels.push('Criação até: '+f.fim.split('-').reverse().join('/'));
  labels.push('Somente com movimentação: '+(f.somenteMovimentacao?'Sim':'Não'));
  return {prestadores,depositos,contratacoes,totais,geradoEmUtc,geradoEm,filtrosTexto:labels.join('; ')};
 });
}
