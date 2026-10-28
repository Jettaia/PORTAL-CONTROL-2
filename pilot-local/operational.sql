-- Pilot-only additions; no changes to the principal database or enterprise policies.
/*PILOT_GUARD*/
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B24D_AtribuirUsuarioDeposito
 @AtorId bigint,@UsuarioId bigint,@DepositoId bigint,@Conceder bit
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 EXEC Seguranca.sp_PilotAdminGuard @AtorId;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@UsuarioId)
   OR NOT EXISTS(SELECT 1 FROM Cadastro.Deposito WHERE DepositoId=@DepositoId AND Ativo=1)
   THROW 55901,N'Usuario ou deposito indisponivel',1;
  IF @Conceder=1 BEGIN
   IF EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId)
    UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=NULL,ConcedidoPor=@AtorId,ConcedidoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId;
   ELSE INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(@UsuarioId,@DepositoId,@AtorId);
   IF EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@UsuarioId AND Perfil='GESTOR') BEGIN
    IF EXISTS(SELECT 1 FROM Seguranca.GestorDeposito WHERE GestorUsuarioId=@UsuarioId AND DepositoId=@DepositoId)
     UPDATE Seguranca.GestorDeposito SET RevogadoEm=NULL,ConcedidoPorUsuarioId=@AtorId,ConcedidoEm=SYSUTCDATETIME() WHERE GestorUsuarioId=@UsuarioId AND DepositoId=@DepositoId;
    ELSE INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId) VALUES(@UsuarioId,@DepositoId,@AtorId);
   END;
  END ELSE BEGIN
   UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME(),RevogadoPor=@AtorId WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId;
   UPDATE Seguranca.GestorDeposito SET RevogadoEm=SYSUTCDATETIME(),RevogadoPorUsuarioId=@AtorId WHERE GestorUsuarioId=@UsuarioId AND DepositoId=@DepositoId AND RevogadoEm IS NULL;
  END;
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Usuario',@UsuarioId,N'ALTERAR_ESCOPO',@AtorId);
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
