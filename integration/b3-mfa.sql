-- Legacy B2B definitions only; no installer, no flags, no B2D.

CREATE OR ALTER PROCEDURE Seguranca.sp_B25B2B_IniciarCadastro
 @UsuarioId bigint,@SessaoHash char(64),@SegredoCifrado varbinary(512),@VersaoChave smallint=1
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @UsuarioId IS NULL OR @UsuarioId<=0 OR @SessaoHash NOT LIKE REPLICATE('[0-9a-f]',64) OR DATALENGTH(@SegredoCifrado)<40 OR @VersaoChave<>1 THROW 59810,'Parametros invalidos',1;
 BEGIN TRAN;
 IF NOT EXISTS (SELECT 1 FROM Seguranca.SessaoWeb WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@UsuarioId AND TokenHash=@SessaoHash AND RevogadoEmUtc IS NULL AND ExpiraEmUtc>SYSUTCDATETIME()) THROW 59811,'Sessao invalida',1;
 IF EXISTS(SELECT 1 FROM Seguranca.MfaTotp WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@UsuarioId AND ConfirmadoEmUtc IS NOT NULL AND RevogadoEmUtc IS NULL) THROW 59812,'MFA confirmado; reset requer recuperacao governada',1;
 IF EXISTS(SELECT 1 FROM Seguranca.MfaTotp WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@UsuarioId)
  UPDATE Seguranca.MfaTotp SET SegredoCifrado=@SegredoCifrado,VersaoChave=@VersaoChave,CriadoEmUtc=SYSUTCDATETIME(),ConfirmadoEmUtc=NULL,UltimoPassoAceito=NULL,RevogadoEmUtc=NULL WHERE UsuarioId=@UsuarioId;
 ELSE INSERT Seguranca.MfaTotp(UsuarioId,SegredoCifrado,VersaoChave) VALUES(@UsuarioId,@SegredoCifrado,@VersaoChave);
 INSERT Seguranca.MfaAuditoria(UsuarioId,AtorUsuarioId,Evento,Resultado) VALUES(@UsuarioId,@UsuarioId,'ENROLL_INICIADO','PASS');
 COMMIT;
END;

GO

CREATE OR ALTER PROCEDURE Seguranca.sp_B25B2B_ConfirmarOuValidar
 @UsuarioId bigint,@SessaoHash char(64),@Passo bigint,@Finalidade varchar(12)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 IF @Finalidade NOT IN ('ENROLL','LOGIN','STEPUP') OR @Passo<0 THROW 59820,'Requisicao invalida',1;
 BEGIN TRAN;
 IF NOT EXISTS(SELECT 1 FROM Seguranca.SessaoWeb WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@UsuarioId AND TokenHash=@SessaoHash AND RevogadoEmUtc IS NULL AND ExpiraEmUtc>SYSUTCDATETIME()) THROW 59821,'Sessao invalida',1;
 UPDATE Seguranca.MfaTotp WITH(UPDLOCK,ROWLOCK)
 SET UltimoPassoAceito=@Passo,ConfirmadoEmUtc=CASE WHEN @Finalidade='ENROLL' AND ConfirmadoEmUtc IS NULL THEN SYSUTCDATETIME() ELSE ConfirmadoEmUtc END
 WHERE UsuarioId=@UsuarioId AND RevogadoEmUtc IS NULL
 AND (@Finalidade='ENROLL' AND ConfirmadoEmUtc IS NULL OR @Finalidade<>'ENROLL' AND ConfirmadoEmUtc IS NOT NULL)
 AND (UltimoPassoAceito IS NULL OR UltimoPassoAceito<@Passo);
 IF @@ROWCOUNT<>1 THROW 59822,'Codigo reutilizado ou MFA indisponivel',1;
 UPDATE Seguranca.SessaoWeb SET MfaValidadoEmUtc=SYSUTCDATETIME(),MfaStepUpEmUtc=SYSUTCDATETIME() WHERE UsuarioId=@UsuarioId AND TokenHash=@SessaoHash AND RevogadoEmUtc IS NULL;
 INSERT Seguranca.MfaAuditoria(UsuarioId,AtorUsuarioId,Evento,Resultado) VALUES(@UsuarioId,@UsuarioId,CASE WHEN @Finalidade='ENROLL' THEN 'ENROLL_CONFIRMADO' WHEN @Finalidade='LOGIN' THEN 'LOGIN_MFA' ELSE 'STEPUP_MFA' END,'PASS');
 COMMIT;
 SELECT CAST(1 AS int) AS Ok;
END;
