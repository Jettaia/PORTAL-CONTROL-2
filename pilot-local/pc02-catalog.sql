-- PC-02 additive extension. Installer/disposable tests only; never auto-upgrade.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55910,N'PC-02 exige transacao externa',1;
IF COL_LENGTH('Cadastro.Filial','Endereco') IS NULL
 ALTER TABLE Cadastro.Filial ADD Endereco nvarchar(400) NULL;
IF COL_LENGTH('Cadastro.TipoServico','Descricao') IS NULL
 ALTER TABLE Cadastro.TipoServico ADD Descricao nvarchar(500) NULL;
GO
IF COL_LENGTH('Cadastro.Filial','Cidade') IS NULL
 ALTER TABLE Cadastro.Filial ADD Cidade nvarchar(120) NULL;
IF COL_LENGTH('Cadastro.Filial','Estado') IS NULL
 ALTER TABLE Cadastro.Filial ADD Estado char(2) NULL;
IF COL_LENGTH('Cadastro.Filial','CEP') IS NULL
 ALTER TABLE Cadastro.Filial ADD CEP char(8) NULL;
GO
