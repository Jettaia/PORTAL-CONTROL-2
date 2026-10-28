-- SOMENTE banco novo JETTA_CONTROL_B2D_TEST_<12 hex>. Dados sinteticos.
CREATE SCHEMA Seguranca;
GO
CREATE SCHEMA Cadastro;
GO
CREATE TABLE Seguranca.Usuario(UsuarioId bigint IDENTITY PRIMARY KEY,Nome nvarchar(150) NOT NULL,Email nvarchar(256) NOT NULL UNIQUE,Perfil varchar(20) NOT NULL,Ativo bit NOT NULL DEFAULT 1,CriadoEm datetime2 DEFAULT SYSUTCDATETIME());
CREATE TABLE Seguranca.UsuarioRaiz(UsuarioId bigint PRIMARY KEY REFERENCES Seguranca.Usuario(UsuarioId),CriadoEmUtc datetime2 DEFAULT SYSUTCDATETIME());
CREATE TABLE Seguranca.Credencial(UsuarioId bigint PRIMARY KEY REFERENCES Seguranca.Usuario(UsuarioId),SaltHex varchar(32) NOT NULL,SenhaHashHex varchar(128) NOT NULL,Falhas int NOT NULL DEFAULT 0,BloqueadoAteUtc datetime2 NULL,AlteradoEmUtc datetime2 DEFAULT SYSUTCDATETIME());
CREATE TABLE Seguranca.SessaoWeb(SessaoId bigint IDENTITY PRIMARY KEY,UsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),TokenHash char(64) NOT NULL UNIQUE,CriadoEmUtc datetime2 DEFAULT SYSUTCDATETIME(),ExpiraEmUtc datetime2 NOT NULL,RevogadoEmUtc datetime2 NULL,MfaValidadoEmUtc datetime2 NULL,MfaStepUpEmUtc datetime2 NULL);
CREATE TABLE Seguranca.MfaTotp(UsuarioId bigint PRIMARY KEY REFERENCES Seguranca.Usuario(UsuarioId),SegredoCifrado varbinary(512) NOT NULL,VersaoChave smallint NOT NULL,CriadoEmUtc datetime2 DEFAULT SYSUTCDATETIME(),ConfirmadoEmUtc datetime2 NULL,UltimoPassoAceito bigint NULL,RevogadoEmUtc datetime2 NULL);
CREATE TABLE Seguranca.MfaDesafio(DesafioId uniqueidentifier DEFAULT NEWID() PRIMARY KEY,UsuarioId bigint NOT NULL,Finalidade varchar(32),CriadoEmUtc datetime2 DEFAULT SYSUTCDATETIME(),ExpiraEmUtc datetime2,ConsumidoEmUtc datetime2,Tentativas tinyint DEFAULT 0,SessaoHash char(64));
CREATE TABLE Seguranca.MfaAuditoria(EventoId bigint IDENTITY PRIMARY KEY,UsuarioId bigint NULL,AtorUsuarioId bigint NULL,Evento varchar(40) NOT NULL,Resultado varchar(12) NOT NULL,CriadoEmUtc datetime2 DEFAULT SYSUTCDATETIME(),DetalhesJson nvarchar(2000) NULL);
CREATE TABLE Seguranca.Auditoria(AuditoriaId bigint IDENTITY PRIMARY KEY,Entidade nvarchar(80),EntidadeId bigint,Acao nvarchar(40),AtorUsuarioId bigint,DataHoraUtc datetime2 DEFAULT SYSUTCDATETIME(),DetalhesJson nvarchar(max));
CREATE TABLE Cadastro.Filial(FilialId bigint IDENTITY PRIMARY KEY,Codigo nvarchar(30),Nome nvarchar(150),Ativo bit DEFAULT 1,CriadoEm datetime2 DEFAULT SYSUTCDATETIME());
CREATE TABLE Cadastro.Deposito(DepositoId bigint IDENTITY PRIMARY KEY,FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),Codigo nvarchar(30),Nome nvarchar(150),Endereco nvarchar(400),Ativo bit DEFAULT 1,CriadoEm datetime2 DEFAULT SYSUTCDATETIME(),AtualizadoEm datetime2 NULL,RowVer rowversion);
CREATE TABLE Seguranca.UsuarioDeposito(UsuarioId bigint,DepositoId bigint,ConcedidoPor bigint,ConcedidoEmUtc datetime2 DEFAULT SYSUTCDATETIME(),RevogadoPor bigint NULL,RevogadoEmUtc datetime2 NULL,PRIMARY KEY(UsuarioId,DepositoId));
CREATE TABLE Seguranca.GestorDeposito(GestorUsuarioId bigint,DepositoId bigint,ConcedidoPorUsuarioId bigint,ConcedidoEm datetime2 DEFAULT SYSUTCDATETIME(),RevogadoPorUsuarioId bigint NULL,RevogadoEm datetime2 NULL,PRIMARY KEY(GestorUsuarioId,DepositoId));
CREATE TABLE Seguranca.PerfilAcesso(PerfilId bigint IDENTITY PRIMARY KEY,Codigo varchar(40),Nome nvarchar(120),Sistema bit DEFAULT 0,Ativo bit DEFAULT 1);
CREATE TABLE Seguranca.Permissao(PermissaoId bigint IDENTITY PRIMARY KEY,Chave varchar(100),Modulo varchar(50),Descricao nvarchar(200),Critica bit DEFAULT 0);
CREATE TABLE Seguranca.PerfilPermissao(PerfilId bigint,PermissaoId bigint,PRIMARY KEY(PerfilId,PermissaoId));
CREATE TABLE Seguranca.UsuarioPerfil(UsuarioId bigint,PerfilId bigint,PRIMARY KEY(UsuarioId,PerfilId));
