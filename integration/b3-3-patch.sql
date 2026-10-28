-- LAB ONLY: delta sobre as mesmas rotinas B1/B3. Sem novas tabelas ou motor paralelo.
-- Aplicado apenas pelo helper que valida DB_NAME em cada batch; nao executar na principal.
CREATE OR ALTER FUNCTION Seguranca.fn_Pode(@UsuarioId bigint,@Chave varchar(100)) RETURNS bit AS
BEGIN
 DECLARE @sim bit=0;
 IF EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@UsuarioId AND Ativo=1)
 AND (EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz WHERE UsuarioId=@UsuarioId)
 OR EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up
 JOIN Seguranca.PerfilAcesso p ON p.PerfilId=up.PerfilId AND p.Ativo=1
 JOIN Seguranca.PerfilPermissao pp ON pp.PerfilId=p.PerfilId
 JOIN Seguranca.Permissao m ON m.PermissaoId=pp.PermissaoId
 WHERE up.UsuarioId=@UsuarioId AND m.Chave=@Chave
 AND (m.Critica=0 OR m.Chave IN ('atividades.confirmar','limites.excecao.aprovar','limites.configurar')))) SET @sim=1;
 RETURN @sim;
END;

GO

CREATE OR ALTER PROCEDURE Operacao.sp_CadastrarPoliticaLimite
 @AdminId bigint, @Modo varchar(20), @LimiteDias int, @JanelaDias int,
 @VigenteDesde date, @VigenteAte date=NULL,@SessaoHash char(64)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 54100,N'Banco incorreto',1;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @lr int;
  EXEC @lr=sys.sp_getapplock @Resource=N'JettaControl.Politicas',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lr<0 THROW 54151,N'Politicas ocupadas',1;
  IF Seguranca.fn_Pode(@AdminId,'limites.configurar')<>1 THROW 54201,N'Permissao negada',1;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.SessaoWeb s WITH(UPDLOCK,HOLDLOCK)
   JOIN Seguranca.MfaTotp m ON m.UsuarioId=s.UsuarioId AND m.ConfirmadoEmUtc IS NOT NULL AND m.RevogadoEmUtc IS NULL
   WHERE s.UsuarioId=@AdminId AND s.TokenHash=@SessaoHash AND s.RevogadoEmUtc IS NULL AND s.ExpiraEmUtc>SYSUTCDATETIME()
   AND s.MfaValidadoEmUtc>=m.ConfirmadoEmUtc AND s.MfaValidadoEmUtc<=SYSUTCDATETIME()
   AND s.MfaStepUpEmUtc>=m.ConfirmadoEmUtc AND s.MfaStepUpEmUtc BETWEEN DATEADD(minute,-5,SYSUTCDATETIME()) AND SYSUTCDATETIME())
   THROW 54203,N'MFA recente obrigatorio',1;

  IF @Modo IS NULL OR @Modo<>'DIAS_CONTRATADOS' THROW 54301,N'Modo indisponivel',1;
  IF EXISTS(SELECT 1 FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK) JOIN Operacao.Atividade a WITH(UPDLOCK,HOLDLOCK) ON a.AtividadeId=p.AtividadeId
   WHERE p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA' AND a.DataServico>=@VigenteDesde AND (@VigenteAte IS NULL OR a.DataServico<=@VigenteAte))
   THROW 54302,N'Impacto historico exige decisao formal',1;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@AdminId AND Perfil='ADMIN' AND Ativo=1)
   THROW 54110,N'Somente ADMIN ativo configura politica',1;
  IF @Modo NOT IN ('DIAS_CONTRATADOS','DIAS_CORRIDOS') OR @Modo IS NULL
   OR @LimiteDias IS NULL OR @LimiteDias<=0 OR @JanelaDias IS NULL OR @JanelaDias<@LimiteDias OR @JanelaDias>36500
   OR @VigenteDesde IS NULL OR (@VigenteAte IS NOT NULL AND @VigenteAte<@VigenteDesde)
   THROW 54111,N'Parametros de politica invalidos',1;
  IF EXISTS(SELECT 1 FROM Operacao.PoliticaLimite WITH(UPDLOCK,HOLDLOCK)
    WHERE VigenteDesde<=ISNULL(@VigenteAte,CONVERT(date,'99991231'))
      AND ISNULL(VigenteAte,CONVERT(date,'99991231'))>=@VigenteDesde)
   THROW 54112,N'Intervalo de vigencia sobreposto; ajuste politica existente com governanca',1;
  INSERT Operacao.PoliticaLimite(Modo,LimiteDias,JanelaDias,VigenteDesde,VigenteAte,CriadoPorAdminId)
  VALUES(@Modo,@LimiteDias,@JanelaDias,@VigenteDesde,@VigenteAte,@AdminId);
  DECLARE @id bigint=CONVERT(bigint,SCOPE_IDENTITY());
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES(N'PoliticaLimite',@id,N'CRIAR',@AdminId,
   (SELECT @Modo modo,@LimiteDias limiteDias,@JanelaDias janelaDias,@VigenteDesde vigenteDesde,@VigenteAte vigenteAte FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
  SELECT @id AS PoliticaId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;

GO

CREATE OR ALTER PROCEDURE Operacao.sp_ConfirmarParticipacao
 @GestorId bigint,@ParticipacaoId bigint,@SessaoHash char(64)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 54200,N'Somente laboratorio B3',1;
 BEGIN TRY
  DECLARE @Prestador bigint,@Atividade bigint,@Deposito bigint,@Data date,@Inicio datetime2(0),@Fim datetime2(0),@Valor decimal(18,2),@lr int;
  SELECT @Prestador=PrestadorId FROM Operacao.Participacao WHERE ParticipacaoId=@ParticipacaoId;
  IF @Prestador IS NULL THROW 54150,N'Participacao indisponivel',1;
  BEGIN TRAN;
  DECLARE @Recurso nvarchar(255)=CONCAT(N'JettaControl.Prestador.',@Prestador);
  EXEC @lr=sys.sp_getapplock @Resource=@Recurso,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
  IF @lr<0 THROW 54151,N'Prestador ocupado',1;
  IF Seguranca.fn_Pode(@GestorId,'atividades.confirmar')<>1 THROW 54201,N'Permissao critica negada',1;
  SELECT @Atividade=a.AtividadeId,@Deposito=d.DepositoId,@Data=a.DataServico,@Inicio=a.InicioPrevisto,@Fim=a.FimPrevisto,@Valor=p.ValorContratado
  FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK)
  JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId AND a.GestorUsuarioId=@GestorId AND a.Status IN ('PLANEJADA','CONFIRMADA')
  JOIN Cadastro.Prestador pr ON pr.PrestadorId=p.PrestadorId AND pr.Ativo=1
  JOIN Cadastro.TipoServico t ON t.TipoServicoId=a.TipoServicoId AND t.Ativo=1
  JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
  JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
  JOIN Seguranca.Usuario u ON u.UsuarioId=@GestorId AND u.Perfil='GESTOR' AND u.Ativo=1
  JOIN Seguranca.UsuarioDeposito ud ON ud.UsuarioId=@GestorId AND ud.DepositoId=d.DepositoId AND ud.RevogadoEmUtc IS NULL
  JOIN Seguranca.GestorDeposito gd ON gd.GestorUsuarioId=@GestorId AND gd.DepositoId=d.DepositoId AND gd.RevogadoEm IS NULL
  WHERE p.ParticipacaoId=@ParticipacaoId AND p.PrestadorId=@Prestador AND p.Status IN ('PLANEJADA','AGUARDANDO_APROVACAO');
  IF @Atividade IS NULL THROW 54150,N'Participacao fora de estado ou escopo',1;
  IF @Valor IS NULL OR @Valor<0 OR @Fim<=@Inicio OR CONVERT(date,@Inicio)<>@Data THROW 54202,N'Periodo ou valor invalido',1;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.SessaoWeb s WITH(UPDLOCK,HOLDLOCK)
   JOIN Seguranca.MfaTotp m ON m.UsuarioId=s.UsuarioId AND m.ConfirmadoEmUtc IS NOT NULL AND m.RevogadoEmUtc IS NULL
   WHERE s.UsuarioId=@GestorId AND s.TokenHash=@SessaoHash AND s.RevogadoEmUtc IS NULL AND s.ExpiraEmUtc>SYSUTCDATETIME()
   AND s.MfaValidadoEmUtc>=m.ConfirmadoEmUtc AND s.MfaValidadoEmUtc<=SYSUTCDATETIME()
   AND s.MfaStepUpEmUtc>=m.ConfirmadoEmUtc AND s.MfaStepUpEmUtc BETWEEN DATEADD(minute,-5,SYSUTCDATETIME()) AND SYSUTCDATETIME())
   THROW 54203,N'MFA recente obrigatorio',1;
  IF EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
   WHERE p.PrestadorId=@Prestador AND p.ParticipacaoId<>@ParticipacaoId AND p.Status NOT IN ('CANCELADA','NAO_COMPARECEU')
   AND a.Status<>'CANCELADA' AND a.InicioPrevisto<@Fim AND @Inicio<a.FimPrevisto) THROW 54152,N'Conflito de periodo',1;
  IF NOT EXISTS(SELECT 1 FROM Operacao.DisponibilidadePrestador WITH(UPDLOCK,HOLDLOCK)
   WHERE PrestadorId=@Prestador AND DepositoId=@Deposito AND Estado='DISPONIVEL' AND Inicio<=@Inicio AND Fim>=@Fim)
   THROW 54303,N'Disponibilidade integral nao informada',1;
  DECLARE @e TABLE(PoliticaId bigint,Modo varchar(20),LimiteDias int,JanelaDias int,Dias int,Mesmo bit,Dentro bit,Impacto bit,Indefinida bit);
  INSERT @e EXEC Operacao.sp_AvaliarLimiteContratacao @ParticipacaoId=@ParticipacaoId;
  IF EXISTS(SELECT 1 FROM @e WHERE Impacto=1 OR Indefinida=1) THROW 54204,N'Impacto em janela confirmada: bloqueado',1;
  DECLARE @Excecao bigint;
  IF EXISTS(SELECT 1 FROM @e WHERE Dentro=0)
  BEGIN
   DECLARE @Contexto varchar(64);
   SELECT @Contexto=CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(nvarchar(max),(SELECT p.ParticipacaoId participacaoId,p.PrestadorId prestadorId,p.ValorContratado valorContratado,a.AtividadeId atividadeId,a.DepositoId depositoId,a.TipoServicoId servicoId,a.GestorUsuarioId gestorId,a.DataServico dataServico,a.InicioPrevisto inicio,a.FimPrevisto fim FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))),2)
   FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.ParticipacaoId=@ParticipacaoId;
   SELECT @Excecao=e.ExcecaoId FROM Operacao.ExcecaoLimite e WITH(UPDLOCK,HOLDLOCK)
   WHERE e.ParticipacaoId=@ParticipacaoId AND e.Status='APROVADA' AND e.ExpiraEmUtc>SYSUTCDATETIME()
   AND e.DiretorAprovadorId IS NOT NULL AND e.DiretorAprovadorId<>e.SolicitadoPorGestorId AND e.DiretorAprovadorId<>@GestorId
   AND EXISTS(SELECT 1 FROM Seguranca.Auditoria au WHERE au.Entidade='ExcecaoLimite' AND au.EntidadeId=e.ExcecaoId AND au.Acao='APROVAR' AND au.AtorUsuarioId=e.DiretorAprovadorId AND JSON_VALUE(au.DetalhesJson,'$.contextoHash')=@Contexto);
   IF @Excecao IS NULL THROW 54155,N'Limite exige excecao valida',1;
  END;
  UPDATE Operacao.Participacao SET Status='CONFIRMADA' WHERE ParticipacaoId=@ParticipacaoId;
  UPDATE Operacao.Atividade SET Status='CONFIRMADA' WHERE AtividadeId=@Atividade AND Status='PLANEJADA';
  UPDATE Operacao.ExcecaoLimite SET Status='CANCELADA' WHERE ParticipacaoId=@ParticipacaoId AND Status='PENDENTE';
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES(N'Participacao',@ParticipacaoId,N'CONFIRMAR',@GestorId,(SELECT 'PASS' resultado,@Excecao excecaoId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;SELECT @ParticipacaoId ParticipacaoConfirmadaId;
 END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  DECLARE @Erro int=ERROR_NUMBER();
  BEGIN TRY
   IF EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@GestorId)
    INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
    VALUES('Participacao',@ParticipacaoId,'CONFIRMAR_NEGADO',@GestorId,(SELECT 'DENIED' resultado,@Erro erro FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  END TRY BEGIN CATCH END CATCH;
  THROW;
 END CATCH;
END;

GO
