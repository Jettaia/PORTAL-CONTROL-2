import {withDb,intLiteral,nvarcharLiteral,tokenHashLiteral} from './auth-db.js';
import {hashToken} from './security.js';
import {status} from './mfa-b2b.js';
import {PlanningError,transaction,scope} from './b3.js';

export function reason(value){if(typeof value!=='string'||value.trim().length<1||value.length>800)throw new PlanningError('MOTIVO_OBRIGATORIO');return value.trim();}
export function decisionInput(body){
  if(!body||Object.keys(body).sort().join(',')!=='aprovar,contextoHash,motivo,validadeMinutos'||typeof body.aprovar!=='boolean'||!Number.isInteger(body.validadeMinutos)||body.validadeMinutos<1||body.validadeMinutos>1440||typeof body.contextoHash!=='string'||!/^[a-f0-9]{64}$/i.test(body.contextoHash))throw new PlanningError('DECISAO_INVALIDA');
  return {...body,motivo:reason(body.motivo)};
}
export async function critical(cfg,actor,token,query,audit){
  // Reuses the B2B TOTP verifier/session proof; never trusts a browser checkbox.
  const mfa=await status(cfg,actor,token);
  if(!mfa.enrolled||!mfa.verified||!mfa.stepUp){
    await withDb(cfg,db=>db.query(`SET NOCOUNT ON;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(${nvarcharLiteral(audit.entity,80)},${intLiteral(audit.id)},${nvarcharLiteral(audit.action,40)},${intLiteral(actor)},N'{"resultado":"DENIED","motivo":"MFA_RECENTE_OBRIGATORIO"}')`));
    throw new PlanningError('MFA_RECENTE_OBRIGATORIO',403);
  }
  return withDb(cfg,async db=>{await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');return query(db,tokenHashLiteral(hashToken(token)));});
}
export async function confirmParticipation(cfg,actor,token,id,body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new PlanningError('CAMPOS_INVALIDOS');
  return critical(cfg,actor,token,async(db,hash)=>({resultado:await db.query(`EXEC Operacao.sp_ConfirmarParticipacao @GestorId=${intLiteral(actor)},@ParticipacaoId=${intLiteral(id)},@SessaoHash=${hash};`)}),{entity:'Participacao',id,action:'CONFIRMAR_NEGADO'});
}
export async function requestException(cfg,actor,id,body){
  if(!body||Object.keys(body).join(',')!=='motivo')throw new PlanningError('CAMPOS_INVALIDOS');
  const text=reason(body.motivo);
  return transaction(cfg,actor,'atividades.criar',async db=>({resultado:await db.query(`DECLARE @m nvarchar(800)=${nvarcharLiteral(text,800)};EXEC Operacao.sp_SolicitarExcecaoLimite @GestorId=${intLiteral(actor)},@ParticipacaoId=${intLiteral(id)},@Motivo=@m;`)}));
}
export async function decideException(cfg,actor,token,id,body){
  const input=decisionInput(body);
  return critical(cfg,actor,token,async(db,hash)=>({resultado:await db.query(`DECLARE @m nvarchar(800)=${nvarcharLiteral(input.motivo,800)};EXEC Operacao.sp_DecidirExcecaoLimite @DiretorId=${intLiteral(actor)},@ExcecaoId=${intLiteral(id)},@Aprovar=${input.aprovar?1:0},@MfaConfirmado=1,@ValidadeMinutos=${input.validadeMinutos},@MotivoDecisao=@m,@SessaoHash=${hash},@ContextoEsperado='${input.contextoHash}';`)}),{entity:'ExcecaoLimite',id,action:'DECISAO_NEGADA'});
}
export async function listExceptions(cfg,actor){
  return transaction(cfg,actor,'atividades.visualizar',db=>listExceptionsDb(db,actor));
}
export async function listExceptionsDb(db,actor){
  return db.query(`SELECT e.ExcecaoId,e.ParticipacaoId,p.AtividadeId,e.SolicitadoPorGestorId,s.Nome AS Solicitante,e.Motivo,e.Status,
   CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(nvarchar(max),(SELECT p.ParticipacaoId participacaoId,p.PrestadorId prestadorId,p.ValorContratado valorContratado,a.AtividadeId atividadeId,a.DepositoId depositoId,a.TipoServicoId servicoId,a.GestorUsuarioId gestorId,a.DataServico dataServico,a.InicioPrevisto inicio,a.FimPrevisto fim FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))),2) AS ContextoHash,
   CASE WHEN e.Status='APROVADA' AND e.ExpiraEmUtc<=SYSUTCDATETIME() AND p.Status IN ('PLANEJADA','AGUARDANDO_APROVACAO') THEN 'EXPIRADA' ELSE e.Status END AS EstadoExcecao,
   e.DiretorAprovadorId,ap.Nome AS Aprovador,CONVERT(varchar(23),e.DecididoEmUtc,126) AS DecididoEmUtc,CONVERT(varchar(23),e.ExpiraEmUtc,126) AS ExpiraEmUtc,d.Nome AS Deposito,f.Nome AS Filial,pr.Nome AS Prestador,t.Nome AS Servico,CONVERT(varchar(40),p.ValorContratado) AS ValorContratado,CONVERT(varchar(19),a.InicioPrevisto,126) AS InicioPrevisto,CONVERT(varchar(19),a.FimPrevisto,126) AS FimPrevisto,au.MotivoDecisao
   FROM Operacao.ExcecaoLimite e JOIN Operacao.Participacao p ON p.ParticipacaoId=e.ParticipacaoId
   JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
   JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1 JOIN Seguranca.Usuario s ON s.UsuarioId=e.SolicitadoPorGestorId
   JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId JOIN Cadastro.TipoServico t ON t.TipoServicoId=a.TipoServicoId
   LEFT JOIN Seguranca.Usuario ap ON ap.UsuarioId=e.DiretorAprovadorId
   OUTER APPLY(SELECT TOP(1) JSON_VALUE(x.DetalhesJson,'$.motivoDecisao') MotivoDecisao FROM Seguranca.Auditoria x WHERE x.Entidade='ExcecaoLimite' AND x.EntidadeId=e.ExcecaoId AND x.Acao IN ('APROVAR','REJEITAR') ORDER BY x.AuditoriaId DESC) au
   WHERE ${scope(actor)} ORDER BY e.ExcecaoId DESC`);
}
export function sqlContractError(error){
  const code=Number(error.odbcErrors?.find(e=>Number(e.code)>=53100&&Number(e.code)<=54399)?.code);
  const messages={54121:'POLITICA_INDISPONIVEL',54122:'DIAS_CORRIDOS_BLOQUEADO',54150:'PARTICIPACAO_INDISPONIVEL',54151:'CONCORRENCIA_REPETIR_CONSULTA',54152:'CONFLITO_PERIODO',54155:'LIMITE_EXIGE_EXCECAO',54131:'EXCECAO_FORA_ESCOPO',54132:'EXCECAO_JA_EXISTENTE',54143:'EXCECAO_INDISPONIVEL',54201:'PERMISSAO_NEGADA',54203:'MFA_RECENTE_OBRIGATORIO',54204:'IMPACTO_CONFIRMADAS_BLOQUEADO',54205:'EXCECAO_NAO_APLICAVEL',54206:'CONTEXTO_ALTERADO_REVISAR'};
  Object.assign(messages,{53102:'PERMISSAO_NEGADA',53103:'DEPOSITO_INDISPONIVEL',53104:'SERVICO_INATIVO',53105:'PERIODO_INVALIDO',53106:'ATIVIDADE_INDISPONIVEL',53107:'PRESTADOR_INATIVO',53108:'VALOR_INVALIDO',53109:'CONCORRENCIA_REPETIR_CONSULTA',53110:'CONFLITO_PERIODO',54120:'PARTICIPACAO_INDISPONIVEL',54130:'MOTIVO_OBRIGATORIO',54142:'DECISAO_INVALIDA',54202:'PERIODO_INVALIDO',54110:'PERMISSAO_NEGADA',54111:'POLITICA_INVALIDA',54112:'POLITICA_SOBREPOSTA',54301:'DIAS_CORRIDOS_BLOQUEADO',54302:'IMPACTO_HISTORICO_BLOQUEADO',54303:'DISPONIBILIDADE_NAO_INFORMADA',54304:'DISPONIBILIDADE_INVALIDA',54305:'IDEMPOTENCIA_DIVERGENTE',54306:'DISPONIBILIDADE_SOBREPOSTA'});
  return messages[code]?new PlanningError(messages[code],[53102,53103,54110,54201,54203].includes(code)?403:409):error;
}
