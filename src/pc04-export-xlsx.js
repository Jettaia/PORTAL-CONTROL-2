import { zip } from './b5-xlsx.js';

const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const defaultHeaders = ['Número', 'Prestador', 'Depósito', 'Centro de custo', 'Gestor responsável', 'Data do serviço', 'Valor (R$)', 'Situação'];
const defaultFields = ['Numero', 'Prestador', 'Deposito', 'CentroCusto', 'GestorResponsavel', 'DataServico', 'Valor', 'Status'];
const xml = value => String(value ?? '')
  .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const textCell = (address, value, style = 0) => `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const numberCell = (address, value, style) => `<c r="${address}" s="${style}"><v>${value}</v></c>`;

// Excel stores only 15 significant decimal digits. Keep the original decimal
// lexeme in OOXML and use text whenever Excel or JS could lose its cents.
function money(value) {
  const raw = String(value ?? '');
  if (!/^-?\d+\.\d{2}$/.test(raw)) return { raw, numeric: false };
  const significant = raw.replace('-', '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  const canonical = raw.replace(/^(-?)0+(?=\d)/, '$1');
  const numeric = significant.length <= 15 && Number.isFinite(Number(raw)) && (Number(raw).toFixed(2) === canonical || (Number(raw) === 0 && /^-?0\.00$/.test(canonical)));
  return { raw, numeric };
}

function dateSerial(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value || value < '1900-01-01') return null;
  const days = (time - Date.UTC(1899, 11, 30)) / 86400000;
  return value < '1900-03-01' ? days - 1 : days;
}

export function contractsWorkbook(report, options = {}) {
  const headers = options.headers || defaultHeaders, fields = options.fields || defaultFields;
  const moneyField = options.moneyField || 'Valor', dateField = options.dateField || 'DataServico';
  const moneyColumn = String.fromCharCode(65 + fields.indexOf(moneyField));
  const totalLabelColumn = String.fromCharCode(moneyColumn.charCodeAt(0) - 1);
  const total = money(report.total);
  let preservePrecision = !total.numeric;
  const rows = [
    `<row r="1" ht="32" customHeight="1">${textCell('A1', 'JETTA CONTROL · '+(options.title || 'Relatório de contratações'), 1)}</row>`,
    `<row r="2" ht="24" customHeight="1">${textCell('A2', `Gerado em: ${report.geradoEm ?? report.geradoEmUtc ?? ''}`)}</row>`,
    `<row r="3" ht="42" customHeight="1">${textCell('A3', `Filtros: ${report.filtrosTexto ?? ''}`)}</row>`,
    `<row r="4" ht="24" customHeight="1">${textCell('A4', `Quantidade: ${report.quantidade}`, 4)}</row>`,
    `<row r="5" ht="32" customHeight="1">${headers.map((header, index) => textCell(`${String.fromCharCode(65 + index)}5`, header, 2)).join('')}</row>`,
  ];
  for (const [index, record] of report.registros.entries()) {
    const row = index + 6;
    const cells = fields.map((field, column) => {
      const address = `${String.fromCharCode(65 + column)}${row}`;
      if (field === moneyField) {
        const value = money(record[field]);
        preservePrecision ||= !value.numeric;
        return value.numeric ? numberCell(address, value.raw, 3) : textCell(address, value.raw);
      }
      if (field === options.dateTimeField) {
        const parts = String(record[field] ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
        const serial = parts ? dateSerial(parts[3]+'-'+parts[2]+'-'+parts[1]) : null;
        return serial === null ? textCell(address, record[field]) : numberCell(address, serial + (Number(parts[4])*3600+Number(parts[5])*60+Number(parts[6]))/86400, 7);
      }
      if (field === dateField) {
        const serial = dateSerial(record[field]);
        return serial === null ? textCell(address, record[field]) : numberCell(address, serial, 5);
      }
      return textCell(address, record[field]);
    });
    rows.push(`<row r="${row}" ht="32" customHeight="1">${cells.join('')}</row>`);
  }
  const totalRow = report.registros.length + 6;
  rows.push(`<row r="${totalRow}" ht="28" customHeight="1">${textCell(`${totalLabelColumn}${totalRow}`, 'Total (R$)', 4)}${total.numeric ? numberCell(`${moneyColumn}${totalRow}`, total.raw, 6) : textCell(`${moneyColumn}${totalRow}`, total.raw, 4)}</row>`);
  if (preservePrecision) rows.push(`<row r="${totalRow + 1}" ht="34" customHeight="1">${textCell(`A${totalRow + 1}`, 'Para preservar a precisão, valores que excedem a capacidade numérica do Excel são apresentados como texto.')}</row>`);
  const merges = ['A1:H1', 'A2:H2', 'A3:H3', 'A4:H4', ...(preservePrecision ? [`A${totalRow + 1}:H${totalRow + 1}`] : [])];
  const sheet = `<worksheet xmlns="${namespace}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${[24, 38, 25, 30, 32, 20, 26, 22].map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A5:H${Math.max(5, totalRow - 1)}"/><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells></worksheet>`;
  return zip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<workbook xmlns="${namespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(options.sheetName || 'Contratações')}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
}

const styles = `<styleSheet xmlns="${namespace}"><numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm:ss"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Segoe UI"/></font><font><b/><sz val="16"/><color rgb="FF103355"/><name val="Segoe UI"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF103355"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF28C28"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">${[
  [0, 0, 0], [0, 1, 0], [0, 2, 2], [164, 0, 0], [0, 0, 3], [165, 0, 0], [164, 0, 3], [166, 0, 0],
].map(([numFmtId, fontId, fillId]) => `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
