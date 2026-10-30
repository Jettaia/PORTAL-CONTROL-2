-- FIN03 additive: evidence and corrections are never deleted.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55971,N'Baixas exigem transacao externa',1;
IF OBJECT_ID('Financeiro.ContratacaoRecibo','U') IS NULL THROW 55971,N'Recibos nao instalados',1;
IF OBJECT_ID('Financeiro.ContratacaoAnexo','U') IS NULL
 CREATE TABLE Financeiro.ContratacaoAnexo(
  AnexoId bigint IDENTITY PRIMARY KEY,ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  ReciboId bigint NOT NULL REFERENCES Financeiro.ContratacaoRecibo(ReciboId),Nome nvarchar(180) NOT NULL,Tipo varchar(40) NOT NULL,
  Tamanho int NOT NULL CHECK(Tamanho BETWEEN 1 AND 5242880),Sha256 char(64) NOT NULL,
  CriadoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),CriadoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  Conteudo varbinary(max) NOT NULL,CHECK(DATALENGTH(Conteudo)=Tamanho),CHECK(Tipo IN('application/pdf','image/png','image/jpeg'))
 );
IF OBJECT_ID('Financeiro.ContratacaoBaixa','U') IS NULL
BEGIN
 CREATE TABLE Financeiro.ContratacaoBaixa(
  BaixaId bigint IDENTITY PRIMARY KEY,ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  ReciboId bigint NOT NULL REFERENCES Financeiro.ContratacaoRecibo(ReciboId),AnexoId bigint NOT NULL REFERENCES Financeiro.ContratacaoAnexo(AnexoId),
  Valor decimal(18,2) NOT NULL CHECK(Valor>0),DataPagamento date NOT NULL,
  ConfirmadoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),ConfirmadoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  DesfeitoEmUtc datetime2(3) NULL,DesfeitoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),MotivoDesfazimento nvarchar(800) NULL,
  CHECK((DesfeitoEmUtc IS NULL AND DesfeitoPor IS NULL AND MotivoDesfazimento IS NULL) OR (DesfeitoEmUtc IS NOT NULL AND DesfeitoPor IS NOT NULL AND LEN(LTRIM(RTRIM(MotivoDesfazimento)))>0))
 );
 CREATE UNIQUE INDEX UQ_Fin03Baixa_Ativa ON Financeiro.ContratacaoBaixa(ContratacaoId) WHERE DesfeitoEmUtc IS NULL;
END;
GO
