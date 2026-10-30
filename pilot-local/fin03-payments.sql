-- FIN03 additive: evidence and corrections are never deleted.
/*PILOT_GUARD*/
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
