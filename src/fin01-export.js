import {contractsWorkbook} from './pc04-export-xlsx.js';
import {contractReportHtml,contractReportPdf} from './pc04-export-pdf.js';
const headers=['Número','Prestador','Depósito','Atividade','Data do serviço','Valor liberado (R$)','Liberação (Brasília)','Situação'];
const labels={AGUARDANDO_PAGAMENTO:'Aguardando pagamento',RECIBO_GERADO:'Recibo gerado',PAGO:'Pago'};
function released(value){if(!value)return '—';const instant=new Date(String(value).slice(0,23)+'Z');return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(instant).replace(',','');}
const prepare=report=>({...report,registros:report.registros.map(r=>({...r,Liberacao:released(r.LiberadoEmUtc),SituacaoTexto:labels[r.Situacao]||r.Situacao}))});
const options={title:'Relatório financeiro de contratações',headers,sheetName:'Financeiro',fields:['Numero','Prestador','Deposito','Tipo','DataServico','ValorLiberado','Liberacao','SituacaoTexto'],dateTimeField:'Liberacao',moneyField:'ValorLiberado',moneyIndex:5,row:r=>[r.Numero,r.Prestador,r.Deposito,r.Tipo,r.DataServico?r.DataServico.split('-').reverse().join('/'):'—','R$ '+String(r.ValorLiberado).replace(/\B(?=(\d{3})+(?!\d))/g,'.').replace(/\.(\d{2})$/,',$1'),r.Liberacao,r.SituacaoTexto]};
export const financeWorkbook=report=>contractsWorkbook(prepare(report),options);
export const financeReportHtml=report=>contractReportHtml(prepare(report),options);
export const financeReportPdf=load=>contractReportPdf(async()=>prepare(await load()),options);
