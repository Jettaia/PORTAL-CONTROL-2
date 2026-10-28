-- LAB ONLY. The helper validates the exact generated database before every batch.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54300,N'Somente laboratorio B3',1;
IF OBJECT_ID('Operacao.DisponibilidadePrestador','U') IS NULL
BEGIN
 CREATE TABLE Operacao.DisponibilidadePrestador(
  DisponibilidadeId bigint IDENTITY PRIMARY KEY,
  PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
  DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
  Inicio datetime2(0) NOT NULL,Fim datetime2(0) NOT NULL,
  Estado varchar(20) NOT NULL CHECK(Estado IN ('DISPONIVEL','INDISPONIVEL')),
  AtorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CriadoEmUtc datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  RequisicaoId uniqueidentifier NOT NULL,
  CONSTRAINT CK_B33_Intervalo CHECK(Fim>Inicio),
  CONSTRAINT UX_B33_Requisicao UNIQUE(AtorUsuarioId,RequisicaoId));
 CREATE INDEX IX_B33_Intervalo ON Operacao.DisponibilidadePrestador(PrestadorId,DepositoId,Inicio,Fim);
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_InformarDisponibilidade
 @GestorId bigint,@PrestadorId bigint,@DepositoId bigint,@Inicio datetime2(0),@Fim datetime2(0),@Estado varchar(20),@RequisicaoId uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54300,N'Somente laboratorio B3',1;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @lr int,@r nvarchar(255)=CONCAT(N'JettaControl.Prestador.',@PrestadorId),@id bigint;
  EXEC @lr=sys.sp_getapplock @Resource=@r,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lr<0 THROW 54151,N'Prestador ocupado',1;
  IF Seguranca.fn_Pode(@GestorId,'atividades.criar')<>1 OR NOT EXISTS(
   SELECT 1 FROM Seguranca.Usuario u WITH(UPDLOCK,HOLDLOCK)
   JOIN Seguranca.UsuarioDeposito ud WITH(UPDLOCK,HOLDLOCK) ON ud.UsuarioId=u.UsuarioId AND ud.DepositoId=@DepositoId AND ud.RevogadoEmUtc IS NULL
   JOIN Seguranca.GestorDeposito gd WITH(UPDLOCK,HOLDLOCK) ON gd.GestorUsuarioId=u.UsuarioId AND gd.DepositoId=@DepositoId AND gd.RevogadoEm IS NULL
   JOIN Cadastro.Deposito d ON d.DepositoId=@DepositoId AND d.Ativo=1 JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
   WHERE u.UsuarioId=@GestorId AND u.Perfil='GESTOR' AND u.Ativo=1) THROW 54201,N'Permissao ou abrangencia negada',1;
  IF @Inicio IS NULL OR @Fim IS NULL OR @Fim<=@Inicio OR @Estado IS NULL OR @Estado NOT IN ('DISPONIVEL','INDISPONIVEL') OR @RequisicaoId IS NULL
   OR NOT EXISTS(SELECT 1 FROM Cadastro.Prestador WHERE PrestadorId=@PrestadorId AND Ativo=1) THROW 54304,N'Declaracao invalida',1;
  SELECT @id=DisponibilidadeId FROM Operacao.DisponibilidadePrestador WITH(UPDLOCK,HOLDLOCK) WHERE AtorUsuarioId=@GestorId AND RequisicaoId=@RequisicaoId;
  IF @id IS NOT NULL
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM Operacao.DisponibilidadePrestador WHERE DisponibilidadeId=@id AND PrestadorId=@PrestadorId AND DepositoId=@DepositoId AND Inicio=@Inicio AND Fim=@Fim AND Estado=@Estado)
    THROW 54305,N'Chave reutilizada com conteudo divergente',1;
   COMMIT;SELECT @id DisponibilidadeId;RETURN;
  END;
  IF EXISTS(SELECT 1 FROM Operacao.DisponibilidadePrestador WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=@PrestadorId AND DepositoId=@DepositoId AND Inicio<@Fim AND @Inicio<Fim)
   THROW 54306,N'Declaracao sobreposta exige retificacao formal',1;
  IF @Estado='INDISPONIVEL' AND EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
   WHERE p.PrestadorId=@PrestadorId AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA' AND a.InicioPrevisto<@Fim AND @Inicio<a.FimPrevisto)
   THROW 54302,N'Impacto em contratacao confirmada',1;
  INSERT Operacao.DisponibilidadePrestador(PrestadorId,DepositoId,Inicio,Fim,Estado,AtorUsuarioId,RequisicaoId)
   VALUES(@PrestadorId,@DepositoId,@Inicio,@Fim,@Estado,@GestorId,@RequisicaoId);
  SET @id=SCOPE_IDENTITY();
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
   VALUES('DisponibilidadePrestador',@id,'INFORMAR',@GestorId,(SELECT @PrestadorId prestadorId,@DepositoId depositoId,@Inicio inicio,@Fim fim,@Estado estado FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;SELECT @id DisponibilidadeId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
GO
