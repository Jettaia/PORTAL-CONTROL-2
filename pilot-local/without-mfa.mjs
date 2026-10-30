import {withDb} from '../src/auth-db.js';
// Only the four legacy planning checks change: preserve session owner/expiry and all RBAC.
export function passwordSessionSql(sql){return sql.replace(/JOIN Seguranca\.MfaTotp m ON m\.UsuarioId=s\.UsuarioId AND m\.ConfirmadoEmUtc IS NOT NULL AND m\.RevogadoEmUtc IS NULL\s*/g,'').replace(/AND s\.MfaValidadoEmUtc>=m\.ConfirmadoEmUtc AND s\.MfaValidadoEmUtc<=SYSUTCDATETIME\(\)\s*AND s\.MfaStepUpEmUtc>=m\.ConfirmadoEmUtc AND s\.MfaStepUpEmUtc BETWEEN DATEADD\(minute,-5,SYSUTCDATETIME\(\)\) AND SYSUTCDATETIME\(\)/g,'').replaceAll("N'MFA recente obrigatorio'","N'Sessao valida obrigatoria'");}
export async function upgradePasswordSessions(cfg){
 if(cfg.mfaRequired!==false||cfg.runtimeMode!=='LOCAL_PILOT_V1')throw Error('Atualizacao exclusiva do piloto sem MFA');
 return withDb(cfg,async db=>{
  const rows=await db.query("SELECT sm.definition FROM sys.sql_modules sm JOIN sys.procedures p ON p.object_id=sm.object_id JOIN sys.schemas s ON s.schema_id=p.schema_id WHERE s.name='Operacao' AND p.name IN ('sp_ConfirmarParticipacao','sp_DecidirExcecaoLimite','sp_CadastrarPoliticaLimite')");
  await db.beginTransaction();try{
  for(const row of rows){const changed=passwordSessionSql(row.definition);if(changed!==row.definition)await db.query(changed.replace(/\bCREATE(?:\s+OR\s+ALTER)?\s+PROCEDURE/i,'ALTER PROCEDURE'));}
  await db.commit();}catch(error){await db.rollback();throw error;}
 });
}
