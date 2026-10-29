import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError,money} from './b3.js';
import {contractMovements} from './pc10-ledger.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
const json=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?v.toString():v);
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
function identifier(value){if(!['string','number'].includes(typeof value)||!/^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))fail('HORARIO_INVALIDO');
 date(value.slice(0,10));return value;
}
function period(start,end,serviceDate){
 timestamp(start);timestamp(end);if(end<=start)fail('PERIODO_INVALIDO');
 if(serviceDate){const next=new Date(serviceDate+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);if(!start.startsWith(serviceDate+'T')||end.slice(0,10)>next.toISOString().slice(0,10))fail('PERIODO_INVALIDO');}
}
function reason(value){if(typeof value!=='string'||!value.trim()||value.trim().length>800)fail('MOTIVO_OBRIGATORIO');return value.trim();}
function version(value){if(!Number.isSafeInteger(value)||value<1)fail('VERSAO_INVALIDA');return value;}
function creationInput(body){
 keys(body,['filialId','prestadorId','tipoServicoId','gestorId','dataServico','inicioPrevisto','fimPrevisto','valor']);
 const v={filialId:identifier(body.filialId),prestadorId:identifier(body.prestadorId),tipoServicoId:identifier(body.tipoServicoId),gestorId:identifier(body.gestorId),dataServico:date(body.dataServico),inicioPrevisto:body.inicioPrevisto,fimPrevisto:body.fimPrevisto,valor:money(body.valor)};
 period(v.inicioPrevisto,v.fimPrevisto,v.dataServico);return v;
}
async function actorDb(db,actor,write){
 const uid=identifier(actor),row=(await db.query(`SELECT u.UsuarioId,CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor,CASE WHEN ${roleSql(uid,'FINANCEIRO')} THEN 1 ELSE 0 END Financeiro FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
 if(!row||!yes(row.Adm)&&!yes(row.Gestor)&&(write||!yes(row.Financeiro)))fail('PERMISSAO_NEGADA',403);
 return {admin:yes(row.Adm),operational:yes(row.Adm)||yes(row.Gestor),finance:yes(row.Financeiro)};
}
const scope=(actor,user,alias='c')=>user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${identifier(actor)} AND uf.FilialId=${alias}.FilialId AND uf.RevogadoEmUtc IS NULL)`;
// An accumulated financial role grants global financial reads, never broader operations.
const visibility=(actor,user)=>user.finance&&!user.admin?`((${user.operational?scope(actor,user):'1=0'}) OR c.Status='LIBERADA')`:scope(actor,user);
const responsibleScope=branch=>`((${roleSql('u.UsuarioId','ADMIN')} AND u.Perfil='ADMIN') OR (${roleSql('u.UsuarioId','GESTOR')} AND EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial rf WHERE rf.UsuarioId=u.UsuarioId AND rf.FilialId=${branch} AND rf.RevogadoEmUtc IS NULL)))`;
const columns=`c.ContratacaoId,c.Numero,c.FilialId,c.PrestadorId,c.TipoServicoId,p.Nome Prestador,f.Nome Filial,t.Nome Tipo,
 CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(16),c.InicioPrevisto,126) InicioPrevisto,CONVERT(varchar(16),c.FimPrevisto,126) FimPrevisto,
 CONVERT(varchar(16),c.EntradaReal,126) EntradaReal,CONVERT(varchar(16),c.SaidaReal,126) SaidaReal,c.EntradaOrigem,c.SaidaOrigem,
 CONVERT(varchar(40),c.Valor) Valor,c.Status,c.Versao,c.GestorResponsavelId,g.Nome GestorResponsavel,c.CriadoPor,c.ConferidoPor,CONVERT(varchar(23),c.CriadoEmUtc,126) CriadoEmUtc,
 CONVERT(varchar(23),c.LiberadoEmUtc,126) LiberadoEmUtc,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,CONVERT(varchar(23),c.PagoEmUtc,126) PagoEmUtc`;
const joins=' JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Filial f ON f.FilialId=c.FilialId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId';
export async function record(db,actor,user,id,write=false){
 const row=(await db.query(`SELECT ${columns} FROM Operacao.Contratacao c${write?' WITH(UPDLOCK,HOLDLOCK)':''}${joins} WHERE c.ContratacaoId=${identifier(id)} AND ${write?scope(actor,user):visibility(actor,user)}`))[0];
 if(!row)fail('CONTRATACAO_INDISPONIVEL',404);return row;
}
export async function transaction(cfg,actor,token,write,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;'+(write&&!cfg.pc10?"IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NOT NULL THROW 55916,N'PC10 provisionado exige escrituracao ativa',1;":''));await db.beginTransaction();
 try{
  if(write){const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);}
  const user=await actorDb(db,actor,write);if(write)await assertMfa(db,actor,token);const result=await fn(db,user);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627].includes(Number(x.code))))fail('PRESTADOR_JA_CONTRATADO_NA_DATA',409);throw e;}
});}
export async function event(db,actor,id,action,details){
 const payload=s(json(details),'max');
 await db.query(`INSERT Operacao.ContratacaoEvento(ContratacaoId,Acao,AtorUsuarioId,Versao,Status,Valor,ValorLiberado,DetalhesJson) SELECT ContratacaoId,'${action}',${identifier(actor)},Versao,Status,Valor,ValorLiberado,${payload} FROM Operacao.Contratacao WHERE ContratacaoId=${identifier(id)}`);
 await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Contratacao',${identifier(id)},N'PC04_${action}',${identifier(actor)},${payload})`);
}
export async function catalog(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!user.operational)return {pc04:true,podeOperar:false,filiais:[],tipos:[],prestadores:[],gestores:[]};
 return {pc04:true,podeOperar:true,filiais:await db.query(`SELECT f.FilialId,f.Nome FROM Cadastro.Filial f WHERE f.Ativo=1 AND ${scope(actor,user,'f')} ORDER BY f.Nome`),tipos:await db.query('SELECT TipoServicoId,Nome FROM Cadastro.TipoServico WHERE Ativo=1 ORDER BY Nome'),prestadores:await db.query(`SELECT p.PrestadorId,p.Nome,p.CPF,pf.FilialId FROM Cadastro.Prestador p JOIN Cadastro.PrestadorFilial pf ON pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL JOIN Cadastro.Filial f ON f.FilialId=pf.FilialId AND f.Ativo=1 WHERE p.Ativo=1 AND ${scope(actor,user,'f')} ORDER BY p.Nome,pf.FilialId`),gestores:await db.query(`SELECT u.UsuarioId,u.Nome,f.FilialId FROM Seguranca.Usuario u CROSS JOIN Cadastro.Filial f WHERE u.Ativo=1 AND f.Ativo=1 AND ${scope(actor,user,'f')} AND ${responsibleScope('f.FilialId')} ORDER BY u.Nome,u.UsuarioId,f.FilialId`)};
});}
export async function list(cfg,actor,antes){
 const before=antes===undefined?'':` AND c.Numero<${identifier(antes)}`;
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const rows=await db.query(`SELECT TOP(201) ${columns} FROM Operacao.Contratacao c${joins} WHERE ${visibility(actor,user)}${before} ORDER BY c.Numero DESC`),registros=rows.slice(0,200);
  return {pc04:true,podeOperar:user.operational,registros,proximaPagina:rows.length>200?String(registros.at(-1).Numero):null};
 });
}
export async function detail(cfg,actor,id){identifier(id);return transaction(cfg,actor,null,false,async(db,user)=>{
 const row=await record(db,actor,user,id);return {registro:row,pc10:cfg.pc10===true,podeOperar:user.operational&&(user.admin||await branchAllowed(db,actor,row.FilialId)),...(cfg.pc05?{pc05:true,entradaTokenUsada:(await db.query(`SELECT TOP(1) 1 V FROM Operacao.ContratacaoToken WHERE ContratacaoId=${identifier(id)} AND Tipo='ENTRADA' AND ConsumidoEmUtc IS NOT NULL`)).length>0}:{}),eventos:await db.query(`SELECT EventoId,Acao,AtorUsuarioId,Versao,Status,CONVERT(varchar(40),Valor) Valor,CONVERT(varchar(40),ValorLiberado) ValorLiberado,CONVERT(varchar(23),CriadoEmUtc,126) CriadoEmUtc,JSON_VALUE(DetalhesJson,'$.motivo') Motivo,DetalhesJson FROM Operacao.ContratacaoEvento WHERE ContratacaoId=${identifier(id)} ORDER BY EventoId`)};
});}
async function branchAllowed(db,actor,branch){return (await db.query(`SELECT 1 V FROM Seguranca.UsuarioFilial WHERE UsuarioId=${identifier(actor)} AND FilialId=${identifier(branch)} AND RevogadoEmUtc IS NULL`)).length>0;}
export async function create(cfg,actor,token,body){const v=creationInput(body);return transaction(cfg,actor,token,true,async(db,user)=>{
 if(!(await db.query(`SELECT f.FilialId FROM Cadastro.Filial f WITH(HOLDLOCK) WHERE f.FilialId=${v.filialId} AND f.Ativo=1 AND ${scope(actor,user,'f')}`)).length)fail('FILIAL_NAO_AUTORIZADA',403);
 if(!(await db.query(`SELECT u.UsuarioId FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${v.gestorId} AND u.Ativo=1 AND ${responsibleScope(v.filialId)}`)).length)fail('GESTOR_RESPONSAVEL_INDISPONIVEL',403);
 if(!(await db.query(`SELECT p.PrestadorId FROM Cadastro.Prestador p WITH(HOLDLOCK) JOIN Cadastro.PrestadorFilial pf ON pf.PrestadorId=p.PrestadorId AND pf.FilialId=${v.filialId} AND pf.RevogadoEmUtc IS NULL WHERE p.PrestadorId=${v.prestadorId} AND p.Ativo=1`)).length)fail('PRESTADOR_SEM_VINCULO_ATIVO',409);
 if(!(await db.query(`SELECT TipoServicoId FROM Cadastro.TipoServico WITH(HOLDLOCK) WHERE TipoServicoId=${v.tipoServicoId} AND Ativo=1`)).length)fail('TIPO_INATIVO',409);
 // Global occupancy includes cancelled records; identity/history is never reused.
 if((await db.query(`SELECT ContratacaoId FROM Operacao.Contratacao WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=${v.prestadorId} AND DataServico='${v.dataServico}'`)).length)fail('PRESTADOR_JA_CONTRATADO_NA_DATA',409);
 // Existing laboratory history also occupies the day; never silently duplicate it.
 if((await db.query(`SELECT p.ParticipacaoId FROM Operacao.Participacao p WITH(HOLDLOCK) JOIN Operacao.Atividade a WITH(HOLDLOCK) ON a.AtividadeId=p.AtividadeId WHERE p.PrestadorId=${v.prestadorId} AND a.DataServico='${v.dataServico}'`)).length)fail('PRESTADOR_JA_CONTRATADO_NA_DATA',409);
 const inserted=(await db.query(`INSERT Operacao.Contratacao(FilialId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor) OUTPUT inserted.ContratacaoId VALUES(${v.filialId},${v.prestadorId},${v.tipoServicoId},${v.gestorId},'${v.dataServico}','${v.inicioPrevisto}:00','${v.fimPrevisto}:00',${v.valor},${identifier(actor)})`))[0];
 if(!inserted)throw Error('Contratação não persistida');await event(db,actor,inserted.ContratacaoId,'CRIAR',{dados:v});return record(db,actor,user,inserted.ContratacaoId,true);
});}
export async function change(cfg,actor,token,id,action,body){
 identifier(id);const fields={horarios:['entradaReal','saidaReal','motivo'],conferir:[],revisar:['valor','motivo'],cancelar:['motivo']};
 if(!Object.hasOwn(fields,action))fail('ACAO_INVALIDA');keys(body,['versao',...fields[action]]);version(body.versao);
 const why=action==='conferir'?null:reason(body.motivo),amount=action==='revisar'?money(body.valor):null;
 if(action==='horarios')period(body.entradaReal,body.saidaReal);
 return transaction(cfg,actor,token,true,async(db,user)=>{
  const previous=await record(db,actor,user,id,true);
  if(Number(previous.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(previous.PagoEmUtc&&(!cfg.pc10||action==='horarios'))fail('CONTRATACAO_PAGA_PRESERVADA',409);
  if(previous.Status==='CANCELADA')fail('CONTRATACAO_CANCELADA',409);
  let set;
  const unrelease="Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL";
  if(action==='horarios'){
   period(body.entradaReal,body.saidaReal,previous.DataServico);
   set=`EntradaReal='${body.entradaReal}:00',SaidaReal='${body.saidaReal}:00',EntradaOrigem='MANUAL',SaidaOrigem='MANUAL',${unrelease}`;
  }else if(action==='conferir'){
   if(previous.Status==='LIBERADA')fail('CONTRATACAO_JA_LIBERADA',409);
   if(!previous.EntradaReal||!previous.SaidaReal)fail('HORARIOS_REAIS_OBRIGATORIOS',409);
   set=`Status='LIBERADA',ValorLiberado=Valor,LiberadoEmUtc=SYSUTCDATETIME(),ConferidoPor=${identifier(actor)}`;
  }else if(action==='revisar')set=`Valor=${amount},${unrelease}`;
  else set="Status='CANCELADA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL";
  if(cfg.pc10)await contractMovements(db,actor,previous,action,previous.Valor,why);
  await db.query(`UPDATE Operacao.Contratacao SET ${set},Versao=Versao+1 WHERE ContratacaoId=${identifier(id)} AND Versao=${body.versao}`);
  if(cfg.pc05&&['horarios','cancelar'].includes(action))await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${identifier(id)} AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);
  await event(db,actor,id,action.toUpperCase(),{antes:previous,motivo:why,...(action==='horarios'?{entradaReal:body.entradaReal,saidaReal:body.saidaReal,origem:'MANUAL'}:{}),...(action==='revisar'?{valor:amount}:{})});
  return record(db,actor,user,id,true);
 });
}
