import crypto from 'node:crypto';
import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {hashPassword} from './security.js';
import {validNewPassword} from './b25b.js';
import {assertMfa as assertMfaDb} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
export function normalizeAccount(body,creating){
 const fields=['nome','email','funcoes','depositos','ativo',...(creating?['senha']:[])];
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k)))fail('CAMPOS_INVALIDOS');
 const {nome,email,funcoes,depositos,ativo,senha}=body;
 if(typeof nome!=='string'||nome.trim().length<3||nome.trim().length>150)fail('NOME_INVALIDO');
 if(typeof email!=='string'||email.trim().length>256||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))fail('EMAIL_INVALIDO');
 if(!Array.isArray(funcoes)||!funcoes.length||funcoes.length>3||new Set(funcoes).size!==funcoes.length||funcoes.some(r=>!['ADMIN','GESTOR','FINANCEIRO'].includes(r)))fail('FUNCOES_INVALIDAS');
 if(!Array.isArray(depositos)||depositos.length>100||depositos.some(id=>typeof id!=='number'||!Number.isSafeInteger(id)||id<1)||new Set(depositos).size!==depositos.length)fail('DEPOSITOS_INVALIDOS');
 if(typeof ativo!=='boolean'||creating&&!validNewPassword(senha))fail('CONTA_INVALIDA');
 return {nome:nome.trim(),email:email.trim().toLowerCase(),funcoes:[...funcoes].sort(),depositos:[...depositos].sort((a,b)=>a-b),ativo,...(creating?{senha}:{})};
}
export async function assertAdminDb(db,actor){
 if(!(await db.query(`SELECT u.UsuarioId FROM Seguranca.Usuario u WITH(HOLDLOCK) JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId WHERE u.UsuarioId=${n(actor)} AND u.Ativo=1 AND u.Perfil='ADMIN'`)).length)fail('SOMENTE_ADM',403);
}
export async function assertAdmin(cfg,actor){return withDb(cfg,db=>assertAdminDb(db,actor));}
export async function assertMfa(cfg,actor,token){return withDb(cfg,db=>assertMfaDb(db,actor,token,cfg));}
export async function catalog(cfg){return withDb(cfg,async db=>({
 usuarios:await db.query(`SELECT u.UsuarioId,u.Nome,u.Email,u.Ativo,u.Perfil,
 (SELECT pa.Codigo FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId WHERE up.UsuarioId=u.UsuarioId AND pa.Ativo=1 AND pa.Codigo IN('PC01_ADMIN','PC01_GESTOR','PC01_FINANCEIRO') FOR JSON PATH) FuncoesJson,
 (SELECT uf.DepositoId FROM Seguranca.UsuarioDeposito uf WHERE uf.UsuarioId=u.UsuarioId AND uf.RevogadoEmUtc IS NULL FOR JSON PATH) DepositosJson
 FROM Seguranca.Usuario u ORDER BY u.Nome,u.UsuarioId`),
 depositos:await db.query('SELECT DepositoId,Nome,Ativo FROM Cadastro.Deposito ORDER BY Nome,DepositoId')
}));}
// Serialize the whole administrative change, including last-ADM protection and audit.
// Revalidate actor and recent MFA in the same transaction; never trust a posted role.
export async function save(cfg,actor,token,body,id){
 const creating=id===undefined,v=normalizeAccount(body,creating),uid=creating?null:n(id);
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
  await db.beginTransaction();
  try{
   const locked=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC01.Usuarios',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];
   if(!locked||Number(locked.R)<0)fail('OPERACAO_OCUPADA',409);
   await assertAdminDb(db,actor);await assertMfaDb(db,actor,token,cfg);
   const previous=uid?(await db.query(`SELECT UsuarioId,Nome,Email,Perfil,Ativo FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=${uid}`))[0]:null;
   if(uid&&!previous)fail('USUARIO_INDISPONIVEL',404);
   if((await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK) WHERE LOWER(LTRIM(RTRIM(Email)))=${s(v.email)}${uid?' AND UsuarioId<>'+uid:''}`)).length)fail('EMAIL_DUPLICADO',409);
   if(uid&&(!v.ativo||!v.funcoes.includes('ADMIN'))&&(await db.query(`SELECT r.UsuarioId FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u WITH(UPDLOCK,HOLDLOCK) ON u.UsuarioId=r.UsuarioId WHERE u.Ativo=1 AND u.Perfil='ADMIN' AND u.UsuarioId<>${uid}`)).length===0)fail('ULTIMO_ADM_ATIVO',409);
   if(v.depositos.length&&(await db.query(`SELECT DepositoId FROM Cadastro.Deposito WITH(HOLDLOCK) WHERE Ativo=1 AND DepositoId IN(${v.depositos.join(',')})`)).length!==v.depositos.length)fail('DEPOSITO_INDISPONIVEL',409);
   const roles=await db.query(`SELECT PerfilId,Codigo FROM Seguranca.PerfilAcesso WITH(HOLDLOCK) WHERE Ativo=1 AND Codigo IN(${v.funcoes.map(r=>s('PC01_'+r,40)).join(',')})`);
   if(roles.length!==v.funcoes.length)fail('CATALOGO_FUNCOES_INDISPONIVEL',503);
   const previousRoles=uid?await db.query(`SELECT pa.Codigo FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId WHERE up.UsuarioId=${uid}`):[];
   const previousBranches=uid?await db.query(`SELECT DepositoId FROM Seguranca.UsuarioDeposito WHERE UsuarioId=${uid} AND RevogadoEmUtc IS NULL`):[];
   if(uid&&v.ativo&&(await db.query(`SELECT UsuarioId FROM Seguranca.Credencial WHERE UsuarioId=${uid}`)).length===0)fail('CONTA_SEM_CREDENCIAL',409);
   const perfil=v.funcoes.includes('ADMIN')?'ADMIN':v.funcoes.includes('GESTOR')?'GESTOR':'FINANCEIRO';
   const target=uid||(await db.query(`INSERT Seguranca.Usuario(Nome,Email,Perfil,Ativo) OUTPUT inserted.UsuarioId VALUES(${s(v.nome,150)},${s(v.email)},${s(perfil,20)},${v.ativo?1:0})`))[0].UsuarioId;
   const targetId=n(target);
   if(uid)await db.query(`UPDATE Seguranca.Usuario SET Nome=${s(v.nome,150)},Email=${s(v.email)},Perfil=${s(perfil,20)},Ativo=${v.ativo?1:0} WHERE UsuarioId=${targetId}`);
   else{
    const salt=crypto.randomBytes(16).toString('hex'),hash=hashPassword(v.senha,salt);
    await db.query(`INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(${targetId},'${salt}','${hash}')`);
   }
   // The submitted functions are a complete replacement, including legacy custom grants.
   await db.query(`DELETE Seguranca.UsuarioPerfil WHERE UsuarioId=${targetId};DELETE Seguranca.UsuarioRaiz WHERE UsuarioId=${targetId};`);
   for(const role of roles)await db.query(`INSERT Seguranca.UsuarioPerfil(UsuarioId,PerfilId) VALUES(${targetId},${n(role.PerfilId)})`);
   if(v.funcoes.includes('ADMIN'))await db.query(`INSERT Seguranca.UsuarioRaiz(UsuarioId) VALUES(${targetId})`);
   await db.query(`UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME(),RevogadoPor=${n(actor)} WHERE UsuarioId=${targetId} AND RevogadoEmUtc IS NULL`);
   for(const deposito of v.depositos)await db.query(`IF EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito WHERE UsuarioId=${targetId} AND DepositoId=${n(deposito)}) UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=NULL,RevogadoPor=NULL,ConcedidoPor=${n(actor)},ConcedidoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${targetId} AND DepositoId=${n(deposito)};ELSE INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(${targetId},${n(deposito)},${n(actor)});`);
   // Operational procedures use GestorDeposito; keep it synchronized with the
   // explicit assignment without granting future or unrelated depots.
   await db.query(`UPDATE Seguranca.GestorDeposito SET RevogadoEm=SYSUTCDATETIME(),RevogadoPorUsuarioId=${n(actor)} WHERE GestorUsuarioId=${targetId} AND RevogadoEm IS NULL;`);
   if(v.funcoes.includes('GESTOR')||v.funcoes.includes('ADMIN')){
    const deposits=await db.query(`SELECT DepositoId FROM Cadastro.Deposito WHERE Ativo=1 AND ${v.funcoes.includes('ADMIN')?'1=1':v.depositos.length?'DepositoId IN('+v.depositos.join(',')+')':'1=0'}`);
    for(const d of deposits){const dep=n(d.DepositoId);await db.query(`IF EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito WHERE UsuarioId=${targetId} AND DepositoId=${dep}) UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=NULL,RevogadoPor=NULL,ConcedidoPor=${n(actor)} WHERE UsuarioId=${targetId} AND DepositoId=${dep};ELSE INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(${targetId},${dep},${n(actor)});
     IF EXISTS(SELECT 1 FROM Seguranca.GestorDeposito WHERE GestorUsuarioId=${targetId} AND DepositoId=${dep}) UPDATE Seguranca.GestorDeposito SET RevogadoEm=NULL,RevogadoPorUsuarioId=NULL,ConcedidoPorUsuarioId=${n(actor)} WHERE GestorUsuarioId=${targetId} AND DepositoId=${dep};ELSE INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId) VALUES(${targetId},${dep},${n(actor)});`);}
   }
   await db.query(`UPDATE Seguranca.SessaoWeb SET RevogadoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=${targetId} AND RevogadoEmUtc IS NULL;
    UPDATE Seguranca.ConviteAtivacaoPiloto SET RevogadoUtc=SYSUTCDATETIME() WHERE UsuarioId=${targetId} AND ConsumidoUtc IS NULL AND RevogadoUtc IS NULL;`);
   const detail={antes:previous?{nome:previous.Nome,email:previous.Email,perfil:previous.Perfil,ativo:previous.Ativo,perfis:previousRoles.map(r=>r.Codigo),depositos:previousBranches.map(r=>String(r.DepositoId))}:null,depois:{nome:v.nome,email:v.email,funcoes:v.funcoes,depositos:v.depositos,ativo:v.ativo}};
   await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Usuario',${targetId},N'PC01_${creating?'CRIAR':'ATUALIZAR'}',${n(actor)},${s(JSON.stringify(detail),'max')})`);
   await db.commit();return {usuarioId:targetId,sessoesRevogadas:true};
  }catch(error){try{await db.rollback();}catch{}throw error;}
 });
}
