IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
