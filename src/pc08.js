import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError,money} from './b3.js';
import {movement,decimal,cents} from './pc10-ledger.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
const depotScope=(actor,alias='c')=>`(EXISTS(SELECT 1 FROM Seguranca.Usuario au JOIN Seguranca.UsuarioRaiz ar ON ar.UsuarioId=au.UsuarioId WHERE au.UsuarioId=${n(actor)} AND au.Ativo=1 AND au.Perfil='ADMIN') OR EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${n(actor)} AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL))`;
function id(v){if(!['number','string','bigint'].includes(typeof v)||!/^\d+$/.test(String(v)))fail('IDENTIFICADOR_INVALIDO');try{return n(v);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function keys(v,allowed){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'2000-01-01'||v>'9998-12-31')fail('DATA_INVALIDA');const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('DATA_INVALIDA');return v;}
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function input(body){
 keys(body,['dataPagamento','itens']);const day=date(body.dataPagamento);if(day>today())fail('DATA_FUTURA');
 if(!Array.isArray(body.itens)||!body.itens.length||body.itens.length>10)fail('SELECIONE_ATE_10_CONTRATACOES');
 const seen=new Set();const items=body.itens.map(i=>{
  keys(i,['contratacaoId','versao','valor','anexo']);const key=id(i.contratacaoId);if(seen.has(key))fail('CONTRATACAO_REPETIDA');seen.add(key);
  if(!Number.isSafeInteger(i.versao)||i.versao<1)fail('VERSAO_INVALIDA');const value=money(i.valor);
  keys(i.anexo,['nome','conteudo']);const a=i.anexo;
  if(typeof a.nome!=='string'||!a.nome.trim()||a.nome.length>180||/[\x00-\x1f\x7f/\\]/.test(a.nome))fail('NOME_ANEXO_INVALIDO');
  if(typeof a.conteudo!=='string'||!a.conteudo.length||a.conteudo.length>1398104||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.conteudo))fail('ANEXO_INVALIDO');
  const bytes=Buffer.from(a.conteudo,'base64');if(!bytes.length||bytes.length>1048576||bytes.toString('base64')!==a.conteudo)fail('ANEXO_INVALIDO');
  return {id:key,versao:i.versao,valor:value,nome:a.nome.trim(),bytes};
 });return {day,items};
}
// Same transaction-owned lock as PC04: revision/release and payment serialize together.
async function transaction(cfg,actor,token,write,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;'+(write&&!cfg.pc10?"IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NOT NULL THROW 55916,N'PC10 provisionado exige escrituracao ativa',1;":''));await db.beginTransaction();
 try{
  if(write){const r=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!r||!Number.isInteger(Number(r.R))||Number(r.R)<0)fail('OPERACAO_OCUPADA',409);}
  const uid=id(actor),u=(await db.query(`SELECT CASE WHEN ((${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN') OR ${roleSql(uid,'FINANCEIRO')}) THEN 1 ELSE 0 END Permitido FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
  if(!yes(u?.Permitido))fail('PERMISSAO_NEGADA',403);if(write)await assertMfa(db,actor,token,cfg);
  const result=await fn(db);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627,1205,1222].includes(Number(x.code))))fail('REGISTRO_ALTERADO_ATUALIZE',409);throw e;}
});}
export async function pay(cfg,actor,token,body){const {day,items}=input(body);return transaction(cfg,actor,token,true,async db=>{
 const rows=await db.query(`SELECT c.ContratacaoId,c.PrestadorId,c.DepositoId,CONVERT(varchar(10),c.DataServico,23) DataServico,c.Status,c.Versao,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,c.PagoEmUtc FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) WHERE c.ContratacaoId IN(${items.map(i=>i.id).join(',')}) AND ${depotScope(actor)} ORDER BY c.ContratacaoId`);
 if(rows.length!==items.length)fail('CONTRATACAO_INDISPONIVEL',409);
 const provider=String(rows[0].PrestadorId);let total=0n;
 for(const i of items){const row=rows.find(r=>String(r.ContratacaoId)===i.id);
  if(!row||row.Status!=='LIBERADA'||row.PagoEmUtc||!row.ValorLiberado||Number(row.Versao)!==i.versao||money(row.ValorLiberado)!==i.valor)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(String(row.PrestadorId)!==provider)fail('PRESTADORES_DIFERENTES',409);
  if(day<row.DataServico)fail('DATA_ANTERIOR_AO_SERVICO',409);total+=BigInt(i.valor.replace('.',''));
 }
 const value=`${total/100n}.${String(total%100n).padStart(2,'0')}`;
 const payment=(await db.query(`INSERT Financeiro.PC08Pagamento(PrestadorId,DataPagamento,RegistradoPor,ValorTotal) OUTPUT inserted.PagamentoId VALUES(${id(provider)},'${day}',${id(actor)},${value})`))[0];
 if(!payment)throw Error('Pagamento não persistido');const pid=id(payment.PagamentoId);
 for(const i of items){
  await db.query(`INSERT Financeiro.PC08Item(PagamentoId,ContratacaoId,VersaoLiberada,Valor) VALUES(${pid},${i.id},${i.versao},${i.valor})`);
  if(cfg.pc10)await movement(db,{contract:i.id,key:`P:${pid}:${i.id}`,type:'PAGAMENTO',value:decimal(-cents(i.valor)),actor,version:i.versao,day,payment:pid});
  await db.query(`INSERT Financeiro.PC08Anexo(ContratacaoId,Nome,Conteudo) VALUES(${i.id},${s(i.nome,180)},0x${i.bytes.toString('hex')})`);
  await db.query(`UPDATE Operacao.Contratacao SET PagoEmUtc=SYSUTCDATETIME(),Versao=Versao+1 WHERE ContratacaoId=${i.id}`);
 }
 await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Pagamento',${pid},N'PC08_BAIXA',${id(actor)},${s(JSON.stringify({dataPagamento:day,itens:items.map(i=>({contratacaoId:i.id,versao:i.versao,valor:i.valor})),valor:value}),'max')})`);
 return {...payment,ValorTotal:value,DataPagamento:day};
});}
export async function panel(cfg,actor,q){
 keys(q,['depositoId','prestadorId','inicio','fim','situacao','antes']);const where=["c.Status='LIBERADA'","c.ValorLiberado IS NOT NULL"];
 if(q.situacao&&!['ABERTO','PAGO'].includes(q.situacao))fail('SITUACAO_INVALIDA');
 if(q.situacao)where.push(`c.PagoEmUtc IS ${q.situacao==='ABERTO'?'NULL':'NOT NULL'}`);
 for(const [key,column] of [['depositoId','DepositoId'],['prestadorId','PrestadorId']])if(q[key])where.push(`c.${column}=${id(q[key])}`);
 if(q.inicio)where.push(`c.DataServico>='${date(q.inicio)}'`);if(q.fim)where.push(`c.DataServico<='${date(q.fim)}'`);
 if(q.inicio&&q.fim&&q.inicio>q.fim)fail('PERIODO_INVALIDO');if(q.antes)where.push(`c.ContratacaoId<${id(q.antes)}`);
 where.push(depotScope(actor));return transaction(cfg,actor,null,false,async db=>{
  const rows=await db.query(`SELECT TOP(101) c.ContratacaoId,c.Numero,c.DepositoId,c.PrestadorId,c.Versao,f.Nome Deposito,g.Nome Gestor,p.Nome Prestador,t.Nome Tipo,CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(40),c.ValorLiberado) Valor,c.PagoEmUtc,i.PagamentoId,CONVERT(varchar(10),pg.DataPagamento,23) DataPagamento,pg.RegistradoPor,CONVERT(varchar(23),pg.RegistradoEmUtc,126) RegistradoEmUtc FROM Operacao.Contratacao c JOIN Cadastro.Deposito f ON f.DepositoId=c.DepositoId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId LEFT JOIN Financeiro.PC08Item i ON i.ContratacaoId=c.ContratacaoId LEFT JOIN Financeiro.PC08Pagamento pg ON pg.PagamentoId=i.PagamentoId WHERE ${where.join(' AND ')} ORDER BY c.ContratacaoId DESC`);
  const registros=rows.slice(0,100);return {registros,proximaPagina:rows.length>100?String(registros.at(-1).ContratacaoId):null};
 });
}
export async function attachment(cfg,actor,contract){const key=id(contract);return transaction(cfg,actor,null,false,async db=>{
 const row=(await db.query(`SELECT a.Nome,a.Conteudo FROM Financeiro.PC08Anexo a JOIN Financeiro.PC08Item i ON i.ContratacaoId=a.ContratacaoId JOIN Operacao.Contratacao c ON c.ContratacaoId=a.ContratacaoId WHERE a.ContratacaoId=${key} AND ${depotScope(actor)}`))[0];if(!row)fail('ANEXO_INDISPONIVEL',404);return row;
});}
