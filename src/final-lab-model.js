import {PlanningError,money} from './b3.js';
import {fields,date} from './b5-2b-model.js';
import {hash} from './b4-3.js';
import {cents,decimal} from './b5-3-f01-model.js';
export const schema='JETTA-FINAL-LAB-1.0.0';
export const aviso='SIMULAÇÃO DE LABORATÓRIO — NÃO É CONTA A PAGAR, PAGAMENTO, QUITAÇÃO OU ASSINATURA REAL';
export const fail=(code,status=409)=>{throw new PlanningError(code,status);};
export const text=(v,max=800)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('TEXTO_INVALIDO',400);return v.trim();};
export const id=v=>{if(typeof v!=='string'||! /^[1-9]\d{0,17}$/.test(v))fail('ID_INVALIDO',400);return v;};
export const transitions=Object.freeze({
 PROVISIONAR:{SEM_PROCESSO:'PROVISIONADO_GERENCIAL'},
 PROPOR_VALIDACAO:{PROVISIONADO_GERENCIAL:'PENDENTE_VALIDACAO',PENDENTE_VALIDACAO:'PENDENTE_VALIDACAO'},
 VALIDAR_CENARIO:{PENDENTE_VALIDACAO:'VALIDADO_LAB'},REJEITAR_VALIDACAO:{PENDENTE_VALIDACAO:'PROVISIONADO_GERENCIAL'},
 PREPARAR_OBRIGACAO:{VALIDADO_LAB:'OBRIGACAO_SIMULADA'},LIBERAR:{OBRIGACAO_SIMULADA:'LIBERADO_SIMULADO'},
 PROGRAMAR:{LIBERADO_SIMULADO:'PROGRAMADO_SIMULADO'},REGISTRAR_PAGAMENTO:{PROGRAMADO_SIMULADO:'PAGAMENTO_SIMULADO'}
});
export function transition(state,action){const next=transitions[action]?.[state];if(!next)fail('TRANSICAO_SIMULADA_INVALIDA');return next;}
export function packet(x){fields(x,'referenciaCenario,bruto,retencoes,liquido,regraFiscal,versaoVencimento,versaoAlcada,dataMarco,referenciaMarco');
 const r={...x,referenciaCenario:text(x.referenciaCenario,160)};
 for(const k of ['bruto','liquido'])r[k]=x[k]===null?null:money(x[k]);
 if(x.retencoes!==null){if(!Array.isArray(x.retencoes)||x.retencoes.length>10)fail('RETENCOES_INVALIDAS',400);r.retencoes=x.retencoes.map(v=>{fields(v,'descricao,valor');return {descricao:text(v.descricao,120),valor:money(v.valor)};});}
 if(x.regraFiscal!==null){fields(x.regraFiscal,'referencia,versao,natureza,aprovadaEmpresarialmente');if(x.regraFiscal.natureza!=='DADOS_FICTICIOS_SEM_ENQUADRAMENTO_TRIBUTARIO'||x.regraFiscal.aprovadaEmpresarialmente!==false)fail('SOMENTE_REGRA_FISCAL_SINTETICA',400);r.regraFiscal={...x.regraFiscal,referencia:text(x.regraFiscal.referencia,160),versao:text(x.regraFiscal.versao,80)};}
 r.versaoVencimento=x.versaoVencimento===null?null:id(x.versaoVencimento);r.versaoAlcada=x.versaoAlcada===null?null:id(x.versaoAlcada);if(x.dataMarco!==null)date(x.dataMarco);if(x.referenciaMarco!==null)r.referenciaMarco=text(x.referenciaMarco,160);
 return r;
}
export function packetReasons(x,original){const reasons=[];if(x.bruto===null||x.retencoes===null||x.liquido===null||!x.regraFiscal)reasons.push('APURACAO_FISCAL_SINTETICA_INCOMPLETA');if(x.bruto!==null&&x.bruto!==original)reasons.push('BRUTO_DIVERGE_AUTORIZADO_SEM_REGRA');if(x.bruto!==null&&x.retencoes!==null&&x.liquido!==null){const ret=x.retencoes.reduce((s,r)=>s+cents(r.valor),0n);if(ret>cents(x.bruto)||cents(x.bruto)-ret!==cents(x.liquido))reasons.push('VALORES_NAO_RECONCILIADOS');}if(!x.versaoVencimento||!x.dataMarco||!x.referenciaMarco)reasons.push('VENCIMENTO_SEM_POLITICA_OU_MARCO');return reasons;}
export function payment(x,liquid){fields(x,'data,meio,valor,referencia,anexoId');date(x.data);if(!['PIX_FICTICIO','TRANSFERENCIA_FICTICIA','DINHEIRO_FICTICIO','SIMULACAO_MANUAL'].includes(x.meio))fail('MEIO_SOMENTE_SIMULADO',400);if(!/^LAB-[A-Za-z0-9_-]{3,100}$/.test(x.referencia))fail('REFERENCIA_DEVE_SER_LAB',400);const valor=money(x.valor);if(valor!==liquid)fail('PAGAMENTO_PARCIAL_OU_DIVERGENTE_FORA_ESCOPO');return {...x,valor,anexoId:id(x.anexoId)};}
export function receiptContent({process,source,packet:p,kind,number,paid,previous=null}){
 if(!['MINUTA','PREPARADO_PARA_ASSINATURA','EMITIDO_APOS_PAGAMENTO'].includes(kind))fail('TIPO_RECIBO_INVALIDO',400);
 if(kind==='EMITIDO_APOS_PAGAMENTO'&&!paid)fail('PAGAMENTO_SIMULADO_CONFIRMADO_OBRIGATORIO');
 const isPaid=kind==='EMITIDO_APOS_PAGAMENTO';
 const result={schema,simulado:true,aviso,numero:number,tipo:kind,anteriorId:previous,participacaoId:source.participacaoId,atividadeId:source.atividadeId,deposito:source.deposito,prestador:source.prestador,beneficiario:source.beneficiario,servico:source.servico,execucao:source.horarios,comprovante:source.origem,valorContratado:source.valorContratado,brutoSimulado:p?.bruto??null,retencoesSimuladas:p?.retencoes??null,liquidoRecebidoSimulado:isPaid?paid.valor:null,dataPagamentoSimulado:isPaid?paid.data:null,meioPagamentoSimulado:isPaid?paid.meio:null,declaracao:isPaid?'CENÁRIO FICTÍCIO: recebimento referente a pagamento SIMULADO registrado. NÃO comprova recebimento real, pagamento ou quitação.':'Documento de conferência/ciência. Nenhuma declaração de recebimento, pagamento ou quitação.',assinatura:'Espaço reservado à assinatura SINTÉTICA; sem autenticidade jurídica presumida',pagamentoReal:false,quitacaoReal:false,assinaturaReal:false,contexto:process.contexto};
 return {...result,rastreabilidade:hash(result)};
}
