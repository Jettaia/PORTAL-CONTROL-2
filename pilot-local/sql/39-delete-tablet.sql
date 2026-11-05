IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF OBJECT_ID('Operacao.TabletPC05','U') IS NULL THROW 55914,N'PC05 obrigatorio',1;
IF COL_LENGTH('Operacao.TabletPC05','ExcluidoEmUtc') IS NULL
 ALTER TABLE Operacao.TabletPC05 ADD ExcluidoEmUtc datetime2(3) NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Operacao.TabletPC05') AND name='CK_PC05_TabletExcluidoRevogado')
 ALTER TABLE Operacao.TabletPC05 WITH CHECK ADD CONSTRAINT CK_PC05_TabletExcluidoRevogado CHECK(ExcluidoEmUtc IS NULL OR (RevogadoEmUtc IS NOT NULL AND SessaoHash IS NULL AND PareamentoHash IS NULL));
