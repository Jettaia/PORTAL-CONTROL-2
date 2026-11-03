// Only the isolated restore rehearsal may invalidate this synthetic database.
export async function invalidateRecoveredAccess(db,instance){
 if(!/^[a-f0-9]{64}$/.test(instance||''))throw Error('Identidade de recuperação inválida');
 const marker=(await db.query("SELECT DB_NAME() D,CONVERT(varchar(64),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE')) InstanceId,CONVERT(varchar(10),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST')) Test"))[0];
 if(!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(marker?.D||'')||marker.InstanceId!==instance||marker.Test!=='1')throw Error('Invalidação permitida somente no ensaio sintético identificado');
 await db.query('SET XACT_ABORT ON;');await db.beginTransaction();
 try{
  await db.query(`UPDATE Seguranca.SessaoWeb SET RevogadoEmUtc=SYSUTCDATETIME(),MfaValidadoEmUtc=NULL,MfaStepUpEmUtc=NULL WHERE RevogadoEmUtc IS NULL;
UPDATE Operacao.TabletApontamento SET RevogadoUtc=SYSUTCDATETIME() WHERE RevogadoUtc IS NULL;
UPDATE Operacao.CodigoApontamento SET RevogadoUtc=SYSUTCDATETIME() WHERE RevogadoUtc IS NULL;
UPDATE Operacao.TabletPC05 SET RevogadoEmUtc=COALESCE(RevogadoEmUtc,SYSUTCDATETIME()),SessaoHash=NULL,PareamentoHash=NULL;
UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL;
UPDATE Seguranca.ConviteAtivacaoPiloto SET RevogadoUtc=SYSUTCDATETIME() WHERE ConsumidoUtc IS NULL AND RevogadoUtc IS NULL;
UPDATE Seguranca.PilotoInicializacao SET ConsumidoUtc=COALESCE(ConsumidoUtc,SYSUTCDATETIME()),TokenHash=CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(16),NEWID())),2);
DECLARE @epoch varchar(36)=CONVERT(varchar(36),NEWID());
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_LAB_RECOVERY_EPOCH') EXEC sys.sp_updateextendedproperty @name=N'JETTA_LAB_RECOVERY_EPOCH',@value=@epoch;
ELSE EXEC sys.sp_addextendedproperty @name=N'JETTA_LAB_RECOVERY_EPOCH',@value=@epoch;
INSERT Seguranca.Auditoria(Entidade,Acao) VALUES(N'RecuperacaoPiloto',N'RESTORE_INVALIDAR_CONTEXTO');`);
  const counts=(await db.query(`SELECT
(SELECT COUNT(*) FROM Seguranca.SessaoWeb WHERE RevogadoEmUtc IS NULL) Sessions,
(SELECT COUNT(*) FROM Operacao.TabletPC05 WHERE RevogadoEmUtc IS NULL OR SessaoHash IS NOT NULL OR PareamentoHash IS NOT NULL) Tablets,
(SELECT COUNT(*) FROM Operacao.ContratacaoToken WHERE ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL) Tokens,
(SELECT COUNT(*) FROM Seguranca.ConviteAtivacaoPiloto WHERE ConsumidoUtc IS NULL AND RevogadoUtc IS NULL) Invitations,
(SELECT COUNT(*) FROM Seguranca.PilotoInicializacao WHERE ConsumidoUtc IS NULL) Setup`))[0];
  if(!counts||['Sessions','Tablets','Tokens','Invitations','Setup'].some(key=>Number(counts[key])!==0))throw Error('Credenciais recuperadas ainda estão ativas');
  await db.commit();return {sessionsRevoked:true,tabletsRevoked:true,tokensInvalidated:true,invitationsRevoked:true,bootstrapLinkRevoked:true};
 }catch(error){try{await db.rollback();}catch{}throw error;}
}
