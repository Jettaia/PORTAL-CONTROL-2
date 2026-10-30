-- Additive: installed pilot or explicitly marked disposable laboratory only.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55913,N'Tablets exige transacao externa',1;
IF OBJECT_ID('Operacao.TabletPC05','U') IS NULL THROW 55914,N'PC05 obrigatorio',1;
IF COL_LENGTH('Operacao.TabletPC05','DepositoId') IS NULL
 ALTER TABLE Operacao.TabletPC05 ADD DepositoId bigint NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('Operacao.TabletPC05') AND name='FK_PC05_TabletDeposito')
 ALTER TABLE Operacao.TabletPC05 WITH CHECK ADD CONSTRAINT FK_PC05_TabletDeposito FOREIGN KEY(DepositoId) REFERENCES Cadastro.Deposito(DepositoId);
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Operacao.TabletPC05') AND name='ExpiraEmUtc' AND is_nullable=0)
 ALTER TABLE Operacao.TabletPC05 ALTER COLUMN ExpiraEmUtc datetime2(3) NULL;
GO
