import {intLiteral} from './auth-db.js';
import {PlanningError,transaction,scope,activity,evaluateParticipant,evaluateParticipantDb,activityDetailDb} from './b3.js';
import {critical,sqlContractError,listExceptionsDb} from './b3-contracts.js';
function keys(body,expected){if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!==expected.split(',').sort().join(','))throw new PlanningError('CAMPOS_INVALIDOS');}
export function dateInput(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'2000-01-01'||s>'9998-12-31'||Number.isNaN(Date.parse(s+'T00:00Z'))||new Date(s+'T00:00Z').toISOString().slice(0,10)!==s)throw new PlanningError('DATA_INVALIDA');return s;}
export function intervalInput(body){
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)&&!Number.isNaN(Date.parse(s+':00Z'))&&new Date(s+':00Z').toISOString().slice(0,16)===s;
 if(!valid(body.inicio)||!valid(body.fim)||body.fim<=body.inicio)throw new PlanningError('PERIODO_INVALIDO');
 dateInput(body.inicio.slice(0,10));dateInput(body.fim.slice(0,10));
 return {prestadorId:intLiteral(body.prestadorId),depositoId:intLiteral(body.depositoId),inicio:body.inicio,fim:body.fim};
}
export function availabilityInput(body){keys(body,'prestadorId,depositoId,inicio,fim,estado,requisicaoId');const v=intervalInput(body);if(!['DISPONIVEL','INDISPONIVEL'].includes(body.estado)||typeof body.requisicaoId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.requisicaoId))throw new PlanningError('DISPONIBILIDADE_INVALIDA');return {...v,estado:body.estado,requisicaoId:body.requisicaoId};}
export function policyInput(body){keys(body,'modo,limiteDias,janelaDias,vigenteDesde,vigenteAte');if(body.modo!=='DIAS_CONTRATADOS')throw new PlanningError('DIAS_CORRIDOS_BLOQUEADO');if(!Number.isInteger(body.limiteDias)||!Number.isInteger(body.janelaDias)||body.limiteDias<1||body.janelaDias<body.limiteDias||body.janelaDias>36500)throw new PlanningError('POLITICA_INVALIDA');const start=dateInput(body.vigenteDesde),end=body.vigenteAte===null?null:dateInput(body.vigenteAte);if(end&&end<start)throw new PlanningError('POLITICA_INVALIDA');return {...body,vigenteDesde:start,vigenteAte:end};}
async function admin(db,actor){if(!(await db.query(`SELECT UsuarioId FROM Seguranca.Usuario WHERE UsuarioId=${intLiteral(actor)} AND Perfil='ADMIN' AND Ativo=1`)).length)throw new PlanningError('PERMISSAO_NEGADA',403);}
const impactSql=v=>`SELECT COUNT_BIG(*) AS Confirmadas FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA' AND a.DataServico>='${v.vigenteDesde}'${v.vigenteAte?` AND a.DataServico<='${v.vigenteAte}'`:''}`;
export async function listPolicies(cfg,actor){return transaction(cfg,actor,'limites.configurar',async db=>{await admin(db,actor);return {politicas:await db.query(`SELECT PoliticaId,Modo,LimiteDias,JanelaDias,CONVERT(varchar(10),VigenteDesde,23) VigenteDesde,CONVERT(varchar(10),VigenteAte,23) VigenteAte,CriadoPorAdminId,CONVERT(varchar(23),CriadoEmUtc,126) CriadoEmUtc FROM Operacao.PoliticaLimite ORDER BY VigenteDesde DESC`),historico:await db.query(`SELECT EntidadeId,Acao,AtorUsuarioId,CONVERT(varchar(23),DataHoraUtc,126) DataHoraUtc,DetalhesJson FROM Seguranca.Auditoria WHERE Entidade='PoliticaLimite' ORDER BY AuditoriaId DESC`)};});}
export async function policyImpact(cfg,actor,body){const v=policyInput(body);return transaction(cfg,actor,'limites.configurar',async db=>{await admin(db,actor);const affected=Number((await db.query(impactSql(v)))[0].Confirmadas);const overlaps=Number((await db.query(`SELECT COUNT(*) N FROM Operacao.PoliticaLimite WHERE VigenteDesde<=${v.vigenteAte?`'${v.vigenteAte}'`:`'9999-12-31'`} AND ISNULL(VigenteAte,'9999-12-31')>='${v.vigenteDesde}'`))[0].N);return {confirmadasAfetadas:affected,sobreposicoes:overlaps,bloqueado:affected>0||overlaps>0,analise:'Impacto estrutural: havendo confirmadas, alteracao historica indisponivel; nao simula uma nova regra de limite.'};});}
export async function createPolicy(cfg,actor,token,body){const v=policyInput(body);return critical(cfg,actor,token,async(db,hash)=>({resultado:await db.query(`DECLARE @d date='${v.vigenteDesde}',@f date=${v.vigenteAte?`'${v.vigenteAte}'`:'NULL'};EXEC Operacao.sp_CadastrarPoliticaLimite @AdminId=${intLiteral(actor)},@Modo='DIAS_CONTRATADOS',@LimiteDias=${v.limiteDias},@JanelaDias=${v.janelaDias},@VigenteDesde=@d,@VigenteAte=@f,@SessaoHash=${hash};`)}),{entity:'PoliticaLimiteSolicitacao',id:actor,action:'CRIAR_NEGADO'});}
async function checkDepot(db,actor,dep){if(!(await db.query(`SELECT d.DepositoId FROM Cadastro.Deposito d WHERE d.DepositoId=${dep} AND d.Ativo=1 AND ${scope(actor)}`)).length)throw new PlanningError('DEPOSITO_INDISPONIVEL',403);}
export async function informAvailability(cfg,actor,body){const v=availabilityInput(body);return transaction(cfg,actor,'atividades.criar',async db=>({resultado:await db.query(`DECLARE @i datetime2(0)='${v.inicio}:00',@f datetime2(0)='${v.fim}:00';EXEC Operacao.sp_InformarDisponibilidade @GestorId=${intLiteral(actor)},@PrestadorId=${v.prestadorId},@DepositoId=${v.depositoId},@Inicio=@i,@Fim=@f,@Estado='${v.estado}',@RequisicaoId='${v.requisicaoId}';`)}));}
export async function availabilityState(db,v,exclude='0'){
 const where=`PrestadorId=${v.prestadorId} AND DepositoId=${v.depositoId} AND Inicio<'${v.fim}:00' AND '${v.inicio}:00'<Fim`;
 const declarations=await db.query(`SELECT DisponibilidadeId,Estado,CONVERT(varchar(19),Inicio,126) Inicio,CONVERT(varchar(19),Fim,126) Fim,AtorUsuarioId,CONVERT(varchar(23),CriadoEmUtc,126) CriadoEmUtc FROM Operacao.DisponibilidadePrestador WHERE ${where} ORDER BY Inicio`);
 const conflict=(await db.query(`SELECT TOP(1) 1 N FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.PrestadorId=${v.prestadorId} AND p.ParticipacaoId<>${exclude} AND p.Status NOT IN ('CANCELADA','NAO_COMPARECEU') AND a.Status<>'CANCELADA' AND a.InicioPrevisto<'${v.fim}:00' AND '${v.inicio}:00'<a.FimPrevisto`)).length>0;
 const covered=declarations.some(r=>r.Estado==='DISPONIVEL'&&r.Inicio<=v.inicio+':00'&&r.Fim>=v.fim+':00');
 return {estado:conflict?'CONFLITO':declarations.some(r=>r.Estado==='INDISPONIVEL')?'INDISPONIVEL':covered?'DISPONIVEL':'NAO_INFORMADA',declaracoes:declarations};
}
export async function consultAvailability(cfg,actor,body){keys(body,'prestadorId,depositoId,inicio,fim');const v=intervalInput(body);return transaction(cfg,actor,'atividades.visualizar',async db=>{await checkDepot(db,actor,v.depositoId);return availabilityState(db,v);});}
export async function operationalState(cfg,actor,id){
 if(cfg.b34)return transaction(cfg,actor,'atividades.visualizar',db=>operationalStateDb(db,actor,id));
 return operationalStateParts(cfg,actor,id);
}
async function operationalStateParts(cfg,actor,id,sharedDb){
 const read=async db=>{
  const p=(await db.query(`SELECT p.AtividadeId,p.PrestadorId,p.Status,pr.Ativo FROM Operacao.Participacao p JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId WHERE p.ParticipacaoId=${intLiteral(id)}`))[0];if(!p)throw new PlanningError('PARTICIPACAO_INDISPONIVEL',404);
  const a=await activity(db,actor,p.AtividadeId);const service=(await db.query(`SELECT Ativo FROM Cadastro.TipoServico WHERE TipoServicoId=${intLiteral(a.TipoServicoId)}`))[0];
  const availability=await availabilityState(db,{prestadorId:intLiteral(p.PrestadorId),depositoId:intLiteral(a.DepositoId),inicio:a.InicioPrevisto.slice(0,16),fim:a.FimPrevisto.slice(0,16)},intLiteral(id));
  const permitted=Number((await db.query(`SELECT CONVERT(int,Seguranca.fn_Pode(${intLiteral(actor)},'atividades.confirmar')) N`))[0].N)===1&&String(a.GestorUsuarioId)===String(actor);
  return {contabilizada:['CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA'].includes(p.Status)&&a.Status!=='CANCELADA',disponibilidade:availability,impedimentos:[...(permitted?[]:['PERMISSAO_NEGADA']),...(Number(p.Ativo)?[]:['PRESTADOR_INATIVO']),...(Number(service?.Ativo)?[]:['SERVICO_INATIVO']),...(availability.estado==='DISPONIVEL'?[]:[availability.estado==='CONFLITO'?'CONFLITO_PERIODO':availability.estado==='INDISPONIVEL'?'PRESTADOR_INDISPONIVEL':'DISPONIBILIDADE_NAO_INFORMADA'])]};
 };
 const data=sharedDb?await read(sharedDb):await transaction(cfg,actor,'atividades.visualizar',read);
 if(sharedDb){const pol=(await sharedDb.query(`SELECT COUNT(*) N,MAX(pol.Modo) M FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Operacao.PoliticaLimite pol ON pol.VigenteDesde<=a.DataServico AND (pol.VigenteAte IS NULL OR pol.VigenteAte>=a.DataServico) WHERE p.ParticipacaoId=${intLiteral(id)}`))[0];if(Number(pol.N)!==1||pol.M!=='DIAS_CONTRATADOS'){data.impedimentos.push('POLITICA_INDISPONIVEL');return data;}}
 try{const e=sharedDb?await evaluateParticipantDb(sharedDb,actor,id):await evaluateParticipant(cfg,actor,id);const used=Number(e.diasContratados)+(data.contabilizada&&!e.mesmoDia?1:0);data.limite={...e,diasContratados:used,diasDaAvaliacao:e.diasContratados,diasDisponiveis:Math.max(0,e.limiteDias-used)};if(e.impactaConfirmadas||e.politicaFuturaIndefinida)data.impedimentos.push('IMPACTO_CONFIRMADAS_BLOQUEADO');if(!e.dentroDoLimite)data.impedimentos.push('LIMITE_EXIGE_EXCECAO');}catch(error){const mapped=sqlContractError(error);if(!['POLITICA_INDISPONIVEL','DIAS_CORRIDOS_BLOQUEADO'].includes(mapped.code))throw error;data.impedimentos.push('POLITICA_INDISPONIVEL');}
 if(sharedDb&&data.contabilizada)data.impedimentos=data.impedimentos.filter(k=>!['LIMITE_EXIGE_EXCECAO','IMPACTO_CONFIRMADAS_BLOQUEADO'].includes(k));
 if(sharedDb&&!data.contabilizada&&data.limite&&!data.limite.dentroDoLimite){
  const exception=(await sharedDb.query(`SELECT TOP(1) Status,CASE WHEN ExpiraEmUtc<=SYSUTCDATETIME() THEN 1 ELSE 0 END Expirada FROM Operacao.ExcecaoLimite WHERE ParticipacaoId=${intLiteral(id)} ORDER BY ExcecaoId DESC`))[0];
  if(exception){const state=exception.Status==='APROVADA'?(Number(exception.Expirada)?'EXCECAO_EXPIRADA':'EXCECAO_APROVADA_REVALIDAR'):exception.Status==='PENDENTE'?'AGUARDANDO_APROVACAO':'LIMITE_EXIGE_EXCECAO';data.excecao={estado:state==='EXCECAO_APROVADA_REVALIDAR'?'APROVADA_REVALIDAR':state};data.impedimentos=data.impedimentos.map(k=>k==='LIMITE_EXIGE_EXCECAO'?state:k);}
 }
 return data;
}

export const operationalStateDb=(db,actor,id)=>operationalStateParts(null,actor,id,db);
export async function consolidatedDetail(cfg,actor,id){return transaction(cfg,actor,'atividades.visualizar',async db=>{
 const result=await activityDetailDb({...cfg,b32:false},db,actor,id);
 for(const p of result.participacoes){p.Operacional=await operationalStateDb(db,actor,p.ParticipacaoId);p.SituacaoPlanejamento=p.Status;
  if(p.Status==='PLANEJADA'){const o=p.Operacional;p.SituacaoPlanejamento=o.impedimentos.includes('POLITICA_INDISPONIVEL')?'BLOQUEADA_POLITICA':o.limite?.impactaConfirmadas||o.limite?.politicaFuturaIndefinida?'BLOQUEADA_IMPACTO':o.limite&&!o.limite.dentroDoLimite?'BLOQUEADA_LIMITE':o.impedimentos.length?'BLOQUEADA_OPERACIONAL':'ELEGIVEL';}}
 result.excecoes=await listExceptionsDb(db,actor);result.consultaConsolidada=true;return result;
});}
