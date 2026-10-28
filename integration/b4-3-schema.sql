-- LAB ONLY. Never run against JETTA_CONTROL.
IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 54600,N'Somente laboratorio',1;
IF OBJECT_ID('Operacao.FechamentoParticipacao','U') IS NULL
CREATE TABLE Operacao.FechamentoParticipacao(
 FechamentoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL UNIQUE REFERENCES Operacao.Participacao(ParticipacaoId),
 GestorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Resultado varchar(24) NOT NULL CHECK(Resultado='FECHADO_REGULAR'),
 VersaoDados char(64) NOT NULL,RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(GestorId,RequisicaoId));
IF OBJECT_ID('Operacao.ComprovanteServico','U') IS NULL
CREATE TABLE Operacao.ComprovanteServico(
 ComprovanteId uniqueidentifier PRIMARY KEY,FechamentoId bigint NOT NULL UNIQUE REFERENCES Operacao.FechamentoParticipacao(FechamentoId),
 VersaoContrato varchar(16) NOT NULL CHECK(VersaoContrato='1.0.0'),ConteudoJson nvarchar(max) NOT NULL CHECK(ISJSON(ConteudoJson)=1),
 ConteudoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('Operacao.OcorrenciaParticipacao','U') IS NULL
CREATE TABLE Operacao.OcorrenciaParticipacao(
 OcorrenciaId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),
 Tipo varchar(32) NOT NULL CHECK(Tipo IN ('AUSENCIA_APONTAMENTO','FALHA_CONEXAO','CODIGO_PERDIDO_EXPIRADO','DIVERGENCIA_HORARIO','DIVERGENCIA_EXECUCAO')),
 Descricao nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Descricao)))>0),SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 Situacao varchar(16) NOT NULL DEFAULT 'REGISTRADA' CHECK(Situacao='REGISTRADA'),
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(SolicitanteId,RequisicaoId));
IF OBJECT_ID('Operacao.AjusteApontamento','U') IS NULL
CREATE TABLE Operacao.AjusteApontamento(
 AjusteId bigint IDENTITY PRIMARY KEY,CorrecaoId bigint NOT NULL UNIQUE REFERENCES Operacao.CorrecaoApontamento(CorrecaoId),
 EventoOriginalId bigint NOT NULL REFERENCES Operacao.EventoApontamento(EventoId),HorarioEfetivoUtc datetime2(3) NOT NULL,
 AplicadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),PoliticaVersao varchar(40) NOT NULL,
 AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
GO
CREATE OR ALTER TRIGGER Operacao.tr_B43_Fechamento ON Operacao.FechamentoParticipacao INSTEAD OF UPDATE,DELETE AS
BEGIN THROW 54601,N'Fechamento imutavel',1; END;
GO
CREATE OR ALTER TRIGGER Operacao.tr_B43_Comprovante ON Operacao.ComprovanteServico INSTEAD OF UPDATE,DELETE AS
BEGIN THROW 54602,N'Comprovante imutavel',1; END;
GO
CREATE OR ALTER TRIGGER Operacao.tr_B43_Ocorrencia ON Operacao.OcorrenciaParticipacao INSTEAD OF UPDATE,DELETE AS
BEGIN THROW 54603,N'Ocorrencia imutavel; resolucao depende de politica',1; END;
GO
CREATE OR ALTER TRIGGER Operacao.tr_B43_AjusteBloqueado ON Operacao.AjusteApontamento INSTEAD OF INSERT,UPDATE,DELETE AS
BEGIN THROW 54604,N'Aplicacao de correcao bloqueada: politica nao aprovada',1; END;
