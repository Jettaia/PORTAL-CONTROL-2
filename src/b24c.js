import {procedureSql,withDb,intLiteral} from './auth-db.js';
import {normalizeCatalog,read,save} from './pc02.js';
// Both URLs use the same authorization, validation and concurrency contract.
export const normalizeDeposit=body=>normalizeCatalog('depositos',body);
export async function listDeposits(cfg,uid){return (await read(cfg,uid,'depositos')).registros;}
export async function createDeposit(cfg,uid,body,token){return save(cfg,uid,token,'depositos',body);}
export async function updateDeposit(cfg,uid,body,token){const {depositoId,...value}=body||{};return save(cfg,uid,token,'depositos',value,intLiteral(depositoId));}
export async function listUsers(cfg){return withDb(cfg,db=>db.query('SELECT UsuarioId,Nome,Email,Perfil,Ativo FROM Seguranca.Usuario ORDER BY Nome'));}
export async function listScope(cfg){return withDb(cfg,db=>db.query('SELECT UsuarioId,DepositoId FROM Seguranca.UsuarioDeposito WHERE RevogadoEmUtc IS NULL ORDER BY UsuarioId,DepositoId'));}
export async function setScope(cfg,uid,body){if(cfg.pc01)throw Error('UTILIZE_ADMINISTRACAO_PC01');if(typeof body?.conceder!=='boolean')throw Error('Acao invalida');return withDb(cfg,db=>db.query(procedureSql('Seguranca.sp_B24D_AtribuirUsuarioDeposito',{AtorId:intLiteral(uid),UsuarioId:intLiteral(body.usuarioId),DepositoId:intLiteral(body.depositoId),Conceder:body.conceder})));}
