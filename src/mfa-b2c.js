import {safeSqlErrors} from './observability.js';
// B2.5-B2C: privileged-route gate, off until recovery runbook is approved.
// No MFA claim is trusted from client input. Only server-side session state counts.
import {isRoot} from './rbac.js';
import {status} from './mfa-b2b.js';
import {withDb,intLiteral,tokenHashLiteral} from './auth-db.js';
import {hashToken} from './security.js';
import {B2C_ENV,PUBLIC_API,gateDecision,validateKeyConfig} from './mfa-policy.js';
export function privilegedGate(cfg,sessionFn){return async(req,res,next)=>{
 if(process.env[B2C_ENV]!=='true'||PUBLIC_API.has(req.path)||!req.path.startsWith('/api/'))return next();
 sessionFn(req,res,async()=>{try{
  const privileged=req.user.perfil==='DIRETORIA'||await isRoot(cfg,req.user.id);
  const mfa=privileged?await status(cfg,req.user.id,req.rawSession):null;
  const result=gateDecision({enforce:true,privileged,method:req.method,route:req.path,mfa});
  if(!result.allow)return res.status(403).json({erro:result.reason,codigo:'MFA_REQUIRED'});
  next();
 }catch(e){console.error('B2C gate error:',safeSqlErrors(e));return res.status(503).json({erro:'Validacao MFA indisponivel'});}});
 };}
export async function revokeOwnSessions(cfg,userId,token){
 // Revalidation of recent MFA against the current DB session, not browser assertion.
 const st=await status(cfg,userId,token);
 if(!st.enrolled||!st.verified||!st.stepUp)throw Error('MFA recente necessario');
 return withDb(cfg,async db=>{
  await db.query(`UPDATE Seguranca.SessaoWeb SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${intLiteral(userId)} AND RevogadoEmUtc IS NULL`);
  return {ok:true};
 });
}

export {validateKeyConfig};
