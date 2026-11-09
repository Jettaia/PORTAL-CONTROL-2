-- Preserve all contracts and history; allow more than one agreement per provider/day.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55980,N'Previsao exige transacao externa',1;
IF OBJECT_ID('Operacao.UQ_PC04_PrestadorData','UQ') IS NOT NULL
 ALTER TABLE Operacao.Contratacao DROP CONSTRAINT UQ_PC04_PrestadorData;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Operacao.Contratacao') AND name='IX_PC04_PrestadorData')
 CREATE INDEX IX_PC04_PrestadorData ON Operacao.Contratacao(PrestadorId,DataServico);
IF OBJECT_ID('Operacao.CK_HorarioSolicitado_EventoAcao','C') IS NOT NULL
 ALTER TABLE Operacao.ContratacaoEvento DROP CONSTRAINT CK_HorarioSolicitado_EventoAcao;
IF OBJECT_ID('Operacao.CK_PC04_PlanejamentoEvento','C') IS NULL
 ALTER TABLE Operacao.ContratacaoEvento WITH CHECK ADD CONSTRAINT CK_PC04_PlanejamentoEvento CHECK(
 Acao IN('CRIAR','PREVISTOS','HORARIOS','CONFERIR','REVISAR','CANCELAR','TOKEN_GERAR','TOKEN_USAR','HORARIO_SOL','HORARIO_APROV','HORARIO_NEGADO'));
GO
