-- Additive PC-03 extension for a new installer/disposable database only.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55911,N'PC-03 exige transacao externa',1;
IF COL_LENGTH('Cadastro.Prestador','CNPJ') IS NULL
 ALTER TABLE Cadastro.Prestador ADD CNPJ varchar(14) NULL;
IF COL_LENGTH('Cadastro.Prestador','Versao') IS NULL
 ALTER TABLE Cadastro.Prestador ADD Versao int NOT NULL CONSTRAINT DF_PC03_Prestador_Versao DEFAULT(1);
IF OBJECT_ID('Cadastro.PrestadorFilial','U') IS NULL
 CREATE TABLE Cadastro.PrestadorFilial(
  PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
  FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),
  ConcedidoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  ConcedidoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  RevogadoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  RevogadoEmUtc datetime2(3) NULL,
  CONSTRAINT PK_PC03_PrestadorFilial PRIMARY KEY(PrestadorId,FilialId)
 );
-- No inferred links: historical participation does not grant future eligibility.
GO
