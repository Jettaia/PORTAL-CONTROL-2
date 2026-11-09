import test from 'node:test';
import assert from 'node:assert/strict';
import { contractsWorkbook } from '../src/pc04-export-xlsx.js';

// Read the actual ZIP entries emitted by the public generator (stored OOXML).
function entries(buffer) {
  assert.ok(Buffer.isBuffer(buffer));
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    const size = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + nameSize + extraSize;
    files.set(buffer.subarray(offset + 30, offset + 30 + nameSize).toString(), buffer.subarray(start, start + size).toString());
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  return files;
}
const base = {
  filtros: { deposito: 'Floripa' }, filtrosTexto: 'Depósito: Floripa; Situação: Todas',
  geradoEmUtc: '2026-11-09T14:00:00Z', geradoEm: '09/11/2026 11:00:00 (Brasília)',
  quantidade: 1, total: '100.25',
  registros: [{ Numero: '9007199254740993123', Prestador: 'João & Filhos', CPF: '01234567890', Deposito: 'Floripa', CentroCusto: 'Operação', GestorResponsavel: 'Ana', DataServico: '2026-11-09', Valor: '100.25', Status: 'LIBERADA' }],
};
const cell = (sheet, address) => sheet.match(new RegExp(`<c r="${address}"[^>]*>[\\s\\S]*?</c>`))?.[0];

test('exports a genuine single-sheet styled workbook with typed dates, currency and exact identifiers', () => {
  const files = entries(contractsWorkbook(base));
  const sheet = files.get('xl/worksheets/sheet1.xml');
  assert.match(files.get('xl/workbook.xml'), /name="Contratações"/);
  assert.equal((files.get('xl/workbook.xml').match(/<sheet /g) || []).length, 1);
  assert.match(sheet, /JETTA CONTROL · Relatório de contratações/);
  assert.match(sheet, /09\/11\/2026 11:00:00 \(Brasília\)/);
  assert.match(sheet, /Depósito: Floripa/);
  assert.match(sheet, /Quantidade: 1/);
  assert.match(cell(sheet, 'A6'), /t="inlineStr".*9007199254740993123/);
  assert.match(cell(sheet, 'B6'), /João &amp; Filhos/);
  assert.match(cell(sheet, 'C5'), /CPF\/CNPJ do prestador/);
  assert.match(cell(sheet, 'C6'), /t="inlineStr".*012\.345\.678-90/);
  assert.match(sheet, /mergeCell ref="A1:I1"/);
  const serial = (Date.UTC(2026, 10, 9) - Date.UTC(1899, 11, 30)) / 86400000;
  assert.match(cell(sheet, 'G6'), new RegExp(`<v>${serial}</v>`));
  assert.doesNotMatch(cell(sheet, 'G6'), /inlineStr/);
  assert.match(cell(sheet, 'H6'), /<v>100.25<\/v>/);
  assert.match(cell(sheet, 'H7'), /<v>100.25<\/v>/);
  assert.match(sheet, /autoFilter ref="A5:I6"/);
  assert.match(sheet, /ySplit="5" topLeftCell="A6"/);
  assert.doesNotMatch(sheet, /Editar|precisão/);
  assert.match(files.get('xl/styles.xml'), /dd\/mm\/yyyy/);
  assert.match(files.get('xl/styles.xml'), /R\$/);
  assert.match(files.get('xl/styles.xml'), /wrapText="1"/);
  assert.match(files.get('xl/styles.xml'), /FF103355/);
  assert.match(files.get('xl/styles.xml'), /FFF28C28/);
  const formats = [...files.get('xl/styles.xml').match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s)[1].matchAll(/<xf\b[^>]*>[\s\S]*?<\/xf>/g)].map(match => match[0]);
  assert.match(formats[Number(cell(sheet, 'G6').match(/s="(\d+)"/)[1])], /numFmtId="165"/);
  assert.match(formats[Number(cell(sheet, 'H6').match(/s="(\d+)"/)[1])], /numFmtId="164"/);
  for (const [name, xml] of files) {
    assert.doesNotMatch(name, /vba|externalLink/);
    assert.doesNotMatch(xml, /<f>|TargetMode="External"/);
  }
});

test('preserves large decimal values and precomputed total as text with a conditional explanation', () => {
  const report = { ...base, total: '9999999999999999.99', registros: [{ ...base.registros[0], Valor: '9999999999999999.99' }] };
  const sheet = entries(contractsWorkbook(report)).get('xl/worksheets/sheet1.xml');
  assert.match(cell(sheet, 'H6'), /t="inlineStr".*9999999999999999.99/);
  assert.match(cell(sheet, 'H7'), /t="inlineStr".*9999999999999999.99/);
  assert.match(sheet, /precisão.*texto/);
  assert.match(sheet, /autoFilter ref="A5:I6"/);
});

test('never turns user strings into formulas and strips illegal XML controls', () => {
  const report = { ...base, registros: ['=HYPERLINK("https://example.org")', '+SUM(A1)', '-10+20', '@SUM(A1)'].map((Prestador) => ({ ...base.registros[0], Prestador: Prestador + '\u0000\u000b<svg>&', DataServico: '2024-02-29' })), quantidade: 4 };
  const sheet = entries(contractsWorkbook(report)).get('xl/worksheets/sheet1.xml');
  for (let row = 6; row <= 9; row++) assert.match(cell(sheet, `B${row}`), /t="inlineStr"/);
  assert.match(sheet, /&lt;svg&gt;&amp;/);
  assert.doesNotMatch(sheet, /[\u0000\u000b]|<f>|<svg>/);
});

test('empty results retain headers, a zero numeric total, and a header-only filter', () => {
  const sheet = entries(contractsWorkbook({ ...base, registros: [], quantidade: 0, total: '0.00' })).get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /autoFilter ref="A5:I5"/);
  assert.match(cell(sheet, 'H6'), /<v>0.00<\/v>/);
  assert.match(cell(sheet, 'I5'), /Situação/);
});

test('15-digit amounts stay numeric and fractional cents beyond that boundary remain exact text', () => {
  const values = ['1234567890123.45', '12345678901234.56', '1000000000000000.00', '1000000000000000.01', '-123.45', '0.01'];
  const report = { ...base, registros: values.map(Valor => ({ ...base.registros[0], Valor })) };
  const sheet = entries(contractsWorkbook(report)).get('xl/worksheets/sheet1.xml');
  for (const row of [6, 8, 10, 11]) assert.doesNotMatch(cell(sheet, `H${row}`), /inlineStr/);
  assert.match(cell(sheet, 'H7'), /t="inlineStr".*12345678901234.56/);
  assert.match(cell(sheet, 'H9'), /t="inlineStr".*1000000000000000.01/);
});

test('date-only cells handle leap days and never silently roll invalid dates forward', () => {
  const dates = ['2024-02-29', '2026-02-29', null, '1900-01-01', '1900-03-01'];
  const sheet = entries(contractsWorkbook({ ...base, registros: dates.map(DataServico => ({ ...base.registros[0], DataServico })) })).get('xl/worksheets/sheet1.xml');
  assert.match(cell(sheet, 'G6'), /<v>45351<\/v>/);
  assert.match(cell(sheet, 'G7'), /inlineStr.*2026-02-29/);
  assert.match(cell(sheet, 'G8'), /inlineStr/);
  assert.match(cell(sheet, 'G9'), /<v>1<\/v>/);
  assert.match(cell(sheet, 'G10'), /<v>61<\/v>/);
});

test('documentos CPF/CNPJ permanecem texto e ausência mantém a terceira coluna vazia', () => {
  const report = {...base, registros: ['01234567890', '00123456000199', null].map(CPF => ({...base.registros[0], CPF}))};
  const sheet = entries(contractsWorkbook(report)).get('xl/worksheets/sheet1.xml');
  assert.match(cell(sheet, 'C6'), /t="inlineStr".*012\.345\.678-90/);
  assert.match(cell(sheet, 'C7'), /t="inlineStr".*00\.123\.456\/0001-99/);
  assert.match(cell(sheet, 'C8'), /t="inlineStr".*<t xml:space="preserve"><\/t>/);
 });
