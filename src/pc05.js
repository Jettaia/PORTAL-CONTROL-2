import crypto from 'node:crypto';
import {withDb,intLiteral,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {hashToken,newToken} from './security.js';
import {PlanningError} from './b3.js';
import {transaction,event} from './pc04.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const id=value=>{if(!/^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return intLiteral(value);}catch{fail('IDENTIFICADOR_INVALIDO');}};
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
const strong=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const hash=(cfg,code)=>{if(!strong(cfg.token))throw Error('PC05 exige chave privada de 256 bits');return crypto.createHmac('sha256',cfg.token).update('PC05:'+code).digest('hex');};
function pairingVerifier(cfg,value){
 if(typeof value!=='string')fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const raw=value.trim();
 // Existing long pairing codes remain valid only within their original five minutes.
 if(strong(raw))return hashToken(raw);
 if(!/^(?:\d{9}|\d{3}-\d{3}-\d{3})$/.test(raw))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 return hash(cfg,'PAIR:'+raw.replaceAll('-',''));
}
async function newPairing(db,cfg){
 for(let attempt=0;attempt<10;attempt++){
  const digits=String(crypto.randomInt(1000000000)).padStart(9,'0'),digest=hash(cfg,'PAIR:'+digits);
  const exists=await db.query(`SELECT TabletId FROM Operacao.TabletPC05 WITH(UPDLOCK,HOLDLOCK) WHERE PareamentoHash='${digest}' AND ExcluidoEmUtc IS NULL AND RevogadoEmUtc IS NULL AND AtivadoEmUtc IS NULL AND PareamentoExpiraEmUtc>SYSUTCDATETIME()`);
  if(!exists.length)return {code:digits.replace(/(\d{3})(\d{3})(\d{3})/,'$1-$2-$3'),hash:digest};
 }
 fail('OPERACAO_OCUPADA',409);
}
const utc=value=>String(value).replace(/Z$/,'')+'Z';
const after=(value,now)=>value&&Date.parse(utc(value))>Date.parse(utc(now));
const future=(now,minutes)=>new Date(Date.parse(utc(now))+minutes*60000).toISOString();
async function time(db){return (await db.query("SELECT CONVERT(varchar(23),SYSUTCDATETIME(),126) AgoraUtc,CONVERT(varchar(19),CAST(SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time' AS datetime2(0)),126) AgoraLocal"))[0];}
const issuerActive=alias=>`EXISTS(SELECT 1 FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${alias}.EmissorId AND u.Ativo=1 AND ((${roleSql('u.UsuarioId','ADMIN')} AND u.Perfil='ADMIN') OR (${roleSql('u.UsuarioId','GESTOR')} OR ${roleSql('u.UsuarioId','COORDENADOR')})))`;
const issuerDepotScope=(issuer,alias='c')=>`EXISTS(SELECT 1 FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${id(issuer)} AND u.Ativo=1 AND ((${roleSql('u.UsuarioId','ADMIN')} AND u.Perfil='ADMIN') OR ((${roleSql('u.UsuarioId','GESTOR')} OR ${roleSql('u.UsuarioId','COORDENADOR')}) AND EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WITH(HOLDLOCK) WHERE ud.UsuarioId=${id(issuer)} AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL))))`;
async function audit(db,actor,entityId,action,details={}){await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'TabletPC05',${id(entityId)},${s('PC05_'+action,40)},${id(actor)},${s(JSON.stringify(details),'max')})`);}
async function tabletTx(cfg,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);const result=await fn(db,await time(db));await db.commit();return result;}catch(e){try{await db.rollback();}catch{}throw e;}
});}
const dates="CONVERT(varchar(23),t.ExpiraEmUtc,126) ExpiraEmUtc,CONVERT(varchar(23),t.PareamentoExpiraEmUtc,126) PareamentoExpiraEmUtc,t.RevogadoEmUtc,t.AtivadoEmUtc";
// Primary link remains readable by legacy clients; additional links expand it.
const tabletLinks=(alias='t')=>`(SELECT ${alias}.DepositoId DepositoId WHERE ${alias}.DepositoId IS NOT NULL UNION SELECT td.DepositoId FROM Operacao.TabletPC05Deposito td WHERE td.TabletId=${alias}.TabletId)`;
const activeLink=(alias='t')=>`EXISTS(SELECT 1 FROM ${tabletLinks(alias)} links JOIN Cadastro.Deposito f ON f.DepositoId=links.DepositoId WHERE f.Ativo=1)`;
const linkedContract=tablet=>`EXISTS(SELECT 1 FROM Operacao.TabletPC05 tx WHERE tx.TabletId=${id(tablet)} AND EXISTS(SELECT 1 FROM ${tabletLinks('tx')} links JOIN Cadastro.Deposito f ON f.DepositoId=links.DepositoId AND f.Ativo=1 WHERE links.DepositoId=c.DepositoId))`;
function tabletDepots(body){
 keys(body,['nome','depositoId','depositos']);
 if(Object.hasOwn(body,'depositos')&&Object.hasOwn(body,'depositoId'))fail('CAMPOS_INVALIDOS');
 const values=Object.hasOwn(body,'depositos')?body.depositos:[body.depositoId];
 if(!Array.isArray(values)||!values.length||values.length>100)fail('CAMPOS_INVALIDOS');
 const depots=values.map(id);if(new Set(depots.map(String)).size!==depots.length)fail('CAMPOS_INVALIDOS');return depots;
}
async function saveExtraDepots(db,tablet,depots){
 await db.query(`DELETE FROM Operacao.TabletPC05Deposito WHERE TabletId=${id(tablet)}`);
 if(depots.length>1)await db.query(`INSERT Operacao.TabletPC05Deposito(TabletId,DepositoId) VALUES${depots.slice(1).map(d=>'('+id(tablet)+','+d+')').join(',')}`);
}
async function authorizedTablet(db,raw,now){
 if(!strong(raw))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const t=(await db.query(`SELECT t.TabletId,t.DepositoId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.ExcluidoEmUtc IS NULL AND t.SessaoHash='${hashToken(raw)}' AND ${issuerActive('t')} AND ${activeLink()}`))[0];
 if(!t||!t.DepositoId||t.RevogadoEmUtc||!t.AtivadoEmUtc||(t.ExpiraEmUtc!==null&&!after(t.ExpiraEmUtc,now.AgoraUtc))||Number(t.Falhas)>=5)fail('AUTORIZACAO_TABLET_INVALIDA',401);return t;
}
function open(row){if(row.Status!=='ABERTA'||row.PagoEmUtc||Number(row.LiberacaoBloqueada)===1)fail('CONTRATACAO_FECHADA',409);if(row.HorarioPendenteId)fail('HORARIOS_PENDENTES_APROVACAO',409);}

export async function issue(){fail('GERACAO_TOKEN_DESATIVADA',410);}
const depotScope=(actor,user,alias='f')=>user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${id(actor)} AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL)`;
const tabletScope=(actor,user)=>user.admin?'1=1':`((t.DepositoId IS NULL AND t.EmissorId=${id(actor)}) OR (t.DepositoId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${tabletLinks()} links WHERE NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${id(actor)} AND ud.DepositoId=links.DepositoId AND ud.RevogadoEmUtc IS NULL))))`;
function tabletName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80)fail('NOME_INVALIDO');return value.trim();}
async function checkDepot(db,actor,user,depot){if(!(await db.query(`SELECT f.DepositoId FROM Cadastro.Deposito f WITH(HOLDLOCK) WHERE f.DepositoId=${id(depot)} AND f.Ativo=1 AND ${depotScope(actor,user)}`)).length)fail('DEPOSITO_INDISPONIVEL',404);}
async function managedTablet(db,actor,user,tabletId){const r=(await db.query(`SELECT t.TabletId,t.EmissorId,t.DepositoId,t.RevogadoEmUtc FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.TabletId=${id(tabletId)} AND t.ExcluidoEmUtc IS NULL AND ${tabletScope(actor,user)}`))[0];if(!r)fail('TABLET_INDISPONIVEL',404);return r;}
export async function pair(cfg,actor,session,body){
 const depots=tabletDepots(body),name=tabletName(body.nome),depot=depots[0];
 return transaction(cfg,actor,session,true,async(db,user)=>{
  const now=await time(db),expires=future(now.AgoraUtc,5);for(const value of depots)await checkDepot(db,actor,user,value);const pairing=await newPairing(db,cfg);
  const row=(await db.query(`INSERT Operacao.TabletPC05(Nome,EmissorId,DepositoId,PareamentoHash,PareamentoExpiraEmUtc,ExpiraEmUtc) OUTPUT inserted.TabletId VALUES(${s(name,80)},${id(actor)},${depot},'${pairing.hash}',CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126),NULL)`))[0];
  if(!row)throw Error('Tablet não persistido');if(depots.length>1)await saveExtraDepots(db,row.TabletId,depots);await audit(db,actor,row.TabletId,'PAREAR',{depositos:depots.map(String)});return {ok:true,tabletId:row.TabletId,pareamento:pairing.code,expiraEmUtc:expires};
 });
}
export async function tablets(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!user.operational)fail('PERMISSAO_NEGADA',403);
 const valid=`t.RevogadoEmUtc IS NULL AND t.DepositoId IS NOT NULL AND ${activeLink()} AND t.Falhas<5 AND ${issuerActive('t')} AND (t.ExpiraEmUtc IS NULL OR t.ExpiraEmUtc>SYSUTCDATETIME())`;
 const registros=await db.query(`SELECT t.TabletId,t.Nome,t.DepositoId,f.Nome Deposito,f.CentroCusto,
 CASE WHEN t.RevogadoEmUtc IS NOT NULL THEN 'REVOGADO' WHEN t.DepositoId IS NULL THEN 'SEM_DEPOSITO' WHEN t.Falhas>=5 OR NOT (${activeLink()}) OR NOT (${issuerActive('t')}) THEN 'BLOQUEADO'
 WHEN t.AtivadoEmUtc IS NOT NULL AND t.SessaoHash IS NOT NULL AND (t.ExpiraEmUtc IS NULL OR t.ExpiraEmUtc>SYSUTCDATETIME()) THEN 'ATIVO'
 WHEN t.PareamentoHash IS NOT NULL AND t.PareamentoExpiraEmUtc>SYSUTCDATETIME() THEN 'PENDENTE' ELSE 'CODIGO_EXPIRADO' END Estado,
 CASE WHEN ${valid} AND t.AtivadoEmUtc IS NOT NULL AND t.SessaoHash IS NOT NULL THEN 1 ELSE 0 END Ativo,
 CONVERT(varchar(23),t.CriadoEmUtc,126) CriadoEmUtc,CONVERT(varchar(23),t.AtivadoEmUtc,126) AtivadoEmUtc,
 (SELECT f2.DepositoId,f2.Nome,f2.CentroCusto FROM ${tabletLinks()} links JOIN Cadastro.Deposito f2 ON f2.DepositoId=links.DepositoId ORDER BY f2.Nome FOR JSON PATH) DepositosJson
 FROM Operacao.TabletPC05 t LEFT JOIN Cadastro.Deposito f ON f.DepositoId=t.DepositoId WHERE t.ExcluidoEmUtc IS NULL AND ${tabletScope(actor,user)} ORDER BY t.TabletId DESC`);
 for(const row of registros){row.Depositos=JSON.parse(row.DepositosJson||'[]');delete row.DepositosJson;}
 const depositos=await db.query(`SELECT f.DepositoId,f.Nome,f.CentroCusto FROM Cadastro.Deposito f WHERE f.Ativo=1 AND ${depotScope(actor,user)} ORDER BY f.Nome`);return {registros,depositos};
});}
export async function rePair(cfg,actor,session,tabletId,body){keys(body,[]);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 const now=await time(db),r=await managedTablet(db,actor,user,tabletId);if(!r.DepositoId)fail('DEPOSITO_OBRIGATORIO');await checkDepot(db,actor,user,r.DepositoId);const extras=await db.query(`SELECT DepositoId FROM Operacao.TabletPC05Deposito WHERE TabletId=${id(tabletId)}`);for(const extra of extras)await checkDepot(db,actor,user,extra.DepositoId);
 const expires=future(now.AgoraUtc,5),pairing=await newPairing(db,cfg);
 await db.query(`UPDATE Operacao.TabletPC05 SET EmissorId=${id(actor)},SessaoHash=NULL,AtivadoEmUtc=NULL,RevogadoEmUtc=NULL,Falhas=0,ExpiraEmUtc=NULL,PareamentoHash='${pairing.hash}',PareamentoExpiraEmUtc=CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126) WHERE TabletId=${id(tabletId)}`);
 await audit(db,actor,tabletId,'REPAREAR');return {ok:true,tabletId,pareamento:pairing.code,expiraEmUtc:expires};
});}
export async function updateTablet(cfg,actor,session,tabletId,body){const depots=tabletDepots(body),name=tabletName(body.nome),depot=depots[0];id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 await time(db);await managedTablet(db,actor,user,tabletId);for(const value of depots)await checkDepot(db,actor,user,value);
 await db.query(`UPDATE Operacao.TabletPC05 SET Nome=${s(name,80)},DepositoId=${depot},SessaoHash=NULL,PareamentoHash=NULL,AtivadoEmUtc=NULL,ExpiraEmUtc=NULL,Falhas=0 WHERE TabletId=${id(tabletId)}`);
 await saveExtraDepots(db,tabletId,depots);await audit(db,actor,tabletId,'CADASTRO',{depositos:depots.map(String)});return {ok:true,tabletId};
});}
export async function revoke(cfg,actor,session,tabletId,body){keys(body,[]);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 await time(db);await managedTablet(db,actor,user,tabletId);
 await db.query(`UPDATE Operacao.TabletPC05 SET RevogadoEmUtc=COALESCE(RevogadoEmUtc,SYSUTCDATETIME()),SessaoHash=NULL,PareamentoHash=NULL WHERE TabletId=${id(tabletId)}`);await audit(db,actor,tabletId,'REVOGAR');return {ok:true};
});}
export async function deleteTablet(cfg,actor,session,tabletId,body){keys(body,[]);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 if(!user.admin&&!user.coordinator)fail('SOMENTE_ADM',403);
 const row=await managedTablet(db,actor,user,tabletId);
 await db.query(`UPDATE Operacao.TabletPC05 SET ExcluidoEmUtc=SYSUTCDATETIME(),RevogadoEmUtc=COALESCE(RevogadoEmUtc,SYSUTCDATETIME()),SessaoHash=NULL,PareamentoHash=NULL WHERE TabletId=${id(tabletId)} AND ExcluidoEmUtc IS NULL`);
 await audit(db,actor,tabletId,'EXCLUIR',{revogadoNaExclusao:!row.RevogadoEmUtc});return {ok:true};
});}
export async function activate(cfg,body){keys(body,['pareamento']);const pairingHash=pairingVerifier(cfg,body.pareamento);return tabletTx(cfg,async(db,now)=>{
 const r=(await db.query(`SELECT t.TabletId,t.DepositoId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.ExcluidoEmUtc IS NULL AND t.PareamentoHash='${pairingHash}' AND ${issuerActive('t')} AND ${activeLink()}`))[0];
 if(!r||!r.DepositoId||r.RevogadoEmUtc||r.AtivadoEmUtc||!after(r.PareamentoExpiraEmUtc,now.AgoraUtc)||(r.ExpiraEmUtc!==null&&!after(r.ExpiraEmUtc,now.AgoraUtc)))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const raw=newToken();await db.query(`UPDATE Operacao.TabletPC05 SET SessaoHash='${hashToken(raw)}',PareamentoHash=NULL,AtivadoEmUtc=SYSUTCDATETIME(),ExpiraEmUtc=NULL WHERE TabletId=${id(r.TabletId)}`);await audit(db,r.EmissorId,r.TabletId,'HABILITAR');return {token:raw};
});}
export async function status(cfg,raw){return tabletTx(cfg,async(db,now)=>{await authorizedTablet(db,raw,now);return {ok:true};});}

export async function consume(cfg,raw,body){
 keys(body,['codigo','requisicaoId']);
 if(body.requisicaoId!==undefined&&(typeof body.requisicaoId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.requisicaoId)))fail('CAMPOS_INVALIDOS');
 return tabletTx(cfg,async(db,now)=>{
  const t=await authorizedTablet(db,raw,now),accepted={ok:true,mensagem:'Token aceito'};
  const deny=async()=>{await db.query(`UPDATE Operacao.TabletPC05 SET Falhas=Falhas+1 WHERE TabletId=${id(t.TabletId)}`);return {erro:Number(t.Falhas)>=4?'TABLET_BLOQUEADO':'TOKEN_INVALIDO',status:Number(t.Falhas)>=4?401:409};};
  if(typeof body.codigo!=='string'||!/^\d{4}$/.test(body.codigo))return deny();
  const codigoHash=hash(cfg,body.codigo);
  // Replays are scoped to the authorized device and cannot become an exit.
  if(body.requisicaoId){
   const previous=(await db.query(`SELECT TOP(1) JSON_VALUE(a.DetalhesJson,'$.codigoHash') CodigoHash FROM Seguranca.Auditoria a WITH(HOLDLOCK) WHERE a.Entidade=N'TabletPC05' AND a.EntidadeId=${id(t.TabletId)} AND a.Acao=N'PC05_APONTAR' AND JSON_VALUE(a.DetalhesJson,'$.requisicaoId')=${s(body.requisicaoId,36)}`))[0];
   if(previous)return previous.CodigoHash===codigoHash?accepted:deny();
  }
  const day=now.AgoraLocal.slice(0,10),local=s(now.AgoraLocal,30);
  const matches=await db.query(`SELECT TOP(2) c.ContratacaoId,c.DepositoId,c.Status,c.PagoEmUtc,c.Versao,c.LiberacaoBloqueada,CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(19),c.EntradaReal,126) EntradaReal,CONVERT(varchar(19),c.SaidaReal,126) SaidaReal FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId WHERE LEFT(REPLACE(REPLACE(REPLACE(p.CPF,'.',''),'-',''),' ',''),4)=${s(body.codigo,4)} AND LEN(REPLACE(REPLACE(REPLACE(p.CPF,'.',''),'-',''),' ',''))=11 AND c.Status='ABERTA' AND c.PagoEmUtc IS NULL AND c.LiberacaoBloqueada=0 AND c.SaidaReal IS NULL AND ((c.EntradaReal IS NULL AND c.DataServico=${s(day,10)}) OR (c.EntradaReal IS NOT NULL AND c.DataServico BETWEEN DATEADD(day,-1,CONVERT(date,${s(day,10)})) AND CONVERT(date,${s(day,10)}) AND c.EntradaReal<=CONVERT(datetime2(0),${local},126))) AND ${linkedContract(t.TabletId)} AND ${issuerDepotScope(t.EmissorId)} AND NOT EXISTS(SELECT 1 FROM Operacao.ContratacaoHorarioSolicitacao hs WITH(HOLDLOCK) WHERE hs.ContratacaoId=c.ContratacaoId AND hs.Status='PENDENTE') ORDER BY c.ContratacaoId`);
  // A shared prefix never chooses a person arbitrarily or creates another code.
  if(matches.length!==1)return deny();const r=matches[0];open(r);
  if(r.SaidaReal)return deny();
  const entry=!r.EntradaReal,field=entry?'Entrada':'Saida',tipo=entry?'ENTRADA':'SAIDA';
  const next=new Date(r.DataServico+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
  if(entry?day!==r.DataServico:now.AgoraLocal<r.EntradaReal||day>next.toISOString().slice(0,10))fail('HORARIO_FORA_DO_SERVICO',409);
  // A rapid second submission (including from another tablet) confirms the entry.
  if(!entry&&Date.parse(utc(now.AgoraLocal))-Date.parse(utc(r.EntradaReal))<10000){if(body.requisicaoId)await audit(db,t.EmissorId,t.TabletId,'APONTAR',{codigoHash,requisicaoId:body.requisicaoId});return accepted;}
  await db.query(`UPDATE Operacao.Contratacao SET ${field}Real=CONVERT(datetime2(0),${local},126),${field}Origem='TOKEN',Versao=Versao+1 WHERE ContratacaoId=${id(r.ContratacaoId)}`);
  await event(db,t.EmissorId,r.ContratacaoId,'TOKEN_USAR',{tipo,identificacao:'CPF_FIXO',codigoHash,requisicaoId:body.requisicaoId||null,tabletId:String(t.TabletId),habilitadoPor:String(t.EmissorId),instanteUtc:utc(now.AgoraUtc),horarioLocal:now.AgoraLocal});
  if(body.requisicaoId)await audit(db,t.EmissorId,t.TabletId,'APONTAR',{codigoHash,requisicaoId:body.requisicaoId});
  return accepted;
 });
}
