import {procedureSql,withDb,nvarcharLiteral,intLiteral} from './auth-db.js';
export const sqlTrue=v=>v===true||v===1||v===1n||v==='1';
export const asInt=n=>{const v=Number(n);if(!Number.isSafeInteger(v)||v<=0)throw Error('Identificador invalido');return v;};
export const asText=(s,n=120)=>{if(typeof s!=='string'||s.length<1||s.length>n)throw Error('Texto invalido');return nvarcharLiteral(s,n);};
export async function isRoot(cfg,id){return withDb(cfg,async db=>sqlTrue((await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u ON u.UsuarioId=r.UsuarioId AND u.Ativo=1 WHERE r.UsuarioId=${intLiteral(id)}) THEN 1 ELSE 0 END AS Pode`))[0]?.Pode));}
export async function can(cfg,id,key){if(!/^[a-z.]+$/.test(key))return false;return withDb(cfg,async db=>sqlTrue((await db.query(`SELECT Seguranca.fn_Pode(${intLiteral(id)},${asText(key,100)}) AS Pode`))[0]?.Pode));}
export async function catalog(cfg){return withDb(cfg,async db=>({
 perfis:await db.query(`SELECT PerfilId,Codigo,Nome,Sistema,Ativo FROM Seguranca.PerfilAcesso ORDER BY Nome`),
 permissoes:await db.query(`SELECT PermissaoId,Chave,Modulo,Descricao,Critica FROM Seguranca.Permissao ORDER BY Modulo,Chave`),
 concessoes:await db.query(`SELECT pp.PerfilId,p.Chave FROM Seguranca.PerfilPermissao pp JOIN Seguranca.Permissao p ON p.PermissaoId=pp.PermissaoId ORDER BY pp.PerfilId,p.Chave`),
 usuarios:await db.query(`SELECT u.UsuarioId,u.Nome,u.Email,u.Ativo,up.PerfilId FROM Seguranca.Usuario u LEFT JOIN Seguranca.UsuarioPerfil up ON up.UsuarioId=u.UsuarioId ORDER BY u.Nome`)
}));}
export async function createRole(cfg,actor,{codigo,nome}){if(typeof codigo!=='string'||!/^[A-Z][A-Z0-9_]{2,39}$/.test(codigo))throw Error('Codigo invalido');asText(nome,120);return withDb(cfg,db=>db.query(procedureSql('Seguranca.sp_B23_CriarPerfil',{AtorId:intLiteral(actor),Codigo:codigo,Nome:nome})));}
export async function setRolePermission(cfg,actor,{perfilId,chave,conceder}){if(typeof conceder!=='boolean'||typeof chave!=='string'||!/^[a-z.]{3,100}$/.test(chave))throw Error('Dados invalidos');return withDb(cfg,db=>db.query(procedureSql('Seguranca.sp_B23_DefinirPermissao',{AtorId:intLiteral(actor),PerfilId:intLiteral(perfilId),Chave:chave,Conceder:conceder})));}
export async function assignRole(cfg,actor,{usuarioId,perfilId,conceder}){if(typeof conceder!=='boolean')throw Error('Dados invalidos');return withDb(cfg,db=>db.query(procedureSql('Seguranca.sp_B23_AtribuirPerfil',{AtorId:intLiteral(actor),UsuarioId:intLiteral(usuarioId),PerfilId:intLiteral(perfilId),Conceder:conceder})));}
