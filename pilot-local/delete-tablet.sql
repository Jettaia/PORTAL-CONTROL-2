/*PILOT_GUARD*/
IF OBJECT_ID('Operacao.TabletPC05','U') IS NULL THROW 55914,N'PC05 obrigatorio',1;
IF COL_LENGTH('Operacao.TabletPC05','ExcluidoEmUtc') IS NULL
 ALTER TABLE Operacao.TabletPC05 ADD ExcluidoEmUtc datetime2(3) NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Operacao.TabletPC05') AND name='CK_PC05_TabletExcluidoRevogado')
 ALTER TABLE Operacao.TabletPC05 WITH CHECK ADD CONSTRAINT CK_PC05_TabletExcluidoRevogado CHECK(ExcluidoEmUtc IS NULL OR (RevogadoEmUtc IS NOT NULL AND SessaoHash IS NULL AND PareamentoHash IS NULL));
