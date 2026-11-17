-- Additive expansion. Keep reservations and events even when rolling application code back.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55982,N'Troca de deposito exige transacao externa',1;
IF OBJECT_ID('Operacao.ContratacaoNumeroExcluido','U') IS NULL THROW 55982,N'Numeracao de contratacoes pendente',1;
IF OBJECT_ID('Operacao.ContratacaoNumeroTransferido','U') IS NULL
 CREATE TABLE Operacao.ContratacaoNumeroTransferido(
  DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
  Numero bigint NOT NULL CHECK(Numero>0),
  ContratacaoId bigint NOT NULL,
  PRIMARY KEY(DepositoId,Numero)
 );
-- No FK to the contract: reservations must survive its authorized deletion.
IF OBJECT_ID('Operacao.CK_PC04_PlanejamentoEvento','C') IS NOT NULL
 ALTER TABLE Operacao.ContratacaoEvento DROP CONSTRAINT CK_PC04_PlanejamentoEvento;
IF OBJECT_ID('Operacao.CK_PC04_DepositoEvento','C') IS NULL
 ALTER TABLE Operacao.ContratacaoEvento WITH CHECK ADD CONSTRAINT CK_PC04_DepositoEvento CHECK(
 Acao IN('CRIAR','PREVISTOS','DEPOSITO','HORARIOS','CONFERIR','REVISAR','CANCELAR','TOKEN_GERAR','TOKEN_USAR','HORARIO_SOL','HORARIO_APROV','HORARIO_NEGADO'));
GO
