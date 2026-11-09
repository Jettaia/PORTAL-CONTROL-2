import {formatProviderDocument} from './document-format.js';
import fs from 'node:fs';
import {PlanningError} from './b3.js';

const escape=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>{const [whole,fraction='00']=String(value).split('.');return 'R$ '+whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction;};
const date=value=>value?String(value).split('-').reverse().join('/'):'—';
let rendering=false;

export function contractReportHtml(report,options={}){
 const logo=fs.readFileSync(new URL('../public/jetta-logo-integrado.png',import.meta.url)).toString('base64');
 const title=options.title||'Relatório de contratações';
 const headers=options.headers||['Número','Prestador','CPF/CNPJ do prestador','Depósito','Centro de custo','Gestor responsável','Data do serviço','Valor (R$)','Situação'];
 const rows=report.registros.map(r=>'<tr>'+(options.row?options.row(r):[r.Numero,r.Prestador,formatProviderDocument(r.CPF),r.Deposito,r.CentroCusto,r.GestorResponsavel,date(r.DataServico),money(r.Valor),r.Status]).map((value,index)=>'<td'+(index===(options.moneyIndex??7)?' class="money"':'')+'>'+escape(value)+'</td>').join('')+'</tr>').join('');
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'"><title>'+escape(title)+'</title><style>'+`
 @page{size:A4 landscape;margin:12mm 12mm 16mm}*{box-sizing:border-box}body{margin:0;color:#17324d;background:white;font:9pt 'Segoe UI',Arial,sans-serif}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #ed8b36;padding-bottom:10px;margin-bottom:12px;gap:18px}header img{width:110px;height:52px;object-fit:contain}h1{font-size:18pt;margin:0 0 4px;color:#123656}header p{margin:0;font-size:9pt}.meta{margin:7px 0;line-height:1.4;overflow-wrap:anywhere}.summary{padding:8px 10px;background:#eef3f8;border-left:3px solid #ed8b36;margin:9px 0 12px;font-weight:600}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt}thead{display:table-header-group}th{background:#123656;color:white;text-align:left;font-weight:600}th,td{padding:7px 6px;border:1px solid #d5dfe8;vertical-align:top;overflow-wrap:anywhere;word-break:normal}tbody tr:nth-child(even){background:#f4f7fb}tr{break-inside:avoid}.money{text-align:right}${(options.headers?[6,19,13,12,17,10,12,11]:[6,15,13,11,11,14,10,10,10]).map((width,index)=>`col:nth-child(${index+1}){width:${width}%}`).join('')}.empty{text-align:center;padding:18px}footer{font-size:8pt;margin-top:10px;color:#475569}
 `+'</style></head><body><header><div><h1>'+escape(title)+'</h1><p>JETTA CONTROL · Jetta Transportes</p></div><img alt="Jetta Transportes" src="data:image/png;base64,'+logo+'"></header><p class="meta">Gerado em: '+escape(report.geradoEm)+'</p><p class="meta">Filtros: '+escape(report.filtrosTexto)+'</p><div class="summary">Quantidade: '+report.quantidade+' · Total dos valores da tabela: '+escape(money(report.total))+'</div><table><colgroup>'+headers.map(()=>'<col>').join('')+'</colgroup><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+headers.length+'" class="empty">Nenhuma contratação encontrada para os filtros informados.</td></tr>')+'</tbody></table><footer>Visão dos registros autorizados para o usuário no momento da exportação.</footer></body></html>';
}

export async function contractReportPdf(loadReport,options={}){
 if(rendering)throw new PlanningError('EXPORTACAO_PDF_OCUPADA',503);
 rendering=true;let server,timer,cancelled=false;
 try{
  const work=(async()=>{
   const report=await loadReport();if(cancelled)throw new PlanningError('EXPORTACAO_PDF_INDISPONIVEL',503);const {chromium}=await import('playwright');
   const launched=await chromium.launchServer({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,host:'127.0.0.1',timeout:10000});if(cancelled){await launched.kill();throw new PlanningError('EXPORTACAO_PDF_INDISPONIVEL',503);}server=launched;
   const browser=await chromium.connect(server.wsEndpoint()),context=await browser.newContext({javaScriptEnabled:false});
   await context.route('**/*',route=>route.abort());
   const page=await context.newPage();await page.setContent(options.renderHtml?options.renderHtml(report):contractReportHtml(report,options),{waitUntil:'load',timeout:15000});
   const buffer=await page.pdf({format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<div></div>',footerTemplate:'<div style="font:8px Arial;color:#475569;width:100%;text-align:right;padding-right:45px">Jetta · '+escape(options.footerTitle||'Relatório de contratações')+' · Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>'});
   return {buffer,report};
  })();
  return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new PlanningError('EXPORTACAO_PDF_INDISPONIVEL',503)),45000);})]);
 }catch(error){if(error.status)throw error;throw new PlanningError('EXPORTACAO_PDF_INDISPONIVEL',503);}
 finally{cancelled=true;clearTimeout(timer);try{await server?.kill();}finally{rendering=false;}}
}
