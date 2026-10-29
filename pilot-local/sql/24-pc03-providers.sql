-- Additive PC-03 extension for a new installer/disposable database only.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
