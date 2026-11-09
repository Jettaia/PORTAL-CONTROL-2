-- Requires all application instances stopped; preserve the entire token history.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
