IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55000,N'Somente laboratorio',1;
IF OBJECT_ID('Financeiro.ProntidaoVersao','U') IS NULL
CREATE TABLE Financeiro.ProntidaoVersao(
 VersaoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),
 Tipo varchar(20) NOT NULL CHECK(Tipo IN('BENEFICIARIO','POLITICA')),Numero int NOT NULL CHECK(Numero>0),AnteriorId bigint NULL REFERENCES Financeiro.ProntidaoVersao(VersaoId),
 AutorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),ContextoHash char(64) NOT NULL,ConteudoHash char(64) NOT NULL,
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),DadosJson nvarchar(max) NOT NULL CHECK(ISJSON(DadosJson)=1),
 UNIQUE(ParticipacaoId,Tipo,Numero),UNIQUE(AutorId,RequisicaoId));
IF OBJECT_ID('Financeiro.ProntidaoDecisao','U') IS NULL
CREATE TABLE Financeiro.ProntidaoDecisao(
 DecisaoId bigint IDENTITY PRIMARY KEY,VersaoId bigint NOT NULL UNIQUE REFERENCES Financeiro.ProntidaoVersao(VersaoId),
 AprovadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Resultado varchar(10) NOT NULL CHECK(Resultado IN('VALIDADA','RECUSADA')),
 Motivo nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),ReferenciaFormal nvarchar(200) NOT NULL CHECK(LEN(LTRIM(RTRIM(ReferenciaFormal)))>0),
 AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
GO
CREATE OR ALTER TRIGGER Financeiro.B52B_VersaoImutavel ON Financeiro.ProntidaoVersao INSTEAD OF UPDATE,DELETE AS THROW 55001,N'Versao imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.B52B_DecisaoImutavel ON Financeiro.ProntidaoDecisao INSTEAD OF UPDATE,DELETE AS THROW 55002,N'Decisao imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.B52B_Independencia ON Financeiro.ProntidaoDecisao AFTER INSERT AS
BEGIN IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.ProntidaoVersao v ON v.VersaoId=i.VersaoId WHERE v.AutorId=i.AprovadorId) THROW 55003,N'Aprovador independente obrigatorio',1; END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.ProntidaoVersao')) ALTER TABLE Financeiro.ProntidaoVersao ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.ProntidaoDecisao')) ALTER TABLE Financeiro.ProntidaoDecisao ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica)
SELECT k,'FINANCEIRO',N'Prontidao informativa B5.2B',CASE WHEN k LIKE '%consultar' THEN 0 ELSE 1 END FROM (VALUES
('financeiro.prontidao.consultar'),('financeiro.prontidao.configurar'),('financeiro.prontidao.validar'))v(k)
WHERE NOT EXISTS(SELECT 1 FROM Seguranca.Permissao p WHERE p.Chave=v.k);
