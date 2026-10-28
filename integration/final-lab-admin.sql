-- Fixture de administracao das APIs B2 existentes, exclusivamente no banco sintetico.
IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55700,N'Somente laboratorio sintetico',1;
IF OBJECT_ID('Cadastro.TipoPrestador') IS NULL CREATE TABLE Cadastro.TipoPrestador(TipoPrestadorId bigint IDENTITY PRIMARY KEY,Nome nvarchar(120) NOT NULL UNIQUE,Ativo bit NOT NULL DEFAULT 1);
IF OBJECT_ID('Cadastro.PrestadorTipo') IS NULL CREATE TABLE Cadastro.PrestadorTipo(PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),TipoPrestadorId bigint NOT NULL REFERENCES Cadastro.TipoPrestador(TipoPrestadorId),PRIMARY KEY(PrestadorId,TipoPrestadorId));
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_LabAdminGuard @AtorId bigint AS
BEGIN
 IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' THROW 55700,N'Somente laboratorio',1;
 IF NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u ON u.UsuarioId=r.UsuarioId WHERE r.UsuarioId=@AtorId AND u.Ativo=1 AND u.Perfil='ADMIN') THROW 55710,N'Administrador sintetico obrigatorio',1;
END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24A_CriarFilial @AtorId bigint,@Codigo nvarchar(30),@Nome nvarchar(150) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;
 IF LEN(@Nome)<2 OR EXISTS(SELECT 1 FROM Cadastro.Filial WHERE Codigo=@Codigo) THROW 55711,N'Dados invalidos ou duplicados',1;
 INSERT Cadastro.Filial(Codigo,Nome) VALUES(@Codigo,@Nome);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Filial',@id,N'CADASTRAR',@AtorId);COMMIT;SELECT @id FilialId;END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24A_CriarTipoServico @AtorId bigint,@Nome nvarchar(120) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;INSERT Cadastro.TipoServico(Nome) VALUES(@Nome);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'TipoServico',@id,N'CADASTRAR',@AtorId);COMMIT;SELECT @id TipoServicoId;END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24B_CriarTipoPrestador @AtorId bigint,@Nome nvarchar(120) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;INSERT Cadastro.TipoPrestador(Nome) VALUES(@Nome);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'TipoPrestador',@id,N'CADASTRAR',@AtorId);COMMIT;SELECT @id TipoPrestadorId;END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24B_VincularTipoPrestador @AtorId bigint,@PrestadorId bigint,@TipoPrestadorId bigint AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;IF NOT EXISTS(SELECT 1 FROM Cadastro.PrestadorTipo WHERE PrestadorId=@PrestadorId AND TipoPrestadorId=@TipoPrestadorId) INSERT Cadastro.PrestadorTipo VALUES(@PrestadorId,@TipoPrestadorId);INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Prestador',@PrestadorId,N'VINCULAR_TIPO',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24C_CriarDeposito @AtorId bigint,@FilialId bigint,@Codigo nvarchar(30),@Nome nvarchar(150),@Endereco nvarchar(400)=NULL AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM Cadastro.Filial WHERE FilialId=@FilialId AND Ativo=1) OR EXISTS(SELECT 1 FROM Cadastro.Deposito WHERE FilialId=@FilialId AND Codigo=@Codigo) THROW 55711,N'Filial ou codigo invalido',1;
 INSERT Cadastro.Deposito(FilialId,Codigo,Nome,Endereco) VALUES(@FilialId,@Codigo,@Nome,@Endereco);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Deposito',@id,N'CADASTRAR',@AtorId);COMMIT;SELECT @id DepositoId;END;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24C_AtualizarDeposito @AtorId bigint,@DepositoId bigint,@Nome nvarchar(150),@Endereco nvarchar(400)=NULL,@Ativo bit AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;UPDATE Cadastro.Deposito SET Nome=@Nome,Endereco=@Endereco,Ativo=@Ativo,AtualizadoEm=SYSUTCDATETIME() WHERE DepositoId=@DepositoId;IF @@ROWCOUNT<>1 THROW 55711,N'Deposito indisponivel',1;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Deposito',@DepositoId,N'ATUALIZAR',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B24D_AtribuirUsuarioDeposito @AtorId bigint,@UsuarioId bigint,@DepositoId bigint,@Conceder bit AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;
 IF @Conceder=1 BEGIN
 IF EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId) UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=NULL,ConcedidoPor=@AtorId,ConcedidoEmUtc=SYSUTCDATETIME() WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId;
 ELSE INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(@UsuarioId,@DepositoId,@AtorId);END
 ELSE UPDATE Seguranca.UsuarioDeposito SET RevogadoEmUtc=SYSUTCDATETIME(),RevogadoPor=@AtorId WHERE UsuarioId=@UsuarioId AND DepositoId=@DepositoId;
 INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Usuario',@UsuarioId,N'ALTERAR_ESCOPO',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B23_CriarPerfil @AtorId bigint,@Codigo varchar(40),@Nome nvarchar(120) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;IF EXISTS(SELECT 1 FROM Seguranca.PerfilAcesso WHERE Codigo=@Codigo) THROW 55711,N'Codigo duplicado',1;INSERT Seguranca.PerfilAcesso(Codigo,Nome) VALUES(@Codigo,@Nome);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Perfil',@id,N'CADASTRAR',@AtorId);COMMIT;SELECT @id PerfilId;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B23_DefinirPermissao @AtorId bigint,@PerfilId bigint,@Chave varchar(100),@Conceder bit AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;DECLARE @p bigint;SELECT @p=PermissaoId FROM Seguranca.Permissao WHERE Chave=@Chave AND Critica=0;IF @p IS NULL THROW 55711,N'Permissao indisponivel ou critica',1;IF @Conceder=1 BEGIN IF NOT EXISTS(SELECT 1 FROM Seguranca.PerfilPermissao WHERE PerfilId=@PerfilId AND PermissaoId=@p) INSERT Seguranca.PerfilPermissao VALUES(@PerfilId,@p);END ELSE DELETE Seguranca.PerfilPermissao WHERE PerfilId=@PerfilId AND PermissaoId=@p;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Perfil',@PerfilId,N'ALTERAR_PERMISSAO',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B23_AtribuirPerfil @AtorId bigint,@UsuarioId bigint,@PerfilId bigint,@Conceder bit AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@UsuarioId) OR NOT EXISTS(SELECT 1 FROM Seguranca.PerfilAcesso WHERE PerfilId=@PerfilId AND Ativo=1) THROW 55711,N'Usuario ou perfil invalido',1;IF @Conceder=1 BEGIN IF NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil WHERE UsuarioId=@UsuarioId AND PerfilId=@PerfilId) INSERT Seguranca.UsuarioPerfil VALUES(@UsuarioId,@PerfilId);END ELSE DELETE Seguranca.UsuarioPerfil WHERE UsuarioId=@UsuarioId AND PerfilId=@PerfilId;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Usuario',@UsuarioId,N'ALTERAR_PERFIL',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B25_CriarUsuarioPendente @AtorId bigint,@Nome nvarchar(150),@Email nvarchar(256),@PerfilBase varchar(20) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;IF @PerfilBase NOT IN('GESTOR','FINANCEIRO','DIRETORIA','ADMIN') OR @Email NOT LIKE '%@%.%' THROW 55711,N'Perfil ou email invalido',1;INSERT Seguranca.Usuario(Nome,Email,Perfil,Ativo) VALUES(@Nome,@Email,@PerfilBase,0);DECLARE @id bigint=SCOPE_IDENTITY();INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Usuario',@id,N'CRIAR_PENDENTE',@AtorId);COMMIT;SELECT @id UsuarioId;END;
GO
IF OBJECT_ID('Seguranca.ConviteAtivacaoLab') IS NULL CREATE TABLE Seguranca.ConviteAtivacaoLab(ConviteId bigint IDENTITY PRIMARY KEY,UsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),TokenHash char(64) NOT NULL UNIQUE,EmissorId bigint NOT NULL,ExpiraUtc datetime2 NOT NULL,ConsumidoUtc datetime2 NULL,RevogadoUtc datetime2 NULL);
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B25B_EmitirConvite @AtorId bigint,@UsuarioId bigint,@TokenHash char(64) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;EXEC Seguranca.sp_LabAdminGuard @AtorId;BEGIN TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@UsuarioId AND Ativo=0 AND Perfil NOT IN('ADMIN','DIRETORIA')) OR EXISTS(SELECT 1 FROM Seguranca.Credencial WHERE UsuarioId=@UsuarioId) THROW 55711,N'Conta inelegivel',1;
 UPDATE Seguranca.ConviteAtivacaoLab SET RevogadoUtc=SYSUTCDATETIME() WHERE UsuarioId=@UsuarioId AND ConsumidoUtc IS NULL AND RevogadoUtc IS NULL;
 INSERT Seguranca.ConviteAtivacaoLab(UsuarioId,TokenHash,EmissorId,ExpiraUtc) VALUES(@UsuarioId,@TokenHash,@AtorId,DATEADD(minute,30,SYSUTCDATETIME()));INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'Usuario',@UsuarioId,N'CONVITE_LAB',@AtorId);COMMIT;END;
GO
CREATE OR ALTER PROCEDURE Seguranca.sp_B25B_AtivarUsuario @TokenHash char(64),@SaltHex varchar(32),@SenhaHashHex varchar(128) AS
BEGIN SET NOCOUNT ON;SET XACT_ABORT ON;BEGIN TRANSACTION;
 DECLARE @id bigint,@convite bigint;SELECT @id=c.UsuarioId,@convite=c.ConviteId FROM Seguranca.ConviteAtivacaoLab c WITH(UPDLOCK,HOLDLOCK) JOIN Seguranca.Usuario u ON u.UsuarioId=c.UsuarioId AND u.Ativo=0 AND u.Perfil NOT IN('ADMIN','DIRETORIA') WHERE c.TokenHash=@TokenHash AND c.ExpiraUtc>SYSUTCDATETIME() AND c.ConsumidoUtc IS NULL AND c.RevogadoUtc IS NULL;
 IF @id IS NULL THROW 55711,N'Convite invalido ou consumido',1;
 INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(@id,@SaltHex,@SenhaHashHex);UPDATE Seguranca.Usuario SET Ativo=1 WHERE UsuarioId=@id;UPDATE Seguranca.ConviteAtivacaoLab SET ConsumidoUtc=SYSUTCDATETIME() WHERE ConviteId=@convite;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao) VALUES(N'Usuario',@id,N'ATIVAR_LAB');COMMIT;SELECT @id UsuarioId;END;
