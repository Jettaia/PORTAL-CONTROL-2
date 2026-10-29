-- PC10 additive schema. Installer or disposable database only.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55915,N'PC10 exige transacao externa',1;
-- PagoEmUtc is historical cash evidence, including after revision/cancellation.
-- PC04's status-only invariant predates adjustments and rejects those transitions.
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Operacao.Contratacao') AND name='CK_PC04_Pago')
 ALTER TABLE Operacao.Contratacao DROP CONSTRAINT CK_PC04_Pago;
IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NULL
BEGIN
 CREATE TABLE Financeiro.PC10Movimento(
 MovimentoId bigint IDENTITY PRIMARY KEY,
 ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
 Chave nvarchar(120) NOT NULL UNIQUE,
 Tipo varchar(30) NOT NULL CHECK(Tipo IN('LIBERACAO','RETIRADA','PAGAMENTO','ESTORNO','QUITACAO','DEVOLUCAO')),
 Valor decimal(20,2) NOT NULL,DataEfetiva date NOT NULL,Versao int NOT NULL CHECK(Versao>0),
 AtorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 PagamentoId bigint NULL REFERENCES Financeiro.PC08Pagamento(PagamentoId),
 Motivo nvarchar(800) NULL,RegistradoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 Nome nvarchar(180) NULL,Conteudo varbinary(max) NULL CHECK(Conteudo IS NULL OR DATALENGTH(Conteudo) BETWEEN 1 AND 1048576));
 CREATE INDEX IX_PC10_Contratacao ON Financeiro.PC10Movimento(ContratacaoId,MovimentoId) INCLUDE(Valor);
 -- Initial baseline only once; records remain immutable after provisioning.
 INSERT Financeiro.PC10Movimento(ContratacaoId,Chave,Tipo,Valor,DataEfetiva,Versao,AtorUsuarioId)
 SELECT ContratacaoId,CONCAT('BASE:C:',ContratacaoId),'LIBERACAO',ValorLiberado,CONVERT(date,LiberadoEmUtc AT TIME ZONE 'UTC' AT TIME ZONE 'E. South America Standard Time'),Versao,ConferidoPor
 FROM Operacao.Contratacao WHERE Status='LIBERADA' AND ValorLiberado IS NOT NULL;
 INSERT Financeiro.PC10Movimento(ContratacaoId,Chave,Tipo,Valor,DataEfetiva,Versao,AtorUsuarioId,PagamentoId)
 SELECT i.ContratacaoId,CONCAT('P:',p.PagamentoId,':',i.ContratacaoId),'PAGAMENTO',-i.Valor,p.DataPagamento,i.VersaoLiberada,p.RegistradoPor,p.PagamentoId
 FROM Financeiro.PC08Item i JOIN Financeiro.PC08Pagamento p ON p.PagamentoId=i.PagamentoId;
END;
IF OBJECT_ID('Financeiro.PC10Estorno','U') IS NULL
 CREATE TABLE Financeiro.PC10Estorno(PagamentoId bigint PRIMARY KEY REFERENCES Financeiro.PC08Pagamento(PagamentoId),AtorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),Motivo nvarchar(800) NOT NULL,RegistradoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME());
IF OBJECT_ID('Financeiro.PC10DocumentoEstado','U') IS NULL
 CREATE TABLE Financeiro.PC10DocumentoEstado(ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),Versao int NOT NULL,Estado varchar(20) NOT NULL CHECK(Estado IN('CANCELADO','SUBSTITUIDO')),ExigeNovaAssinatura bit NOT NULL CHECK(ExigeNovaAssinatura=1),Motivo nvarchar(800) NOT NULL,AtorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),RegistradoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(ContratacaoId,Versao));
