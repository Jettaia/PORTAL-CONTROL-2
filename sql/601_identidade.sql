USE JETTA_CONTROL;
GO
IF DB_NAME() <> N'JETTA_CONTROL' THROW 56100, 'Banco incorreto', 1;
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRAN;
 IF OBJECT_ID('Seguranca.Credencial','U') IS NULL
 CREATE TABLE Seguranca.Credencial (
  UsuarioId bigint NOT NULL PRIMARY KEY REFERENCES Seguranca.Usuario(UsuarioId),
  SaltHex varchar(32) NOT NULL,
  SenhaHashHex varchar(128) NOT NULL,
  Falhas int NOT NULL CONSTRAINT DF_B22_Falhas DEFAULT(0),
  BloqueadoAteUtc datetime2(3) NULL,
  AlteradoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B22_Alter DEFAULT(SYSUTCDATETIME()),
  CONSTRAINT CK_B22_Falhas CHECK(Falhas BETWEEN 0 AND 100)
 );
 IF OBJECT_ID('Seguranca.SessaoWeb','U') IS NULL
 CREATE TABLE Seguranca.SessaoWeb (
  SessaoId bigint IDENTITY PRIMARY KEY,
  UsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  TokenHash char(64) NOT NULL UNIQUE,
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B22_Criado DEFAULT(SYSUTCDATETIME()),
  ExpiraEmUtc datetime2(3) NOT NULL,
  RevogadoEmUtc datetime2(3) NULL,
  CONSTRAINT CK_B22_Expira CHECK(ExpiraEmUtc > CriadoEmUtc)
 );
 COMMIT;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
GO
-- Para producao, um login SQL/Windows dedicado deve possuir somente os direitos estritamente necessarios.
-- Este patch nao concede papeis ou permissões automaticamente.
