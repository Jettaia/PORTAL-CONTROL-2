-- MIGRAÇÃO EXCLUSIVA DE BANCO SINTÉTICO. Não remove nenhum bloqueio Financeiro.ObrigacaoPreparada.
IF DB_NAME() NOT LIKE 'JETTA[_]CONTROL[_]B3[_]TEST[_]%' OR RIGHT(DB_NAME(),12) LIKE '%[^a-f0-9]%' THROW 55700,N'Somente laboratorio sintetico',1;
IF SCHEMA_ID('Simulacao') IS NULL EXEC('CREATE SCHEMA Simulacao');
GO
IF OBJECT_ID('Simulacao.Processo') IS NULL CREATE TABLE Simulacao.Processo(
 ProcessoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL UNIQUE REFERENCES Operacao.Participacao(ParticipacaoId),DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),CriadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),CriadoUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),Simulado bit NOT NULL CHECK(Simulado=1));
IF OBJECT_ID('Simulacao.Evento') IS NULL CREATE TABLE Simulacao.Evento(
 EventoId bigint IDENTITY PRIMARY KEY,ProcessoId bigint NOT NULL REFERENCES Simulacao.Processo(ProcessoId),Numero int NOT NULL,Acao varchar(60) NOT NULL,Estado varchar(50) NOT NULL,AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,ConteudoJson nvarchar(max) NOT NULL CHECK(ISJSON(ConteudoJson)=1),ConteudoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),Simulado bit NOT NULL CHECK(Simulado=1),UNIQUE(ProcessoId,Numero),UNIQUE(AtorId,RequisicaoId),CHECK(Estado IN('PROVISIONADO_GERENCIAL','PENDENTE_VALIDACAO','VALIDADO_LAB','OBRIGACAO_SIMULADA','LIBERADO_SIMULADO','PROGRAMADO_SIMULADO','PAGAMENTO_SIMULADO','CANCELADO_SIMULADO','ESTORNADO_SIMULADO')));
IF OBJECT_ID('Simulacao.ReciboVersao') IS NULL CREATE TABLE Simulacao.ReciboVersao(
 ReciboId bigint IDENTITY PRIMARY KEY,ProcessoId bigint NOT NULL REFERENCES Simulacao.Processo(ProcessoId),Numero int NOT NULL,AnteriorId bigint NULL REFERENCES Simulacao.ReciboVersao(ReciboId),Tipo varchar(40) NOT NULL CHECK(Tipo IN('MINUTA','PREPARADO_PARA_ASSINATURA','EMITIDO_APOS_PAGAMENTO')),ConteudoJson nvarchar(max) NOT NULL CHECK(ISJSON(ConteudoJson)=1),ConteudoHash char(64) NOT NULL,AutorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),Simulado bit NOT NULL CHECK(Simulado=1),UNIQUE(ProcessoId,Numero));
IF OBJECT_ID('Simulacao.Anexo') IS NULL CREATE TABLE Simulacao.Anexo(
 AnexoId bigint IDENTITY PRIMARY KEY,ProcessoId bigint NOT NULL REFERENCES Simulacao.Processo(ProcessoId),ReciboId bigint NULL REFERENCES Simulacao.ReciboVersao(ReciboId),Finalidade varchar(50) NOT NULL CHECK(Finalidade IN('EVIDENCIA_PAGAMENTO_SIMULADO','ASSINATURA_SINTETICA')),Nome nvarchar(120) NOT NULL,Mime varchar(40) NOT NULL CHECK(Mime IN('application/pdf','image/png','image/jpeg')),Conteudo varbinary(max) NOT NULL CHECK(DATALENGTH(Conteudo) BETWEEN 16 AND 2097152),ConteudoHash char(64) NOT NULL,AutorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),Simulado bit NOT NULL CHECK(Simulado=1),CHECK(ConteudoHash=LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',Conteudo),2))));
GO
CREATE OR ALTER TRIGGER Simulacao.ProcessoImutavel ON Simulacao.Processo INSTEAD OF UPDATE,DELETE AS THROW 55701,N'Historico simulado imutavel',1;
GO
CREATE OR ALTER TRIGGER Simulacao.EventoImutavel ON Simulacao.Evento INSTEAD OF UPDATE,DELETE AS THROW 55701,N'Historico simulado imutavel',1;
GO
CREATE OR ALTER TRIGGER Simulacao.ReciboImutavel ON Simulacao.ReciboVersao INSTEAD OF UPDATE,DELETE AS THROW 55701,N'Historico simulado imutavel',1;
GO
CREATE OR ALTER TRIGGER Simulacao.AnexoImutavel ON Simulacao.Anexo INSTEAD OF UPDATE,DELETE AS THROW 55701,N'Anexo simulado imutavel',1;
GO
IF COL_LENGTH('Simulacao.Evento','PagamentoReferencia') IS NULL ALTER TABLE Simulacao.Evento ADD PagamentoReferencia AS CONVERT(varchar(120),JSON_VALUE(ConteudoJson,'$.dados.referencia')) PERSISTED;
IF COL_LENGTH('Simulacao.Evento','PagamentoAnexoHash') IS NULL ALTER TABLE Simulacao.Evento ADD PagamentoAnexoHash AS CONVERT(char(64),JSON_VALUE(ConteudoJson,'$.dados.anexoHash')) PERSISTED;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Simulacao.Evento') AND name='UX_Lab_PagamentoParticipacao') CREATE UNIQUE INDEX UX_Lab_PagamentoParticipacao ON Simulacao.Evento(ProcessoId) WHERE Acao='REGISTRAR_PAGAMENTO';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Simulacao.Evento') AND name='UX_Lab_PagamentoReferencia') CREATE UNIQUE INDEX UX_Lab_PagamentoReferencia ON Simulacao.Evento(PagamentoReferencia) WHERE Acao='REGISTRAR_PAGAMENTO';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Simulacao.Evento') AND name='UX_Lab_PagamentoEvidencia') CREATE UNIQUE INDEX UX_Lab_PagamentoEvidencia ON Simulacao.Evento(PagamentoAnexoHash) WHERE Acao='REGISTRAR_PAGAMENTO';
