-- Pilot-only additions; no changes to the principal database or enterprise policies.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
