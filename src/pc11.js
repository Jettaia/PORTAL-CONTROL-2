import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {PlanningError} from './b3.js';
import {cents,decimal} from './pc10-ledger.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
function id(v){if(!['number','string','bigint'].includes(typeof v)||!/^[1-9]\d*$/.test(String(v)))fail('IDENTIFICADOR_INVALIDO');try{return n(v);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'2000-01-01'||v>'9998-12-31')fail('DATA_INVALIDA');const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('DATA_INVALIDA');return v;}
function filters(q){
 if(!q||typeof q!=='object'||Object.keys(q).some(k=>!['nome','prestadorId','depositoId','inicio','fim'].includes(k)))fail('FILTROS_INVALIDOS');
 const f={};for(const k of ['prestadorId','depositoId'])if(q[k]!==undefined&&q[k]!=='')f[k]=id(q[k]);
 for(const k of ['inicio','fim'])if(q[k]!==undefined&&q[k]!=='')f[k]=date(q[k]);
 if(f.inicio&&f.fim&&f.inicio>f.fim)fail('PERIODO_INVALIDO');
 if(q.nome!==undefined){if(typeof q.nome!=='string'||q.nome.length>150)fail('NOME_INVALIDO');if(q.nome.trim())f.nome=q.nome.trim();}return f;
}
const scope=(actor,u)=>yes(u.Adm)?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito uf WHERE uf.UsuarioId=${id(actor)} AND uf.DepositoId=c.DepositoId AND uf.RevogadoEmUtc IS NULL)`;
async function read(cfg,actor,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{
  const uid=id(actor),u=(await db.query(`SELECT CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'FINANCEIRO')} THEN 1 ELSE 0 END Financeiro,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
  if(!u||![u.Adm,u.Financeiro,u.Gestor].some(yes))fail('PERMISSAO_NEGADA',403);
  const result=await fn(db,u);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}throw e;}
});}
const joins=`JOIN Operacao.Contratacao c ON c.ContratacaoId=m.ContratacaoId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito f ON f.DepositoId=c.DepositoId JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId`;

// Read the canonical events, including all history before the cut. Never use current
// ValorLiberado/PagoEmUtc to reconstruct a historical balance after a revision.
export async function statement(cfg,actor,q){const filtros=filters(q);return read(cfg,actor,async(db,u)=>{
 const where=[scope(actor,u)];
 for(const [k,col] of [['prestadorId','PrestadorId'],['depositoId','DepositoId']])if(filtros[k])where.push(`c.${col}=${filtros[k]}`);
 if(filtros.fim)where.push(`m.DataEfetiva<='${filtros.fim}'`);
 if(filtros.nome)where.push(`p.Nome LIKE ${s('%'+filtros.nome.replace(/[~%_\[]/g,'~$&')+'%',304)} ESCAPE '~'`);
 const rows=await db.query(`SELECT TOP(10001) m.MovimentoId,m.ContratacaoId,c.Numero,c.PrestadorId,p.Nome Prestador,c.DepositoId,f.Nome Deposito,g.Nome Gestor,t.Nome Atividade,CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(10),m.DataEfetiva,23) DataEfetiva,CONVERT(varchar(23),m.RegistradoEmUtc,126) RegistradoEmUtc,m.Tipo,CONVERT(varchar(40),m.Valor) Valor,m.PagamentoId,m.Motivo,CASE WHEN m.Conteudo IS NULL THEN 0 ELSE 1 END TemAnexo,CASE WHEN a.ContratacaoId IS NULL THEN 0 ELSE 1 END TemAnexoPagamento,CAST(NULL AS varchar(40)) Recibo FROM Financeiro.PC10Movimento m ${joins} LEFT JOIN Financeiro.PC08Anexo a ON a.ContratacaoId=c.ContratacaoId WHERE ${where.join(' AND ')} ORDER BY m.DataEfetiva,m.RegistradoEmUtc,m.MovimentoId`);
 if(rows.length>10000)fail('EXTRATO_EXCEDE_LIMITE_REFINE_FILTROS',422);
 let previous=0n,balance=0n,paid=0n;const contracts=new Map(),movimentos=[];
 for(const row of rows){
  const value=cents(row.Valor);balance+=value;const key=String(row.ContratacaoId);contracts.set(key,(contracts.get(key)||0n)+value);
  if(filtros.inicio&&row.DataEfetiva<filtros.inicio){previous+=value;continue;}
  if(['PAGAMENTO','QUITACAO','ESTORNO','DEVOLUCAO'].includes(row.Tipo))paid-=value;
  movimentos.push({...row,Saldo:decimal(balance)});
 }
 let open=0n,returned=0n;for(const value of contracts.values())if(value>0n)open+=value;else returned-=value;
 return {filtros,saldoAnterior:decimal(previous),saldoFinal:decimal(balance),totalPago:decimal(paid),totalAberto:decimal(open),totalDevolver:decimal(returned),movimentos,integracaoRecibos:'PENDENTE_PC09'};
});}

export async function group(cfg,actor,key){key=id(key);return read(cfg,actor,async(db,u)=>{
 const itens=await db.query(`SELECT i.ContratacaoId,c.Numero,c.PrestadorId,p.Nome Prestador,c.DepositoId,f.Nome Deposito,g.Nome Gestor,CONVERT(varchar(40),i.Valor) Valor,CONVERT(varchar(10),pg.DataPagamento,23) DataPagamento,CAST(NULL AS varchar(40)) Recibo,CASE WHEN a.ContratacaoId IS NULL THEN 0 ELSE 1 END TemAnexoPagamento FROM Financeiro.PC08Item i JOIN Financeiro.PC08Pagamento pg ON pg.PagamentoId=i.PagamentoId JOIN Operacao.Contratacao c ON c.ContratacaoId=i.ContratacaoId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito f ON f.DepositoId=c.DepositoId JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId LEFT JOIN Financeiro.PC08Anexo a ON a.ContratacaoId=c.ContratacaoId WHERE i.PagamentoId=${key} AND ${scope(actor,u)} ORDER BY i.ContratacaoId`);
 if(!itens.length)fail('PAGAMENTO_INDISPONIVEL',404);
 return {itens,total:decimal(itens.reduce((sum,row)=>sum+cents(row.Valor),0n))};
});}

export async function evidence(cfg,actor,key,kind){key=id(key);return read(cfg,actor,async(db,u)=>{
 const source=kind==='pagamento'?`Financeiro.PC08Anexo a JOIN Operacao.Contratacao c ON c.ContratacaoId=a.ContratacaoId WHERE a.ContratacaoId=${key}`:`Financeiro.PC10Movimento a JOIN Operacao.Contratacao c ON c.ContratacaoId=a.ContratacaoId WHERE a.MovimentoId=${key}`;
 const row=(await db.query(`SELECT a.Nome,a.Conteudo FROM ${source} AND a.Conteudo IS NOT NULL AND ${scope(actor,u)}`))[0];
 if(!row)fail('ANEXO_INDISPONIVEL',404);return row;
});}
