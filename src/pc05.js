import crypto from 'node:crypto';
import {withDb,intLiteral,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {hashToken,newToken} from './security.js';
import {PlanningError} from './b3.js';
import {transaction,record,event} from './pc04.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const id=value=>{if(!/^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return intLiteral(value);}catch{fail('IDENTIFICADOR_INVALIDO');}};
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
const strong=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const hash=(cfg,code)=>{if(!strong(cfg.token))throw Error('PC05 exige chave privada de 256 bits');return crypto.createHmac('sha256',cfg.token).update('PC05:'+code).digest('hex');};
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
async function authorizedTablet(db,raw,now){
 if(!strong(raw))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const t=(await db.query(`SELECT t.TabletId,t.DepositoId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.ExcluidoEmUtc IS NULL AND t.SessaoHash='${hashToken(raw)}' AND ${issuerActive('t')} AND EXISTS(SELECT 1 FROM Cadastro.Deposito f WHERE f.DepositoId=t.DepositoId AND f.Ativo=1)`))[0];
 if(!t||!t.DepositoId||t.RevogadoEmUtc||!t.AtivadoEmUtc||(t.ExpiraEmUtc!==null&&!after(t.ExpiraEmUtc,now.AgoraUtc))||Number(t.Falhas)>=5)fail('AUTORIZACAO_TABLET_INVALIDA',401);return t;
}
function open(row){if(row.Status!=='ABERTA'||row.PagoEmUtc||Number(row.LiberacaoBloqueada)===1)fail('CONTRATACAO_FECHADA',409);if(row.HorarioPendenteId)fail('HORARIOS_PENDENTES_APROVACAO',409);}

export async function issue(cfg,actor,session,contractId,body){
 keys(body,['versao','tipo']);id(contractId);if(!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_INVALIDA');if(!['ENTRADA','SAIDA'].includes(body.tipo))fail('TIPO_INVALIDO');
 return transaction(cfg,actor,session,true,async(db,user)=>{
  const now=await time(db),r=await record(db,actor,user,contractId,true);open(r);if(Number(r.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(r[body.tipo==='ENTRADA'?'EntradaReal':'SaidaReal'])fail('HORARIO_JA_REGISTRADO',409);
  if(body.tipo==='SAIDA'){
   if(!r.EntradaReal)fail('ENTRADA_OBRIGATORIA',409);
   if(!(await db.query(`SELECT TOP(1) 1 V FROM Operacao.ContratacaoToken WHERE ContratacaoId=${id(contractId)} AND Tipo='ENTRADA' AND ConsumidoEmUtc IS NOT NULL`)).length)fail('ENTRADA_OBRIGATORIA',409);
  }
  // The PC04 transaction lock serializes issuance and consumption globally.
  // Consumed/replaced codes stay reserved until their original expiry.
  const reserved=new Set((await db.query(`SELECT CodigoHash FROM Operacao.ContratacaoToken WITH(UPDLOCK,HOLDLOCK) WHERE ExpiraEmUtc>CONVERT(datetime2(3),${s(now.AgoraUtc,30)},126)`)).map(t=>t.CodigoHash));
  const candidates=Array.from({length:10000},(_,i)=>i);
  let code,verifier;
  // Sample without replacement: find a free code even when almost full.
  while(candidates.length){const index=crypto.randomInt(candidates.length),candidate=candidates[index];candidates[index]=candidates[candidates.length-1];candidates.pop();const value=String(candidate).padStart(4,'0'),digest=hash(cfg,value);if(!reserved.has(digest)){code=value;verifier=digest;break;}}
  if(!code)fail('GERACAO_INDISPONIVEL',503);
  const expires=future(now.AgoraUtc,60);
  await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${id(contractId)} AND Tipo='${body.tipo}' AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);
  await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc) VALUES(${id(contractId)},'${body.tipo}','${verifier}',${id(actor)},CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126))`);
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${id(contractId)} AND Versao=${body.versao}`);
  await event(db,actor,contractId,'TOKEN_GERAR',{tipo:body.tipo,expiraEmUtc:expires});
  return {ok:true,codigo:code,expiraEmUtc:expires,versao:body.versao+1};
 });
}
const depotScope=(actor,user,alias='f')=>user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${id(actor)} AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL)`;
const tabletScope=(actor,user)=>user.admin?'1=1':`((t.DepositoId IS NULL AND t.EmissorId=${id(actor)}) OR ${depotScope(actor,user,'t')})`;
function tabletName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80)fail('NOME_INVALIDO');return value.trim();}
async function checkDepot(db,actor,user,depot){if(!(await db.query(`SELECT f.DepositoId FROM Cadastro.Deposito f WITH(HOLDLOCK) WHERE f.DepositoId=${id(depot)} AND f.Ativo=1 AND ${depotScope(actor,user)}`)).length)fail('DEPOSITO_INDISPONIVEL',404);}
async function managedTablet(db,actor,user,tabletId){const r=(await db.query(`SELECT t.TabletId,t.EmissorId,t.DepositoId,t.RevogadoEmUtc FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.TabletId=${id(tabletId)} AND t.ExcluidoEmUtc IS NULL AND ${tabletScope(actor,user)}`))[0];if(!r)fail('TABLET_INDISPONIVEL',404);return r;}
export async function pair(cfg,actor,session,body){
 keys(body,['nome','depositoId']);const name=tabletName(body.nome),depot=id(body.depositoId);
 return transaction(cfg,actor,session,true,async(db,user)=>{
  const now=await time(db),pairing=newToken(),expires=future(now.AgoraUtc,5);await checkDepot(db,actor,user,depot);
  const row=(await db.query(`INSERT Operacao.TabletPC05(Nome,EmissorId,DepositoId,PareamentoHash,PareamentoExpiraEmUtc,ExpiraEmUtc) OUTPUT inserted.TabletId VALUES(${s(name,80)},${id(actor)},${depot},'${hashToken(pairing)}',CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126),NULL)`))[0];
  if(!row)throw Error('Tablet não persistido');await audit(db,actor,row.TabletId,'PAREAR',{depositoId:String(depot)});return {ok:true,tabletId:row.TabletId,pareamento:pairing,expiraEmUtc:expires};
 });
}
export async function tablets(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!user.operational)fail('PERMISSAO_NEGADA',403);
 const valid=`t.RevogadoEmUtc IS NULL AND t.DepositoId IS NOT NULL AND f.Ativo=1 AND t.Falhas<5 AND ${issuerActive('t')} AND (t.ExpiraEmUtc IS NULL OR t.ExpiraEmUtc>SYSUTCDATETIME())`;
 const registros=await db.query(`SELECT t.TabletId,t.Nome,t.DepositoId,f.Nome Deposito,f.CentroCusto,
 CASE WHEN t.RevogadoEmUtc IS NOT NULL THEN 'REVOGADO' WHEN t.DepositoId IS NULL THEN 'SEM_DEPOSITO' WHEN t.Falhas>=5 OR ISNULL(f.Ativo,0)=0 OR NOT (${issuerActive('t')}) THEN 'BLOQUEADO'
 WHEN t.AtivadoEmUtc IS NOT NULL AND t.SessaoHash IS NOT NULL AND (t.ExpiraEmUtc IS NULL OR t.ExpiraEmUtc>SYSUTCDATETIME()) THEN 'ATIVO'
 WHEN t.PareamentoHash IS NOT NULL AND t.PareamentoExpiraEmUtc>SYSUTCDATETIME() THEN 'PENDENTE' ELSE 'CODIGO_EXPIRADO' END Estado,
 CASE WHEN ${valid} AND t.AtivadoEmUtc IS NOT NULL AND t.SessaoHash IS NOT NULL THEN 1 ELSE 0 END Ativo,
 CONVERT(varchar(23),t.CriadoEmUtc,126) CriadoEmUtc,CONVERT(varchar(23),t.AtivadoEmUtc,126) AtivadoEmUtc
 FROM Operacao.TabletPC05 t LEFT JOIN Cadastro.Deposito f ON f.DepositoId=t.DepositoId WHERE t.ExcluidoEmUtc IS NULL AND ${tabletScope(actor,user)} ORDER BY t.TabletId DESC`);
 const depositos=await db.query(`SELECT f.DepositoId,f.Nome,f.CentroCusto FROM Cadastro.Deposito f WHERE f.Ativo=1 AND ${depotScope(actor,user)} ORDER BY f.Nome`);return {registros,depositos};
});}
export async function rePair(cfg,actor,session,tabletId,body){keys(body,[]);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 const now=await time(db),r=await managedTablet(db,actor,user,tabletId);if(!r.DepositoId)fail('DEPOSITO_OBRIGATORIO');await checkDepot(db,actor,user,r.DepositoId);
 const pairing=newToken(),expires=future(now.AgoraUtc,5);
 await db.query(`UPDATE Operacao.TabletPC05 SET EmissorId=${id(actor)},SessaoHash=NULL,AtivadoEmUtc=NULL,RevogadoEmUtc=NULL,Falhas=0,ExpiraEmUtc=NULL,PareamentoHash='${hashToken(pairing)}',PareamentoExpiraEmUtc=CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126) WHERE TabletId=${id(tabletId)}`);
 await audit(db,actor,tabletId,'REPAREAR');return {ok:true,tabletId,pareamento:pairing,expiraEmUtc:expires};
});}
export async function updateTablet(cfg,actor,session,tabletId,body){keys(body,['nome','depositoId']);const name=tabletName(body.nome),depot=id(body.depositoId);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 await time(db);await managedTablet(db,actor,user,tabletId);await checkDepot(db,actor,user,depot);
 await db.query(`UPDATE Operacao.TabletPC05 SET Nome=${s(name,80)},DepositoId=${depot},SessaoHash=NULL,PareamentoHash=NULL,AtivadoEmUtc=NULL,ExpiraEmUtc=NULL,Falhas=0 WHERE TabletId=${id(tabletId)}`);
 await audit(db,actor,tabletId,'CADASTRO',{depositoId:String(depot)});return {ok:true,tabletId};
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
export async function activate(cfg,body){keys(body,['pareamento']);if(!strong(body.pareamento))fail('AUTORIZACAO_TABLET_INVALIDA',401);return tabletTx(cfg,async(db,now)=>{
 const r=(await db.query(`SELECT t.TabletId,t.DepositoId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.ExcluidoEmUtc IS NULL AND t.PareamentoHash='${hashToken(body.pareamento)}' AND ${issuerActive('t')} AND EXISTS(SELECT 1 FROM Cadastro.Deposito f WHERE f.DepositoId=t.DepositoId AND f.Ativo=1)`))[0];
 if(!r||!r.DepositoId||r.RevogadoEmUtc||r.AtivadoEmUtc||!after(r.PareamentoExpiraEmUtc,now.AgoraUtc)||(r.ExpiraEmUtc!==null&&!after(r.ExpiraEmUtc,now.AgoraUtc)))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const raw=newToken();await db.query(`UPDATE Operacao.TabletPC05 SET SessaoHash='${hashToken(raw)}',PareamentoHash=NULL,AtivadoEmUtc=SYSUTCDATETIME(),ExpiraEmUtc=NULL WHERE TabletId=${id(r.TabletId)}`);await audit(db,r.EmissorId,r.TabletId,'HABILITAR');return {token:raw};
});}
export async function status(cfg,raw){return tabletTx(cfg,async(db,now)=>{await authorizedTablet(db,raw,now);return {ok:true};});}

export async function consume(cfg,raw,body){keys(body,['codigo']);return tabletTx(cfg,async(db,now)=>{
 const t=await authorizedTablet(db,raw,now);
 const deny=async()=>{await db.query(`UPDATE Operacao.TabletPC05 SET Falhas=Falhas+1 WHERE TabletId=${id(t.TabletId)}`);return {erro:Number(t.Falhas)>=4?'TABLET_BLOQUEADO':'TOKEN_INVALIDO',status:Number(t.Falhas)>=4?401:409};};
 if(typeof body.codigo!=='string'||!/^(?:\d{4}|\d{8})$/.test(body.codigo))return deny();
 const token=(await db.query(`SELECT TOP(1) TokenId,ContratacaoId,Tipo,EmissorId,CONVERT(varchar(23),ExpiraEmUtc,126) ExpiraEmUtc,ConsumidoEmUtc,InvalidadoEmUtc FROM Operacao.ContratacaoToken WITH(UPDLOCK,HOLDLOCK) WHERE CodigoHash='${hash(cfg,body.codigo)}' AND ExpiraEmUtc>CONVERT(datetime2(3),${s(now.AgoraUtc,30)},126) ORDER BY TokenId DESC`))[0];
 if(!token||token.ConsumidoEmUtc||token.InvalidadoEmUtc||!after(token.ExpiraEmUtc,now.AgoraUtc))return deny();
 const r=(await db.query(`SELECT c.ContratacaoId,c.DepositoId,c.Status,c.PagoEmUtc,c.Versao,c.LiberacaoBloqueada,CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(19),c.EntradaReal,126) EntradaReal,CONVERT(varchar(19),c.SaidaReal,126) SaidaReal FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) WHERE c.ContratacaoId=${id(token.ContratacaoId)} AND c.DepositoId=${id(t.DepositoId)} AND ${issuerDepotScope(token.EmissorId)} AND ${issuerDepotScope(t.EmissorId)} AND NOT EXISTS(SELECT 1 FROM Operacao.ContratacaoHorarioSolicitacao hs WITH(HOLDLOCK) WHERE hs.ContratacaoId=c.ContratacaoId AND hs.Status='PENDENTE')`))[0];
 if(!r||String(r.DepositoId)!==String(t.DepositoId))return deny();open(r);
 const entry=token.Tipo==='ENTRADA',field=entry?'Entrada':'Saida';
 if(r[field+'Real'])fail('HORARIO_JA_REGISTRADO',409);
 if(!entry&&!r.EntradaReal)fail('ENTRADA_OBRIGATORIA',409);
 const next=new Date(r.DataServico+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 if(entry?now.AgoraLocal.slice(0,10)!==r.DataServico:now.AgoraLocal<=r.EntradaReal||now.AgoraLocal.slice(0,10)>next.toISOString().slice(0,10))fail('HORARIO_FORA_DO_SERVICO',409);
 await db.query(`UPDATE Operacao.ContratacaoToken SET ConsumidoEmUtc=SYSUTCDATETIME(),TabletId=${id(t.TabletId)} WHERE TokenId=${id(token.TokenId)} AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);
 await db.query(`UPDATE Operacao.Contratacao SET ${field}Real=CONVERT(datetime2(0),${s(now.AgoraLocal,30)},126),${field}Origem='TOKEN',Versao=Versao+1 WHERE ContratacaoId=${id(r.ContratacaoId)}`);
 await event(db,token.EmissorId,r.ContratacaoId,'TOKEN_USAR',{tipo:token.Tipo,tabletId:String(t.TabletId),habilitadoPor:String(t.EmissorId),instanteUtc:utc(now.AgoraUtc),horarioLocal:now.AgoraLocal});
 return {ok:true,mensagem:'Token aceito'};
});}
