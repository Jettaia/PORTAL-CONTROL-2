import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {assertAdminDb,save} from './pc01.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
export async function accountLock(db){
 const row=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC01.Usuarios',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];
 if(!row||Number(row.R)<0)fail('OPERACAO_OCUPADA',409);
}
export async function pendingRequest(db,id){
 const row=(await db.query(`SELECT SolicitacaoId,Nome,Email,Estado FROM Seguranca.SolicitacaoAcesso WITH(UPDLOCK,HOLDLOCK) WHERE SolicitacaoId=${n(id)}`))[0];
 if(!row)fail('SOLICITACAO_INDISPONIVEL',404);
 if(row.Estado!=='PENDENTE')fail('SOLICITACAO_JA_DECIDIDA',409);
 return row;
}
export async function requestAccess(cfg,body){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['nome','email'].includes(k)))fail('CAMPOS_INVALIDOS');
 if(typeof body.nome!=='string'||body.nome.trim().length<3||body.nome.trim().length>150)fail('NOME_INVALIDO');
 if(typeof body.email!=='string'||body.email.trim().length>256||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))fail('EMAIL_INVALIDO');
 const nome=body.nome.trim(),email=body.email.trim().toLowerCase();
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');await db.beginTransaction();
  try{
   await accountLock(db);
   const exists=(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE LOWER(LTRIM(RTRIM(Email)))=${s(email)}`)).length;
   const pending=(await db.query(`SELECT SolicitacaoId FROM Seguranca.SolicitacaoAcesso WHERE Email=${s(email)} AND Estado='PENDENTE'`)).length;
   if(!exists&&!pending)await db.query(`INSERT Seguranca.SolicitacaoAcesso(Nome,Email) VALUES(${s(nome,150)},${s(email)})`);
   await db.commit();return {ok:true};
  }catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
export async function listRequests(cfg){return withDb(cfg,async db=>({solicitacoes:await db.query("SELECT SolicitacaoId,Nome,Email,CriadoEmUtc FROM Seguranca.SolicitacaoAcesso WHERE Estado='PENDENTE' ORDER BY CriadoEmUtc,SolicitacaoId")}));}
export async function approveRequest(cfg,actor,token,id,body){
 try{n(id);}catch{fail('IDENTIFICADOR_INVALIDO');}
 if(body?.ativo!==true)fail('APROVACAO_EXIGE_CONTA_ATIVA');
 return save(cfg,actor,token,body,undefined,id);
}
export async function rejectRequest(cfg,actor,token,id,body){
 try{n(id);}catch{fail('IDENTIFICADOR_INVALIDO');}
 if(!body||Array.isArray(body)||Object.keys(body).length)fail('CAMPOS_INVALIDOS');
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');await db.beginTransaction();
  try{
   await accountLock(db);await assertAdminDb(db,actor);await assertMfa(db,actor,token,cfg);await pendingRequest(db,id);
   await db.query(`UPDATE Seguranca.SolicitacaoAcesso SET Estado='RECUSADA',DecididoPor=${n(actor)},DecididoEmUtc=SYSUTCDATETIME() WHERE SolicitacaoId=${n(id)};
    INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'SolicitacaoAcesso',${n(id)},N'ACESSO_RECUSADO',${n(actor)});`);
   await db.commit();return {ok:true};
  }catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
