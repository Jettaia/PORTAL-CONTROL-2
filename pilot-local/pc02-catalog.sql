-- PC-02 additive extension. Installer/disposable tests only; never auto-upgrade.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55910,N'PC-02 exige transacao externa',1;
IF COL_LENGTH('Cadastro.Filial','Endereco') IS NULL
 ALTER TABLE Cadastro.Filial ADD Endereco nvarchar(400) NULL;
IF COL_LENGTH('Cadastro.TipoServico','Descricao') IS NULL
 ALTER TABLE Cadastro.TipoServico ADD Descricao nvarchar(500) NULL;
GO
