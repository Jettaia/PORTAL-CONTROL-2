// Extract definitions only. Never executes historical installers, seeds or USE statements.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const sources = [
  ['Jetta_Control_B1_v0.1.0/sql/101_b1_modelo.sql', 'tables'],
  ['Jetta_Control_B1_2_v1.0.0/sql/301_operacao_planejamento.sql', 'sp_CriarAtividadePlanejada'],
  ['Jetta_Control_B1_2_PATCH_v1.0.1/sql/401_patch_participante.sql', 'sp_AdicionarParticipantePlanejado'],
  ['Jetta_Control_B1_3_v1.0.0/sql/501_motor_contratacao.sql', 'engine']
];
const report = [], batches = ['CREATE SCHEMA Operacao;'];
for (const [relative, kind] of sources) {
  const source = path.join('C:/Jetta Control', relative), raw = fs.readFileSync(source), text = raw.toString('utf8');
  const definitions = kind === 'tables'
    ? [...text.matchAll(/CREATE TABLE (?:Operacao|Cadastro)\.\w+ \([\s\S]*?\r?\n \);/g)].map(m => m[0])
    : text.split(/^\s*GO\s*$/im).filter(s => /CREATE OR ALTER PROCEDURE Operacao\./.test(s)).map(s => s.slice(s.indexOf('CREATE OR ALTER PROCEDURE')).trim()).filter(s => kind === 'engine' || new RegExp('^CREATE OR ALTER PROCEDURE Operacao\\.' + kind + '\\s').test(s));
  if (definitions.length !== (kind === 'tables' ? 6 : kind === 'engine' ? 5 : 1)) throw Error('Contrato de extracao divergente: ' + kind + '/' + definitions.length);
  batches.push(...definitions.map(s => s.replaceAll("IF DB_NAME()<>N'JETTA_CONTROL'", "IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%'")));
  report.push({source, sha256: crypto.createHash('sha256').update(raw).digest('hex'), definitions: definitions.map(s => s.match(/(?:TABLE|PROCEDURE) ((?:Operacao|Cadastro)\.\w+)/)[1])});
}
batches.splice(5, 0, 'CREATE UNIQUE INDEX UX_B13_Politica_Inicio ON Operacao.PoliticaLimite(VigenteDesde);');
fs.mkdirSync('integration', {recursive: true}); fs.mkdirSync('docs/b3', {recursive: true});
fs.writeFileSync('integration/b3-operation.sql', '-- EXTRACTED LAB FIXTURE ONLY. Never an installer for principal.\n' + batches.join('\nGO\n') + '\nGO\n');
const common = fs.readFileSync('../jetta-b2d-pre/integration/fixture.sql', 'utf8');
if (/B2D(Codigo|Controle|Ticket|Excecao)/.test(common)) throw Error('Fixture nao pode incluir recuperacao B2D');
fs.writeFileSync('integration/b3-common.sql', common);
const fn = fs.readFileSync('../jetta-b2d-pre/integration/foundation.sql', 'utf8').split(/^\s*GO\s*$/im).find(s => /CREATE\s+FUNCTION Seguranca.fn_Pode/.test(s));
if (!fn) throw Error('Funcao RBAC ausente');
fs.writeFileSync('integration/b3-rbac.sql', fn.trim() + '\n');
fs.writeFileSync('docs/b3/historical-sources.json', JSON.stringify({principalAccesses: 0, sourceCatalog: 'docs/governanca/sql-inventory.json (2026-10-19)', transformation: 'definitions only; lab DB_NAME guards; historical installers never executed', sources: report}, null, 2) + '\n');
