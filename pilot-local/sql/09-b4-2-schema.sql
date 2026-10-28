-- LAB ONLY; helper also checks the exact generated name inside its transaction.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54500,N'Somente laboratorio',1;
IF COL_LENGTH('Operacao.TabletApontamento','DispositivoId') IS NULL
BEGIN
 ALTER TABLE Operacao.TabletApontamento ADD DispositivoId uniqueidentifier NOT NULL DEFAULT NEWID(),NomeDispositivo nvarchar(80) NOT NULL DEFAULT N'Tablet de laboratorio',AnteriorTabletId bigint NULL REFERENCES Operacao.TabletApontamento(TabletId),NavegacaoProtegida bit NOT NULL DEFAULT 0;
END;
IF OBJECT_ID('Operacao.ConferenciaApontamento','U') IS NULL
CREATE TABLE Operacao.ConferenciaApontamento(
 ConferenciaId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL UNIQUE REFERENCES Operacao.Participacao(ParticipacaoId),
 GestorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Decisao varchar(20) NOT NULL CHECK(Decisao IN ('CONFERIDO','DIVERGENCIA')),
 Motivo nvarchar(800) NOT NULL,ContextoHash char(64) NOT NULL,RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(GestorId,RequisicaoId),CHECK(Decisao='CONFERIDO' OR LEN(LTRIM(RTRIM(Motivo)))>0));
IF OBJECT_ID('Operacao.CorrecaoApontamento','U') IS NULL
CREATE TABLE Operacao.CorrecaoApontamento(
 CorrecaoId bigint IDENTITY PRIMARY KEY,EventoId bigint NOT NULL REFERENCES Operacao.EventoApontamento(EventoId),
 HorarioPropostoUtc datetime2(3) NOT NULL,Justificativa nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Justificativa)))>0),
 SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),ContextoHash char(64) NOT NULL,
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(SolicitanteId,RequisicaoId));
IF OBJECT_ID('Operacao.DecisaoCorrecaoApontamento','U') IS NULL
CREATE TABLE Operacao.DecisaoCorrecaoApontamento(
 CorrecaoId bigint PRIMARY KEY REFERENCES Operacao.CorrecaoApontamento(CorrecaoId),
 AprovadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Aprovada bit NOT NULL,Motivo nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(AprovadorId,RequisicaoId));
IF OBJECT_ID('Operacao.GovernancaTablet','U') IS NULL
CREATE TABLE Operacao.GovernancaTablet(
 OperacaoId bigint IDENTITY PRIMARY KEY,TabletId bigint NOT NULL REFERENCES Operacao.TabletApontamento(TabletId),
 NovoTabletId bigint NULL REFERENCES Operacao.TabletApontamento(TabletId),AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 Tipo varchar(12) NOT NULL CHECK(Tipo IN ('PAREAR','REVOGAR','RENOVAR','SUBSTITUIR')),Motivo nvarchar(800) NOT NULL,
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(AtorId,RequisicaoId));
GO
CREATE OR ALTER TRIGGER Operacao.tr_B42_EventoOriginal ON Operacao.EventoApontamento INSTEAD OF UPDATE,DELETE AS
BEGIN
 THROW 54501,N'Evento original imutavel',1;
END;
GO
