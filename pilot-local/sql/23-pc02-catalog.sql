-- PC-02 additive extension. Installer/disposable tests only; never auto-upgrade.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55910,N'PC-02 exige transacao externa',1;
IF COL_LENGTH('Cadastro.Filial','Endereco') IS NULL
 ALTER TABLE Cadastro.Filial ADD Endereco nvarchar(400) NULL;
IF COL_LENGTH('Cadastro.TipoServico','Descricao') IS NULL
 ALTER TABLE Cadastro.TipoServico ADD Descricao nvarchar(500) NULL;
GO
