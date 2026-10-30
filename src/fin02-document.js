// FIN02 document layout follows recibos/MODELO DE RECIBO.docx. Values come
// from the issuance snapshot; legacy depot identification is supplied by the reader.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>String(value).split('-').reverse().join('/');
const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function renderReceipt(receipt){
 const s=receipt.Snapshot,[year,month,day]=receipt.DataEmissao.split('-');
 const street=[s.Rua,s.NumeroEndereco].filter(Boolean).join(', ');
 const locality=[s.Cidade,s.Estado].filter(Boolean).join('/');
 const postal=String(s.CEP??'').replace(/^(\d{5})(\d{3})$/,'$1-$2');
 const header=[s.Deposito,s.CentroCusto?'Centro de custo: '+s.CentroCusto:'',street,[s.Bairro,locality].filter(Boolean).join(' — '),postal?'CEP '+postal:''].filter(Boolean).map(escape).join('<br>');
 const value=String(s.ValorLiberado).replace(/\B(?=(\d{3})+(?!\d))/g,'.').replace(/\.(\d{2})$/,',$1');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo — contratação ${escape(s.Numero)}</title><style>
 @page{size:A4;margin:20mm 30mm}*{box-sizing:border-box}html{background:#eee;color:#000}body{margin:0;font-family:Calibri,Arial,sans-serif;font-size:16pt;line-height:1.35}.receipt{max-width:210mm;min-height:297mm;margin:24px auto;padding:25mm 30mm;background:#fff;overflow-wrap:anywhere}.cost{text-align:right;font-size:10pt;margin:0 0 6mm}h1{text-align:center;font-size:16pt;margin:0 0 9mm}p{margin:0 0 4mm;text-align:justify}.manual{display:inline-block;border-bottom:1px solid #000;vertical-align:baseline;height:1.2em}.place{margin-top:10mm;margin-bottom:12mm;text-align:left}.receiver{font-size:14pt;margin-bottom:9mm}.name{display:block;margin-top:5mm;font-size:16pt;min-height:10mm;border-bottom:1px solid #000}.signature{font-size:14pt;margin-bottom:7mm}.signature .manual{display:block;width:100%;height:10mm;margin-top:1mm}.cpf{font-size:14pt}.cpf .manual{width:75mm;max-width:100%;height:10mm}h1,p,.receiver,.signature,.cpf{break-inside:avoid}@media print{html,body{background:#fff}.receipt{max-width:none;min-height:0;margin:0;padding:0}}@media screen and (max-width:820px){.receipt{margin:0;min-height:100vh;padding:24px;font-size:14pt}}
 </style></head><body><main class="receipt"><div class="cost">${header}</div><h1>RECIBO — Contratação ${escape(s.Numero)}</h1>
 <p>Recebi da <strong>${escape(s.Pagador)}</strong>, possuidora do CNPJ ${escape(s.CnpjPagador)}, o valor de R$ ${escape(value)}, referente a prestação de serviço de ${escape(s.Tipo)}, realizado na data de ${escape(date(s.DataServico))}.</p>
 <p>O serviço foi contratado de forma esporádica, conforme negociação entre as partes.</p>
 <p>Sendo assim, declaro estar satisfeita e de acordo com o valor, dou total, geral e irrevogável quitação, não restando nada a reclamar em juízo ou fora dele.</p>
 <p class="place">${escape(s.Cidade)}/${escape(s.Estado)}, ${escape(Number(day))} de ${months[Number(month)-1]} de ${escape(year)}</p>
 <div class="receiver">Nome por extenso do(a) recebedor(a)<span class="name">${escape(s.Prestador)}</span></div>
 <div class="signature">Assinatura do(a) recebedor(a)<span class="manual" data-manual="assinatura" aria-label="Assinatura manual"></span></div>
 <div class="cpf">CPF do(a) recebedor(a) <span class="manual" data-manual="cpf" aria-label="CPF para preenchimento manual"></span></div>
 </main></body></html>`;
}
