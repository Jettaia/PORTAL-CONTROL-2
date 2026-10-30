-- Additive: installed pilot or explicitly marked disposable laboratory only.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55913,N'Tablets exige transacao externa',1;
IF OBJECT_ID('Operacao.TabletPC05','U') IS NULL THROW 55914,N'PC05 obrigatorio',1;
IF COL_LENGTH('Operacao.TabletPC05','DepositoId') IS NULL
 ALTER TABLE Operacao.TabletPC05 ADD DepositoId bigint NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('Operacao.TabletPC05') AND name='FK_PC05_TabletDeposito')
 ALTER TABLE Operacao.TabletPC05 WITH CHECK ADD CONSTRAINT FK_PC05_TabletDeposito FOREIGN KEY(DepositoId) REFERENCES Cadastro.Deposito(DepositoId);
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Operacao.TabletPC05') AND name='ExpiraEmUtc' AND is_nullable=0)
 ALTER TABLE Operacao.TabletPC05 ALTER COLUMN ExpiraEmUtc datetime2(3) NULL;
GO
