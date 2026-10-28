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
 AND (m.Critica=0 OR m.Chave IN ('atividades.confirmar','limites.excecao.aprovar')))) SET @sim=1;
 RETURN @sim;
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_AvaliarLimiteContratacao @ParticipacaoId bigint
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54200,N'Somente laboratorio B3',1;
 DECLARE @Data date,@Prestador bigint,@Modo varchar(20),@Max int,@Janela int,@Politica bigint,@Politicas int;
 SELECT @Data=a.DataServico,@Prestador=p.PrestadorId FROM Operacao.Participacao p
 JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.ParticipacaoId=@ParticipacaoId;
 IF @Data IS NULL THROW 54120,N'Participacao inexistente',1;
 SELECT @Politicas=COUNT(*),@Politica=MAX(PoliticaId),@Modo=MAX(Modo),@Max=MAX(LimiteDias),@Janela=MAX(JanelaDias)
 FROM Operacao.PoliticaLimite WHERE VigenteDesde<=@Data AND (VigenteAte IS NULL OR VigenteAte>=@Data);
 IF @Politicas<>1 THROW 54121,N'Politica vigente ausente ou ambigua',1;
 IF @Modo<>'DIAS_CONTRATADOS' THROW 54122,N'DIAS_CORRIDOS nao homologado',1;
 DECLARE @Dias TABLE(Data date PRIMARY KEY);
 INSERT @Dias SELECT DISTINCT a.DataServico FROM Operacao.Participacao p
 JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
 WHERE p.PrestadorId=@Prestador AND p.ParticipacaoId<>@ParticipacaoId
 AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA';
 DECLARE @N int=(SELECT COUNT(*) FROM @Dias WHERE Data BETWEEN DATEADD(day,1-@Janela,@Data) AND @Data),
 @Mesmo bit=CASE WHEN EXISTS(SELECT 1 FROM @Dias WHERE Data=@Data) THEN 1 ELSE 0 END,
 @Impacto bit=0,@Indefinida bit=0;
 -- Adding an already counted day cannot increase any existing rolling window.
 IF @Mesmo=0
 BEGIN
  IF EXISTS(SELECT 1 FROM @Dias d OUTER APPLY
   (SELECT COUNT(*) N,MAX(Modo) M FROM Operacao.PoliticaLimite p
    WHERE p.VigenteDesde<=d.Data AND (p.VigenteAte IS NULL OR p.VigenteAte>=d.Data)) v
   WHERE d.Data>@Data AND (v.N<>1 OR v.M<>'DIAS_CONTRATADOS')) SET @Indefinida=1;
  IF EXISTS(SELECT 1 FROM @Dias d JOIN Operacao.PoliticaLimite pol
   ON pol.VigenteDesde<=d.Data AND (pol.VigenteAte IS NULL OR pol.VigenteAte>=d.Data)
   CROSS APPLY(SELECT COUNT(*) N FROM @Dias x WHERE x.Data BETWEEN DATEADD(day,1-pol.JanelaDias,d.Data) AND d.Data) c
   WHERE d.Data>@Data AND pol.Modo='DIAS_CONTRATADOS'
    AND @Data BETWEEN DATEADD(day,1-pol.JanelaDias,d.Data) AND d.Data AND c.N+1>pol.LimiteDias)
   SET @Impacto=1;
 END;
 SELECT @Politica PoliticaId,@Modo Modo,@Max LimiteDias,@Janela JanelaDias,@N DiasContratadosNaJanela,
 @Mesmo MesmoDiaJaContabilizado,CONVERT(bit,CASE WHEN @N+1-CONVERT(int,@Mesmo)<=@Max THEN 1 ELSE 0 END) DentroDoLimite,
 @Impacto ImpactaConfirmadas,@Indefinida PoliticaFuturaIndefinida;
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_ConfirmarParticipacao
 @GestorId bigint,@ParticipacaoId bigint,@SessaoHash char(64)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54200,N'Somente laboratorio B3',1;
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
CREATE OR ALTER PROCEDURE Operacao.sp_SolicitarExcecaoLimite
 @GestorId bigint,@ParticipacaoId bigint,@Motivo nvarchar(800)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54200,N'Somente laboratorio B3',1;
 BEGIN TRY
  BEGIN TRAN;
  IF NULLIF(LTRIM(RTRIM(@Motivo)),N'') IS NULL THROW 54130,N'Motivo obrigatorio',1;
  IF Seguranca.fn_Pode(@GestorId,'atividades.criar')<>1 THROW 54201,N'Permissao negada',1;
  IF NOT EXISTS(SELECT 1 FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK)
   JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId AND a.GestorUsuarioId=@GestorId AND a.Status IN ('PLANEJADA','CONFIRMADA')
   JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
   JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
   JOIN Seguranca.Usuario u ON u.UsuarioId=@GestorId AND u.Perfil='GESTOR' AND u.Ativo=1
   JOIN Seguranca.UsuarioDeposito ud ON ud.UsuarioId=u.UsuarioId AND ud.DepositoId=d.DepositoId AND ud.RevogadoEmUtc IS NULL
   JOIN Seguranca.GestorDeposito gd ON gd.GestorUsuarioId=u.UsuarioId AND gd.DepositoId=d.DepositoId AND gd.RevogadoEm IS NULL
   WHERE p.ParticipacaoId=@ParticipacaoId AND p.Status IN ('PLANEJADA','AGUARDANDO_APROVACAO')) THROW 54131,N'Gestor fora de escopo',1;
  DECLARE @e TABLE(PoliticaId bigint,Modo varchar(20),LimiteDias int,JanelaDias int,Dias int,Mesmo bit,Dentro bit,Impacto bit,Indefinida bit);
  INSERT @e EXEC Operacao.sp_AvaliarLimiteContratacao @ParticipacaoId=@ParticipacaoId;
  IF EXISTS(SELECT 1 FROM @e WHERE Dentro=1 OR Impacto=1 OR Indefinida=1) THROW 54205,N'Excecao nao aplicavel',1;
  UPDATE Operacao.ExcecaoLimite SET Status='CANCELADA' WHERE ParticipacaoId=@ParticipacaoId AND Status='APROVADA' AND ExpiraEmUtc<=SYSUTCDATETIME();
  IF EXISTS(SELECT 1 FROM Operacao.ExcecaoLimite WHERE ParticipacaoId=@ParticipacaoId AND Status IN ('PENDENTE','APROVADA')) THROW 54132,N'Excecao ja existente',1;
  INSERT Operacao.ExcecaoLimite(ParticipacaoId,SolicitadoPorGestorId,Motivo) VALUES(@ParticipacaoId,@GestorId,@Motivo);
  DECLARE @Id bigint=CONVERT(bigint,SCOPE_IDENTITY());
  UPDATE Operacao.Participacao SET Status='AGUARDANDO_APROVACAO' WHERE ParticipacaoId=@ParticipacaoId;
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES('ExcecaoLimite',@Id,'SOLICITAR',@GestorId,(SELECT 'PASS' resultado,@ParticipacaoId participacaoId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;SELECT @Id ExcecaoId;
 END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  DECLARE @Erro int=ERROR_NUMBER();
  BEGIN TRY
   IF EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@GestorId)
    INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
    VALUES('Participacao',@ParticipacaoId,'SOLICITAR_NEGADO',@GestorId,(SELECT 'DENIED' resultado,@Erro erro FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  END TRY BEGIN CATCH END CATCH;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_DecidirExcecaoLimite
 @DiretorId bigint,@ExcecaoId bigint,@Aprovar bit,@MfaConfirmado bit,
 @ValidadeMinutos int=60,@MotivoDecisao nvarchar(800)=NULL,@SessaoHash char(64)=NULL,@ContextoEsperado varchar(64)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
 IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 54200,N'Somente laboratorio B3',1;
 BEGIN TRY
  BEGIN TRAN;
  IF @Aprovar IS NULL OR @ValidadeMinutos IS NULL OR @ValidadeMinutos NOT BETWEEN 1 AND 1440 OR NULLIF(LTRIM(RTRIM(@MotivoDecisao)),N'') IS NULL THROW 54142,N'Decisao, motivo e validade obrigatorios',1;
  IF Seguranca.fn_Pode(@DiretorId,'limites.excecao.aprovar')<>1 THROW 54201,N'Permissao critica negada',1;
  DECLARE @Participacao bigint,@Solicitante bigint;
  SELECT @Participacao=p.ParticipacaoId,@Solicitante=e.SolicitadoPorGestorId
  FROM Operacao.ExcecaoLimite e WITH(UPDLOCK,HOLDLOCK)
  JOIN Operacao.Participacao p ON p.ParticipacaoId=e.ParticipacaoId AND p.Status='AGUARDANDO_APROVACAO'
  JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId AND a.Status IN ('PLANEJADA','CONFIRMADA')
  JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
  JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
  JOIN Seguranca.Usuario u ON u.UsuarioId=@DiretorId AND u.Perfil='DIRETORIA' AND u.Ativo=1
  JOIN Seguranca.UsuarioDeposito ud ON ud.UsuarioId=u.UsuarioId AND ud.DepositoId=d.DepositoId AND ud.RevogadoEmUtc IS NULL
  WHERE e.ExcecaoId=@ExcecaoId AND e.Status='PENDENTE' AND e.SolicitadoPorGestorId<>@DiretorId AND a.GestorUsuarioId<>@DiretorId;
  IF @Participacao IS NULL THROW 54143,N'Excecao decidida, autoaprovacao ou fora de escopo',1;
  IF ISNULL(@MfaConfirmado,0)<>1 OR NOT EXISTS(SELECT 1 FROM Seguranca.SessaoWeb s WITH(UPDLOCK,HOLDLOCK)
   JOIN Seguranca.MfaTotp m ON m.UsuarioId=s.UsuarioId AND m.ConfirmadoEmUtc IS NOT NULL AND m.RevogadoEmUtc IS NULL
   WHERE s.UsuarioId=@DiretorId AND s.TokenHash=@SessaoHash AND s.RevogadoEmUtc IS NULL AND s.ExpiraEmUtc>SYSUTCDATETIME()
   AND s.MfaValidadoEmUtc>=m.ConfirmadoEmUtc AND s.MfaValidadoEmUtc<=SYSUTCDATETIME()
   AND s.MfaStepUpEmUtc>=m.ConfirmadoEmUtc AND s.MfaStepUpEmUtc BETWEEN DATEADD(minute,-5,SYSUTCDATETIME()) AND SYSUTCDATETIME())
   THROW 54203,N'MFA recente obrigatorio',1;
  DECLARE @Contexto varchar(64);
  SELECT @Contexto=CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(nvarchar(max),(SELECT p.ParticipacaoId participacaoId,p.PrestadorId prestadorId,p.ValorContratado valorContratado,a.AtividadeId atividadeId,a.DepositoId depositoId,a.TipoServicoId servicoId,a.GestorUsuarioId gestorId,a.DataServico dataServico,a.InicioPrevisto inicio,a.FimPrevisto fim FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))),2)
  FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId WHERE p.ParticipacaoId=@Participacao;
  IF @ContextoEsperado IS NULL OR @ContextoEsperado<>@Contexto THROW 54206,N'Contexto alterado: revisar solicitacao',1;
  UPDATE Operacao.ExcecaoLimite SET Status=CASE WHEN @Aprovar=1 THEN 'APROVADA' ELSE 'REJEITADA' END,
   DiretorAprovadorId=@DiretorId,DecididoEmUtc=SYSUTCDATETIME(),ExpiraEmUtc=CASE WHEN @Aprovar=1 THEN DATEADD(minute,@ValidadeMinutos,SYSUTCDATETIME()) ELSE NULL END WHERE ExcecaoId=@ExcecaoId;
  IF @Aprovar=0 UPDATE Operacao.Participacao SET Status='PLANEJADA' WHERE ParticipacaoId=@Participacao;
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES('ExcecaoLimite',@ExcecaoId,CASE WHEN @Aprovar=1 THEN 'APROVAR' ELSE 'REJEITAR' END,@DiretorId,
   (SELECT 'PASS' resultado,@MotivoDecisao motivoDecisao,@Solicitante solicitanteId,@ValidadeMinutos validadeMinutos,@Contexto contextoHash FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;SELECT @ExcecaoId ExcecaoDecididaId;
 END TRY BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  DECLARE @Erro int=ERROR_NUMBER();
  BEGIN TRY
   IF EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@DiretorId)
    INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
    VALUES('ExcecaoLimite',@ExcecaoId,'DECISAO_NEGADA',@DiretorId,(SELECT 'DENIED' resultado,@Erro erro FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  END TRY BEGIN CATCH END CATCH;
  THROW;
 END CATCH;
END;
