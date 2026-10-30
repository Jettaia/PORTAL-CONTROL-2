-- One numeric identity per provider. Retain the internal column name for callers.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55950,N'Documento exige transacao externa',1;
IF COL_LENGTH('Cadastro.Prestador','CPF') IS NULL THROW 55950,N'Cadastro de prestadores ausente',1;
IF COL_LENGTH('Cadastro.Prestador','CPF')<>14 OR EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Cadastro.Prestador') AND name='CPF' AND TYPE_NAME(user_type_id)<>'varchar') BEGIN
 ALTER TABLE Cadastro.Prestador DROP CONSTRAINT CK_B1_Prestador_CPF;
 ALTER TABLE Cadastro.Prestador DROP CONSTRAINT UQ_B1_Prestador_CPF;
 ALTER TABLE Cadastro.Prestador ALTER COLUMN CPF varchar(14) NOT NULL;
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('Cadastro.Prestador') AND name='UQ_B1_Prestador_CPF')
 ALTER TABLE Cadastro.Prestador ADD CONSTRAINT UQ_B1_Prestador_CPF UNIQUE(CPF);
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Cadastro.Prestador') AND name='CK_B1_Prestador_CPF')
 ALTER TABLE Cadastro.Prestador ADD CONSTRAINT CK_B1_Prestador_CPF CHECK(CPF COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%' AND LEN(CPF) IN(11,14));
GO
