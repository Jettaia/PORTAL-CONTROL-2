IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54800,N'Somente laboratorio',1;
IF OBJECT_ID('Financeiro.SolicitacaoAutorizacao','U') IS NULL
CREATE TABLE Financeiro.SolicitacaoAutorizacao(
 SolicitacaoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL UNIQUE REFERENCES Operacao.Participacao(ParticipacaoId),
 AvaliacaoId bigint NOT NULL REFERENCES Financeiro.AvaliacaoCarteira(AvaliacaoId),SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,VersaoConsulta char(64) NOT NULL,
 ValorHistorico decimal(18,2) NOT NULL CHECK(ValorHistorico>=0),FechamentoId bigint NOT NULL REFERENCES Operacao.FechamentoParticipacao(FechamentoId),
 ComprovanteId uniqueidentifier NOT NULL REFERENCES Operacao.ComprovanteServico(ComprovanteId),VersaoComprovante char(64) NOT NULL,
 SnapshotJson nvarchar(max) NOT NULL CHECK(ISJSON(SnapshotJson)=1),Justificativa nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Justificativa)))>0),
 AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(SolicitanteId,RequisicaoId));
IF OBJECT_ID('Financeiro.DecisaoAutorizacao','U') IS NULL
CREATE TABLE Financeiro.DecisaoAutorizacao(
 DecisaoId bigint IDENTITY PRIMARY KEY,SolicitacaoId bigint NOT NULL UNIQUE REFERENCES Financeiro.SolicitacaoAutorizacao(SolicitacaoId),
 AprovadorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Resultado varchar(10) NOT NULL CHECK(Resultado IN ('APROVADA','RECUSADA')),
 Motivo nvarchar(800) NOT NULL CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(AprovadorId,RequisicaoId));
-- Estrutura vazia para futura politica. Nenhuma obrigacao pode ser constituida neste incremento.
IF OBJECT_ID('Financeiro.ObrigacaoPreparada','U') IS NULL
CREATE TABLE Financeiro.ObrigacaoPreparada(
 ObrigacaoId uniqueidentifier PRIMARY KEY,ParticipacaoId bigint NOT NULL UNIQUE REFERENCES Operacao.Participacao(ParticipacaoId),
 DecisaoId bigint NOT NULL UNIQUE REFERENCES Financeiro.DecisaoAutorizacao(DecisaoId),PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
 FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
 TipoServicoId bigint NOT NULL REFERENCES Cadastro.TipoServico(TipoServicoId),ValorAprovado decimal(18,2) NOT NULL,
 ReferenciaHistorica char(64) NOT NULL,Competencia date NOT NULL,Vencimento date NOT NULL,PoliticaVersao varchar(80) NOT NULL,
 Status varchar(20) NOT NULL CHECK(Status='CONSTITUIDA'),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId));
GO
CREATE OR ALTER TRIGGER Financeiro.B52_SolicitacaoImutavel ON Financeiro.SolicitacaoAutorizacao INSTEAD OF UPDATE,DELETE AS THROW 54801,N'Solicitacao imutavel',1;
GO
CREATE OR ALTER TRIGGER Financeiro.B52_DecisaoProtegida ON Financeiro.DecisaoAutorizacao AFTER INSERT,UPDATE,DELETE AS
BEGIN
 IF EXISTS(SELECT 1 FROM deleted) THROW 54802,N'Decisao imutavel',1;
 IF EXISTS(SELECT 1 FROM inserted i JOIN Financeiro.SolicitacaoAutorizacao s ON s.SolicitacaoId=i.SolicitacaoId WHERE s.SolicitanteId=i.AprovadorId) THROW 54803,N'Segregacao obrigatoria',1;
END;
GO
CREATE OR ALTER TRIGGER Financeiro.B52_ObrigacaoBloqueada ON Financeiro.ObrigacaoPreparada INSTEAD OF INSERT,UPDATE,DELETE AS THROW 54804,N'Politicas funcionais e fiscais nao aprovadas',1;
GO
IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='financeiro.autorizacao.consultar')
 INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('financeiro.autorizacao.consultar','FINANCEIRO',N'Consultar autorizacoes financeiras',0),('financeiro.autorizacao.solicitar','FINANCEIRO',N'Solicitar autorizacao financeira',1),('financeiro.autorizacao.decidir','FINANCEIRO',N'Decidir autorizacao financeira independente',1),('financeiro.autorizacao.preparar','FINANCEIRO',N'Consultar impedimentos de constituicao',1);
GO
