IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF COL_LENGTH('Seguranca.Usuario','ExcluidoEmUtc') IS NULL
 ALTER TABLE Seguranca.Usuario ADD ExcluidoEmUtc datetime2 NULL,ExcluidoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId);
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Seguranca.Usuario') AND name='CK_Usuario_ExcluidoInativo')
 ALTER TABLE Seguranca.Usuario WITH CHECK ADD CONSTRAINT CK_Usuario_ExcluidoInativo CHECK(ExcluidoEmUtc IS NULL OR Ativo=0);
