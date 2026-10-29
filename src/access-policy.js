// Existing tables only: older installations keep their legacy grants until PC-01
// is explicitly provisioned. A browser role string never grants SQL access.
export function roleSql(userId,role){
 if(!['GESTOR','FINANCEIRO','ADMIN'].includes(role)||!/^(?:u\.UsuarioId|[1-9]\d*)$/.test(String(userId)))throw Error('Funcao invalida');
 const grant=r=>`EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil pcup JOIN Seguranca.PerfilAcesso pcpa ON pcpa.PerfilId=pcup.PerfilId AND pcpa.Ativo=1 WHERE pcup.UsuarioId=${userId} AND pcpa.Codigo='PC01_${r}')`;
 const admin=`EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz pcr WHERE pcr.UsuarioId=${userId})`;
 return role==='ADMIN'?admin:`(EXISTS(SELECT 1 FROM Seguranca.Usuario pcu WHERE pcu.UsuarioId=${userId} AND pcu.Ativo=1 AND pcu.Perfil='${role}') OR ${grant(role)} OR (${grant('ADMIN')} AND ${admin}))`;
}
export function globalFinanceSql(userId){
 if(!/^[1-9]\d*$/.test(String(userId)))throw Error('Identificador invalido');
 return `EXISTS(SELECT 1 FROM Seguranca.Usuario pcu JOIN Seguranca.UsuarioPerfil pcup ON pcup.UsuarioId=pcu.UsuarioId JOIN Seguranca.PerfilAcesso pcpa ON pcpa.PerfilId=pcup.PerfilId AND pcpa.Ativo=1 WHERE pcu.UsuarioId=${userId} AND pcu.Ativo=1 AND (pcpa.Codigo='PC01_FINANCEIRO' OR (pcpa.Codigo='PC01_ADMIN' AND EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz pcr WHERE pcr.UsuarioId=pcu.UsuarioId))))`;
}
