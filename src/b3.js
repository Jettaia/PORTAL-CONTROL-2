import {roleSql} from './access-policy.js';
import {withDb, intLiteral, nvarcharLiteral} from './auth-db.js';
import {sqlTrue} from './rbac.js';

export class PlanningError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
export function money(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value)) throw new PlanningError('VALOR_INVALIDO');
  return value.includes('.') ? value.padEnd(value.indexOf('.') + 3, '0') : value + '.00';
}
export function planningInput(body) {
  if (!body || Object.keys(body).some(k => !['depositoId','tipoServicoId','dataServico','inicioPrevisto','fimPrevisto','descricao'].includes(k))) throw new PlanningError('CAMPOS_INVALIDOS');
  const date = body.dataServico, start = body.inicioPrevisto, end = body.fimPrevisto;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0,4)) < 2000 || Number(date.slice(0,4)) > 9998 || new Date(date + 'T00:00:00Z').toISOString().slice(0,10) !== date) throw new PlanningError('DATA_INVALIDA');
  const validTime = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(s) && !Number.isNaN(Date.parse(s + ':00Z')) && new Date(s + ':00Z').toISOString().slice(0,16) === s;
  if (!validTime(start) || !validTime(end) || !start.startsWith(date + 'T') || end <= start) throw new PlanningError('PERIODO_INVALIDO');
  if (body.descricao !== undefined && (typeof body.descricao !== 'string' || body.descricao.length > 500)) throw new PlanningError('DESCRICAO_INVALIDA');
  return {depositoId: intLiteral(body.depositoId), tipoServicoId: intLiteral(body.tipoServicoId), date, start, end, description: body.descricao || ''};
}
// Current grant AND legacy grant for managers. ADMIN label alone never grants scope.
export function scope(actor, alias = 'd') {
  const id = intLiteral(actor);
  return `EXISTS(SELECT 1 FROM Seguranca.Usuario u WHERE u.UsuarioId=${id} AND u.Ativo=1 AND
    (EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=u.UsuarioId) OR
     (EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=u.UsuarioId AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL)
      AND (u.Perfil<>'GESTOR' OR EXISTS(SELECT 1 FROM Seguranca.GestorDeposito gd WHERE gd.GestorUsuarioId=u.UsuarioId AND gd.DepositoId=${alias}.DepositoId AND gd.RevogadoEm IS NULL)))))`;
}
export async function transaction(cfg, actor, permission, fn) {
  return withDb(cfg, async db => {
    await db.query('SET NOCOUNT ON; SET XACT_ABORT ON; SET LOCK_TIMEOUT 5000; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await db.beginTransaction();
    try {
      const permitted = (await db.query(`SELECT Seguranca.fn_Pode(${intLiteral(actor)},${nvarcharLiteral(permission,100)}) AS Pode`))[0];
      if (!sqlTrue(permitted?.Pode)) throw new PlanningError('PERMISSAO_NEGADA', 403);
      const result = await fn(db); await db.commit(); return result;
    } catch (e) { try { await db.rollback(); } catch {} throw e; }
  });
}
const selectActivity = `SELECT a.AtividadeId,a.DepositoId,d.Nome AS Deposito,a.TipoServicoId,t.Nome AS Servico,a.GestorUsuarioId,CONVERT(varchar(10),a.DataServico,23) AS DataServico,CONVERT(varchar(19),a.InicioPrevisto,126) AS InicioPrevisto,CONVERT(varchar(19),a.FimPrevisto,126) AS FimPrevisto,a.Descricao,a.Status FROM Operacao.Atividade a JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId JOIN Cadastro.TipoServico t ON t.TipoServicoId=a.TipoServicoId`;
export async function activity(db, actor, id, own = false) {
  const row = (await db.query(`${selectActivity} WHERE a.AtividadeId=${intLiteral(id)} AND ${scope(actor)}${own ? ` AND a.GestorUsuarioId=${intLiteral(actor)}` : ''}`))[0];
  if (!row) throw new PlanningError('ATIVIDADE_INDISPONIVEL', 404);
  return row;
}
export async function planningCatalog(cfg, actor) {
  return transaction(cfg, actor, 'atividades.visualizar', async db => ({
    atorId:actor,
    depositos: await db.query(`SELECT d.DepositoId,d.Nome FROM Cadastro.Deposito d WHERE d.Ativo=1 AND ${scope(actor)} ORDER BY d.Nome`),
    servicos: await db.query('SELECT TipoServicoId,Nome FROM Cadastro.TipoServico WHERE Ativo=1 ORDER BY Nome'),
    prestadores: await db.query(cfg.pc03?`SELECT p.PrestadorId,p.Nome,pf.DepositoId FROM Cadastro.Prestador p JOIN Cadastro.PrestadorDeposito pf ON pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL WHERE p.Ativo=1 AND EXISTS(SELECT 1 FROM Cadastro.Deposito d WHERE d.DepositoId=pf.DepositoId AND d.Ativo=1 AND ${scope(actor)}) ORDER BY p.Nome,pf.DepositoId`:'SELECT PrestadorId,Nome FROM Cadastro.Prestador WHERE Ativo=1 ORDER BY Nome'),
    podeCriar: !cfg.pc04 && sqlTrue((await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=${intLiteral(actor)} AND ${roleSql(intLiteral(actor),'GESTOR')} AND Ativo=1) AND Seguranca.fn_Pode(${intLiteral(actor)},'atividades.criar')=1 THEN 1 ELSE 0 END AS V`))[0]?.V),
    pc03:cfg.pc03===true,
    b34:cfg.b34===true,
    b33:cfg.b33===true,
    b32:cfg.b32===true,
    podeConfirmar:cfg.b32===true&&sqlTrue((await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=${intLiteral(actor)} AND ${roleSql(intLiteral(actor),'GESTOR')} AND Ativo=1) AND Seguranca.fn_Pode(${intLiteral(actor)},'atividades.confirmar')=1 THEN 1 ELSE 0 END AS V`))[0]?.V),
    podeDecidir:cfg.b32===true&&sqlTrue((await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=${intLiteral(actor)} AND Perfil='DIRETORIA' AND Ativo=1) AND Seguranca.fn_Pode(${intLiteral(actor)},'limites.excecao.aprovar')=1 THEN 1 ELSE 0 END AS V`))[0]?.V)
  }));
}
export async function listActivities(cfg, actor) {
  return transaction(cfg, actor, 'atividades.visualizar', db => db.query(`${selectActivity} WHERE ${scope(actor)} ORDER BY a.DataServico DESC,a.AtividadeId DESC`));
}
export async function activityDetail(cfg, actor, id) {
  return transaction(cfg,actor,'atividades.visualizar',db=>activityDetailDb(cfg,db,actor,id));
}
export async function activityDetailDb(cfg,db,actor,id){
    const a=await activity(db,actor,id),rows=await db.query(`SELECT p.ParticipacaoId,p.PrestadorId,c.Nome,CONVERT(varchar(40),p.ValorContratado) AS ValorContratado,p.Status FROM Operacao.Participacao p JOIN Cadastro.Prestador c ON c.PrestadorId=p.PrestadorId WHERE p.AtividadeId=${intLiteral(id)} ORDER BY p.ParticipacaoId`);
    if(cfg.b32===true){
      const pol=(await db.query(`SELECT COUNT(*) AS N,MAX(pol.Modo) AS Modo FROM Operacao.Atividade a JOIN Operacao.PoliticaLimite pol ON pol.VigenteDesde<=a.DataServico AND (pol.VigenteAte IS NULL OR pol.VigenteAte>=a.DataServico) WHERE a.AtividadeId=${intLiteral(id)}`))[0];
      for(const row of rows){
        row.SituacaoPlanejamento=row.Status;
        if(row.Status==='PLANEJADA'){
          if(Number(pol.N)!==1||pol.Modo!=='DIAS_CONTRATADOS')row.SituacaoPlanejamento='BLOQUEADA_POLITICA';
          else{const e=(await db.query(`EXEC Operacao.sp_AvaliarLimiteContratacao @ParticipacaoId=${intLiteral(row.ParticipacaoId)}`))[0];row.SituacaoPlanejamento=sqlTrue(e.ImpactaConfirmadas)||sqlTrue(e.PoliticaFuturaIndefinida)?'BLOQUEADA_IMPACTO':sqlTrue(e.DentroDoLimite)?'ELEGIVEL':'BLOQUEADA_LIMITE';}
        }
      }
    }
    return {atividade:a,participacoes:rows};
}
export async function createActivity(cfg, actor, body) {
  if(cfg.pc04)throw new PlanningError('UTILIZE_CONTRATACOES_PC04',409);
  const v = planningInput(body);
  return transaction(cfg, actor, 'atividades.criar', async db => {
    if (!(await db.query(`SELECT d.DepositoId FROM Cadastro.Deposito d WHERE d.DepositoId=${v.depositoId} AND d.Ativo=1 AND ${scope(actor)}`)).length) throw new PlanningError('DEPOSITO_INDISPONIVEL', 403);
    const rows = await db.query(`DECLARE @d date='${v.date}',@i datetime2(0)='${v.start}:00',@f datetime2(0)='${v.end}:00',@desc nvarchar(500)=${nvarcharLiteral(v.description,500)};
      EXEC Operacao.sp_CriarAtividadePlanejada @GestorUsuarioId=${intLiteral(actor)},@DepositoId=${v.depositoId},@TipoServicoId=${v.tipoServicoId},@DataServico=@d,@InicioPrevisto=@i,@FimPrevisto=@f,@Descricao=@desc;`);
    return {atividadeId: rows[0]?.AtividadeId};
  });
}
export async function addParticipant(cfg, actor, id, body) {
  if(cfg.pc04)throw new PlanningError('UTILIZE_CONTRATACOES_PC04',409);
  if (!body || Object.keys(body).sort().join(',') !== 'prestadorId,valorContratado') throw new PlanningError('CAMPOS_INVALIDOS');
  const provider = intLiteral(body.prestadorId), amount = money(body.valorContratado);
  return transaction(cfg, actor, 'atividades.criar', async db => {
    await activity(db, actor, id, true);
    if (!(await db.query(`SELECT a.AtividadeId FROM Operacao.Atividade a JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId JOIN Cadastro.TipoServico t ON t.TipoServicoId=a.TipoServicoId AND t.Ativo=1 WHERE a.AtividadeId=${intLiteral(id)}`)).length) throw new PlanningError('CADASTRO_INATIVO',409);
    if(cfg.pc03&&!(await db.query(`SELECT p.PrestadorId FROM Cadastro.Prestador p WITH(HOLDLOCK) JOIN Cadastro.PrestadorDeposito pf WITH(HOLDLOCK) ON pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL JOIN Cadastro.Deposito d ON d.DepositoId=pf.DepositoId JOIN Operacao.Atividade a ON a.DepositoId=d.DepositoId WHERE a.AtividadeId=${intLiteral(id)} AND p.PrestadorId=${provider} AND p.Ativo=1`)).length)throw new PlanningError('PRESTADOR_SEM_VINCULO_ATIVO',409);
    const rows = await db.query(`EXEC Operacao.sp_AdicionarParticipantePlanejado @GestorUsuarioId=${intLiteral(actor)},@AtividadeId=${intLiteral(id)},@PrestadorId=${provider},@ValorContratado=${amount};`);
    return {participacaoId: rows[0]?.ParticipacaoId};
  });
}
export async function evaluateParticipant(cfg, actor, id) {
  return transaction(cfg,actor,'atividades.visualizar',db=>evaluateParticipantDb(db,actor,id));
}
export async function evaluateParticipantDb(db,actor,id){
    const p = (await db.query(`SELECT AtividadeId FROM Operacao.Participacao WHERE ParticipacaoId=${intLiteral(id)}`))[0];
    if (!p) throw new PlanningError('PARTICIPACAO_INDISPONIVEL', 404);
    await activity(db, actor, p.AtividadeId);
    const row = (await db.query(`EXEC Operacao.sp_AvaliarLimiteContratacao @ParticipacaoId=${intLiteral(id)};`))[0];
    return {politicaId: row.PoliticaId, modo: row.Modo, limiteDias: row.LimiteDias, janelaDias: row.JanelaDias, diasContratados: row.DiasContratadosNaJanela, mesmoDia: sqlTrue(row.MesmoDiaJaContabilizado), dentroDoLimite: sqlTrue(row.DentroDoLimite), impactaConfirmadas:sqlTrue(row.ImpactaConfirmadas), politicaFuturaIndefinida:sqlTrue(row.PoliticaFuturaIndefinida), somenteAvaliacao: true};
}
