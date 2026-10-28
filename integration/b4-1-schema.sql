-- Overlay exclusivo de laboratório. Aplicar dentro da transação do instalador isolado.
IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 54400,N'Somente laboratorio B3',1;
IF OBJECT_ID('Operacao.TabletApontamento','U') IS NULL
CREATE TABLE Operacao.TabletApontamento(
 TabletId bigint IDENTITY PRIMARY KEY,
 DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
 EmissorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 PareamentoHash char(64) NOT NULL UNIQUE, PareamentoExpiraUtc datetime2(3) NOT NULL,
 TokenHash char(64) NULL, ExpiraUtc datetime2(3) NOT NULL,
 AtivadoUtc datetime2(3) NULL,RevogadoUtc datetime2(3) NULL,
 Falhas tinyint NOT NULL DEFAULT 0 CHECK(Falhas BETWEEN 0 AND 5),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.TabletApontamento') AND name='UX_B41_TabletToken')
CREATE UNIQUE INDEX UX_B41_TabletToken ON Operacao.TabletApontamento(TokenHash) WHERE TokenHash IS NOT NULL;
IF OBJECT_ID('Operacao.CodigoApontamento','U') IS NULL
CREATE TABLE Operacao.CodigoApontamento(
 CodigoId bigint IDENTITY PRIMARY KEY,Geracao uniqueidentifier NOT NULL UNIQUE,
 ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),
 AtividadeId bigint NOT NULL REFERENCES Operacao.Atividade(AtividadeId),
 PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
 DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),
 TipoServicoId bigint NOT NULL REFERENCES Cadastro.TipoServico(TipoServicoId),GestorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),ValorContratado decimal(18,2) NOT NULL,
 InicioPrevisto datetime2(0) NOT NULL,FimPrevisto datetime2(0) NOT NULL,
 EntradaHash char(64) NOT NULL UNIQUE,SaidaHash char(64) NOT NULL UNIQUE,
 EmissorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),ExpiraUtc datetime2(3) NOT NULL,
 RevogadoUtc datetime2(3) NULL,EntradaConsumidaUtc datetime2(3) NULL,SaidaConsumidaUtc datetime2(3) NULL,
 CHECK(EntradaHash<>SaidaHash),CHECK(ExpiraUtc>CriadoUtc),CHECK(FimPrevisto>InicioPrevisto));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.CodigoApontamento') AND name='UX_B41_CodigoAtual')
CREATE UNIQUE INDEX UX_B41_CodigoAtual ON Operacao.CodigoApontamento(ParticipacaoId) WHERE RevogadoUtc IS NULL;
IF OBJECT_ID('Operacao.EventoApontamento','U') IS NULL
CREATE TABLE Operacao.EventoApontamento(
 EventoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),
 CodigoId bigint NOT NULL REFERENCES Operacao.CodigoApontamento(CodigoId),TabletId bigint NOT NULL REFERENCES Operacao.TabletApontamento(TabletId),
 Tipo varchar(7) NOT NULL CHECK(Tipo IN ('ENTRADA','SAIDA')),InstanteUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 Conferencia varchar(10) NOT NULL DEFAULT 'PENDENTE' CHECK(Conferencia='PENDENTE'),
 UNIQUE(ParticipacaoId,Tipo),UNIQUE(TabletId,RequisicaoId));
IF OBJECT_ID('Operacao.TentativaApontamento','U') IS NULL
CREATE TABLE Operacao.TentativaApontamento(
 TentativaId bigint IDENTITY PRIMARY KEY,TabletId bigint NULL REFERENCES Operacao.TabletApontamento(TabletId),
 Resultado varchar(40) NOT NULL,InstanteUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 RequisicaoId uniqueidentifier NULL);
GO
