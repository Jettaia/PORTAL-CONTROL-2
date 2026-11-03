import crypto from 'node:crypto';
import {withDb,intLiteral} from './auth-db.js';
import {hashPassword,hashToken} from './security.js';

export function hexLiteral(value,length){
 if(typeof value!=='string'||value.length!==length||!/^[0-9a-f]+$/.test(value)) throw Error('Hexadecimal invalido');
 return `'${value}'`;
}
export function validNewPassword(password){
 return typeof password==='string' && password.length>=6 && password.length<=128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
export async function issueInvite(cfg,actorId,userId){
 const id=intLiteral(userId), actor=intLiteral(actorId);
 const token=crypto.randomBytes(32).toString('hex');
 const digest=hashToken(token);
 await withDb(cfg,db=>db.query(`EXEC Seguranca.sp_B25B_EmitirConvite @AtorId=${actor},@UsuarioId=${id},@TokenHash=${hexLiteral(digest,64)}`));
 return {token,validadeMinutos:30};
}
export async function activate(cfg,token,password){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token) || !validNewPassword(password)) throw Error('Codigo ou senha invalidos');
 const digest=hashToken(token.toLowerCase());
 const salt=crypto.randomBytes(16).toString('hex');
 const hashed=hashPassword(password,salt);
 const rows=await withDb(cfg,db=>db.query(`EXEC Seguranca.sp_B25B_AtivarUsuario @TokenHash=${hexLiteral(digest,64)},@SaltHex=${hexLiteral(salt,32)},@SenhaHashHex=${hexLiteral(hashed,128)}`));
 return rows[0]??{ok:true};
}
