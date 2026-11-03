/*PILOT_GUARD*/
IF OBJECT_ID('Seguranca.SolicitacaoAcesso','U') IS NULL
BEGIN
 CREATE TABLE Seguranca.SolicitacaoAcesso(
  SolicitacaoId bigint IDENTITY PRIMARY KEY,
  Nome nvarchar(150) NOT NULL,
  Email nvarchar(256) NOT NULL,
  Estado varchar(10) NOT NULL DEFAULT 'PENDENTE' CHECK(Estado IN('PENDENTE','APROVADA','RECUSADA')),
  CriadoEmUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  DecididoEmUtc datetime2 NULL,
  DecididoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  UsuarioId bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CONSTRAINT CK_SolicitacaoAcesso_Decisao CHECK(
   (Estado='PENDENTE' AND DecididoEmUtc IS NULL AND DecididoPor IS NULL AND UsuarioId IS NULL) OR
   (Estado='RECUSADA' AND DecididoEmUtc IS NOT NULL AND DecididoPor IS NOT NULL AND UsuarioId IS NULL) OR
   (Estado='APROVADA' AND DecididoEmUtc IS NOT NULL AND DecididoPor IS NOT NULL AND UsuarioId IS NOT NULL))
 );
 CREATE UNIQUE INDEX UX_SolicitacaoAcesso_Pendente ON Seguranca.SolicitacaoAcesso(Email) WHERE Estado='PENDENTE';
END;
