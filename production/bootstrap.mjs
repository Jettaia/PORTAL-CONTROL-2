import crypto from 'node:crypto';
import {installSchema} from '../pilot-local/database.mjs';
import {seedCatalog} from '../pilot-local/seed-catalog.mjs';
import {nvarcharLiteral, intLiteral} from '../src/auth-db.js';

export function validateAdmin(admin){
 if(!admin||!Number.isSafeInteger(Number(admin.id))||Number(admin.id)<1||typeof admin.name!=='string'||!admin.name.trim()||admin.name.length>150||typeof admin.email!=='string'||!/^\S+@\S+\.\S+$/.test(admin.email)||admin.email.length>256||!/^[a-f0-9]{32}$/i.test(admin.saltHex||'')||!/^[a-f0-9]{128}$/i.test(admin.passwordHashHex||''))throw Error('Credencial administrativa de origem inválida');
 return admin;
}
export async function seedNewChapa(db,{pilotInstance,admin,test=false}){
 validateAdmin(admin);
 if(!/^[a-f0-9]{64}$/.test(pilotInstance||''))throw Error('Identidade de instalação inválida');
 // installSchema verifies database allowlist, empty database and every migration hash.
 const schema=await installSchema(db,pilotInstance,{test});
 await db.beginTransaction();
 try{
  await seedCatalog(db);
  const id=intLiteral(Number(admin.id));
  await db.query(`SET IDENTITY_INSERT Seguranca.Usuario ON;INSERT Seguranca.Usuario(UsuarioId,Nome,Email,Perfil,Ativo) VALUES(${id},${nvarcharLiteral(admin.name,150)},${nvarcharLiteral(admin.email)},'ADMIN',1);SET IDENTITY_INSERT Seguranca.Usuario OFF;`);
  await db.query(`INSERT Seguranca.UsuarioRaiz(UsuarioId) VALUES(${id});INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(${id},'${admin.saltHex}','${admin.passwordHashHex}');INSERT Seguranca.UsuarioPerfil(UsuarioId,PerfilId) SELECT ${id},PerfilId FROM Seguranca.PerfilAcesso WHERE Codigo IN('PC01_ADMIN','PILOTO_ADMIN');`);
  await db.query(`INSERT Seguranca.PilotoInicializacao(Id,TokenHash,AdminEmail,AdminNome,ConsumidoUtc) VALUES(1,'${crypto.randomBytes(32).toString('hex')}',${nvarcharLiteral(admin.email)},${nvarcharLiteral(admin.name,150)},SYSUTCDATETIME());`);
  const check=(await db.query("SELECT (SELECT COUNT(*) FROM Seguranca.Usuario) Users,(SELECT COUNT(*) FROM Cadastro.Deposito) Depots,(SELECT COUNT(*) FROM Cadastro.Prestador) Providers,(SELECT COUNT(*) FROM Cadastro.TipoServico) Services,(SELECT COUNT(*) FROM Operacao.Contratacao) Contracts,(SELECT COUNT(*) FROM Financeiro.ContratacaoRecibo) Receipts,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) Payments,(SELECT COUNT(*) FROM Seguranca.SessaoWeb) Sessions,(SELECT COUNT(*) FROM Seguranca.SolicitacaoAcesso) AccessRequests"))[0];
  if(Number(check.Users)!==1||Object.entries(check).some(([k,v])=>k!=='Users'&&Number(v)!==0))throw Error('Banco inicial contém registros não autorizados');
  const c=(await db.query(`SELECT SaltHex,SenhaHashHex FROM Seguranca.Credencial WHERE UsuarioId=${id}`))[0];
  if(c?.SaltHex!==admin.saltHex||c?.SenhaHashHex!==admin.passwordHashHex)throw Error('Credencial importada diverge da origem');
  await db.commit();
  return {migrations:schema.migrations,adminCount:1,operationalRows:0,credentialPreserved:true};
 }catch(error){await db.rollback();throw error;}
}
