-- Additive schema; deleting a contract remains an explicit ADMIN application action.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55961,N'Exclusao de contratacoes exige transacao externa',1;
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL THROW 55961,N'Contratacoes nao instaladas',1;
IF OBJECT_ID('Operacao.ContratacaoExclusaoSolicitacao','U') IS NULL
BEGIN
 CREATE TABLE Operacao.ContratacaoExclusaoSolicitacao(
  SolicitacaoId bigint IDENTITY PRIMARY KEY,
  ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  Motivo nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),
  Status varchar(10) NOT NULL DEFAULT('PENDENTE') CHECK(Status IN('PENDENTE','NEGADA')),
  CriadoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  DecididoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  DecididoEmUtc datetime2(3) NULL,MotivoDecisao nvarchar(800) NULL,
  CHECK((Status='PENDENTE' AND DecididoPor IS NULL AND DecididoEmUtc IS NULL AND MotivoDecisao IS NULL) OR
        (Status='NEGADA' AND DecididoPor IS NOT NULL AND DecididoEmUtc IS NOT NULL AND LEN(LTRIM(RTRIM(MotivoDecisao)))>0))
 );
 CREATE UNIQUE INDEX UQ_ContratacaoExclusaoPendente ON Operacao.ContratacaoExclusaoSolicitacao(ContratacaoId) WHERE Status='PENDENTE';
END;
-- A deleted number must never be assigned to a different contract in the same depot.
IF OBJECT_ID('Operacao.ContratacaoNumeroExcluido','U') IS NULL
 CREATE TABLE Operacao.ContratacaoNumeroExcluido(
  ContratacaoId bigint PRIMARY KEY,DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
  Numero bigint NOT NULL CHECK(Numero>0),UNIQUE(DepositoId,Numero)
 );
GO
