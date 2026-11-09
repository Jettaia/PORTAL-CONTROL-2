-- Offline rollback only before any code has been reused. Never remove history.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55913,N'PC-05 exige transacao externa',1;
DECLARE @r int;
EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
IF @r<0 THROW 55980,N'Tokens ocupados',1;
IF EXISTS(SELECT CodigoHash FROM Operacao.ContratacaoToken GROUP BY CodigoHash HAVING COUNT(*)>1)
 THROW 55981,N'Rollback recusado: codigos reutilizados; preserve historico e use aplicacao compativel',1;
IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='UQ_PC05_Codigo')
 ALTER TABLE Operacao.ContratacaoToken ADD CONSTRAINT UQ_PC05_Codigo UNIQUE(CodigoHash);
IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='IX_PC05_CodigoPrazo')
 DROP INDEX IX_PC05_CodigoPrazo ON Operacao.ContratacaoToken;
IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='IX_PC05_Prazo')
 DROP INDEX IX_PC05_Prazo ON Operacao.ContratacaoToken;
GO
