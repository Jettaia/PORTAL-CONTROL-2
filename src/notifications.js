import {withDb,intLiteral as n} from './auth-db.js';
import {roleSql} from './access-policy.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function key(value){const match=/^([1-9]\d*)-(SOLICITACAO|RESULTADO)$/.exec(value||'');if(!match)fail('IDENTIFICADOR_INVALIDO');try{return {id:n(match[1]),type:match[2]};}catch{fail('IDENTIFICADOR_INVALIDO');}}
async function context(db,actor){
 const uid=n(actor),u=(await db.query(`SELECT CASE WHEN u.Perfil='ADMIN' AND ${roleSql(uid,'ADMIN')} THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'COORDENADOR')} THEN 1 ELSE 0 END Coordenador,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor FROM Seguranca.Usuario u WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
 const yes=v=>v===true||Number(v)===1;
 if(!u||![u.Adm,u.Coordenador,u.Gestor].some(yes))fail('PERMISSAO_NEGADA',403);
 const scope=yes(u.Adm)?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito uf WHERE uf.UsuarioId=${uid} AND uf.DepositoId=c.DepositoId AND uf.RevogadoEmUtc IS NULL)`;
 return {uid,scope,supervisor:yes(u.Adm)||yes(u.Coordenador)};
}
function source({uid,scope,supervisor}){return `WITH Avisos AS (
 SELECT hs.SolicitacaoId,c.ContratacaoId,c.Numero,p.Nome Prestador,d.Nome Deposito,u.Nome Solicitante,hs.Status,hs.Motivo,
 CONVERT(varchar(16),hs.EntradaReal,126) EntradaReal,CONVERT(varchar(16),hs.SaidaReal,126) SaidaReal,
 k.Tipo,CASE WHEN k.Tipo='SOLICITACAO' THEN hs.CriadoEmUtc ELSE hs.DecididoEmUtc END EventoEmUtc,
 CASE WHEN l.UsuarioId IS NULL THEN 0 ELSE 1 END Lida
 FROM Operacao.ContratacaoHorarioSolicitacao hs
 JOIN Operacao.Contratacao c ON c.ContratacaoId=hs.ContratacaoId
 JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId
 JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId
 JOIN Seguranca.Usuario u ON u.UsuarioId=hs.SolicitanteId
 CROSS JOIN (VALUES('SOLICITACAO'),('RESULTADO')) k(Tipo)
 LEFT JOIN Seguranca.NotificacaoLeitura l ON l.UsuarioId=${uid} AND l.SolicitacaoId=hs.SolicitacaoId AND l.Tipo=k.Tipo
 WHERE ${scope} AND ((k.Tipo='SOLICITACAO' AND ${supervisor?'1=1':'1=0'}) OR (k.Tipo='RESULTADO' AND hs.SolicitanteId=${uid} AND hs.Status IN('APROVADA','NEGADA','CANCELADA')))
 ) `;}
async function transaction(cfg,actor,fn){return withDb(cfg,async db=>{
 await db.query('SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{const result=await fn(db,await context(db,actor));await db.commit();return result;}catch(e){try{await db.rollback();}catch{}throw e;}
});}
export async function list(cfg,actor,before){
 const cursor=before===undefined?null:key(before);
 return transaction(cfg,actor,async(db,ctx)=>{
  const cte=source(ctx),count=(await db.query(cte+'SELECT COUNT_BIG(*) NaoLidas FROM Avisos WHERE Lida=0'))[0];
  const boundary=cursor?` WHERE EXISTS(SELECT 1 FROM Avisos b WHERE b.SolicitacaoId=${cursor.id} AND b.Tipo='${cursor.type}' AND (a.EventoEmUtc<b.EventoEmUtc OR (a.EventoEmUtc=b.EventoEmUtc AND (a.SolicitacaoId<b.SolicitacaoId OR (a.SolicitacaoId=b.SolicitacaoId AND a.Tipo<b.Tipo)))))`:'';
  const rows=await db.query(cte+`SELECT TOP(31) a.*,CONVERT(varchar(23),a.EventoEmUtc,126) CriadoEmUtc FROM Avisos a${boundary} ORDER BY a.EventoEmUtc DESC,a.SolicitacaoId DESC,a.Tipo DESC`);
  const registros=rows.slice(0,30).map(r=>({...r,Id:String(r.SolicitacaoId)+'-'+r.Tipo,Lida:Number(r.Lida)===1}));
  return {registros,naoLidas:Number(count?.NaoLidas||0),proximaPagina:rows.length>30?registros.at(-1).Id:null};
 });
}
export async function markRead(cfg,actor,value,body){
 const item=key(value);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)fail('CAMPOS_INVALIDOS');
 return transaction(cfg,actor,async(db,ctx)=>{
  const visible=await db.query(source(ctx)+`SELECT SolicitacaoId FROM Avisos WHERE SolicitacaoId=${item.id} AND Tipo='${item.type}'`);
  if(!visible.length)fail('NOTIFICACAO_INDISPONIVEL',404);
  await db.query(`INSERT Seguranca.NotificacaoLeitura(UsuarioId,SolicitacaoId,Tipo) SELECT ${ctx.uid},${item.id},'${item.type}' WHERE NOT EXISTS(SELECT 1 FROM Seguranca.NotificacaoLeitura WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=${ctx.uid} AND SolicitacaoId=${item.id} AND Tipo='${item.type}')`);
  return {ok:true};
 });
}
