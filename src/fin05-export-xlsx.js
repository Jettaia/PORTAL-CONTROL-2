import {zip} from './b5-xlsx.js';
import {formatProviderDocument} from './document-format.js';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const xml=value=>String(value??'').replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const text=(address,value,style=0)=>`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numeric=(address,value,style)=>`<c r="${address}" s="${style}"><v>${value}</v></c>`;
function moneyCell(address,value,style=5){
 const raw=String(value??'0.00'),significant=raw.replace('-','').replace('.','').replace(/^0+/,'').replace(/0+$/,''),canonical=raw.replace(/^(-?)0+(?=\d)/,'$1');
 const safe=/^-?\d+\.\d{2}$/.test(raw)&&significant.length<=15&&Number.isFinite(Number(raw))&&(Number(raw).toFixed(2)===canonical||(Number(raw)===0&&/^-?0\.00$/.test(canonical)));
 return safe?numeric(address,raw,style):text(address,raw,style===5?0:3);
}
function serial(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value??''))||value<'1900-01-01')return null;
 const time=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)return null;
 return (time-Date.UTC(1899,11,30))/86400000-(value<'1900-03-01'?1:0);
}
function dateCell(address,value,instant=false){
 if(!value)return text(address,'—');
 const day=instant?localDate.format(new Date(value+'Z')):value;
 const date=serial(day);return date===null?text(address,value):numeric(address,date,6);
}
export function statementWorkbook(report){
 const rows=[],merges=[];let r=0;
 const add=(cells,level=0,height=26)=>{r++;rows.push(`<row r="${r}" ht="${height}" customHeight="1"${level?` outlineLevel="${level}"`:''}>${cells(r)}</row>`);};
 const heading=(value,style=1,level=0)=>{add(n=>text('A'+n,value,style),level,32);merges.push(`A${r}:I${r}`);};
 const total=(label,values,level=0)=>add(n=>text('A'+n,label,3)+moneyCell('F'+n,values.ValorDevido,7)+moneyCell('H'+n,values.ValorPago,7)+moneyCell('I'+n,values.Saldo,7),level,28);
 heading('JETTA CONTROL · Extrato por depósito e prestador');heading('Gerado em: '+(report.geradoEm??''),0);heading('Filtros: '+(report.filtrosTexto??''),0);
 heading('Depósitos: '+report.depositos.length+' · Vínculos de prestadores: '+report.prestadores.length+' · Contratações: '+report.contratacoes.length,0);
 const pairs=new Map(),contracts=new Map();
 for(const person of report.prestadores){const key=String(person.DepositoId);if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(person);}
 for(const contract of report.contratacoes){const key=contract.DepositoId+':'+contract.PrestadorId;if(!contracts.has(key))contracts.set(key,[]);contracts.get(key).push(contract);}
 const headers=['Número da contratação','Data do serviço','Data de criação','Centro de custo','Descrição da atividade','Valor devido (R$)','Data do pagamento','Valor pago (R$)','Saldo a pagar (R$)'];
 for(const depot of report.depositos){
  heading('Depósito: '+depot.Deposito,2);
  for(const person of pairs.get(String(depot.DepositoId))||[]){
   add(n=>text('A'+n,'Prestador: '+person.Prestador,3)+text('D'+n,'CPF/CNPJ: '+(formatProviderDocument(person.CPF)||'—'),3)+text('G'+n,'Contratações: '+person.QuantidadeContratacoes,3),1,34);
   merges.push(`A${r}:C${r}`,`D${r}:F${r}`,`G${r}:I${r}`);
   add(n=>headers.map((label,i)=>text(String.fromCharCode(65+i)+n,label,4)).join(''),2,34);
   const records=contracts.get(depot.DepositoId+':'+person.PrestadorId)||[];
   for(const record of records)add(n=>text('A'+n,record.Numero)+dateCell('B'+n,record.DataServico)+dateCell('C'+n,record.DataCriacao,true)+text('D'+n,record.CentroCusto||'—')+text('E'+n,record.Atividade)+moneyCell('F'+n,record.ValorDevido)+dateCell('G'+n,record.DataPagamento,true)+moneyCell('H'+n,record.ValorPago)+moneyCell('I'+n,record.Saldo),2,32);
   if(!records.length)heading('Nenhuma contratação encontrada para os filtros informados.',0,2);
   total('Subtotal do prestador',person,1);
  }
  total('Total do depósito',depot);
 }
 if(!report.prestadores.length)heading('Nenhum prestador encontrado para os filtros informados.',0);
 total('Total geral',report.totais);
 heading('CPF/CNPJ e identificadores são texto. Valores que excedem a precisão numérica do Excel permanecem como texto.',0);
 const sheet=`<worksheet xmlns="${ns}"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22" outlineLevelRow="2"/><cols>${[22,20,20,26,48,24,22,24,24].map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells></worksheet>`;
 return zip([
 ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
 ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Extrato por depósito" sheetId="1" r:id="rId1"/></sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
 ['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet],
 ]);
}
const styles=`<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Segoe UI"/></font><font><b/><sz val="14"/><color rgb="FF123656"/><name val="Segoe UI"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123656"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF28C28"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${[[0,0,0],[0,1,0],[0,2,2],[0,0,3],[0,2,2],[164,0,0],[165,0,0],[164,0,4]].map(([numFmtId,fontId,fillId])=>`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
