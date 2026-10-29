-- Additive PC05 installer/disposable database only; no installed database migration.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55913,N'PC-05 exige transacao externa',1;
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL THROW 55914,N'PC-04 obrigatorio',1;
IF OBJECT_ID('Operacao.TabletPC05','U') IS NULL
 CREATE TABLE Operacao.TabletPC05(
  TabletId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PC05_Tablet PRIMARY KEY,
  Nome nvarchar(80) NOT NULL,EmissorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  PareamentoHash char(64) NULL,SessaoHash char(64) NULL,
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_PC05_TabletCriado DEFAULT SYSUTCDATETIME(),
  PareamentoExpiraEmUtc datetime2(3) NOT NULL,ExpiraEmUtc datetime2(3) NOT NULL,
  AtivadoEmUtc datetime2(3) NULL,RevogadoEmUtc datetime2(3) NULL,
  Falhas int NOT NULL CONSTRAINT DF_PC05_Falhas DEFAULT(0),
  CONSTRAINT CK_PC05_Falhas CHECK(Falhas>=0 AND Falhas<=5),
  CONSTRAINT CK_PC05_TabletPrazo CHECK(PareamentoExpiraEmUtc>CriadoEmUtc AND ExpiraEmUtc>CriadoEmUtc)
 );
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.TabletPC05') AND name='UQ_PC05_Sessao')
 CREATE UNIQUE INDEX UQ_PC05_Sessao ON Operacao.TabletPC05(SessaoHash) WHERE SessaoHash IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.TabletPC05') AND name='UQ_PC05_Pareamento')
 CREATE UNIQUE INDEX UQ_PC05_Pareamento ON Operacao.TabletPC05(PareamentoHash) WHERE PareamentoHash IS NOT NULL;
IF OBJECT_ID('Operacao.ContratacaoToken','U') IS NULL
 CREATE TABLE Operacao.ContratacaoToken(
  TokenId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PC05_Token PRIMARY KEY,
  ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  Tipo varchar(7) NOT NULL,CodigoHash char(64) NOT NULL,
  EmissorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_PC05_TokenCriado DEFAULT SYSUTCDATETIME(),
  ExpiraEmUtc datetime2(3) NOT NULL,ConsumidoEmUtc datetime2(3) NULL,InvalidadoEmUtc datetime2(3) NULL,
  TabletId bigint NULL REFERENCES Operacao.TabletPC05(TabletId),
  CONSTRAINT UQ_PC05_Codigo UNIQUE(CodigoHash),
  CONSTRAINT CK_PC05_Tipo CHECK(Tipo IN('ENTRADA','SAIDA')),
  CONSTRAINT CK_PC05_TokenPrazo CHECK(ExpiraEmUtc>CriadoEmUtc),
  CONSTRAINT CK_PC05_Consumo CHECK((ConsumidoEmUtc IS NULL AND TabletId IS NULL) OR (ConsumidoEmUtc IS NOT NULL AND TabletId IS NOT NULL AND InvalidadoEmUtc IS NULL))
 );
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoToken') AND name='IX_PC05_ContratacaoTipo')
 CREATE INDEX IX_PC05_ContratacaoTipo ON Operacao.ContratacaoToken(ContratacaoId,Tipo) INCLUDE(ConsumidoEmUtc,InvalidadoEmUtc);
IF OBJECT_ID('Operacao.CK_PC04_EventoAcao','C') IS NOT NULL
 ALTER TABLE Operacao.ContratacaoEvento DROP CONSTRAINT CK_PC04_EventoAcao;
IF OBJECT_ID('Operacao.CK_PC05_EventoAcao','C') IS NULL
 ALTER TABLE Operacao.ContratacaoEvento WITH CHECK ADD CONSTRAINT CK_PC05_EventoAcao CHECK(Acao IN('CRIAR','HORARIOS','CONFERIR','REVISAR','CANCELAR','TOKEN_GERAR','TOKEN_USAR'));
GO
