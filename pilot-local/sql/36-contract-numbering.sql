-- One-time renumbering. Requires the caller to back up and stop the local pilot.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55980,N'Numeracao exige transacao externa',1;
IF COL_LENGTH('Operacao.Contratacao','DepositoId') IS NULL THROW 55980,N'Depositos nao instalados',1;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
IF @lock<0 THROW 55980,N'Contratacoes ocupadas',1;
IF OBJECT_ID('Operacao.ContratacaoNumeracaoMigracao','U') IS NULL BEGIN
 -- Freeze the old-to-new mapping and all writers before dropping global uniqueness.
 SELECT ContratacaoId,DepositoId,Numero NumeroAnterior,
  ROW_NUMBER() OVER(PARTITION BY DepositoId ORDER BY CriadoEmUtc,ContratacaoId) NumeroNovo
 INTO Operacao.ContratacaoNumeracaoMigracao
 FROM Operacao.Contratacao WITH(TABLOCKX,HOLDLOCK);
 ALTER TABLE Operacao.ContratacaoNumeracaoMigracao ADD CONSTRAINT PK_ContratacaoNumeracaoMigracao PRIMARY KEY(ContratacaoId);
 ALTER TABLE Operacao.ContratacaoNumeracaoMigracao ADD MigradoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_ContratacaoNumeracaoMigrada DEFAULT SYSUTCDATETIME();
 IF EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.Contratacao') AND name='UQ_PC04_Numero')
  ALTER TABLE Operacao.Contratacao DROP CONSTRAINT UQ_PC04_Numero;
 UPDATE c SET Numero=m.NumeroNovo FROM Operacao.Contratacao c JOIN Operacao.ContratacaoNumeracaoMigracao m ON m.ContratacaoId=c.ContratacaoId;
 -- No global default: every writer must supply the depot-scoped number explicitly.
 IF OBJECT_ID('Operacao.DF_PC04_Numero','D') IS NOT NULL ALTER TABLE Operacao.Contratacao DROP CONSTRAINT DF_PC04_Numero;
 ALTER TABLE Operacao.Contratacao ADD CONSTRAINT UQ_PC04_DepositoNumero UNIQUE(DepositoId,Numero);
 ALTER TABLE Operacao.Contratacao ADD CONSTRAINT CK_PC04_NumeroPositivo CHECK(Numero>0);
END;
IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Operacao.Contratacao') AND name='UQ_PC04_DepositoNumero')
 THROW 55980,N'Numeracao por deposito incompleta',1;
GO
