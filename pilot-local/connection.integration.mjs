import test from 'node:test';
import assert from 'node:assert/strict';
import {connectPilot} from './database.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('destino padrao conecta ao SQL Express desta maquina via Windows', async () => {
 const db = await connectPilot('master');
 try {
  const [row] = await db.query("SELECT DB_NAME() Banco, CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')) Maquina, CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')) Instancia, ORIGINAL_LOGIN() LoginWindows");
  assert.equal(row.Banco, 'master');
  assert.equal(row.Maquina.toLowerCase(), process.env.COMPUTERNAME.toLowerCase());
  assert.equal(row.Instancia.toUpperCase(), 'SQLEXPRESS');
  assert.match(row.LoginWindows, /\\/);
 } finally { await db.close(); }
});

test('conexao do piloto recusa banco legado antes de acessar SQL', async () => {
 await assert.rejects(() => connectPilot('JETTA_CONTROL'), /Destino de instalacao recusado/);
});

test('diagnostico funciona em clone sem plan.json e informa gates pendentes', async () => {
 const {stdout} = await promisify(execFile)(process.execPath, ['scripts/inspect-local-pilot.mjs', '--sql-readonly'], {windowsHide:true});
 const report = JSON.parse(stdout.trim());
 assert.equal(report.sql.connectedDatabase, 'master');
 assert.equal(report.sql.server.toLowerCase(), (process.env.COMPUTERNAME + '\\SQLEXPRESS').toLowerCase());
 assert.equal(typeof report.blockers, 'number');
});
