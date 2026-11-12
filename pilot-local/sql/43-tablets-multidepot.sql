-- Additive links beyond TabletPC05.DepositoId (the compatible primary link).
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55913,N'Tablets exige transacao externa',1;
IF COL_LENGTH('Operacao.TabletPC05','DepositoId') IS NULL THROW 55914,N'Tablets permanentes obrigatorio',1;
IF OBJECT_ID('Operacao.TabletPC05Deposito','U') IS NULL
 CREATE TABLE Operacao.TabletPC05Deposito(
  TabletId bigint NOT NULL,
  DepositoId bigint NOT NULL,
  CONSTRAINT PK_PC05_TabletDeposito PRIMARY KEY(TabletId,DepositoId),
  CONSTRAINT FK_PC05_VinculoTablet FOREIGN KEY(TabletId) REFERENCES Operacao.TabletPC05(TabletId),
  CONSTRAINT FK_PC05_VinculoDeposito FOREIGN KEY(DepositoId) REFERENCES Cadastro.Deposito(DepositoId)
 );
GO
