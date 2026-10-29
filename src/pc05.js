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
const issuerActive=alias=>`EXISTS(SELECT 1 FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${alias}.EmissorId AND u.Ativo=1 AND ((${roleSql('u.UsuarioId','ADMIN')} AND u.Perfil='ADMIN') OR ${roleSql('u.UsuarioId','GESTOR')}))`;
async function audit(db,actor,entityId,action,details={}){await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'TabletPC05',${id(entityId)},${s('PC05_'+action,40)},${id(actor)},${s(JSON.stringify(details),'max')})`);}
async function tabletTx(cfg,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);const result=await fn(db,await time(db));await db.commit();return result;}catch(e){try{await db.rollback();}catch{}throw e;}
});}
const dates="CONVERT(varchar(23),t.ExpiraEmUtc,126) ExpiraEmUtc,CONVERT(varchar(23),t.PareamentoExpiraEmUtc,126) PareamentoExpiraEmUtc,t.RevogadoEmUtc,t.AtivadoEmUtc";
async function authorizedTablet(db,raw,now){
 if(!strong(raw))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const t=(await db.query(`SELECT t.TabletId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.SessaoHash='${hashToken(raw)}' AND ${issuerActive('t')}`))[0];
 if(!t||t.RevogadoEmUtc||!t.AtivadoEmUtc||!after(t.ExpiraEmUtc,now.AgoraUtc)||Number(t.Falhas)>=5)fail('AUTORIZACAO_TABLET_INVALIDA',401);return t;
}
function open(row){if(row.Status!=='ABERTA'||row.PagoEmUtc)fail('CONTRATACAO_FECHADA',409);}

export async function issue(cfg,actor,session,contractId,body){
 keys(body,['versao','tipo']);id(contractId);if(!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_INVALIDA');if(!['ENTRADA','SAIDA'].includes(body.tipo))fail('TIPO_INVALIDO');
 return transaction(cfg,actor,session,true,async(db,user)=>{
  const now=await time(db),r=await record(db,actor,user,contractId,true);open(r);if(Number(r.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(r[body.tipo==='ENTRADA'?'EntradaReal':'SaidaReal'])fail('HORARIO_JA_REGISTRADO',409);
  if(body.tipo==='SAIDA'){
   if(!r.EntradaReal)fail('ENTRADA_OBRIGATORIA',409);
   if(!(await db.query(`SELECT TOP(1) 1 V FROM Operacao.ContratacaoToken WHERE ContratacaoId=${id(contractId)} AND Tipo='ENTRADA' AND ConsumidoEmUtc IS NOT NULL`)).length)fail('ENTRADA_OBRIGATORIA',409);
  }
  let code,verifier;
  for(let attempt=0;attempt<10;attempt++){code=String(crypto.randomInt(100000000)).padStart(8,'0');verifier=hash(cfg,code);if(!(await db.query(`SELECT TokenId FROM Operacao.ContratacaoToken WITH(UPDLOCK,HOLDLOCK) WHERE CodigoHash='${verifier}'`)).length)break;code=null;}
  if(!code)fail('GERACAO_INDISPONIVEL',503);
  const expires=future(now.AgoraUtc,60);
  await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${id(contractId)} AND Tipo='${body.tipo}' AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);
  await db.query(`INSERT Operacao.ContratacaoToken(ContratacaoId,Tipo,CodigoHash,EmissorId,ExpiraEmUtc) VALUES(${id(contractId)},'${body.tipo}','${verifier}',${id(actor)},CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126))`);
  await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${id(contractId)} AND Versao=${body.versao}`);
  await event(db,actor,contractId,'TOKEN_GERAR',{tipo:body.tipo,expiraEmUtc:expires});
  return {ok:true,codigo:code,expiraEmUtc:expires,versao:body.versao+1};
 });
}
export async function pair(cfg,actor,session,body){keys(body,['nome']);if(typeof body.nome!=='string'||!body.nome.trim()||body.nome.trim().length>80)fail('NOME_INVALIDO');return transaction(cfg,actor,session,true,async db=>{
 const now=await time(db),pairing=newToken(),expires=future(now.AgoraUtc,5);
 const row=(await db.query(`INSERT Operacao.TabletPC05(Nome,EmissorId,PareamentoHash,PareamentoExpiraEmUtc,ExpiraEmUtc) OUTPUT inserted.TabletId VALUES(${s(body.nome.trim(),80)},${id(actor)},'${hashToken(pairing)}',CONVERT(datetime2(3),${s(expires.slice(0,-1),30)},126),DATEADD(hour,8,SYSUTCDATETIME()))`))[0];
 if(!row)throw Error('Tablet não persistido');await audit(db,actor,row.TabletId,'PAREAR');return {ok:true,tabletId:row.TabletId,pareamento:pairing,expiraEmUtc:expires};
});}
export async function tablets(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>({registros:await db.query(`SELECT TabletId,Nome,CASE WHEN RevogadoEmUtc IS NULL AND ExpiraEmUtc>SYSUTCDATETIME() AND Falhas<5 THEN 1 ELSE 0 END Ativo,CONVERT(varchar(23),ExpiraEmUtc,126) ExpiraEmUtc FROM Operacao.TabletPC05 WHERE ${user.admin?'1=1':`EmissorId=${id(actor)}`} ORDER BY TabletId DESC`)}));}
export async function revoke(cfg,actor,session,tabletId,body){keys(body,[]);id(tabletId);return transaction(cfg,actor,session,true,async(db,user)=>{
 await time(db);const r=(await db.query(`SELECT TabletId,EmissorId FROM Operacao.TabletPC05 WITH(UPDLOCK,HOLDLOCK) WHERE TabletId=${id(tabletId)}`))[0];if(!r||!user.admin&&String(r.EmissorId)!==String(actor))fail('TABLET_INDISPONIVEL',404);
 await db.query(`UPDATE Operacao.TabletPC05 SET RevogadoEmUtc=COALESCE(RevogadoEmUtc,SYSUTCDATETIME()),SessaoHash=NULL,PareamentoHash=NULL WHERE TabletId=${id(tabletId)}`);await audit(db,actor,tabletId,'REVOGAR');return {ok:true};
});}
export async function activate(cfg,body){keys(body,['pareamento']);if(!strong(body.pareamento))fail('AUTORIZACAO_TABLET_INVALIDA',401);return tabletTx(cfg,async(db,now)=>{
 const r=(await db.query(`SELECT t.TabletId,t.EmissorId,t.Falhas,${dates} FROM Operacao.TabletPC05 t WITH(UPDLOCK,HOLDLOCK) WHERE t.PareamentoHash='${hashToken(body.pareamento)}' AND ${issuerActive('t')}`))[0];
 if(!r||r.RevogadoEmUtc||r.AtivadoEmUtc||!after(r.PareamentoExpiraEmUtc,now.AgoraUtc)||!after(r.ExpiraEmUtc,now.AgoraUtc))fail('AUTORIZACAO_TABLET_INVALIDA',401);
 const raw=newToken();await db.query(`UPDATE Operacao.TabletPC05 SET SessaoHash='${hashToken(raw)}',PareamentoHash=NULL,AtivadoEmUtc=SYSUTCDATETIME(),ExpiraEmUtc=DATEADD(hour,8,SYSUTCDATETIME()) WHERE TabletId=${id(r.TabletId)}`);await audit(db,r.EmissorId,r.TabletId,'HABILITAR');return {token:raw};
});}
export async function status(cfg,raw){return tabletTx(cfg,async(db,now)=>{await authorizedTablet(db,raw,now);return {ok:true};});}
export async function leave(cfg,raw){return tabletTx(cfg,async(db,now)=>{const r=await authorizedTablet(db,raw,now);await db.query(`UPDATE Operacao.TabletPC05 SET RevogadoEmUtc=SYSUTCDATETIME(),SessaoHash=NULL WHERE TabletId=${id(r.TabletId)}`);await audit(db,r.EmissorId,r.TabletId,'SAIR');return {ok:true};});}

export async function consume(cfg,raw,body){keys(body,['codigo']);return tabletTx(cfg,async(db,now)=>{
 const t=await authorizedTablet(db,raw,now);
 const deny=async()=>{await db.query(`UPDATE Operacao.TabletPC05 SET Falhas=Falhas+1 WHERE TabletId=${id(t.TabletId)}`);return {erro:Number(t.Falhas)>=4?'TABLET_BLOQUEADO':'TOKEN_INVALIDO',status:Number(t.Falhas)>=4?401:409};};
 if(typeof body.codigo!=='string'||!/^\d{8}$/.test(body.codigo))return deny();
 const token=(await db.query(`SELECT TokenId,ContratacaoId,Tipo,EmissorId,CONVERT(varchar(23),ExpiraEmUtc,126) ExpiraEmUtc,ConsumidoEmUtc,InvalidadoEmUtc FROM Operacao.ContratacaoToken WITH(UPDLOCK,HOLDLOCK) WHERE CodigoHash='${hash(cfg,body.codigo)}'`))[0];
 if(!token||token.ConsumidoEmUtc||token.InvalidadoEmUtc||!after(token.ExpiraEmUtc,now.AgoraUtc))return deny();
 const r=(await db.query(`SELECT ContratacaoId,FilialId,Status,PagoEmUtc,Versao,CONVERT(varchar(10),DataServico,23) DataServico,CONVERT(varchar(19),EntradaReal,126) EntradaReal,CONVERT(varchar(19),SaidaReal,126) SaidaReal FROM Operacao.Contratacao WITH(UPDLOCK,HOLDLOCK) WHERE ContratacaoId=${id(token.ContratacaoId)}`))[0];
 if(!r)fail('TOKEN_INVALIDO',409);open(r);
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
