import assert from 'node:assert/strict';
import fs from 'node:fs';
import {snapshot} from './recovery.mjs';
import {targetGuard} from './build-schema.mjs';

const retired=new Set([
 'Financeiro.PC10Estorno','Financeiro.PC10Movimento','Financeiro.PC10DocumentoEstado',
 'Financeiro.PC08Anexo','Financeiro.PC08Item','Financeiro.PC08Pagamento',
 'Financeiro.EtapaAlcadaLab','Financeiro.DecisaoExcecaoVencimentoLab','Financeiro.ExcecaoVencimentoLab',
 'Financeiro.EventoRegraFuncional','Financeiro.RegraFuncional','Financeiro.ObrigacaoPreparada',
 'Financeiro.DecisaoAutorizacao','Financeiro.SolicitacaoAutorizacao','Financeiro.EncaminhamentoPolitica',
 'Financeiro.ProntidaoDecisao','Financeiro.ProntidaoVersao','Financeiro.AvaliacaoCarteira','Financeiro.ReferenciaCarteira',
 'Simulacao.Anexo','Simulacao.Evento','Simulacao.ReciboVersao','Simulacao.Processo'
]);
const stable=(rows,skip=new Set())=>rows.filter(row=>!skip.has(row.table));
async function contractSnapshot(db){
 const table=(await db.query("SELECT OBJECT_ID('Operacao.Contratacao','U') Id"))[0]?.Id;
 assert.ok(table,'Operacao.Contratacao ausente');
 const columns=(await db.query(`SELECT name FROM sys.columns WHERE object_id=${Number(table)} AND name<>'PagoEmUtc' ORDER BY column_id`)).map(row=>row.name);
 if(!columns.length||columns.some(name=>!/^[A-Za-z0-9_]+$/.test(name)))throw Error('Colunas da contratação recusadas');
 const projection=columns.map(name=>'['+name+']').join(',');
 return (await db.query(`SELECT (SELECT ${projection} FROM Operacao.Contratacao ORDER BY ContratacaoId FOR JSON PATH,INCLUDE_NULL_VALUES) J`))[0]?.J||'[]';
}
async function runSql(db){
 const sql=fs.readFileSync(new URL('./fin04-retirement.sql',import.meta.url),'utf8').replace('/*PILOT_GUARD*/',`IF NOT (${targetGuard}) THROW 55900,N'Destino recusado',1;`);
 for(const batch of sql.split(/^\s*GO\s*$/im).filter(value=>value.trim()))await db.query(batch);
}
async function checkLegacyEmpty(db){
 for(const table of retired){const [schema,name]=table.split('.');if(!/^[A-Za-z0-9_]+$/.test(schema+name))throw Error('Tabela recusada');const count=Number((await db.query(`SELECT COUNT(*) N FROM [${schema}].[${name}]`))[0].N);assert.equal(count,0,`Dados antigos restantes: ${table}`);}
}
async function checkMarker(db){
 const rows=await db.query("SELECT CONVERT(varchar(32),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_FIN04_RESET'");
 assert.equal(rows[0]?.V,'1','Marcador FIN04 ausente ou divergente');
 const mismatch=Number((await db.query(`SELECT COUNT(*) N FROM Operacao.Contratacao c LEFT JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL WHERE (c.PagoEmUtc IS NULL AND b.ConfirmadoEmUtc IS NOT NULL) OR (c.PagoEmUtc IS NOT NULL AND b.ConfirmadoEmUtc IS NULL) OR (c.PagoEmUtc IS NOT NULL AND b.ConfirmadoEmUtc IS NOT NULL AND c.PagoEmUtc<>b.ConfirmadoEmUtc)`))[0].N);
 assert.equal(mismatch,0,'PagoEmUtc diverge da baixa ativa FIN03');
}

// Caller owns the transaction. This helper deliberately does not open, commit, or roll it back.
export async function resetFin04(db){
 if(Number((await db.query('SELECT @@TRANCOUNT N'))[0].N)<1)throw Error('FIN04 exige transacao externa');
 const database=(await db.query('SELECT DB_NAME() N'))[0].N;
 if(database!=='JETTA_CONTROL_PILOTO_LOCAL'&&!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(database))throw Error('Destino FIN04 recusado');
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0]?.V;
 if(!/^[a-f0-9]{64}$/.test(marker||''))throw Error('Identidade do piloto ausente');
 const before=await snapshot(db),beforeContracts=await contractSnapshot(db);
 await runSql(db);
 const after=await snapshot(db),afterContracts=await contractSnapshot(db);
 const ignored=new Set([...retired,'Operacao.Contratacao']);
 assert.deepEqual(stable(after,ignored),stable(before,ignored),'Tabelas protegidas, incluindo FIN02/03 e auditoria, preservadas');
 assert.equal(afterContracts,beforeContracts,'Contratações/cadastros operacionais preservados, exceto marcador financeiro');
 await checkLegacyEmpty(db);await checkMarker(db);
 return {legacyTablesCleared:retired.size,protectedTablesPreserved:stable(after,ignored).length,contractsPreserved:true,newFinancePreserved:true,auditPreserved:true,marker:'1'};
}

export const fin04RetiredTables=[...retired];
