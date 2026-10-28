IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55200,N'Somente laboratorio',1;
IF OBJECT_ID('Operacao.ContratoIndividual','U') IS NULL CREATE TABLE Operacao.ContratoIndividual(
 ParticipacaoId bigint PRIMARY KEY REFERENCES Operacao.Participacao(ParticipacaoId),Versao uniqueidentifier NOT NULL UNIQUE DEFAULT NEWID(),
 ValorOriginal decimal(18,2) NOT NULL,Origem varchar(35) NOT NULL CHECK(Origem IN('CONFIRMACAO_TRANSACIONAL','BASELINE_NAO_VERIFICADA')),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),ContextoJson nvarchar(max) NOT NULL CHECK(ISJSON(ContextoJson)=1));
INSERT Operacao.ContratoIndividual(ParticipacaoId,ValorOriginal,Origem,ContextoJson)
SELECT p.ParticipacaoId,p.ValorContratado,'BASELINE_NAO_VERIFICADA',(SELECT p.ParticipacaoId participacaoId,p.PrestadorId prestadorId,p.AtividadeId atividadeId,a.DepositoId depositoId,d.FilialId filialId,a.TipoServicoId servicoId,p.ValorContratado valorContratado FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)
FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId
WHERE (p.Status NOT IN('PLANEJADA','AGUARDANDO_APROVACAO') OR EXISTS(SELECT 1 FROM Seguranca.Auditoria au WHERE au.Entidade='Participacao' AND au.EntidadeId=p.ParticipacaoId AND au.Acao='CONFIRMAR')) AND NOT EXISTS(SELECT 1 FROM Operacao.ContratoIndividual c WHERE c.ParticipacaoId=p.ParticipacaoId);
IF OBJECT_ID('Financeiro.RegraFuncional','U') IS NULL CREATE TABLE Financeiro.RegraFuncional(
 VersaoId bigint IDENTITY PRIMARY KEY,PoliticaId uniqueidentifier NOT NULL,Numero int NOT NULL,AnteriorId bigint NULL REFERENCES Financeiro.RegraFuncional(VersaoId),
 Tipo varchar(15) NOT NULL CHECK(Tipo IN('VENCIMENTO','ALCADA')),DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
 AutorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),ConteudoHash char(64) NOT NULL,DadosJson nvarchar(max) NOT NULL CHECK(ISJSON(DadosJson)=1),
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(PoliticaId,Numero),UNIQUE(AutorId,RequisicaoId));
IF OBJECT_ID('Financeiro.EventoRegraFuncional','U') IS NULL CREATE TABLE Financeiro.EventoRegraFuncional(
 EventoId bigint IDENTITY PRIMARY KEY,VersaoId bigint NOT NULL REFERENCES Financeiro.RegraFuncional(VersaoId),Estado varchar(25) NOT NULL CHECK(Estado IN('ENCAMINHADA','PUBLICADA_LAB','REVOGADA_LAB')),
 AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Motivo nvarchar(800) NOT NULL,Referencia nvarchar(200) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(VersaoId,Estado));
IF OBJECT_ID('Financeiro.ExcecaoVencimentoLab','U') IS NULL CREATE TABLE Financeiro.ExcecaoVencimentoLab(
 ExcecaoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),VersaoId bigint NOT NULL REFERENCES Financeiro.RegraFuncional(VersaoId),
 DataMarco date NOT NULL,ReferenciaMarco nvarchar(200) NOT NULL,DataOriginal date NOT NULL,DataProposta date NOT NULL,ContextoHash char(64) NOT NULL,
 SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Justificativa nvarchar(800) NOT NULL,RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(SolicitanteId,RequisicaoId));
IF OBJECT_ID('Financeiro.DecisaoExcecaoVencimentoLab','U') IS NULL CREATE TABLE Financeiro.DecisaoExcecaoVencimentoLab(
 ExcecaoId bigint PRIMARY KEY REFERENCES Financeiro.ExcecaoVencimentoLab(ExcecaoId),AprovadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Resultado varchar(15) NOT NULL CHECK(Resultado IN('ACEITA_LAB','RECUSADA_LAB')),Motivo nvarchar(800) NOT NULL,AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('Financeiro.EtapaAlcadaLab','U') IS NULL CREATE TABLE Financeiro.EtapaAlcadaLab(
 EtapaId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),VersaoId bigint NOT NULL REFERENCES Financeiro.RegraFuncional(VersaoId),
 Ordem int NOT NULL CHECK(Ordem IN(1,2)),AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),ContextoHash char(64) NOT NULL,AcessoHash char(64) NOT NULL,SnapshotJson nvarchar(max) NOT NULL CHECK(ISJSON(SnapshotJson)=1),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(ParticipacaoId,VersaoId,Ordem),UNIQUE(ParticipacaoId,VersaoId,AtorId));
GO
CREATE OR ALTER TRIGGER Operacao.F01_ContratoImutavel ON Operacao.ContratoIndividual INSTEAD OF UPDATE,DELETE AS THROW 55211,N'Contrato individual imutavel',1;
GO
CREATE OR ALTER TRIGGER Operacao.F01_FixarContrato ON Operacao.Participacao AFTER INSERT,UPDATE,DELETE AS
BEGIN
 IF EXISTS(SELECT 1 FROM deleted p JOIN Operacao.ContratoIndividual c ON c.ParticipacaoId=p.ParticipacaoId LEFT JOIN inserted i ON i.ParticipacaoId=p.ParticipacaoId WHERE i.ParticipacaoId IS NULL OR i.ValorContratado<>c.ValorOriginal OR i.PrestadorId<>p.PrestadorId OR i.AtividadeId<>p.AtividadeId) THROW 55210,N'Revisao contratual nao autorizada',1;
 INSERT Operacao.ContratoIndividual(ParticipacaoId,ValorOriginal,Origem,ContextoJson)
 SELECT p.ParticipacaoId,p.ValorContratado,'CONFIRMACAO_TRANSACIONAL',(SELECT p.ParticipacaoId participacaoId,p.PrestadorId prestadorId,p.AtividadeId atividadeId,a.DepositoId depositoId,d.FilialId filialId,a.TipoServicoId servicoId,p.ValorContratado valorContratado FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)
 FROM inserted p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId WHERE p.Status='CONFIRMADA' AND NOT EXISTS(SELECT 1 FROM Operacao.ContratoIndividual c WHERE c.ParticipacaoId=p.ParticipacaoId);
END;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_RegraImutavel ON Financeiro.RegraFuncional INSTEAD OF UPDATE,DELETE AS THROW 55212,N'Regra imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_EventoImutavel ON Financeiro.EventoRegraFuncional INSTEAD OF UPDATE,DELETE AS THROW 55212,N'Evento imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_ExcecaoImutavel ON Financeiro.ExcecaoVencimentoLab INSTEAD OF UPDATE,DELETE AS THROW 55212,N'Excecao imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_DecisaoImutavel ON Financeiro.DecisaoExcecaoVencimentoLab INSTEAD OF UPDATE,DELETE AS THROW 55212,N'Decisao imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_EtapaImutavel ON Financeiro.EtapaAlcadaLab INSTEAD OF UPDATE,DELETE AS THROW 55212,N'Etapa imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_PublicadorIndependente ON Financeiro.EventoRegraFuncional AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.RegraFuncional p ON p.VersaoId=i.VersaoId WHERE i.Estado='PUBLICADA_LAB' AND i.AtorId=p.AutorId) THROW 55213,N'Publicador independente obrigatorio',1; END;
GO
CREATE OR ALTER TRIGGER Financeiro.F01_DecisorIndependente ON Financeiro.DecisaoExcecaoVencimentoLab AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.ExcecaoVencimentoLab p ON p.ExcecaoId=i.ExcecaoId WHERE i.AprovadorId=p.SolicitanteId) THROW 55214,N'Decisor independente obrigatorio',1; END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Operacao.ContratoIndividual')) ALTER TABLE Operacao.ContratoIndividual ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.RegraFuncional')) ALTER TABLE Financeiro.RegraFuncional ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.EventoRegraFuncional')) ALTER TABLE Financeiro.EventoRegraFuncional ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.ExcecaoVencimentoLab')) ALTER TABLE Financeiro.ExcecaoVencimentoLab ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.DecisaoExcecaoVencimentoLab')) ALTER TABLE Financeiro.DecisaoExcecaoVencimentoLab ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Financeiro.EtapaAlcadaLab')) ALTER TABLE Financeiro.EtapaAlcadaLab ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Seguranca.UsuarioDeposito')) ALTER TABLE Seguranca.UsuarioDeposito ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Seguranca.UsuarioPerfil')) ALTER TABLE Seguranca.UsuarioPerfil ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Seguranca.PerfilPermissao')) ALTER TABLE Seguranca.PerfilPermissao ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM sys.change_tracking_tables WHERE object_id=OBJECT_ID('Seguranca.PerfilAcesso')) ALTER TABLE Seguranca.PerfilAcesso ENABLE CHANGE_TRACKING WITH(TRACK_COLUMNS_UPDATED=OFF);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.consultar') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.consultar','FINANCEIRO',N'Laboratorio F01',0);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.configurar') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.configurar','FINANCEIRO',N'Laboratorio F01',1);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.publicar') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.publicar','FINANCEIRO',N'Laboratorio F01',1);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.excecao.solicitar') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.excecao.solicitar','FINANCEIRO',N'Laboratorio F01',1);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.excecao.decidir') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.excecao.decidir','FINANCEIRO',N'Laboratorio F01',1);
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.f01.alcada.simular') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.f01.alcada.simular','FINANCEIRO',N'Laboratorio F01',1);
GO
CREATE OR ALTER TRIGGER Financeiro.F01_EtapaConsistente ON Financeiro.EtapaAlcadaLab AFTER INSERT AS
BEGIN
 IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.RegraFuncional p ON p.VersaoId=i.VersaoId LEFT JOIN Financeiro.SolicitacaoAutorizacao s ON s.ParticipacaoId=i.ParticipacaoId
 WHERE p.Tipo<>'ALCADA' OR p.AutorId=i.AtorId OR s.SolicitanteId=i.AtorId OR s.SolicitacaoId IS NULL OR s.VersaoConsulta<>i.ContextoHash
 OR NOT EXISTS(SELECT 1 FROM Financeiro.EventoRegraFuncional e WHERE e.VersaoId=p.VersaoId AND e.Estado='PUBLICADA_LAB')
 OR EXISTS(SELECT 1 FROM Financeiro.EventoRegraFuncional e WHERE e.VersaoId=p.VersaoId AND (e.Estado='REVOGADA_LAB' OR e.Estado='PUBLICADA_LAB' AND e.AtorId=i.AtorId))
 OR i.Ordem>TRY_CONVERT(int,JSON_VALUE(p.DadosJson,'$.aprovadores'))
 OR i.Ordem=2 AND NOT EXISTS(SELECT 1 FROM Financeiro.EtapaAlcadaLab e WHERE e.ParticipacaoId=i.ParticipacaoId AND e.VersaoId=i.VersaoId AND e.Ordem=1 AND e.AtorId<>i.AtorId)
 OR ISNULL(JSON_VALUE(i.SnapshotJson,'$.resultado'),'')<>'APTO_LAB'
 OR ISNULL(JSON_VALUE(i.SnapshotJson,'$.aprovacaoFinanceira'),'')<>'false'
 OR ISNULL(JSON_VALUE(i.SnapshotJson,'$.obrigacaoCriada'),'')<>'false'
 OR ISNULL(JSON_VALUE(i.SnapshotJson,'$.conteudoHash'),'')<>p.ConteudoHash)
 THROW 55215,N'Etapa laboratorial inconsistente ou sem independencia',1;
END;
