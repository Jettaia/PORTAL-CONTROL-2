-- One-time retirement of legacy financial data; preserve operational and FIN02/03 data.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55980,N'FIN04 exige transacao externa',1;
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL OR OBJECT_ID('Financeiro.ContratacaoBaixa','U') IS NULL OR OBJECT_ID('Financeiro.ContratacaoRecibo','U') IS NULL OR OBJECT_ID('Financeiro.ContratacaoAnexo','U') IS NULL THROW 55980,N'Contratos FIN02/03 ausentes',1;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
IF @lock<0 THROW 55981,N'Nao foi possivel bloquear PC04 para FIN04',1;
DECLARE @marker nvarchar(32)=(SELECT CONVERT(nvarchar(32),value) FROM sys.extended_properties WHERE class=0 AND name='JETTA_FIN04_RESET');
IF @marker IS NOT NULL AND @marker<>N'1' THROW 55982,N'Marcador FIN04 desconhecido',1;

-- Detect new/unplanned incoming references before touching any legacy table.
DECLARE @allow table(SchemaName sysname NOT NULL,TableName sysname NOT NULL,PRIMARY KEY(SchemaName,TableName));
INSERT @allow VALUES
 (N'Financeiro',N'PC10Estorno'),(N'Financeiro',N'PC10Movimento'),(N'Financeiro',N'PC10DocumentoEstado'),
 (N'Financeiro',N'PC08Anexo'),(N'Financeiro',N'PC08Item'),(N'Financeiro',N'PC08Pagamento'),
 (N'Financeiro',N'EtapaAlcadaLab'),(N'Financeiro',N'DecisaoExcecaoVencimentoLab'),(N'Financeiro',N'ExcecaoVencimentoLab'),
 (N'Financeiro',N'EventoRegraFuncional'),(N'Financeiro',N'RegraFuncional'),(N'Financeiro',N'ObrigacaoPreparada'),
 (N'Financeiro',N'DecisaoAutorizacao'),(N'Financeiro',N'SolicitacaoAutorizacao'),(N'Financeiro',N'EncaminhamentoPolitica'),
 (N'Financeiro',N'ProntidaoDecisao'),(N'Financeiro',N'ProntidaoVersao'),(N'Financeiro',N'AvaliacaoCarteira'),(N'Financeiro',N'ReferenciaCarteira'),
 (N'Simulacao',N'Anexo'),(N'Simulacao',N'Evento'),(N'Simulacao',N'ReciboVersao'),(N'Simulacao',N'Processo');
IF EXISTS(SELECT 1 FROM @allow a LEFT JOIN sys.tables t ON t.name=a.TableName AND SCHEMA_NAME(t.schema_id)=a.SchemaName WHERE t.object_id IS NULL)
 THROW 55983,N'Esquema legado incompleto; reset cancelado',1;
IF EXISTS(
 SELECT 1 FROM sys.foreign_keys fk
 JOIN sys.tables parent ON parent.object_id=fk.parent_object_id
 JOIN sys.schemas ps ON ps.schema_id=parent.schema_id
 JOIN sys.tables referenced ON referenced.object_id=fk.referenced_object_id
 JOIN sys.schemas rs ON rs.schema_id=referenced.schema_id
 JOIN @allow target ON target.SchemaName=rs.name AND target.TableName=referenced.name
 LEFT JOIN @allow source ON source.SchemaName=ps.name AND source.TableName=parent.name
 WHERE source.TableName IS NULL)
 THROW 55984,N'Referencia externa inesperada para tabela financeira legada',1;

IF @marker IS NULL
BEGIN
 CREATE TABLE #FIN04EnabledTriggers(SchemaName sysname NOT NULL,TriggerName sysname NOT NULL,TableSchema sysname NOT NULL,TableName sysname NOT NULL);
 INSERT #FIN04EnabledTriggers
  SELECT OBJECT_SCHEMA_NAME(tr.object_id),tr.name,OBJECT_SCHEMA_NAME(tr.parent_id),OBJECT_NAME(tr.parent_id)
  FROM sys.triggers tr JOIN sys.tables tb ON tb.object_id=tr.parent_id JOIN sys.schemas sc ON sc.schema_id=tb.schema_id
  JOIN @allow a ON a.SchemaName=sc.name AND a.TableName=tb.name
  WHERE tr.parent_class=1 AND tr.is_disabled=0;
 DECLARE @triggerSchema sysname,@triggerName sysname,@tableSchema sysname,@tableName sysname,@sql nvarchar(max);
 DECLARE trigger_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT SchemaName,TriggerName,TableSchema,TableName FROM #FIN04EnabledTriggers;
 OPEN trigger_cursor; FETCH NEXT FROM trigger_cursor INTO @triggerSchema,@triggerName,@tableSchema,@tableName;
 WHILE @@FETCH_STATUS=0
 BEGIN
  SET @sql=N'DISABLE TRIGGER '+QUOTENAME(@triggerSchema)+N'.'+QUOTENAME(@triggerName)+N' ON '+QUOTENAME(@tableSchema)+N'.'+QUOTENAME(@tableName)+N';';
  EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM trigger_cursor INTO @triggerSchema,@triggerName,@tableSchema,@tableName;
 END
 CLOSE trigger_cursor; DEALLOCATE trigger_cursor;

 -- FK-safe child-first order. Self-referencing version chains are deleted leaf-first.
 DELETE Financeiro.PC10Estorno;
 DELETE Financeiro.PC10Movimento;
 DELETE Financeiro.PC10DocumentoEstado;
 DELETE Financeiro.PC08Anexo;
 DELETE Financeiro.PC08Item;
 DELETE Financeiro.PC08Pagamento;
 DELETE Financeiro.EtapaAlcadaLab;
 DELETE Financeiro.DecisaoExcecaoVencimentoLab;
 DELETE Financeiro.ExcecaoVencimentoLab;
 DELETE Financeiro.EventoRegraFuncional;
 WHILE EXISTS(SELECT 1 FROM Financeiro.RegraFuncional)
 BEGIN
  DELETE p FROM Financeiro.RegraFuncional p
   WHERE NOT EXISTS(SELECT 1 FROM Financeiro.RegraFuncional child WHERE child.AnteriorId=p.VersaoId);
  IF @@ROWCOUNT=0 THROW 55987,N'Ciclo ou referencia inesperada em Financeiro.RegraFuncional',1;
 END;
 DELETE Financeiro.ObrigacaoPreparada;
 DELETE Financeiro.DecisaoAutorizacao;
 DELETE Financeiro.SolicitacaoAutorizacao;
 DELETE Financeiro.EncaminhamentoPolitica;
 DELETE Financeiro.ProntidaoDecisao;
 WHILE EXISTS(SELECT 1 FROM Financeiro.ProntidaoVersao)
 BEGIN
  DELETE v FROM Financeiro.ProntidaoVersao v
   WHERE NOT EXISTS(SELECT 1 FROM Financeiro.ProntidaoVersao child WHERE child.AnteriorId=v.VersaoId);
  IF @@ROWCOUNT=0 THROW 55985,N'Ciclo ou referencia inesperada em Financeiro.ProntidaoVersao',1;
 END;
 DELETE Financeiro.AvaliacaoCarteira;
 DELETE Financeiro.ReferenciaCarteira;
 DELETE Simulacao.Anexo;
 DELETE Simulacao.Evento;
 WHILE EXISTS(SELECT 1 FROM Simulacao.ReciboVersao)
 BEGIN
  DELETE r FROM Simulacao.ReciboVersao r
   WHERE NOT EXISTS(SELECT 1 FROM Simulacao.ReciboVersao child WHERE child.AnteriorId=r.ReciboId);
  IF @@ROWCOUNT=0 THROW 55986,N'Ciclo ou referencia inesperada em Simulacao.ReciboVersao',1;
 END;
 DELETE Simulacao.Processo;

 -- Restore exactly the trigger states observed before cleanup (only enabled triggers were disabled).
 DECLARE restore_cursor CURSOR LOCAL FAST_FORWARD FOR
  SELECT SchemaName,TriggerName,TableSchema,TableName FROM #FIN04EnabledTriggers;
 OPEN restore_cursor; FETCH NEXT FROM restore_cursor INTO @triggerSchema,@triggerName,@tableSchema,@tableName;
 WHILE @@FETCH_STATUS=0
 BEGIN
  SET @sql=N'ENABLE TRIGGER '+QUOTENAME(@triggerSchema)+N'.'+QUOTENAME(@triggerName)+N' ON '+QUOTENAME(@tableSchema)+N'.'+QUOTENAME(@tableName)+N';';
  EXEC sys.sp_executesql @sql;
  FETCH NEXT FROM restore_cursor INTO @triggerSchema,@triggerName,@tableSchema,@tableName;
 END
 CLOSE restore_cursor; DEALLOCATE restore_cursor;
 DROP TABLE #FIN04EnabledTriggers;
END;

-- Reconcile the legacy boolean/date marker from the new authoritative active settlement only.
UPDATE c SET PagoEmUtc=b.ConfirmadoEmUtc
FROM Operacao.Contratacao c
LEFT JOIN Financeiro.ContratacaoBaixa b ON b.ContratacaoId=c.ContratacaoId AND b.DesfeitoEmUtc IS NULL
WHERE (c.PagoEmUtc IS NULL AND b.ConfirmadoEmUtc IS NOT NULL)
 OR (c.PagoEmUtc IS NOT NULL AND b.ConfirmadoEmUtc IS NULL)
 OR (c.PagoEmUtc IS NOT NULL AND b.ConfirmadoEmUtc IS NOT NULL AND c.PagoEmUtc<>b.ConfirmadoEmUtc);
IF @marker IS NULL EXEC sys.sp_addextendedproperty @name=N'JETTA_FIN04_RESET',@value=N'1';
