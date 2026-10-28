import {safeSqlErrors} from './observability.js';
import crypto from 'node:crypto';
import {withDb,intLiteral,tokenHashLiteral} from './auth-db.js';
import {hashToken} from './security.js';
import {newTotpSecret,verifyTotp} from './totp.js';
const hex=(s)=>'0x'+Buffer.from(s).toString('hex');
function key(){const raw=process.env.JETTA_MFA_KEY_HEX||'';if(!/^[a-fA-F0-9]{64}$/.test(raw))throw Error('JETTA_MFA_KEY_HEX ausente/invalida');return Buffer.from(raw,'hex');}
export function encryptedSecret(secret){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv);const enc=Buffer.concat([c.update(secret),c.final()]);return Buffer.concat([iv,c.getAuthTag(),enc]);}
export function decryptedSecret(raw){if(!Buffer.isBuffer(raw)||raw.length<48)throw Error('Segredo invalido');const c=crypto.createDecipheriv('aes-256-gcm',key(),raw.subarray(0,12));c.setAuthTag(raw.subarray(12,28));return Buffer.concat([c.update(raw.subarray(28)),c.final()]);}
function literalHash(token){return tokenHashLiteral(hashToken(token));}
async function statusRow(cfg,userId,token){return withDb(cfg,async db=>{
 const rows=await db.query(`SELECT TOP(1) CASE WHEN m.ConfirmadoEmUtc IS NOT NULL AND m.RevogadoEmUtc IS NULL THEN 1 ELSE 0 END AS Ativo,s.MfaValidadoEmUtc,s.MfaStepUpEmUtc FROM Seguranca.SessaoWeb s LEFT JOIN Seguranca.MfaTotp m ON m.UsuarioId=s.UsuarioId WHERE s.UsuarioId=${intLiteral(userId)} AND s.TokenHash=${literalHash(token)} AND s.RevogadoEmUtc IS NULL AND s.ExpiraEmUtc>SYSUTCDATETIME()`);
 return rows[0]||null;
});}
export async function status(cfg,id,token){const r=await statusRow(cfg,id,token);if(!r)throw Error('Sessao invalida');return {enrolled:(r.Ativo === true || r.Ativo === 1 || r.Ativo === 1n || r.Ativo === '1'),verified:!!r.MfaValidadoEmUtc,stepUp:!!r.MfaStepUpEmUtc && Date.now()-new Date(r.MfaStepUpEmUtc instanceof Date ? r.MfaStepUpEmUtc : String(r.MfaStepUpEmUtc).replace(' ','T')+'Z').getTime()<5*60*1000};}
export function base32(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let acc=0,bits=0,out='';for(const byte of secret){acc=(acc<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(acc>>bits)&31];}}if(bits)out+=alphabet[(acc<<(5-bits))&31];return out;}
export async function enroll(cfg,user,token){const state=await status(cfg,user.id,token);if(state.enrolled)throw Error('MFA ja confirmado');const secret=newTotpSecret();const encrypted=encryptedSecret(secret);await withDb(cfg,db=>db.query(`EXEC Seguranca.sp_B25B2B_IniciarCadastro @UsuarioId=${intLiteral(user.id)},@SessaoHash=${literalHash(token)},@SegredoCifrado=${hex(encrypted)},@VersaoChave=1`));const encoded=base32(secret);return {secret:encoded,uri:`otpauth://totp/${encodeURIComponent('Jetta Control:'+user.email)}?secret=${encoded}&issuer=Jetta%20Control&algorithm=SHA1&digits=6&period=30`};}
export async function verify(cfg,user,token,code,purpose){if(!['ENROLL','LOGIN','STEPUP'].includes(purpose))throw Error('Finalidade invalida');if(typeof code!=='string'|| !/^\d{6}$/.test(code))return false;
 return withDb(cfg,async db=>{const rows=await db.query(`SELECT m.SegredoCifrado,m.UltimoPassoAceito,m.ConfirmadoEmUtc,m.RevogadoEmUtc FROM Seguranca.MfaTotp m WHERE m.UsuarioId=${intLiteral(user.id)}`);const r=rows[0];if(!r||r.RevogadoEmUtc||((purpose==='ENROLL')!==(!r.ConfirmadoEmUtc)))return false;
 const buf=Buffer.isBuffer(r.SegredoCifrado)?r.SegredoCifrado:Buffer.from(r.SegredoCifrado);
 const last=r.UltimoPassoAceito===null?-1:Number(r.UltimoPassoAceito);if(!Number.isSafeInteger(last))return false;
 const match=verifyTotp(decryptedSecret(buf),code,Date.now(),last);if(!match.valid)return false;
 try{await db.query(`EXEC Seguranca.sp_B25B2B_ConfirmarOuValidar @UsuarioId=${intLiteral(user.id)},@SessaoHash=${literalHash(token)},@Passo=${match.step},@Finalidade='${purpose}'`);return true;}catch(e){if(e.odbcErrors?.some(x=>Number(x.code)===59822))return false;throw e;}
 });}
export function requireMfaMiddleware(cfg,sessionFn){return async(req,res,next)=>{const method=req.method;
 if(!['POST','PUT','PATCH','DELETE'].includes(method))return next();
 const exempt=['/api/auth/login','/api/auth/logout','/api/b25b/ativar','/api/mfa/enroll','/api/mfa/confirm','/api/mfa/verify','/api/mfa/status'];
 if(exempt.includes('/api'+req.path))return next();
 if(process.env.JETTA_MFA_ENFORCE_CRITICAL!=='true')return next();
 await sessionFn(req,res,async()=>{try{const st=await status(cfg,req.user.id,req.rawSession);if(!st.enrolled||!st.verified||!st.stepUp)return res.status(403).json({erro:'MFA recente obrigatorio para esta acao'});next();}catch(e){console.error('MFA gate:',safeSqlErrors(e));res.status(503).json({erro:'MFA indisponivel'});}});
 };}
