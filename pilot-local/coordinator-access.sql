-- Additive, idempotent catalog extension. No user, credential or scope changes.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55901,N'Coordenador exige transacao externa',1;
IF NOT EXISTS(SELECT 1 FROM Seguranca.PerfilAcesso WHERE Codigo='PC01_COORDENADOR')
 INSERT Seguranca.PerfilAcesso(Codigo,Nome,Sistema,Ativo)
 VALUES('PC01_COORDENADOR',N'Portal Control - COORDENADOR',1,1);
GO
