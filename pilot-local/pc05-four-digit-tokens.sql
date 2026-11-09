-- Requires all application instances stopped; preserve the entire token history.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55913,N'PC-05 exige transacao externa',1;
IF OBJECT_ID('Operacao.ContratacaoToken','U') IS NULL THROW 55914,N'PC-05 obrigatorio',1;
DECLARE @r int;
EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
IF @r<0 THROW 55980,N'Tokens ocupados',1;
IF EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='UQ_PC05_Codigo')
 ALTER TABLE Operacao.ContratacaoToken DROP CONSTRAINT UQ_PC05_Codigo;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='IX_PC05_CodigoPrazo')
 CREATE INDEX IX_PC05_CodigoPrazo ON Operacao.ContratacaoToken(CodigoHash,ExpiraEmUtc) INCLUDE(TokenId,ConsumidoEmUtc,InvalidadoEmUtc);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='IX_PC05_Prazo')
 CREATE INDEX IX_PC05_Prazo ON Operacao.ContratacaoToken(ExpiraEmUtc) INCLUDE(CodigoHash);
GO
