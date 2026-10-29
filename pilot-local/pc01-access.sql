-- PC-01: schema extension only. Apply exclusively through the guarded schema
-- installer or an explicitly authorized upgrade in a transaction; never auto-run.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55901,N'PC-01 exige transacao externa',1;
IF EXISTS(SELECT LOWER(LTRIM(RTRIM(Email))) FROM Seguranca.Usuario GROUP BY LOWER(LTRIM(RTRIM(Email))) HAVING COUNT(*)>1)
 THROW 55902,N'Emails duplicados: reconciliar antes de ativar PC-01',1;
IF OBJECT_ID('Seguranca.UsuarioFilial') IS NULL
 CREATE TABLE Seguranca.UsuarioFilial(
  UsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),
  ConcedidoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  ConcedidoEmUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  RevogadoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),RevogadoEmUtc datetime2 NULL,
  PRIMARY KEY(UsuarioId,FilialId));
GO
CREATE OR ALTER FUNCTION Seguranca.fn_PC01_TemFuncao(@UsuarioId bigint,@Funcao varchar(20)) RETURNS bit AS
BEGIN
 DECLARE @sim bit=0;
 IF EXISTS(SELECT 1 FROM Seguranca.Usuario u WHERE u.UsuarioId=@UsuarioId AND u.Ativo=1 AND
  (u.Perfil=@Funcao OR EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId AND pa.Ativo=1 WHERE up.UsuarioId=u.UsuarioId AND
   (pa.Codigo='PC01_'+@Funcao OR (pa.Codigo='PC01_ADMIN' AND EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=u.UsuarioId)))))) SET @sim=1;
 RETURN @sim;
END;
GO
-- Only the operational procedures whose role guard was single-valued change.
-- Retain the remaining SQL verbatim, including MFA, scope and concurrency guards.
DECLARE @name sysname,@definition nvarchar(max),@patched nvarchar(max);
DECLARE pc01_procs CURSOR LOCAL FAST_FORWARD FOR
 SELECT name FROM sys.procedures WHERE schema_id=SCHEMA_ID('Operacao') AND name IN(
 'sp_CriarAtividadePlanejada','sp_AdicionarParticipantePlanejado','sp_ConfirmarParticipacao',
 'sp_SolicitarExcecaoLimite','sp_InformarDisponibilidade','sp_ReagendarAtividade','sp_AtualizarAtividadePlanejada',
 'sp_AtualizarParticipacaoPlanejada','sp_CancelarParticipacaoPlanejada');
OPEN pc01_procs;FETCH NEXT FROM pc01_procs INTO @name;
WHILE @@FETCH_STATUS=0 BEGIN
 SET @definition=OBJECT_DEFINITION(OBJECT_ID('Operacao.'+@name));
 SET @patched=REPLACE(@definition,N'u.Perfil=''GESTOR''',N'Seguranca.fn_PC01_TemFuncao(u.UsuarioId,''GESTOR'')=1');
 SET @patched=REPLACE(@patched,N'Perfil=''GESTOR''',N'Seguranca.fn_PC01_TemFuncao(UsuarioId,''GESTOR'')=1');
 IF @patched<>@definition BEGIN
  SET @patched=N'ALTER '+SUBSTRING(@patched,CHARINDEX(N'PROCEDURE',UPPER(@patched)),LEN(@patched));
  EXEC sys.sp_executesql @patched;
 END;
 FETCH NEXT FROM pc01_procs INTO @name;
END;
CLOSE pc01_procs;DEALLOCATE pc01_procs;
GO
-- Branch assignments cover depots created later by PC-02 as well.
CREATE OR ALTER TRIGGER Cadastro.tr_PC01_DepositoAbrangencia ON Cadastro.Deposito AFTER INSERT AS
BEGIN
 SET NOCOUNT ON;
 INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor)
 SELECT uf.UsuarioId,i.DepositoId,uf.ConcedidoPor FROM inserted i JOIN Seguranca.UsuarioFilial uf ON uf.FilialId=i.FilialId AND uf.RevogadoEmUtc IS NULL
 WHERE Seguranca.fn_PC01_TemFuncao(uf.UsuarioId,'GESTOR')=1 AND NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=uf.UsuarioId AND ud.DepositoId=i.DepositoId);
 INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId)
 SELECT uf.UsuarioId,i.DepositoId,uf.ConcedidoPor FROM inserted i JOIN Seguranca.UsuarioFilial uf ON uf.FilialId=i.FilialId AND uf.RevogadoEmUtc IS NULL
 WHERE Seguranca.fn_PC01_TemFuncao(uf.UsuarioId,'GESTOR')=1 AND NOT EXISTS(SELECT 1 FROM Seguranca.GestorDeposito gd WHERE gd.GestorUsuarioId=uf.UsuarioId AND gd.DepositoId=i.DepositoId);
 INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor)
 SELECT r.UsuarioId,i.DepositoId,r.UsuarioId FROM inserted i CROSS JOIN Seguranca.UsuarioRaiz r
 WHERE EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId AND pa.Ativo=1 WHERE up.UsuarioId=r.UsuarioId AND pa.Codigo='PC01_ADMIN')
 AND NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=r.UsuarioId AND ud.DepositoId=i.DepositoId);
 INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId)
 SELECT r.UsuarioId,i.DepositoId,r.UsuarioId FROM inserted i CROSS JOIN Seguranca.UsuarioRaiz r
 WHERE EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up JOIN Seguranca.PerfilAcesso pa ON pa.PerfilId=up.PerfilId AND pa.Ativo=1 WHERE up.UsuarioId=r.UsuarioId AND pa.Codigo='PC01_ADMIN')
 AND NOT EXISTS(SELECT 1 FROM Seguranca.GestorDeposito gd WHERE gd.GestorUsuarioId=r.UsuarioId AND gd.DepositoId=i.DepositoId);
END;
GO
