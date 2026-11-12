-- Additive links beyond TabletPC05.DepositoId (the compatible primary link).
/*PILOT_GUARD*/
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
