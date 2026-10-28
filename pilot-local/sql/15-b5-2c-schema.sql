IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55100,N'Somente laboratorio',1;
IF OBJECT_ID('Financeiro.EncaminhamentoPolitica','U') IS NULL
CREATE TABLE Financeiro.EncaminhamentoPolitica(
 EncaminhamentoId bigint IDENTITY PRIMARY KEY,VersaoId bigint NOT NULL UNIQUE REFERENCES Financeiro.ProntidaoVersao(VersaoId),
 Estado varchar(30) NOT NULL CHECK(Estado='PENDENTE_APROVACAO'),AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 ContextoHash char(64) NOT NULL,ConteudoHash char(64) NOT NULL,RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 Motivo nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(AtorId,RequisicaoId));
GO
CREATE OR ALTER TRIGGER Financeiro.B52C_EncaminhamentoImutavel ON Financeiro.EncaminhamentoPolitica INSTEAD OF UPDATE,DELETE AS THROW 55101,N'Encaminhamento imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.B52C_FontePolitica ON Financeiro.EncaminhamentoPolitica AFTER INSERT AS
BEGIN IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.ProntidaoVersao v ON v.VersaoId=i.VersaoId WHERE v.Tipo<>'POLITICA' OR v.ContextoHash<>i.ContextoHash OR v.ConteudoHash<>i.ConteudoHash) THROW 55102,N'Fonte da politica invalida',1; END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.EncaminhamentoPolitica')) ALTER TABLE Financeiro.EncaminhamentoPolitica ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.prontidao.encaminhar') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.prontidao.encaminhar','FINANCEIRO',N'Encaminhar proposta sem efeito financeiro',1);
