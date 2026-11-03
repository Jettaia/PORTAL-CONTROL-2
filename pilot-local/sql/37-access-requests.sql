IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
