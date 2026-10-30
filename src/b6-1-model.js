import {PlanningError} from './b3.js';
import {validOriginals,hash} from './b4-3.js';
export const stages=Object.freeze(['CONTRATADO','EXECUTADO','CONFERIDO','FECHADO','PREVISTO_PARA_PROVISAO','BLOQUEADO','AUTORIZADO_FINANCEIRO']);
const fail=code=>{throw new PlanningError(code,409);};
export function cents(value){if(typeof value!=='string'||!/^\d{1,18}\.\d{2}$/.test(value))fail('VALOR_CONTRATUAL_INVALIDO');return BigInt(value.replace('.',''));}
export const decimal=value=>(value/100n)+'.'+(value%100n).toString().padStart(2,'0');
// Projeção gerencial apenas. Elegibilidade e decisão são consumidas dos motores B5 existentes.
export function provision(row,contract,authorization=null,proposal=null){
 const o=row.operacional,original=contract?.valor??null,verified=contract?.verificado===true;
 if(original!==null)cents(original);
 const reasons=[...row.elegibilidade.motivos];
 if(!verified)reasons.push('CONTRATO_BASELINE_NAO_VERIFICADO');
 if(original!==null&&row.valorContratualAtual!==original)reasons.push('VALOR_ATUAL_DIVERGE_CONTRATO_ORIGINAL');
 if(row.valorContratualHistorico!==null&&original!==row.valorContratualHistorico)reasons.push('SNAPSHOT_DIVERGE_CONTRATO_ORIGINAL');
 const contracted=o.participacao.statusContratacao==='CONFIRMADA'&&original!==null;
 const executed=validOriginals(o.horarios.originais),reviewed=o.conferencia?.Decisao==='CONFERIDO'&&!o.pendenciasImpeditivas.includes('CONFERENCIA_DESATUALIZADA');
 const closed=o.fechamento.estado==='FECHADO_REGULAR',blocked=reasons.length>0;
 const flags={CONTRATADO:contracted,EXECUTADO:executed,CONFERIDO:reviewed,FECHADO:closed,PREVISTO_PARA_PROVISAO:contracted&&verified&&!blocked&&row.elegibilidade.resultado==='CANDIDATA_AUTORIZACAO',BLOQUEADO:blocked,AUTORIZADO_FINANCEIRO:authorization?.estadoAtual==='APROVADA'};
 return {participacaoId:o.participacao.id,atividadeId:o.participacao.atividadeId,prestador:o.prestador,deposito:o.deposito,servico:o.servico,previsao:o.previsao,horarios:o.horarios.originais,conferencia:o.conferencia,fechamento:o.fechamento,ocorrencias:o.ocorrencias,valorContratado:original,contrato:contract,valorGerencial:flags.PREVISTO_PARA_PROVISAO?original:null,valorOriginalPreservado:original,valorAtualReferencia:row.valorContratualAtual,etapas:flags,situacoes:stages.filter(k=>flags[k]),pendencias:[...new Set(reasons)].sort(),autorizacao:authorization?{estado:authorization.estadoAtual,decisaoHistorica:authorization.decisao?.resultado??null,valorAutorizado:authorization.estadoAtual==='APROVADA'?authorization.valorHistorico:null} :{estado:'NAO_CONSULTADA_SEM_PERMISSAO',valorAutorizado:null},competencia:proposal?.competencia??{sugerida:null,efetiva:null,pendencias:['PROPOSTA_NAO_DETERMINADA']},vencimento:{proposto:null,efetivo:null,motivo:'SIMULACAO_EXIGE_POLITICA_E_MARCO_DECLARADOS',consulta:'/regras-financeiras.html'},identificacao:proposal?.contratacao?.dados?{nome:proposal.contratacao.dados.identificacao,tipo:proposal.contratacao.dados.tipoJuridico,documentoMascarado:'Final '+proposal.contratacao.dados.documentoContratado.slice(-4)}:null,origem:row.origem,versaoConsulta:row.versaoConsulta,financeiro:{natureza:'PROVISIONAMENTO_GERENCIAL_NAO_OBRIGACAO',liquido:null,tributos:null,retencoes:null,obrigacaoCriada:false,pagamentoRealizado:false,quitacaoRealizada:false}};
}
export function summarize(lines){
 const seen=new Set();for(const r of lines){if(seen.has(r.participacaoId))fail('PARTICIPACAO_DUPLICADA');seen.add(r.participacaoId);}
 const total=predicate=>decimal(lines.filter(r=>predicate(r)&&r.valorContratado!==null).reduce((sum,r)=>sum+cents(r.valorContratado),0n));
 const contracted=lines.filter(r=>r.etapas.CONTRATADO&&r.valorContratado!==null);
 const sums=Object.fromEntries(stages.map(k=>[k,{quantidade:lines.filter(r=>r.etapas[k]).length,valor:total(r=>r.etapas[k])}]));
 if(lines.some(r=>r.autorizacao.estado==='NAO_CONSULTADA_SEM_PERMISSAO'))sums.AUTORIZADO_FINANCEIRO={quantidade:null,valor:null,situacao:'NAO_CONSULTADA_SEM_PERMISSAO'};
 const grouped=key=>{const groups=new Map();for(const r of lines){const id=r[key].id;if(!groups.has(id))groups.set(id,{id,nome:r[key].nome,participacoes:0,contratado:0n,candidato:0n});const g=groups.get(id);g.participacoes++;if(r.etapas.CONTRATADO&&r.valorContratado!==null)g.contratado+=cents(r.valorContratado);if(r.etapas.PREVISTO_PARA_PROVISAO)g.candidato+=cents(r.valorGerencial);}return [...groups.values()].map(g=>({...g,contratado:decimal(g.contratado),candidato:decimal(g.candidato)}));};
 const sum=contracted.reduce((s,r)=>s+cents(r.valorContratado),0n),count=BigInt(contracted.length);
 return {participacoes:lines.length,prestadores:new Set(lines.map(r=>r.prestador.id)).size,valoresIndeterminados:lines.filter(r=>r.valorContratado===null).length,etapas:sums,custoMedioParticipacao:count?decimal((sum+count/2n)/count):null,baseMedia:'PARTICIPACOES_CONTRATADAS_COM_VALOR_ORIGINAL; ARREDONDAMENTO_GERENCIAL_CENTAVO',porDeposito:grouped('deposito'),porPrestador:grouped('prestador'),aviso:'Etapas cumulativas e sobrepostas. Não somar os totais entre etapas. Recorte completo limitado a 100 participações.'};
}
export function draftReceipt(line){
 const document={tipo:'MINUTA_RECIBO',aviso:'MINUTA - NÃO COMPROVA PAGAMENTO',numero:'MINUTA-'+hash([line.participacaoId,line.contrato?.versao,line.versaoConsulta]),participacaoId:line.participacaoId,prestador:line.prestador,identificacao:line.identificacao,deposito:line.deposito,servico:line.servico,dataExecucao:line.horarios.filter(e=>e.tipo==='ENTRADA'||e.tipo==='SAIDA'),dataPrevista:line.previsao.data,valorContratadoReferencia:line.valorContratado,bruto:null,retencoes:null,liquidoRecebido:null,dataPagamento:null,meioPagamento:null,comprovante:line.origem.comprovanteId,versaoComprovante:line.origem.versaoComprovante,contexto:line.versaoConsulta,pendencias:line.pendencias,assinatura:'Espaço reservado ao recebedor - minuta sem eficácia de quitação',reciboDefinitivo:false,quitacao:false,pagamentoConfirmado:false};
 return {...document,rastreabilidade:hash(document)};
}
