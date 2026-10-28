import {withDb,intLiteral,nvarcharLiteral} from './auth-db.js';
import {normalizeUser} from './b25-validate.js';

// SQL Server EXEC procedure arguments accept constants/variables, not inline
// CONVERT expressions. Declare and type values before invocation.
// nvarcharLiteral uses UTF-16LE hexadecimal literals, not SQL string interpolation.
export function pendingUserSql(actor,body){
 const u=normalizeUser(body);
 return `SET NOCOUNT ON;
DECLARE @B25AtorId bigint = ${intLiteral(actor)};
DECLARE @B25Nome nvarchar(150) = ${nvarcharLiteral(u.nome,150)};
DECLARE @B25Email nvarchar(256) = ${nvarcharLiteral(u.email,256)};
DECLARE @B25PerfilBase varchar(20) = CONVERT(varchar(20),${nvarcharLiteral(u.perfil,20)});
EXEC Seguranca.sp_B25_CriarUsuarioPendente
 @AtorId=@B25AtorId,
 @Nome=@B25Nome,
 @Email=@B25Email,
 @PerfilBase=@B25PerfilBase;`;
}
export async function registerPendingUser(cfg,actor,body){
 const sql=pendingUserSql(actor,body);
 return withDb(cfg,db=>db.query(sql));
}
export async function pendingUsers(cfg){
 return withDb(cfg,db=>db.query(`SELECT TOP (200) u.UsuarioId,u.Nome,u.Email,u.Perfil,u.Ativo FROM Seguranca.Usuario u WHERE u.Ativo=0 AND NOT EXISTS(SELECT 1 FROM Seguranca.Credencial c WHERE c.UsuarioId=u.UsuarioId) ORDER BY u.UsuarioId DESC`));
}
