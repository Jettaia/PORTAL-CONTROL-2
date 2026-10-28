USE JETTA_CONTROL;
GO
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRAN;
 DECLARE @Em nvarchar(256)=CONCAT('b22-test-',CONVERT(varchar(36),NEWID()),'@example.invalid');
 INSERT Seguranca.Usuario(Nome,Email,Perfil) VALUES('B22 TESTE',@Em,'GESTOR');
 DECLARE @Uid bigint=SCOPE_IDENTITY();
 INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(@Uid,REPLICATE('a',32),REPLICATE('b',128));
 INSERT Seguranca.SessaoWeb(UsuarioId,TokenHash,ExpiraEmUtc) VALUES(@Uid,CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varchar(36),NEWID())),2),DATEADD(hour,1,SYSUTCDATETIME()));
 IF (SELECT COUNT(*) FROM Seguranca.SessaoWeb WHERE UsuarioId=@Uid)<>1 THROW 56101,'Teste sessao falhou',1;
 ROLLBACK;
 PRINT 'PASS: transacao de identidade revertida.';
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
