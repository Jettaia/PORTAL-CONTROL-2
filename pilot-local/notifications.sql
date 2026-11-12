/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55960,N'Notificacoes exigem transacao externa',1;
IF OBJECT_ID('Operacao.ContratacaoHorarioSolicitacao','U') IS NULL THROW 55960,N'Aprovacao de horarios nao instalada',1;
IF OBJECT_ID('Seguranca.NotificacaoLeitura','U') IS NULL
 CREATE TABLE Seguranca.NotificacaoLeitura(
  UsuarioId bigint NOT NULL,
  SolicitacaoId bigint NOT NULL,
  Tipo varchar(11) NOT NULL CHECK(Tipo IN('SOLICITACAO','RESULTADO')),
  LidoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_NotificacaoLeitura PRIMARY KEY(UsuarioId,SolicitacaoId,Tipo),
  CONSTRAINT FK_NotificacaoLeitura_Usuario FOREIGN KEY(UsuarioId) REFERENCES Seguranca.Usuario(UsuarioId) ON DELETE CASCADE,
  CONSTRAINT FK_NotificacaoLeitura_Solicitacao FOREIGN KEY(SolicitacaoId) REFERENCES Operacao.ContratacaoHorarioSolicitacao(SolicitacaoId)
 );
