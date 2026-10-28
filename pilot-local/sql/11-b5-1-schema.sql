-- LAB ONLY. No payable/payment/receipt tables are created.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54700,N'Somente laboratorio',1;
IF SCHEMA_ID('Financeiro') IS NULL EXEC(N'CREATE SCHEMA Financeiro');
IF OBJECT_ID('Financeiro.ReferenciaCarteira','U') IS NULL
CREATE TABLE Financeiro.ReferenciaCarteira(
 ParticipacaoId bigint PRIMARY KEY REFERENCES Operacao.Participacao(ParticipacaoId),Referencia varchar(64) NOT NULL UNIQUE,
 CriadoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('Financeiro.AvaliacaoCarteira','U') IS NULL
CREATE TABLE Financeiro.AvaliacaoCarteira(
 AvaliacaoId bigint IDENTITY PRIMARY KEY,ParticipacaoId bigint NOT NULL REFERENCES Financeiro.ReferenciaCarteira(ParticipacaoId),
 AtorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),RequisicaoId uniqueidentifier NOT NULL,ComandoHash char(64) NOT NULL,
 Resultado varchar(32) NOT NULL CHECK(Resultado IN ('CANDIDATA_AUTORIZACAO','BLOQUEADA')),RegrasVersao varchar(20) NOT NULL CHECK(RegrasVersao='B5.1-1.0.0'),
 VersaoDados char(64) NOT NULL,VersaoConsulta char(64) NOT NULL,FechamentoId bigint NULL REFERENCES Operacao.FechamentoParticipacao(FechamentoId),
 ComprovanteId uniqueidentifier NULL REFERENCES Operacao.ComprovanteServico(ComprovanteId),VersaoComprovante char(64) NULL,
 MotivosJson nvarchar(max) NOT NULL CHECK(ISJSON(MotivosJson)=1),AuditoriaId bigint NOT NULL REFERENCES Seguranca.Auditoria(AuditoriaId),
 CriadoUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(AtorId,RequisicaoId));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Financeiro.AvaliacaoCarteira') AND name='IX_B51_AvaliacaoParticipacao')
 CREATE INDEX IX_B51_AvaliacaoParticipacao ON Financeiro.AvaliacaoCarteira(ParticipacaoId,AvaliacaoId DESC) INCLUDE(AtorId,Resultado,VersaoConsulta,AuditoriaId,CriadoUtc);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Seguranca.Auditoria') AND name='IX_B51_AuditoriaReferencia')
 CREATE INDEX IX_B51_AuditoriaReferencia ON Seguranca.Auditoria(Entidade,EntidadeId,Acao,AuditoriaId);
GO
CREATE OR ALTER FUNCTION Financeiro.fn_ElegibilidadePreFinanceira(@ParticipacaoId bigint,@VersaoAtual char(64),@PendenciasJson nvarchar(max),@ComprovanteIntegro bit)
RETURNS TABLE AS RETURN
 SELECT DISTINCT Motivo FROM (
  SELECT CONVERT(varchar(80),j.[value]) Motivo FROM OPENJSON(@PendenciasJson) j
  UNION ALL SELECT 'FECHAMENTO_AUSENTE' WHERE NOT EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao WHERE ParticipacaoId=@ParticipacaoId)
  UNION ALL SELECT 'FECHAMENTO_NAO_REGULAR' WHERE EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao WHERE ParticipacaoId=@ParticipacaoId AND Resultado<>'FECHADO_REGULAR')
  UNION ALL SELECT 'CONTEXTO_DESATUALIZADO' WHERE EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao WHERE ParticipacaoId=@ParticipacaoId AND VersaoDados<>@VersaoAtual)
  UNION ALL SELECT 'COMPROVANTE_AUSENTE' WHERE NOT EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao f JOIN Operacao.ComprovanteServico c ON c.FechamentoId=f.FechamentoId WHERE f.ParticipacaoId=@ParticipacaoId)
  UNION ALL SELECT 'COMPROVANTE_INTEGRO_INVALIDO' WHERE @ComprovanteIntegro=0
  UNION ALL SELECT 'CONTRATO_NAO_SUPORTADO' WHERE EXISTS(SELECT 1 FROM Operacao.FechamentoParticipacao f JOIN Operacao.ComprovanteServico c ON c.FechamentoId=f.FechamentoId WHERE f.ParticipacaoId=@ParticipacaoId AND c.VersaoContrato<>'1.0.0')
  UNION ALL SELECT 'CONTRATACAO_NAO_CONFIRMADA' WHERE EXISTS(SELECT 1 FROM Operacao.Participacao WHERE ParticipacaoId=@ParticipacaoId AND Status<>'CONFIRMADA')
  UNION ALL SELECT 'EVENTOS_INCOMPLETOS_OU_INVALIDOS' WHERE (SELECT COUNT(*) FROM Operacao.EventoApontamento WHERE ParticipacaoId=@ParticipacaoId)<>2 OR NOT EXISTS(SELECT 1 FROM Operacao.EventoApontamento en JOIN Operacao.EventoApontamento sa ON sa.ParticipacaoId=en.ParticipacaoId AND sa.Tipo='SAIDA' AND sa.EventoId>en.EventoId AND sa.InstanteUtc>=en.InstanteUtc WHERE en.ParticipacaoId=@ParticipacaoId AND en.Tipo='ENTRADA')
  UNION ALL SELECT 'CONTEXTO_APONTAMENTO_ALTERADO' WHERE EXISTS(SELECT 1 FROM Operacao.EventoApontamento e JOIN Operacao.CodigoApontamento c ON c.CodigoId=e.CodigoId JOIN Operacao.Participacao p ON p.ParticipacaoId=e.ParticipacaoId JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId WHERE e.ParticipacaoId=@ParticipacaoId AND (c.ParticipacaoId<>p.ParticipacaoId OR c.AtividadeId<>a.AtividadeId OR c.PrestadorId<>p.PrestadorId OR c.DepositoId<>a.DepositoId OR c.FilialId<>d.FilialId OR c.TipoServicoId<>a.TipoServicoId OR c.GestorUsuarioId<>a.GestorUsuarioId OR c.ValorContratado<>p.ValorContratado OR c.InicioPrevisto<>a.InicioPrevisto OR c.FimPrevisto<>a.FimPrevisto))
  UNION ALL SELECT 'CADASTRO_OU_ATIVIDADE_INATIVA' WHERE EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId JOIN Cadastro.Filial f ON f.FilialId=d.FilialId JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId JOIN Cadastro.TipoServico ts ON ts.TipoServicoId=a.TipoServicoId WHERE p.ParticipacaoId=@ParticipacaoId AND (a.Status='CANCELADA' OR d.Ativo=0 OR f.Ativo=0 OR pr.Ativo=0 OR ts.Ativo=0))
  UNION ALL SELECT 'CONFERENCIA_PENDENTE' WHERE NOT EXISTS(SELECT 1 FROM Operacao.ConferenciaApontamento WHERE ParticipacaoId=@ParticipacaoId)
  UNION ALL SELECT 'CONFERENCIA_DIVERGENTE' WHERE EXISTS(SELECT 1 FROM Operacao.ConferenciaApontamento WHERE ParticipacaoId=@ParticipacaoId AND Decisao<>'CONFERIDO')
  UNION ALL SELECT 'CORRECAO_PENDENTE' WHERE EXISTS(SELECT 1 FROM Operacao.CorrecaoApontamento c JOIN Operacao.EventoApontamento e ON e.EventoId=c.EventoId LEFT JOIN Operacao.DecisaoCorrecaoApontamento dc ON dc.CorrecaoId=c.CorrecaoId WHERE e.ParticipacaoId=@ParticipacaoId AND (dc.CorrecaoId IS NULL OR dc.Aprovada=1))
  UNION ALL SELECT 'OCORRENCIA_SEM_RESOLUCAO_APROVADA' WHERE EXISTS(SELECT 1 FROM Operacao.OcorrenciaParticipacao WHERE ParticipacaoId=@ParticipacaoId)
  UNION ALL SELECT 'AJUSTE_SEM_POLITICA_APROVADA' WHERE EXISTS(SELECT 1 FROM Operacao.AjusteApontamento a JOIN Operacao.EventoApontamento e ON e.EventoId=a.EventoOriginalId WHERE e.ParticipacaoId=@ParticipacaoId)
 ) reasons;
GO
CREATE OR ALTER TRIGGER Financeiro.tr_B51_Referencia ON Financeiro.ReferenciaCarteira INSTEAD OF UPDATE,DELETE AS
BEGIN THROW 54701,N'Referencia pre-financeira imutavel',1; END;
GO
CREATE OR ALTER TRIGGER Financeiro.tr_B51_Avaliacao ON Financeiro.AvaliacaoCarteira INSTEAD OF UPDATE,DELETE AS
BEGIN THROW 54702,N'Avaliacao historica imutavel; reavaliar em outro registro',1; END;
