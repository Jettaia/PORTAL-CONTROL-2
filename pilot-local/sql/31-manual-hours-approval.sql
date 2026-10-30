-- Additive approval workflow. No business rows are removed or re-created.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55960,N'Aprovacao de horarios exige transacao externa',1;
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL THROW 55960,N'Contratacoes nao instaladas',1;
IF COL_LENGTH('Operacao.Contratacao','LiberacaoBloqueada') IS NULL
 ALTER TABLE Operacao.Contratacao ADD LiberacaoBloqueada bit NOT NULL CONSTRAINT DF_Contratacao_LiberacaoBloqueada DEFAULT(0);
GO
-- Preserve the lock even for a contract re-opened by an older software version.
UPDATE c SET LiberacaoBloqueada=1 FROM Operacao.Contratacao c
WHERE c.LiberacaoBloqueada=0 AND (c.Status='LIBERADA' OR c.PagoEmUtc IS NOT NULL OR EXISTS(
 SELECT 1 FROM Operacao.ContratacaoEvento e WHERE e.ContratacaoId=c.ContratacaoId AND e.Acao='CONFERIR'));
IF OBJECT_ID('Operacao.ContratacaoHorarioSolicitacao','U') IS NULL
 CREATE TABLE Operacao.ContratacaoHorarioSolicitacao(
  SolicitacaoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContratacaoHorarioSolicitacao PRIMARY KEY,
  ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  EntradaReal datetime2(0) NOT NULL,SaidaReal datetime2(0) NOT NULL,
  Motivo nvarchar(800) NOT NULL,SolicitanteId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_HorarioSolicitado_Criado DEFAULT SYSUTCDATETIME(),
  Status varchar(10) NOT NULL CONSTRAINT DF_HorarioSolicitado_Status DEFAULT('PENDENTE'),
  DecididoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),DecididoEmUtc datetime2(3) NULL,
  CONSTRAINT CK_HorarioSolicitado_Periodo CHECK(SaidaReal>EntradaReal),
  CONSTRAINT CK_HorarioSolicitado_Motivo CHECK(LEN(LTRIM(RTRIM(Motivo)))>0),
  CONSTRAINT CK_HorarioSolicitado_Status CHECK(Status IN('PENDENTE','APROVADA','NEGADA','CANCELADA')),
  CONSTRAINT CK_HorarioSolicitado_Decisao CHECK(
   (Status='PENDENTE' AND DecididoPor IS NULL AND DecididoEmUtc IS NULL) OR
   (Status<>'PENDENTE' AND DecididoPor IS NOT NULL AND DecididoEmUtc IS NOT NULL))
 );
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoHorarioSolicitacao') AND name='UX_HorarioSolicitado_Pendente')
 CREATE UNIQUE INDEX UX_HorarioSolicitado_Pendente ON Operacao.ContratacaoHorarioSolicitacao(ContratacaoId) WHERE Status='PENDENTE';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.ContratacaoHorarioSolicitacao') AND name='IX_HorarioSolicitado_Historico')
 CREATE INDEX IX_HorarioSolicitado_Historico ON Operacao.ContratacaoHorarioSolicitacao(ContratacaoId,SolicitacaoId DESC);
GO
IF OBJECT_ID('Operacao.CK_PC04_EventoAcao','C') IS NOT NULL ALTER TABLE Operacao.ContratacaoEvento DROP CONSTRAINT CK_PC04_EventoAcao;
IF OBJECT_ID('Operacao.CK_PC05_EventoAcao','C') IS NOT NULL ALTER TABLE Operacao.ContratacaoEvento DROP CONSTRAINT CK_PC05_EventoAcao;
IF OBJECT_ID('Operacao.CK_HorarioSolicitado_EventoAcao','C') IS NULL
 ALTER TABLE Operacao.ContratacaoEvento ADD CONSTRAINT CK_HorarioSolicitado_EventoAcao CHECK(
  Acao IN('CRIAR','HORARIOS','CONFERIR','REVISAR','CANCELAR','TOKEN_GERAR','TOKEN_USAR','HORARIO_SOL','HORARIO_APROV','HORARIO_NEGADO'));
GO
