-- Somente no banco sintetico restaurado, antes de abrir HTTP.
IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55700,N'Somente laboratorio sintetico',1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @epoch varchar(36)=CONVERT(varchar(36),NEWID());
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'JETTA_LAB_RECOVERY_EPOCH')
 EXEC sys.sp_updateextendedproperty @name=N'JETTA_LAB_RECOVERY_EPOCH',@value=@epoch;
ELSE EXEC sys.sp_addextendedproperty @name=N'JETTA_LAB_RECOVERY_EPOCH',@value=@epoch;
UPDATE Seguranca.SessaoWeb SET RevogadoEmUtc=SYSUTCDATETIME(),MfaValidadoEmUtc=NULL,MfaStepUpEmUtc=NULL WHERE RevogadoEmUtc IS NULL;
UPDATE Operacao.TabletApontamento SET RevogadoUtc=SYSUTCDATETIME() WHERE RevogadoUtc IS NULL;
UPDATE Operacao.CodigoApontamento SET RevogadoUtc=SYSUTCDATETIME() WHERE RevogadoUtc IS NULL;
INSERT Seguranca.Auditoria(Entidade,Acao,DetalhesJson) VALUES(N'RecuperacaoLaboratorio',N'RESTORE_INVALIDAR_CONTEXTO',N'{"simulado":true,"revalidacaoObrigatoria":true}');
COMMIT;
