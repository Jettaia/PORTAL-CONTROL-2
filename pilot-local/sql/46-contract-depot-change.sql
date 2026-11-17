-- Additive expansion. Keep reservations and events even when rolling application code back.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
