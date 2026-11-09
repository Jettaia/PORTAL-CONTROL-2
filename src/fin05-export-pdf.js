import fs from 'node:fs';
import {formatProviderDocument} from './document-format.js';
import {contractReportPdf} from './pc04-export-pdf.js';
const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>{const [whole,fraction='00']=String(value??'0.00').split('.');return 'R$ '+whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction;};
const day=value=>value?String(value).split('-').reverse().join('/'):'—';
const localDate=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const instant=value=>value?localDate.format(new Date(value+'Z')):'—';
const summary=(label,values)=>'<div class="totals"><strong>'+escape(label)+'</strong><span>Valor devido: '+escape(money(values.ValorDevido))+'</span><span>Valor pago: '+escape(money(values.ValorPago))+'</span><span>Saldo a pagar: '+escape(money(values.Saldo))+'</span></div>';
export function statementReportHtml(report){
 const pairs=new Map(),contracts=new Map();
 for(const person of report.prestadores){const key=String(person.DepositoId);if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(person);}
 for(const row of report.contratacoes){const key=row.DepositoId+':'+row.PrestadorId;if(!contracts.has(key))contracts.set(key,[]);contracts.get(key).push(row);}
 const headers=['Número','Data do serviço','Data de criação','Centro de custo','Atividade','Valor devido','Data do pagamento','Valor pago','Saldo a pagar'];
 let groups='';
 for(const depot of report.depositos){
  groups+='<section class="depot"><h2>Depósito: '+escape(depot.Deposito)+'</h2>';
  for(const person of pairs.get(String(depot.DepositoId))||[]){
   const context='Depósito: '+depot.Deposito+' · Prestador: '+person.Prestador+' · CPF/CNPJ: '+(formatProviderDocument(person.CPF)||'—');
   const records=contracts.get(depot.DepositoId+':'+person.PrestadorId)||[];
   groups+='<table><colgroup>'+[7,9,9,11,21,11,9,11,12].map(width=>'<col style="width:'+width+'%">').join('')+'</colgroup><thead><tr><th colspan="9" class="context">'+escape(context)+'<span class="quantity">Contratações: '+escape(person.QuantidadeContratacoes)+'</span></th></tr><tr>'+headers.map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>';
   for(const row of records){const cells=[row.Numero,day(row.DataServico),instant(row.DataCriacao),row.CentroCusto||'—',row.Atividade,money(row.ValorDevido),instant(row.DataPagamento),money(row.ValorPago),money(row.Saldo)];groups+='<tr>'+cells.map((value,i)=>'<td'+([5,7,8].includes(i)?' class="money"':'')+'>'+escape(value)+'</td>').join('')+'</tr>';}
   if(!records.length)groups+='<tr><td colspan="9" class="empty">Nenhuma contratação encontrada para os filtros informados.</td></tr>';
   groups+='<tr class="subtotal"><td colspan="5">Subtotal do prestador</td><td class="money">'+escape(money(person.ValorDevido))+'</td><td></td><td class="money">'+escape(money(person.ValorPago))+'</td><td class="money">'+escape(money(person.Saldo))+'</td></tr></tbody></table>';
  }
  groups+=summary('Total do depósito: '+depot.Deposito,depot)+'</section>';
 }
 if(!report.prestadores.length)groups='<p class="empty">Nenhum prestador encontrado para os filtros informados.</p>';
 const logo=fs.readFileSync(new URL('../public/jetta-logo-integrado.png',import.meta.url)).toString('base64');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'"><title>Extrato</title><style>'+`
 @page{size:A4 landscape;margin:12mm 12mm 16mm}*{box-sizing:border-box}body{margin:0;font:9pt 'Segoe UI',Arial,sans-serif;color:#17324d}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #ed8b36;padding-bottom:10px;gap:16px}header img{width:110px;height:52px;object-fit:contain}h1{margin:0;font-size:19pt;color:#123656}header p{margin:4px 0 0}.meta{line-height:1.4;overflow-wrap:anywhere}h2{font-size:12pt;color:#123656;margin:18px 0 8px;break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt;margin:10px 0}thead{display:table-header-group}th,td{padding:6px 5px;border:1px solid #d5dfe8;vertical-align:top;overflow-wrap:anywhere}th{background:#123656;color:white;text-align:left;font-weight:600}th.context{background:#eef3f8;color:#123656;border-top:2px solid #ed8b36;font-size:9pt;padding:9px}.quantity{display:block;margin-top:4px;font-size:8pt;font-weight:400}tbody tr:nth-child(even){background:#f4f7fb}tr{break-inside:avoid}.money{text-align:right;font-variant-numeric:tabular-nums}.subtotal{font-weight:600;background:#eef3f8}.totals{break-inside:avoid;display:flex;gap:12px;flex-wrap:wrap;padding:9px 10px;background:#eef3f8;margin:8px 0 14px;font-size:9pt}.totals strong{flex-basis:100%;color:#123656}.empty{padding:14px;text-align:center}footer{font-size:8pt;color:#475569;margin-top:12px}
 `+'</style></head><body><header><div><h1>Extrato</h1><p>JETTA CONTROL · Jetta Transportes</p></div><img alt="Jetta Transportes" src="data:image/png;base64,'+logo+'"></header><p class="meta">Gerado em: '+escape(report.geradoEm)+'</p><p class="meta">Filtros: '+escape(report.filtrosTexto)+'</p><p class="meta">Depósitos: '+report.depositos.length+' · Vínculos de prestadores: '+report.prestadores.length+' · Contratações: '+report.contratacoes.length+'</p>'+groups+summary('Total geral',report.totais)+'<footer>Visão dos registros autorizados para o usuário no momento da exportação.</footer></body></html>';
}
export const statementReportPdf=loadReport=>contractReportPdf(loadReport,{renderHtml:statementReportHtml,footerTitle:'Extrato'});
