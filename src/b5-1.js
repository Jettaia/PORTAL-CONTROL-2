import {intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {PlanningError} from './b3.js';
import {tx,lock,explicit,assertMfa} from './b4.js';
import {context,input,uuid} from './b4-2.js';
import {data,record,closingView,hash,json} from './b4-3.js';
import {workbook} from './b5-xlsx.js';
const fail=(code,status=409)=>{throw new PlanningError(code,status);};
const MAX_ROWS=100;
function enabled(cfg){if(cfg.b51!==true||cfg.b43!==true)fail('B51_INDISPONIVEL',404);}
export function financialScope(actor,alias='d'){return `EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${n(actor)} AND ud.DepositoId=${alias}.DepositoId AND ud.RevogadoEmUtc IS NULL)`;}
export async function financialAuthorize(db,actor,permission,depot){
 if(!(await db.query(`SELECT 1 V FROM Seguranca.Usuario u WHERE u.UsuarioId=${n(actor)} AND u.Ativo=1 AND u.Perfil='FINANCEIRO' AND ${explicit(actor,permission)}`)).length)fail('PERMISSAO_FINANCEIRA_NEGADA',403);
 if(depot!==undefined&&!(await db.query(`SELECT 1 V FROM Cadastro.Deposito d WHERE d.DepositoId=${n(depot)} AND ${financialScope(actor)}`)).length)fail('ABRANGENCIA_FINANCEIRA_NEGADA',403);
}
export function filters(value={}){
 if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['filialId','depositoId','prestadorId','servicoId','inicio','fim','situacao','pendencia'].includes(k)))fail('FILTROS_INVALIDOS',400);
 const result={};for(const [key,v]of Object.entries(value)){if(typeof v!=='string')fail('FILTROS_INVALIDOS',400);if(v==='')continue;
  if(key.endsWith('Id')){try{if(!/^[1-9]\d*$/.test(v))fail('FILTROS_INVALIDOS',400);result[key]=n(v);}catch{fail('FILTROS_INVALIDOS',400);}}
  else if(['inicio','fim'].includes(key)){if(!/^\d{4}-\d\d-\d\d$/.test(v)||Number(v.slice(0,4))<2000||Number(v.slice(0,4))>9998||Number.isNaN(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('PERIODO_INVALIDO',400);result[key]=v;}
  else if(key==='situacao'){if(!['CANDIDATA_AUTORIZACAO','BLOQUEADA','NAO_FECHADO','FECHADO_REGULAR','FECHADO_DESATUALIZADO'].includes(v))fail('SITUACAO_INVALIDA',400);result[key]=v;}
  else{if(!['COM','SEM'].includes(v))fail('PENDENCIA_INVALIDA',400);result[key]=v;}
 }if(result.inicio&&result.fim&&result.inicio>result.fim)fail('PERIODO_INVALIDO',400);return result;
}
export function eligibility(contract,{proofExists,proofIntegrity,contractVersion='1.0.0',active=true}={}){
 const reasons=[...contract.pendenciasImpeditivas];
 if(contract.fechamento.estado==='NAO_FECHADO')reasons.push('FECHAMENTO_AUSENTE');
 if(contract.fechamento.resultado&&contract.fechamento.resultado!=='FECHADO_REGULAR')reasons.push('FECHAMENTO_NAO_REGULAR');
 if(contract.fechamento.estado==='FECHADO_DESATUALIZADO')reasons.push('CONTEXTO_DESATUALIZADO');
 if(!proofExists)reasons.push('COMPROVANTE_AUSENTE');
 if(!proofIntegrity)reasons.push('COMPROVANTE_INTEGRO_INVALIDO');
 if(proofExists&&contractVersion!=='1.0.0')reasons.push('CONTRATO_NAO_SUPORTADO');
 if(!active)reasons.push('CADASTRO_OU_ATIVIDADE_INATIVA');
 const motivos=[...new Set(reasons)].sort();return {regrasVersao:'B5.1-1.0.0',resultado:motivos.length?'BLOQUEADA':'CANDIDATA_AUTORIZACAO',motivos,autorizaPagamento:false,criaObrigacao:false};
}
async function scopedMeta(db,actor,id){const row=(await db.query(`SELECT p.ParticipacaoId,a.DepositoId,(SELECT CONVERT(varchar(36),value) FROM sys.extended_properties WHERE class=0 AND name='JETTA_LAB_RECOVERY_EPOCH') RecoveryEpoch,CASE WHEN a.Status<>'CANCELADA' AND d.Ativo=1 AND f.Ativo=1 AND pr.Ativo=1 AND ts.Ativo=1 THEN 1 ELSE 0 END CadastrosAtivos FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId JOIN Cadastro.Filial f ON f.FilialId=d.FilialId JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId JOIN Cadastro.TipoServico ts ON ts.TipoServicoId=a.TipoServicoId WHERE p.ParticipacaoId=${n(id)} AND ${financialScope(actor)}`))[0];if(!row)fail('PARTICIPACAO_FINANCEIRA_INDISPONIVEL',403);return row;}
export async function rowDb(db,actor,id,{readOnly=false}={}){
 const meta=await scopedMeta(db,actor,id);await lock(db,'P'+n(id),readOnly?'Shared':'Exclusive');const p=await context(db,id,true,readOnly),current=await data(db,p),version=hash(current),closed=await record(db,id);
 let proof=null,integrity=true;if(closed){try{proof=JSON.parse(closed.ConteudoJson);integrity=hash(closed.ConteudoJson)===closed.ConteudoHash&&proof.schemaVersao==='1.0.0'&&proof.dados.schemaVersao==='1.0.0'&&proof.versaoDados===closed.VersaoDados&&proof.comprovanteId.toLowerCase()===String(closed.ComprovanteId).toLowerCase()&&String(proof.fechamento.id)===String(closed.FechamentoId);}catch{integrity=false;}}
 const operational={...current,versaoDados:version,fechamento:closingView(closed,version),podeFechar:!closed&&!current.pendenciasImpeditivas.length};
 const decision=eligibility(operational,{proofExists:!!closed,proofIntegrity:integrity,contractVersion:proof?.schemaVersao,active:Number(meta.CadastrosAtivos)===1});
 const sqlReasons=(await db.query(`/*JETTA:FIN_ELIGIBILITY*/ DECLARE @pendenciasJson nvarchar(max)=${s(json(current.pendenciasImpeditivas),'max')};EXEC sys.sp_executesql N'/*JETTA:FIN_ELIGIBILITY*/ SELECT Motivo FROM Financeiro.fn_ElegibilidadePreFinanceira(@participacao,@versao,@pendencias,@integro) ORDER BY Motivo',N'@participacao bigint,@versao char(64),@pendencias nvarchar(max),@integro bit',@participacao=${n(id)},@versao='${version}',@pendencias=@pendenciasJson,@integro=${integrity?1:0}`)).map(r=>r.Motivo).sort();
 if(json(sqlReasons)!==json(decision.motivos)){decision.motivos=[...new Set([...decision.motivos,...sqlReasons,'DIVERGENCIA_MOTOR_ELEGIBILIDADE'])].sort();decision.resultado='BLOQUEADA';}
 const result={referencia:'PF-'+String(p.ParticipacaoId),origem:{contrato:'B5 1.0.0',participacaoId:String(p.ParticipacaoId),fechamentoId:closed?String(closed.FechamentoId):null,comprovanteId:closed?.ComprovanteId||null,versaoComprovante:closed?.VersaoDados||null,conteudoHash:closed?.ConteudoHash||null,integridade:integrity},operacional:operational,valorContratualHistorico:closed&&integrity?proof.dados.valorContratual.valor:null,valorContratualAtual:current.valorContratual.valor,elegibilidade:decision,referenciaFinanceira:'PRE_FINANCEIRA_SEM_OBRIGACAO',pagamentoRealizado:false};
 result.versaoConsulta=hash({recoveryEpoch:meta.RecoveryEpoch||null,versaoDados:version,fechamento:operational.fechamento,origem:result.origem,elegibilidade:decision});
 const last=(await db.query(`SELECT TOP(1) AvaliacaoId,AtorId,Resultado,VersaoConsulta,AuditoriaId,CONVERT(varchar(23),CriadoUtc,126) CriadoUtc FROM Financeiro.AvaliacaoCarteira WHERE ParticipacaoId=${n(id)} ORDER BY AvaliacaoId DESC`))[0];
 result.ultimaAvaliacao=last?{id:String(last.AvaliacaoId),atorId:String(last.AtorId),resultado:last.Resultado,criadoUtc:last.CriadoUtc+'Z',auditoriaId:String(last.AuditoriaId),desatualizada:last.VersaoConsulta!==result.versaoConsulta}:null;
 return result;
}
async function audit(db,actor,id,action,details){return (await db.query(`DECLARE @ids TABLE(AuditoriaId bigint);INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) OUTPUT inserted.AuditoriaId INTO @ids VALUES(N'CarteiraPreFinanceira',${id?n(id):'NULL'},${s(action,40)},${n(actor)},${s(json({bloco:'B5.1',...details}),'max')});SELECT AuditoriaId FROM @ids;`))[0].AuditoriaId;}
export async function walletDetail(cfg,actor,id){enabled(cfg);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');return rowDb(db,actor,id);});}
function total(rows,predicate){let cents=0n;for(const row of rows.filter(predicate)){const value=row.valorContratualHistorico;if(value===null)continue;const [whole,fraction='']=value.split('.');cents+=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));}return (cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0');}
async function walletDb(db,actor,filter){
 if(filter.depositoId)await financialAuthorize(db,actor,'financeiro.carteira.consultar',filter.depositoId);
 if(filter.filialId&&!(await db.query(`SELECT 1 V FROM Cadastro.Deposito d WHERE d.FilialId=${n(filter.filialId)} AND ${financialScope(actor)}`)).length)fail('ABRANGENCIA_FINANCEIRA_NEGADA',403);
 const conditions=[financialScope(actor),"(p.Status='CONFIRMADA' OR EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao fe WHERE fe.ParticipacaoId=p.ParticipacaoId))"];
 for(const[key,column]of [['filialId','d.FilialId'],['depositoId','d.DepositoId'],['prestadorId','p.PrestadorId'],['servicoId','a.TipoServicoId']])if(filter[key])conditions.push(column+'='+n(filter[key]));
 if(filter.inicio)conditions.push('a.DataServico>='+s(filter.inicio));if(filter.fim)conditions.push('a.DataServico<='+s(filter.fim));
 const ids=await db.query(`SELECT TOP(${MAX_ROWS+1}) p.ParticipacaoId FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId WHERE ${conditions.join(' AND ')} ORDER BY p.ParticipacaoId`);if(ids.length>MAX_ROWS)fail('CONSULTA_EXIGE_FILTRO',422);
 // Acquire the complete bounded set before reading shared audit/history ranges.
 for(const {ParticipacaoId:id}of ids)await lock(db,'P'+n(id));
 const rows=[];for(const {ParticipacaoId:id}of ids){const row=await rowDb(db,actor,id);if(filter.situacao&&![row.elegibilidade.resultado,row.operacional.fechamento.estado].includes(filter.situacao))continue;if(filter.pendencia==='COM'&&!row.elegibilidade.motivos.length||filter.pendencia==='SEM'&&row.elegibilidade.motivos.length)continue;rows.push(row);}
 const utc=(await db.query('SELECT CONVERT(varchar(23),SYSUTCDATETIME(),126) U'))[0].U+'Z';
 return {schemaVersao:'B5.1-1.0.0',consultadoUtc:utc,filtros:filter,linhas:rows,indicadores:{participacoes:rows.length,candidatas:rows.filter(r=>r.elegibilidade.resultado==='CANDIDATA_AUTORIZACAO').length,bloqueadas:rows.filter(r=>r.elegibilidade.resultado==='BLOQUEADA').length,valorContratualHistorico:total(rows,()=>true),valorCandidato:total(rows,r=>r.elegibilidade.resultado==='CANDIDATA_AUTORIZACAO')},pagamentoAprovado:false,obrigacaoCriada:false,limiteTecnico:MAX_ROWS};
}
export async function wallet(cfg,actor,query){enabled(cfg);const filter=filters(query);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');return walletDb(db,actor,filter);});}
export async function financeCatalog(cfg,actor){enabled(cfg);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');const deposits=await db.query(`SELECT d.DepositoId,d.Nome,d.FilialId,f.Nome Filial FROM Cadastro.Deposito d JOIN Cadastro.Filial f ON f.FilialId=d.FilialId WHERE ${financialScope(actor)} ORDER BY d.DepositoId`);const rows=await db.query(`SELECT DISTINCT pr.PrestadorId,pr.Nome Prestador,ts.TipoServicoId,ts.Nome Servico FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId JOIN Cadastro.TipoServico ts ON ts.TipoServicoId=a.TipoServicoId WHERE ${financialScope(actor)}`);return {depositos:deposits,referencias:rows};});}
export async function evaluate(cfg,actor,token,id,body){enabled(cfg);input(body,'versaoConsulta,requisicaoId');uuid(body.requisicaoId);if(typeof body.versaoConsulta!=='string'||!/^[a-f0-9]{64}$/.test(body.versaoConsulta))fail('VERSAO_INVALIDA',400);const command=hash([String(id),body.versaoConsulta]);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');await financialAuthorize(db,actor,'financeiro.elegibilidade.analisar');await assertMfa(db,actor,token);await lock(db,'B51-ESCRITA-AUDITADA');const row=await rowDb(db,actor,id);
 const old=(await db.query(`SELECT AvaliacaoId,ParticipacaoId,ComandoHash,VersaoConsulta FROM Financeiro.AvaliacaoCarteira WHERE AtorId=${n(actor)} AND RequisicaoId='${body.requisicaoId}'`))[0];if(old){if(old.ComandoHash!==command||String(old.ParticipacaoId)!==String(id))fail('REQUISICAO_REUTILIZADA');return {avaliacaoId:String(old.AvaliacaoId),repeticao:true,desatualizada:old.VersaoConsulta!==row.versaoConsulta,elegibilidadeAtual:row.elegibilidade,pagamentoAprovado:false};}
 if(row.versaoConsulta!==body.versaoConsulta)fail('CONTEXTO_ALTERADO');
 await db.query(`IF NOT EXISTS(SELECT 1 FROM Financeiro.ReferenciaCarteira WHERE ParticipacaoId=${n(id)}) INSERT Financeiro.ReferenciaCarteira(ParticipacaoId,Referencia,CriadoPor) VALUES(${n(id)},${s(row.referencia,64)},${n(actor)})`);
 const auditId=await audit(db,actor,id,'ELEGIBILIDADE_AVALIADA',{versaoConsulta:row.versaoConsulta,resultado:row.elegibilidade.resultado,versaoComprovante:row.origem.versaoComprovante});
 const r=(await db.query(`INSERT Financeiro.AvaliacaoCarteira(ParticipacaoId,AtorId,RequisicaoId,ComandoHash,Resultado,RegrasVersao,VersaoDados,VersaoConsulta,FechamentoId,ComprovanteId,VersaoComprovante,MotivosJson,AuditoriaId) OUTPUT inserted.AvaliacaoId VALUES(${n(id)},${n(actor)},'${body.requisicaoId}','${command}','${row.elegibilidade.resultado}','B5.1-1.0.0','${row.operacional.versaoDados}','${row.versaoConsulta}',${row.origem.fechamentoId?n(row.origem.fechamentoId):'NULL'},${row.origem.comprovanteId?"'"+row.origem.comprovanteId+"'":'NULL'},${row.origem.versaoComprovante?"'"+row.origem.versaoComprovante+"'":'NULL'},${s(json(row.elegibilidade.motivos),'max')},${n(auditId)})`))[0];
 return {avaliacaoId:String(r.AvaliacaoId),repeticao:false,elegibilidadeAtual:row.elegibilidade,pagamentoAprovado:false,obrigacaoCriada:false};});}
export async function financialReceipt(cfg,actor,id){enabled(cfg);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');const row=await rowDb(db,actor,id);if(!row.origem.comprovanteId)fail('COMPROVANTE_INDISPONIVEL',404);if(!row.origem.integridade)fail('COMPROVANTE_INTEGRO_INVALIDO');const stored=await record(db,id);return {documento:JSON.parse(stored.ConteudoJson),conteudoHash:stored.ConteudoHash,dadosAlterados:row.operacional.versaoDados!==row.origem.versaoComprovante,assinaturaDigital:false,reciboFinanceiro:false};});}
export async function exportWallet(cfg,actor,query){enabled(cfg);const filter=filters(query);return tx(cfg,async db=>{await financialAuthorize(db,actor,'financeiro.carteira.consultar');await financialAuthorize(db,actor,'financeiro.carteira.exportar');await lock(db,'B51-ESCRITA-AUDITADA');const portfolio=await walletDb(db,actor,filter);const auditId=await audit(db,actor,null,'CARTEIRA_EXPORTADA',{filtros:filter,quantidade:portfolio.linhas.length,versoesHash:hash(portfolio.linhas.map(r=>[r.referencia,r.versaoConsulta]))});return {buffer:workbook(portfolio,String(auditId)),auditoriaId:String(auditId),quantidade:portfolio.linhas.length};});}
