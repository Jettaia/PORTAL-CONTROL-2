import {roleSql} from './access-policy.js';
import crypto from 'node:crypto';
import {withDb,intLiteral,nvarcharLiteral,tokenHashLiteral} from './auth-db.js';
import {hashToken} from './security.js';
import {PlanningError,scope} from './b3.js';
import {randomCode,randomTablet,verifier,commandInput,codeContext,labOnly} from './b4-codes.js';
const n=intLiteral, s=nvarcharLiteral;
export async function tx(cfg,fn){
 labOnly(cfg);return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
  try{const result=await fn(db);await db.commit();return result;}catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
export async function lock(db,key,mode='Exclusive'){if(!['Exclusive','Shared'].includes(mode))throw Error('Modo de trava invalido');const r=(await db.query(`DECLARE @r int,@resource nvarchar(255)=${s('JettaControl.B41.'+key,255)};EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='${mode}',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r AS R;`))[0];if(Number(r?.R)<0)throw new PlanningError('OPERACAO_OCUPADA',409);}
export function explicit(actor,key){return `EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId AND pa.Ativo=1 JOIN Seguranca.PerfilPermissao pp ON pp.PerfilId=pa.PerfilId JOIN Seguranca.Permissao pm ON pm.PermissaoId=pp.PermissaoId WHERE up.UsuarioId=${n(actor)} AND pm.Chave=${s(key,100)})`;}
function manager(actor,depot,key){return `EXISTS(SELECT 1 FROM Cadastro.Deposito d JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1 JOIN Seguranca.Usuario u ON u.UsuarioId=${n(actor)} AND u.Ativo=1 AND ${roleSql('u.UsuarioId','GESTOR')} WHERE d.DepositoId=${n(depot)} AND d.Ativo=1 AND ${scope(actor)} AND ${explicit(actor,key)})`;}
export async function authorize(db,actor,depot,key,token){
 if(!(await db.query(`SELECT 1 AS V WHERE ${manager(actor,depot,key)}`)).length)throw new PlanningError('PERMISSAO_OU_ABRANGENCIA_NEGADA',403);
 if(token!==undefined)await assertMfa(db,actor,token);
}
export async function audit(db,actor,id,action,block='B4.1'){if(!['B4.1','B4.2'].includes(block))throw Error('Bloco invalido');await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Apontamento',${n(id)},${s(action,40)},${actor?n(actor):'NULL'},${s(JSON.stringify({bloco:block}),80)})`);}
const contextQuery=id=>`SELECT p.ParticipacaoId,p.PrestadorId,p.Status,a.AtividadeId,a.DepositoId,d.FilialId,a.TipoServicoId,a.GestorUsuarioId,CONVERT(varchar(40),p.ValorContratado) ValorContratado,CONVERT(varchar(19),a.InicioPrevisto,126) InicioPrevisto,CONVERT(varchar(19),a.FimPrevisto,126) FimPrevisto FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK) JOIN Operacao.Atividade a WITH(HOLDLOCK) ON a.AtividadeId=p.AtividadeId AND a.Status<>'CANCELADA' JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1 JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1 JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId AND pr.Ativo=1 JOIN Cadastro.TipoServico ts ON ts.TipoServicoId=a.TipoServicoId AND ts.Ativo=1 WHERE p.ParticipacaoId=${n(id)}`;
export async function pairTablet(cfg,actor,token,depot){
 if(cfg.b42){const {governTablet}=await import('./b4-2.js');const r=await governTablet(cfg,actor,token,depot,{tipo:'PAREAR',motivo:'Pareamento solicitado pela interface de apontamentos',nome:'Tablet de apontamentos',requisicaoId:crypto.randomUUID()});return {...r,validadePareamentoMinutos:5};}
 return tx(cfg,async db=>{await authorize(db,actor,depot,'apontamentos.emitir',token);const {code,row}=await newTabletAuthorization(db,actor,depot);await audit(db,actor,row.TabletId,'TABLET_PAREAMENTO');return {tabletId:Number(row.TabletId),pareamento:code,validadePareamentoMinutos:5};});
}
export async function activateTablet(cfg,pair){
 let hash;try{hash=verifier(pair,'PAIR');}catch{await tx(cfg,db=>db.query("INSERT Operacao.TentativaApontamento(Resultado) VALUES('PAREAMENTO_INVALIDO')"));throw new PlanningError('PAREAMENTO_INVALIDO',401);}const result=await tx(cfg,async db=>{const row=(await db.query(`SELECT * FROM Operacao.TabletApontamento WITH(UPDLOCK,HOLDLOCK) WHERE PareamentoHash='${hash}' AND AtivadoUtc IS NULL AND RevogadoUtc IS NULL AND PareamentoExpiraUtc>SYSUTCDATETIME() AND ExpiraUtc>SYSUTCDATETIME()`))[0];if(!row){await db.query("INSERT Operacao.TentativaApontamento(Resultado) VALUES('PAREAMENTO_INVALIDO')");return {negado:true};}await authorize(db,row.EmissorId,row.DepositoId,'apontamentos.emitir');const token=randomTablet();await db.query(`UPDATE Operacao.TabletApontamento SET TokenHash='${verifier(token,'TABLET')}',AtivadoUtc=SYSUTCDATETIME()${cfg.b42?',NavegacaoProtegida=1':''} WHERE TabletId=${n(row.TabletId)}`);await audit(db,row.EmissorId,row.TabletId,'TABLET_ATIVADO');return {token,tabletId:Number(row.TabletId),depositoId:Number(row.DepositoId)};});if(result.negado)throw new PlanningError('PAREAMENTO_INVALIDO',401);return result;
}
export async function issueCodes(cfg,actor,token,id,minutes){
 if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new PlanningError('VALIDADE_INVALIDA');
 return tx(cfg,async db=>{await lock(db,'P'+n(id));const p=(await db.query(contextQuery(id)))[0];if(!p)throw new PlanningError('PARTICIPACAO_INDISPONIVEL',404);await authorize(db,actor,p.DepositoId,'apontamentos.emitir',token);if(p.Status!=='CONFIRMADA')throw new PlanningError('PARTICIPACAO_NAO_CONFIRMADA',409);
  if((await db.query(`SELECT 1 AS V FROM Operacao.EventoApontamento WHERE ParticipacaoId=${n(id)} AND Tipo='SAIDA'`)).length)throw new PlanningError('SAIDA_JA_REGISTRADA',409);
  const generation=crypto.randomUUID(),entrada=randomCode(),saida=randomCode();const make=type=>codeContext(generation,id,p.AtividadeId,p.PrestadorId,p.DepositoId,type);
  await db.query(`UPDATE Operacao.CodigoApontamento SET RevogadoUtc=SYSUTCDATETIME() WHERE ParticipacaoId=${n(id)} AND RevogadoUtc IS NULL;
   INSERT Operacao.CodigoApontamento(Geracao,ParticipacaoId,AtividadeId,PrestadorId,DepositoId,FilialId,TipoServicoId,GestorUsuarioId,ValorContratado,InicioPrevisto,FimPrevisto,EntradaHash,SaidaHash,EmissorId,ExpiraUtc)
   SELECT '${generation}',p.ParticipacaoId,a.AtividadeId,p.PrestadorId,a.DepositoId,${n(p.FilialId)},a.TipoServicoId,a.GestorUsuarioId,p.ValorContratado,a.InicioPrevisto,a.FimPrevisto,'${verifier(entrada,make('ENTRADA'))}','${verifier(saida,make('SAIDA'))}',${n(actor)},DATEADD(minute,${minutes},SYSUTCDATETIME()) FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.ParticipacaoId=${n(id)}`);
  await audit(db,actor,id,'CODIGOS_EMITIDOS');return {participacaoId:Number(id),atividadeId:Number(p.AtividadeId),prestadorId:Number(p.PrestadorId),depositoId:Number(p.DepositoId),entrada,saida,validadeMinutos:minutes,identidadePessoalComprovada:false};
 });
}
export async function recordEvent(cfg,token,body){
 let v,th;try{v=commandInput(body);th=verifier(token,'TABLET');}catch{await tx(cfg,db=>db.query("INSERT Operacao.TentativaApontamento(Resultado) VALUES('COMANDO_INVALIDO')"));return {erro:'COMANDO_INVALIDO',status:400};}
 return tx(cfg,async db=>{
  // Tablet -> participation is the same order for every command. No automatic retry.
  const t=(await db.query(`SELECT * FROM Operacao.TabletApontamento WITH(UPDLOCK,HOLDLOCK) WHERE TokenHash='${th}' AND AtivadoUtc IS NOT NULL AND RevogadoUtc IS NULL AND ExpiraUtc>SYSUTCDATETIME() AND Falhas<5 ${cfg.b42?'AND NavegacaoProtegida=1':''}`))[0];
  async function denied(code,tablet=t){await db.query(`INSERT Operacao.TentativaApontamento(TabletId,Resultado,RequisicaoId) VALUES(${tablet?n(tablet.TabletId):'NULL'},'${code}','${v.requisicaoId}')`);if(tablet)await db.query(`UPDATE Operacao.TabletApontamento SET Falhas=CASE WHEN Falhas<5 THEN Falhas+1 ELSE 5 END WHERE TabletId=${n(tablet.TabletId)}`);return {erro:code,status:tablet?409:401};}
  if(!t)return denied('AUTORIZACAO_TABLET_INVALIDA');
  if(!(await db.query(`SELECT 1 AS V WHERE ${manager(t.EmissorId,t.DepositoId,'apontamentos.emitir')}`)).length)return denied('AUTORIZACAO_TABLET_INVALIDA');
  await lock(db,'P'+n(v.participacaoId));
  const commandHash=crypto.createHash('sha256').update(JSON.stringify([v.participacaoId,v.atividadeId,v.prestadorId,v.tipo,v.codigo])).digest('hex');
  const prev=(await db.query(`SELECT EventoId,Tipo,CONVERT(varchar(23),InstanteUtc,126) AS InstanteUtc,ComandoHash FROM Operacao.EventoApontamento WHERE TabletId=${n(t.TabletId)} AND RequisicaoId='${v.requisicaoId}'`))[0];
  if(prev){if(prev.ComandoHash!==commandHash)return denied('REQUISICAO_REUTILIZADA');return {eventoId:Number(prev.EventoId),tipo:prev.Tipo,instanteUtc:prev.InstanteUtc+'Z',repeticao:true};}
  const p=(await db.query(contextQuery(v.participacaoId)))[0];
  if(!p||p.Status!=='CONFIRMADA'||Number(p.DepositoId)!==Number(t.DepositoId)||Number(p.AtividadeId)!==v.atividadeId||Number(p.PrestadorId)!==v.prestadorId)return denied('CONTEXTO_OU_CODIGO_INVALIDO');
  const c=(await db.query(`SELECT * FROM Operacao.CodigoApontamento WITH(UPDLOCK,HOLDLOCK) WHERE ParticipacaoId=${n(v.participacaoId)} AND RevogadoUtc IS NULL AND ExpiraUtc>SYSUTCDATETIME() AND AtividadeId=${n(p.AtividadeId)} AND PrestadorId=${n(p.PrestadorId)} AND DepositoId=${n(p.DepositoId)} AND FilialId=${n(p.FilialId)} AND TipoServicoId=${n(p.TipoServicoId)} AND GestorUsuarioId=${n(p.GestorUsuarioId)} AND ValorContratado=CONVERT(decimal(18,2),${s(p.ValorContratado)}) AND InicioPrevisto=${s(p.InicioPrevisto)} AND FimPrevisto=${s(p.FimPrevisto)}`))[0];
  if(!c||verifier(v.codigo,codeContext(c.Geracao,v.participacaoId,p.AtividadeId,p.PrestadorId,p.DepositoId,v.tipo))!==c[v.tipo==='ENTRADA'?'EntradaHash':'SaidaHash'])return denied('CONTEXTO_OU_CODIGO_INVALIDO');
  const events=await db.query(`SELECT Tipo FROM Operacao.EventoApontamento WITH(UPDLOCK,HOLDLOCK) WHERE ParticipacaoId=${n(v.participacaoId)}`);
  if(events.some(e=>e.Tipo===v.tipo))return denied('APONTAMENTO_JA_REGISTRADO');
  if(v.tipo==='SAIDA'&&!events.some(e=>e.Tipo==='ENTRADA'))return denied('ENTRADA_OBRIGATORIA');
  const row=(await db.query(`INSERT Operacao.EventoApontamento(ParticipacaoId,CodigoId,TabletId,Tipo,RequisicaoId,ComandoHash) OUTPUT inserted.EventoId,CONVERT(varchar(23),inserted.InstanteUtc,126) AS InstanteUtc VALUES(${n(v.participacaoId)},${n(c.CodigoId)},${n(t.TabletId)},'${v.tipo}','${v.requisicaoId}','${commandHash}');UPDATE Operacao.CodigoApontamento SET ${v.tipo==='ENTRADA'?'EntradaConsumidaUtc':'SaidaConsumidaUtc'}=SYSUTCDATETIME() WHERE CodigoId=${n(c.CodigoId)};UPDATE Operacao.TabletApontamento SET Falhas=0 WHERE TabletId=${n(t.TabletId)};`))[0];
  await db.query(`INSERT Operacao.TentativaApontamento(TabletId,Resultado,RequisicaoId) VALUES(${n(t.TabletId)},'CONCLUIDA','${v.requisicaoId}')`);await audit(db,null,v.participacaoId,'APONTAMENTO_'+v.tipo);
  return {eventoId:Number(row.EventoId),tipo:v.tipo,instanteUtc:row.InstanteUtc+'Z',conferencia:'PENDENTE',identidadePessoalComprovada:false};
 });
}
export async function listEvents(cfg,actor,depot){return tx(cfg,async db=>{await authorize(db,actor,depot,'apontamentos.visualizar');return db.query(`SELECT p.ParticipacaoId,p.PrestadorId,pr.Nome,a.AtividadeId,a.DepositoId,d.FilialId,CONVERT(varchar(19),a.InicioPrevisto,126) InicioPrevisto,CONVERT(varchar(19),a.FimPrevisto,126) FimPrevisto,CONVERT(varchar(23),en.InstanteUtc,126) EntradaUtc,CONVERT(varchar(23),sa.InstanteUtc,126) SaidaUtc,CASE WHEN sa.EventoId IS NOT NULL THEN 'SAIDA_REGISTRADA' WHEN en.EventoId IS NOT NULL THEN 'EM_ATIVIDADE' ELSE 'AGUARDANDO_ENTRADA' END Estado,CASE WHEN sa.EventoId IS NOT NULL THEN ${cfg.b42?"COALESCE(cf.Decisao,'PENDENTE')":"'PENDENTE'"} ELSE NULL END Conferencia FROM Operacao.Participacao p JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId LEFT JOIN Operacao.EventoApontamento en ON en.ParticipacaoId=p.ParticipacaoId AND en.Tipo='ENTRADA' LEFT JOIN Operacao.EventoApontamento sa ON sa.ParticipacaoId=p.ParticipacaoId AND sa.Tipo='SAIDA' ${cfg.b42?'LEFT JOIN Operacao.ConferenciaApontamento cf ON cf.ParticipacaoId=p.ParticipacaoId':''} WHERE a.DepositoId=${n(depot)} AND (p.Status='CONFIRMADA' OR en.EventoId IS NOT NULL) ORDER BY p.ParticipacaoId DESC`);});}

export async function revokeTablet(cfg,token){const th=verifier(token,'TABLET');return tx(cfg,async db=>{const row=(await db.query(`UPDATE Operacao.TabletApontamento SET RevogadoUtc=COALESCE(RevogadoUtc,SYSUTCDATETIME()) OUTPUT inserted.TabletId WHERE TokenHash='${th}'`))[0];if(row)await audit(db,null,row.TabletId,'TABLET_ENCERRADO');return {ok:true};});}

export async function assertMfa(db,actor,token){
 if(!(await db.query(`SELECT 1 AS V FROM Seguranca.SessaoWeb se JOIN Seguranca.MfaTotp m ON m.UsuarioId=se.UsuarioId AND m.ConfirmadoEmUtc IS NOT NULL AND m.RevogadoEmUtc IS NULL WHERE se.UsuarioId=${n(actor)} AND se.TokenHash=${tokenHashLiteral(hashToken(token))} AND se.RevogadoEmUtc IS NULL AND se.ExpiraEmUtc>SYSUTCDATETIME() AND se.MfaValidadoEmUtc>=m.ConfirmadoEmUtc AND se.MfaValidadoEmUtc<=SYSUTCDATETIME() AND se.MfaStepUpEmUtc>=m.ConfirmadoEmUtc AND se.MfaStepUpEmUtc BETWEEN DATEADD(minute,-5,SYSUTCDATETIME()) AND SYSUTCDATETIME()`)).length)throw new PlanningError('MFA_RECENTE_OBRIGATORIO',403);
}

export async function newTabletAuthorization(db,actor,depot){const code=randomTablet();const row=(await db.query(`INSERT Operacao.TabletApontamento(DepositoId,EmissorId,PareamentoHash,PareamentoExpiraUtc,ExpiraUtc) OUTPUT inserted.TabletId VALUES(${n(depot)},${n(actor)},'${verifier(code,'PAIR')}',DATEADD(minute,5,SYSUTCDATETIME()),DATEADD(hour,8,SYSUTCDATETIME()))`))[0];return {code,row};}
