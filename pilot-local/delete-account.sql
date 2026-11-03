/*PILOT_GUARD*/
IF COL_LENGTH('Seguranca.Usuario','ExcluidoEmUtc') IS NULL
 ALTER TABLE Seguranca.Usuario ADD ExcluidoEmUtc datetime2 NULL,ExcluidoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId);
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Seguranca.Usuario') AND name='CK_Usuario_ExcluidoInativo')
 ALTER TABLE Seguranca.Usuario WITH CHECK ADD CONSTRAINT CK_Usuario_ExcluidoInativo CHECK(ExcluidoEmUtc IS NULL OR Ativo=0);
