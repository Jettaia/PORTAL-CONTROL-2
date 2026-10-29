import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
import {movement,cents,decimal} from './pc10-ledger.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
function id(v){if(!['number','string'].includes(typeof v)||! /^[1-9]\d*$/.test(String(v)))fail('IDENTIFICADOR_INVALIDO');try{return n(v);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function keys(v,allowed){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');}
function reason(v){if(typeof v!=='string'||!v.trim()||v.trim().length>800)fail('MOTIVO_OBRIGATORIO');return v.trim();}
function date(v){if(typeof v!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(v)||v<'2000-01-01'||v>'9998-12-31')fail('DATA_INVALIDA');const d=new Date(v+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('DATA_INVALIDA');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(v>today)fail('DATA_FUTURA');return v;}
function attachment(v){keys(v,['nome','conteudo']);if(typeof v.nome!=='string'||!v.nome.trim()||v.nome.length>180||/[\x00-\x1f\x7f/\\]/.test(v.nome))fail('ANEXO_INVALIDO');if(typeof v.conteudo!=='string'||!v.conteudo||v.conteudo.length>1398104||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.conteudo))fail('ANEXO_INVALIDO');const bytes=Buffer.from(v.conteudo,'base64');if(!bytes.length||bytes.length>1048576||bytes.toString('base64')!==v.conteudo)fail('ANEXO_INVALIDO');return {name:v.nome.trim(),bytes};}
async function tx(cfg,actor,token,write,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{
  if(write){const r=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!r||!Number.isInteger(Number(r.R))||Number(r.R)<0)fail('OPERACAO_OCUPADA',409);}
  const uid=id(actor),u=(await db.query(`SELECT CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor,CASE WHEN ${roleSql(uid,'FINANCEIRO')} THEN 1 ELSE 0 END Financeiro FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
  if(!u||!yes(u.Adm)&&!yes(u.Financeiro)&&(!yes(u.Gestor)||write))fail('PERMISSAO_NEGADA',403);
  if(write)await assertMfa(db,actor,token);const result=await fn(db,u);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627,1205,1222].includes(Number(x.code))))fail('REGISTRO_ALTERADO_ATUALIZE',409);throw e;}
});}
const scoped=(actor,u,alias='c')=>yes(u.Adm)||yes(u.Financeiro)?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${id(actor)} AND uf.FilialId=${alias}.FilialId AND uf.RevogadoEmUtc IS NULL)`;
async function contract(db,actor,u,key){const r=(await db.query(`SELECT c.ContratacaoId,c.Status,c.Versao,c.PagoEmUtc,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,CONVERT(varchar(10),c.DataServico,23) DataServico FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) WHERE c.ContratacaoId=${key} AND ${scoped(actor,u)}`))[0];if(!r)fail('CONTRATACAO_INDISPONIVEL',404);return r;}
async function balance(db,key){return (await db.query(`SELECT CONVERT(varchar(40),COALESCE(SUM(Valor),0)) Saldo FROM Financeiro.PC10Movimento WHERE ContratacaoId=${key}`))[0]?.Saldo||'0.00';}
async function audit(db,actor,key,type,details){await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Contratacao',${key},${s(type,40)},${id(actor)},${s(JSON.stringify(details),'max')})`);}
export async function detail(cfg,actor,key){key=id(key);return tx(cfg,actor,null,false,async(db,u)=>{
 const registro=await contract(db,actor,u,key),saldo=await balance(db,key);
 const movimentos=await db.query(`SELECT MovimentoId,Tipo,CONVERT(varchar(40),Valor) Valor,CONVERT(varchar(10),DataEfetiva,23) DataEfetiva,AtorUsuarioId,Versao,PagamentoId,Motivo,CONVERT(varchar(23),RegistradoEmUtc,126) RegistradoEmUtc,CASE WHEN Conteudo IS NULL THEN 0 ELSE 1 END TemAnexo FROM Financeiro.PC10Movimento WHERE ContratacaoId=${key} ORDER BY MovimentoId`);
 // Managers must not receive a cross-branch payment group ID or authority to reverse it.
 const pagamentosEstornaveis=yes(u.Adm)||yes(u.Financeiro)?await db.query(`SELECT p.PagamentoId FROM Financeiro.PC08Pagamento p JOIN Financeiro.PC08Item i ON i.PagamentoId=p.PagamentoId WHERE i.ContratacaoId=${key} AND ${yes(u.Adm)?'1=1':`p.RegistradoPor=${id(actor)}`} AND NOT EXISTS(SELECT 1 FROM Financeiro.PC10Estorno e WHERE e.PagamentoId=p.PagamentoId)`):[];
 const documentos=await db.query(`SELECT Versao,Estado,ExigeNovaAssinatura FROM Financeiro.PC10DocumentoEstado WHERE ContratacaoId=${key} ORDER BY Versao`);
 return {registro,saldo,movimentos,pagamentosEstornaveis,documentos,podeRegularizar:(yes(u.Adm)||yes(u.Financeiro))&&['LIBERADA','CANCELADA'].includes(registro.Status)&&!!registro.PagoEmUtc&&cents(saldo)!==0n};
});}
export async function settle(cfg,actor,token,key,body){
 key=id(key);keys(body,['versao','valor','data','anexo','motivo']);if(!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_INVALIDA');
 if(typeof body.valor!=='string'||! /^-?(?:0|[1-9]\d{0,15})\.\d{2}$/.test(body.valor)||cents(body.valor)===0n)fail('VALOR_INVALIDO');const day=date(body.data),why=reason(body.motivo),a=attachment(body.anexo);
 return tx(cfg,actor,token,true,async(db,u)=>{
  const c=await contract(db,actor,u,key);if(Number(c.Versao)!==body.versao||!c.PagoEmUtc||!['LIBERADA','CANCELADA'].includes(c.Status))fail('REGISTRO_ALTERADO_ATUALIZE',409);
  const saldo=await balance(db,key);if(cents(saldo)!==cents(body.valor))fail('SALDO_ALTERADO_ATUALIZE',409);if(day<c.DataServico)fail('DATA_ANTERIOR_AO_SERVICO',409);
  // One settlement per contract version; version advances atomically with the balance.
  await movement(db,{contract:key,key:`Q:${key}:${body.versao}`,type:cents(saldo)>0n?'QUITACAO':'DEVOLUCAO',value:decimal(-cents(saldo)),actor,version:body.versao,day,reason:why});
  await db.query(`UPDATE Financeiro.PC10Movimento SET Nome=${s(a.name,180)},Conteudo=0x${a.bytes.toString('hex')} WHERE Chave=${s(`Q:${key}:${body.versao}`,120)}`);
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${key};INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Contratacao',${key},N'PC10_REGULARIZAR',${id(actor)},${s(JSON.stringify({valor:saldo,data:day,motivo:why}),'max')})`);
  return {saldo:'0.00'};
 });
}
export async function reverse(cfg,actor,token,key,body){key=id(key);keys(body,['motivo']);const why=reason(body.motivo);return tx(cfg,actor,token,true,async(db,u)=>{
 const pg=(await db.query(`SELECT PagamentoId,RegistradoPor FROM Financeiro.PC08Pagamento WITH(UPDLOCK,HOLDLOCK) WHERE PagamentoId=${key}`))[0];if(!pg)fail('PAGAMENTO_INDISPONIVEL',404);if(!yes(u.Adm)&&String(pg.RegistradoPor)!==String(actor))fail('PERMISSAO_NEGADA',403);
 if((await db.query(`SELECT PagamentoId FROM Financeiro.PC10Estorno WHERE PagamentoId=${key}`)).length)fail('PAGAMENTO_JA_ESTORNADO',409);
 const items=await db.query(`SELECT i.ContratacaoId,CONVERT(varchar(40),i.Valor) Valor,c.Versao FROM Financeiro.PC08Item i JOIN Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) ON c.ContratacaoId=i.ContratacaoId WHERE i.PagamentoId=${key}`);if(!items.length)fail('PAGAMENTO_INDISPONIVEL',409);
 await db.query(`INSERT Financeiro.PC10Estorno(PagamentoId,AtorUsuarioId,Motivo) VALUES(${key},${id(actor)},${s(why,800)})`);
 for(const i of items){await movement(db,{contract:i.ContratacaoId,key:`E:${key}:${i.ContratacaoId}`,type:'ESTORNO',value:i.Valor,actor,version:i.Versao,payment:key,reason:why});await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${id(i.ContratacaoId)}`);await audit(db,actor,id(i.ContratacaoId),'PC10_ESTORNO',{pagamentoId:key,motivo:why,valor:i.Valor});}
 return {estornado:true};
});}
export async function evidence(cfg,actor,key){key=id(key);return tx(cfg,actor,null,false,async(db,u)=>{const row=(await db.query(`SELECT m.Nome,m.Conteudo FROM Financeiro.PC10Movimento m JOIN Operacao.Contratacao c ON c.ContratacaoId=m.ContratacaoId WHERE m.MovimentoId=${key} AND m.Conteudo IS NOT NULL AND ${scoped(actor,u)}`))[0];if(!row)fail('ANEXO_INDISPONIVEL',404);return row;});}
