-- EXTRACTED LAB FIXTURE ONLY. Never an installer for principal.
CREATE SCHEMA Operacao;
GO
CREATE TABLE Cadastro.Prestador (
  PrestadorId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_Prestador PRIMARY KEY,
  Nome nvarchar(160) NOT NULL, CPF char(11) NOT NULL,
  Telefone nvarchar(25) NULL, Ativo bit NOT NULL CONSTRAINT DF_B1_Prestador_Ativo DEFAULT (1),
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B1_Prestador_Criado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_B1_Prestador_CPF UNIQUE(CPF),
  CONSTRAINT CK_B1_Prestador_CPF CHECK(CPF NOT LIKE '%[^0-9]%' AND LEN(CPF)=11)
 );
GO
CREATE TABLE Cadastro.TipoServico (
  TipoServicoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_TipoServico PRIMARY KEY,
  Nome nvarchar(120) NOT NULL, Ativo bit NOT NULL CONSTRAINT DF_B1_TipoServico_Ativo DEFAULT (1),
  CONSTRAINT UQ_B1_TipoServico_Nome UNIQUE(Nome)
 );
GO
CREATE TABLE Operacao.PoliticaLimite (
  PoliticaId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_Politica PRIMARY KEY,
  Modo varchar(20) NOT NULL, /* DIAS_CONTRATADOS ou DIAS_CORRIDOS */
  LimiteDias int NOT NULL, JanelaDias int NOT NULL,
  MarcoDiasCorridos varchar(30) NOT NULL CONSTRAINT DF_B1_Politica_Marco DEFAULT 'PRIMEIRA_CONTRATACAO',
  StatusContabilizados varchar(50) NOT NULL CONSTRAINT DF_B1_Politica_Status DEFAULT 'CONFIRMADA,EM_EXECUCAO,CONCLUIDA',
  VigenteDesde date NOT NULL, VigenteAte date NULL,
  CriadoPorAdminId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B1_Politica_Criado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_B1_Politica_Modo CHECK(Modo IN ('DIAS_CONTRATADOS','DIAS_CORRIDOS')),
  CONSTRAINT CK_B1_Politica_Limites CHECK(LimiteDias>0 AND JanelaDias>=LimiteDias),
  CONSTRAINT CK_B1_Politica_Vigencia CHECK(VigenteAte IS NULL OR VigenteAte>=VigenteDesde),
  CONSTRAINT CK_B1_Politica_Marco CHECK(MarcoDiasCorridos IN ('PRIMEIRA_CONTRATACAO'))
 );
GO
CREATE TABLE Operacao.Atividade (
  AtividadeId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_Atividade PRIMARY KEY,
  DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
  TipoServicoId bigint NOT NULL REFERENCES Cadastro.TipoServico(TipoServicoId),
  GestorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  DataServico date NOT NULL, InicioPrevisto datetime2(0) NOT NULL, FimPrevisto datetime2(0) NOT NULL,
  Descricao nvarchar(500) NULL, Status varchar(22) NOT NULL CONSTRAINT DF_B1_Atividade_Status DEFAULT 'PLANEJADA',
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B1_Atividade_Criado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_B1_Atividade_Horario CHECK(FimPrevisto>InicioPrevisto),
  CONSTRAINT CK_B1_Atividade_Status CHECK(Status IN ('PLANEJADA','CONFIRMADA','EM_EXECUCAO','CONCLUIDA','CANCELADA'))
 );
GO
CREATE UNIQUE INDEX UX_B13_Politica_Inicio ON Operacao.PoliticaLimite(VigenteDesde);
GO
CREATE TABLE Operacao.Participacao (
  ParticipacaoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_Participacao PRIMARY KEY,
  AtividadeId bigint NOT NULL REFERENCES Operacao.Atividade(AtividadeId),
  PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
  ValorContratado decimal(18,2) NOT NULL,
  Status varchar(24) NOT NULL CONSTRAINT DF_B1_Participacao_Status DEFAULT 'PLANEJADA',
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B1_Participacao_Criado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_B1_Participacao_AtividadePrestador UNIQUE(AtividadeId,PrestadorId),
  CONSTRAINT CK_B1_Participacao_Valor CHECK(ValorContratado>=0),
  CONSTRAINT CK_B1_Participacao_Status CHECK(Status IN ('PLANEJADA','AGUARDANDO_APROVACAO','CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA','CANCELADA','NAO_COMPARECEU'))
 );
GO
CREATE TABLE Operacao.ExcecaoLimite (
  ExcecaoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_B1_Excecao PRIMARY KEY,
  ParticipacaoId bigint NOT NULL REFERENCES Operacao.Participacao(ParticipacaoId),
  SolicitadoPorGestorId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  Motivo nvarchar(800) NOT NULL,
  Status varchar(15) NOT NULL CONSTRAINT DF_B1_Excecao_Status DEFAULT 'PENDENTE',
  DiretorAprovadorId bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  DecididoEmUtc datetime2(3) NULL, ExpiraEmUtc datetime2(3) NULL,
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_B1_Excecao_Criado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_B1_Excecao_Status CHECK(Status IN ('PENDENTE','APROVADA','REJEITADA','CANCELADA'))
 );
GO
CREATE OR ALTER PROCEDURE Operacao.sp_CriarAtividadePlanejada
 @GestorUsuarioId bigint, @DepositoId bigint, @TipoServicoId bigint,
 @DataServico date, @InicioPrevisto datetime2(0), @FimPrevisto datetime2(0),
 @Descricao nvarchar(500)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 53100,N'Banco incorreto',1;
 BEGIN TRY
 BEGIN TRAN;
 IF NOT EXISTS (SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@GestorUsuarioId AND Perfil='GESTOR' AND Ativo=1)
  THROW 53102,N'Gestor nao habilitado',1;
 IF NOT EXISTS (SELECT 1 FROM Cadastro.Deposito d INNER JOIN Seguranca.GestorDeposito gd
  ON gd.DepositoId=d.DepositoId AND gd.GestorUsuarioId=@GestorUsuarioId AND gd.RevogadoEm IS NULL
  INNER JOIN Cadastro.Filial f ON f.FilialId=d.FilialId
  WHERE d.DepositoId=@DepositoId AND d.Ativo=1 AND f.Ativo=1)
  THROW 53103,N'Deposito sem autorizacao ativa',1;
 IF NOT EXISTS (SELECT 1 FROM Cadastro.TipoServico WHERE TipoServicoId=@TipoServicoId AND Ativo=1)
  THROW 53104,N'Tipo de servico inativo ou inexistente',1;
 IF @DataServico IS NULL OR @InicioPrevisto IS NULL OR @FimPrevisto IS NULL
  OR @FimPrevisto<=@InicioPrevisto OR CONVERT(date,@InicioPrevisto)<>@DataServico
  THROW 53105,N'Data ou periodo invalido',1;
 INSERT Operacao.Atividade(DepositoId,TipoServicoId,GestorUsuarioId,DataServico,InicioPrevisto,FimPrevisto,Descricao,Status)
 VALUES(@DepositoId,@TipoServicoId,@GestorUsuarioId,@DataServico,@InicioPrevisto,@FimPrevisto,@Descricao,'PLANEJADA');
 DECLARE @AtividadeId bigint=CONVERT(bigint,SCOPE_IDENTITY());
 INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
 VALUES(N'Atividade',@AtividadeId,N'CRIAR_PLANEJADA',@GestorUsuarioId,
 CONCAT(N'{"depositoId":',@DepositoId,N'}'));
 COMMIT;
 SELECT @AtividadeId AS AtividadeId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_AdicionarParticipantePlanejado
 @GestorUsuarioId bigint, @AtividadeId bigint, @PrestadorId bigint,
 @ValorContratado decimal(18,2)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 53100,N'Banco incorreto',1;
 BEGIN TRY
 BEGIN TRAN;
 IF NOT EXISTS (SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@GestorUsuarioId AND Perfil='GESTOR' AND Ativo=1)
  THROW 53102,N'Gestor nao habilitado',1;
 DECLARE @Inicio datetime2(0), @Fim datetime2(0);
 SELECT @Inicio=a.InicioPrevisto, @Fim=a.FimPrevisto
 FROM Operacao.Atividade a WITH(UPDLOCK,HOLDLOCK)
 INNER JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
 INNER JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
 INNER JOIN Seguranca.GestorDeposito gd ON gd.DepositoId=d.DepositoId
  AND gd.GestorUsuarioId=@GestorUsuarioId AND gd.RevogadoEm IS NULL
 WHERE a.AtividadeId=@AtividadeId AND a.GestorUsuarioId=@GestorUsuarioId AND a.Status='PLANEJADA';
 IF @Inicio IS NULL THROW 53106,N'Atividade nao planejada ou fora do escopo',1;
 IF NOT EXISTS (SELECT 1 FROM Cadastro.Prestador WHERE PrestadorId=@PrestadorId AND Ativo=1)
  THROW 53107,N'Prestador nao habilitado',1;
 IF @ValorContratado IS NULL OR @ValorContratado<0
  THROW 53108,N'Valor invalido',1;
 /* Lock por prestador serializa inclusoes concorrentes (inclusive em depositos distintos). */
 DECLARE @lockResult int;
 DECLARE @LockResource nvarchar(255)=CONCAT(N'JettaControl.Prestador.',CONVERT(varchar(20),@PrestadorId));
 EXEC @lockResult=sys.sp_getapplock
   @Resource=@LockResource,
   @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lockResult<0 THROW 53109,N'Nao foi possivel bloquear prestador para validacao',1;
 IF EXISTS (
  SELECT 1 FROM Operacao.Participacao p
  INNER JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
  WHERE p.PrestadorId=@PrestadorId AND p.Status NOT IN ('CANCELADA','NAO_COMPARECEU')
   AND a.Status<>'CANCELADA' AND a.InicioPrevisto<@Fim AND @Inicio<a.FimPrevisto
 ) THROW 53110,N'Conflito de horario do prestador',1;
 INSERT Operacao.Participacao(AtividadeId,PrestadorId,ValorContratado,Status)
 VALUES(@AtividadeId,@PrestadorId,@ValorContratado,'PLANEJADA');
 DECLARE @ParticipacaoId bigint=CONVERT(bigint,SCOPE_IDENTITY());
 INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
 VALUES(N'Participacao',@ParticipacaoId,N'CRIAR_PLANEJADA',@GestorUsuarioId,
 CONCAT(N'{"atividadeId":',@AtividadeId,N',"prestadorId":',@PrestadorId,N'}'));
 COMMIT;
 SELECT @ParticipacaoId AS ParticipacaoId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_CadastrarPoliticaLimite
 @AdminId bigint, @Modo varchar(20), @LimiteDias int, @JanelaDias int,
 @VigenteDesde date, @VigenteAte date=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF DB_NAME() NOT LIKE N'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 54100,N'Banco incorreto',1;
 BEGIN TRY
  BEGIN TRAN;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK) WHERE UsuarioId=@AdminId AND Perfil='ADMIN' AND Ativo=1)
   THROW 54110,N'Somente ADMIN ativo configura politica',1;
  IF @Modo NOT IN ('DIAS_CONTRATADOS','DIAS_CORRIDOS') OR @Modo IS NULL
   OR @LimiteDias IS NULL OR @LimiteDias<=0 OR @JanelaDias IS NULL OR @JanelaDias<@LimiteDias
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
   (SELECT @Modo modo,@LimiteDias limiteDias,@JanelaDias janelaDias FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
  SELECT @id AS PoliticaId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_AvaliarLimiteContratacao
 @ParticipacaoId bigint
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Data date,@PrestadorId bigint,@Modo varchar(20),@Max int,@Janela int,@Politica bigint;
 SELECT @Data=a.DataServico,@PrestadorId=p.PrestadorId
 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
 WHERE p.ParticipacaoId=@ParticipacaoId;
 IF @Data IS NULL THROW 54120,N'Participacao inexistente',1;
 SELECT @Politica=PoliticaId,@Modo=Modo,@Max=LimiteDias,@Janela=JanelaDias
 FROM Operacao.PoliticaLimite
 WHERE VigenteDesde<=@Data AND (VigenteAte IS NULL OR VigenteAte>=@Data);
 IF @Politica IS NULL THROW 54121,N'Sem politica vigente para data do servico',1;
 IF @Modo='DIAS_CORRIDOS' THROW 54122,N'DIAS_CORRIDOS bloqueado: marco/reinicio nao homologados',1;
 /* Usa DISTINCT por dia e considera contratações confirmadas de todas as filiais. */
 DECLARE @Inicio date=DATEADD(day,1-@Janela,@Data),@Dias int,@MesmoDia bit=0;
 SELECT @Dias=COUNT(DISTINCT a.DataServico)
 FROM Operacao.Participacao p WITH(HOLDLOCK)
 JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
 WHERE p.PrestadorId=@PrestadorId AND p.ParticipacaoId<>@ParticipacaoId
 AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA')
 AND a.Status<>'CANCELADA' AND a.DataServico BETWEEN @Inicio AND @Data;
 IF EXISTS (SELECT 1 FROM Operacao.Participacao p
 JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
 WHERE p.PrestadorId=@PrestadorId AND p.ParticipacaoId<>@ParticipacaoId
 AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA')
 AND a.Status<>'CANCELADA' AND a.DataServico=@Data)
 SET @MesmoDia=1;
 SELECT @Politica AS PoliticaId,@Modo AS Modo,@Max AS LimiteDias,@Janela AS JanelaDias,
 @Dias AS DiasContratadosNaJanela, @MesmoDia AS MesmoDiaJaContabilizado,
 CASE WHEN @Dias+CASE WHEN @MesmoDia=1 THEN 0 ELSE 1 END<=@Max THEN CONVERT(bit,1) ELSE CONVERT(bit,0) END AS DentroDoLimite;
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_SolicitarExcecaoLimite
 @GestorId bigint,@ParticipacaoId bigint,@Motivo nvarchar(800)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRAN;
  IF NULLIF(LTRIM(RTRIM(@Motivo)),N'') IS NULL THROW 54130,N'Justificativa obrigatoria',1;
  IF NOT EXISTS(SELECT 1 FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK)
    JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
    JOIN Seguranca.Usuario u ON u.UsuarioId=@GestorId AND u.Perfil='GESTOR' AND u.Ativo=1
    JOIN Seguranca.GestorDeposito gd ON gd.GestorUsuarioId=@GestorId AND gd.DepositoId=a.DepositoId AND gd.RevogadoEm IS NULL
    WHERE p.ParticipacaoId=@ParticipacaoId AND p.Status IN ('PLANEJADA','AGUARDANDO_APROVACAO')
      AND a.GestorUsuarioId=@GestorId AND a.Status='PLANEJADA')
   THROW 54131,N'Gestor nao autorizado ou participacao nao planejada',1;
  IF EXISTS(SELECT 1 FROM Operacao.ExcecaoLimite WHERE ParticipacaoId=@ParticipacaoId AND Status IN ('PENDENTE','APROVADA'))
   THROW 54132,N'Ja existe excecao pendente ou aprovada',1;
  INSERT Operacao.ExcecaoLimite(ParticipacaoId,SolicitadoPorGestorId,Motivo)
  VALUES(@ParticipacaoId,@GestorId,@Motivo);
  DECLARE @id bigint=CONVERT(bigint,SCOPE_IDENTITY());
  UPDATE Operacao.Participacao SET Status='AGUARDANDO_APROVACAO' WHERE ParticipacaoId=@ParticipacaoId;
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES(N'ExcecaoLimite',@id,N'SOLICITAR',@GestorId,
    (SELECT @ParticipacaoId participacaoId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
  SELECT @id AS ExcecaoId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_DecidirExcecaoLimite
 @DiretorId bigint,@ExcecaoId bigint,@Aprovar bit,@MfaConfirmado bit,
 @ValidadeMinutos int=60
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRAN;
  IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@DiretorId AND Perfil='DIRETORIA' AND Ativo=1)
    THROW 54140,N'Somente Diretoria ativa pode decidir excecao',1;
  IF ISNULL(@MfaConfirmado,0)<>1 THROW 54141,N'MFA adicional nao comprovado',1;
  IF @Aprovar IS NULL OR @ValidadeMinutos NOT BETWEEN 1 AND 1440
    THROW 54142,N'Parametros de decisao invalidos',1;
  IF NOT EXISTS(SELECT 1 FROM Operacao.ExcecaoLimite WITH(UPDLOCK,HOLDLOCK) WHERE ExcecaoId=@ExcecaoId AND Status='PENDENTE')
    THROW 54143,N'Excecao inexistente ou decidida',1;
  UPDATE Operacao.ExcecaoLimite SET Status=CASE WHEN @Aprovar=1 THEN 'APROVADA' ELSE 'REJEITADA' END,
   DiretorAprovadorId=@DiretorId,DecididoEmUtc=SYSUTCDATETIME(),
   ExpiraEmUtc=CASE WHEN @Aprovar=1 THEN DATEADD(minute,@ValidadeMinutos,SYSUTCDATETIME()) ELSE NULL END
   WHERE ExcecaoId=@ExcecaoId;
  IF @Aprovar=0
   UPDATE p SET Status='PLANEJADA' FROM Operacao.Participacao p
   JOIN Operacao.ExcecaoLimite e ON e.ParticipacaoId=p.ParticipacaoId WHERE e.ExcecaoId=@ExcecaoId AND p.Status='AGUARDANDO_APROVACAO';
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
  VALUES(N'ExcecaoLimite',@ExcecaoId,CASE WHEN @Aprovar=1 THEN N'APROVAR' ELSE N'REJEITAR' END,@DiretorId,
    (SELECT @ValidadeMinutos validadeMinutos FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Operacao.sp_ConfirmarParticipacao
 @GestorId bigint,@ParticipacaoId bigint
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRAN;
  DECLARE @Prestador bigint,@Data date,@Inicio datetime2(0),@Fim datetime2(0),@Atividade bigint;
  SELECT @Prestador=p.PrestadorId,@Data=a.DataServico,@Inicio=a.InicioPrevisto,@Fim=a.FimPrevisto,@Atividade=a.AtividadeId
  FROM Operacao.Participacao p WITH(UPDLOCK,HOLDLOCK)
  JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
  JOIN Cadastro.Deposito d ON d.DepositoId=a.DepositoId AND d.Ativo=1
  JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1
  JOIN Cadastro.TipoServico t ON t.TipoServicoId=a.TipoServicoId AND t.Ativo=1
  JOIN Cadastro.Prestador c ON c.PrestadorId=p.PrestadorId AND c.Ativo=1
  JOIN Seguranca.Usuario u ON u.UsuarioId=@GestorId AND u.Perfil='GESTOR' AND u.Ativo=1
  JOIN Seguranca.GestorDeposito gd ON gd.GestorUsuarioId=@GestorId AND gd.DepositoId=a.DepositoId AND gd.RevogadoEm IS NULL
  WHERE p.ParticipacaoId=@ParticipacaoId AND p.Status IN ('PLANEJADA','AGUARDANDO_APROVACAO')
   AND a.GestorUsuarioId=@GestorId AND a.Status IN ('PLANEJADA','CONFIRMADA');
  IF @Prestador IS NULL THROW 54150,N'Participacao indisponivel ou gestor sem acesso',1;
  DECLARE @res nvarchar(255)=CONCAT(N'JettaControl.Prestador.',CONVERT(varchar(20),@Prestador)),@lr int;
  EXEC @lr=sys.sp_getapplock @Resource=@res,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
  IF @lr<0 THROW 54151,N'Falha de lock para prestador',1;
  IF EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
     WHERE p.PrestadorId=@Prestador AND p.ParticipacaoId<>@ParticipacaoId
       AND p.Status NOT IN ('CANCELADA','NAO_COMPARECEU') AND a.Status<>'CANCELADA'
       AND a.InicioPrevisto<@Fim AND @Inicio<a.FimPrevisto)
   THROW 54152,N'Conflito de periodo com outra atividade',1;
  DECLARE @Modo varchar(20),@Limite int,@Janela int;
  SELECT @Modo=Modo,@Limite=LimiteDias,@Janela=JanelaDias FROM Operacao.PoliticaLimite
  WHERE VigenteDesde<=@Data AND (VigenteAte IS NULL OR VigenteAte>=@Data);
  IF @Modo IS NULL THROW 54153,N'Politica de limite ausente',1;
  IF @Modo='DIAS_CORRIDOS' THROW 54154,N'DIAS_CORRIDOS nao habilitado ate definir marco e reinicio',1;
  DECLARE @InicioJanela date=DATEADD(day,1-@Janela,@Data),@Dias int,@MesmoDia bit=0;
  SELECT @Dias=COUNT(DISTINCT a.DataServico)
   FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
   WHERE p.PrestadorId=@Prestador AND p.ParticipacaoId<>@ParticipacaoId
    AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA'
    AND a.DataServico BETWEEN @InicioJanela AND @Data;
  IF EXISTS(SELECT 1 FROM Operacao.Participacao p JOIN Operacao.Atividade a ON a.AtividadeId=p.AtividadeId
   WHERE p.PrestadorId=@Prestador AND p.ParticipacaoId<>@ParticipacaoId
    AND p.Status IN ('CONFIRMADA','EM_EXECUCAO','CONFERENCIA','CONCLUIDA') AND a.Status<>'CANCELADA' AND a.DataServico=@Data)
   SET @MesmoDia=1;
  IF @Dias+CASE WHEN @MesmoDia=1 THEN 0 ELSE 1 END>@Limite
   AND NOT EXISTS(SELECT 1 FROM Operacao.ExcecaoLimite WITH(UPDLOCK,HOLDLOCK)
    WHERE ParticipacaoId=@ParticipacaoId AND Status='APROVADA' AND ExpiraEmUtc>SYSUTCDATETIME()
    AND DiretorAprovadorId IS NOT NULL)
   THROW 54155,N'Limite excedido: exige autorizacao valida da Diretoria',1;
  UPDATE Operacao.Participacao SET Status='CONFIRMADA' WHERE ParticipacaoId=@ParticipacaoId;
  UPDATE Operacao.Atividade SET Status='CONFIRMADA' WHERE AtividadeId=@Atividade AND Status='PLANEJADA';
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
   VALUES(N'Participacao',@ParticipacaoId,N'CONFIRMAR',@GestorId,
    (SELECT @Dias diasAnteriores,@Limite limiteDias FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
  COMMIT;
  SELECT @ParticipacaoId AS ParticipacaoConfirmadaId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END;
GO
