-- FIN02 is additive. Preserve all previous financial and operational records.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55970,N'Recibos exigem transacao externa',1;
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL THROW 55970,N'Contratacoes nao instaladas',1;
IF OBJECT_ID('Financeiro.ContratacaoRecibo','U') IS NULL
 CREATE TABLE Financeiro.ContratacaoRecibo(
  ReciboId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Fin02Recibo PRIMARY KEY,
  ContratacaoId bigint NOT NULL CONSTRAINT UQ_Fin02Recibo_Contratacao UNIQUE REFERENCES Operacao.Contratacao(ContratacaoId),
  VersaoOrigem int NOT NULL,DepositoId bigint NOT NULL REFERENCES Cadastro.Deposito(DepositoId),
  PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),TipoServicoId bigint NOT NULL REFERENCES Cadastro.TipoServico(TipoServicoId),
  DataServico date NOT NULL,ValorLiberado decimal(18,2) NOT NULL,LiberadoEmUtc datetime2(7) NOT NULL,
  DataEmissao date NOT NULL,EmitidoEmUtc datetime2(3) NOT NULL,EmitidoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  SnapshotJson nvarchar(max) NOT NULL,DocumentoHtml nvarchar(max) NOT NULL,
  CONSTRAINT CK_Fin02Recibo_Documento CHECK(LEN(DocumentoHtml)>0),
  CONSTRAINT CK_Fin02Recibo_Snapshot CHECK(ISJSON(SnapshotJson)=1),
  CONSTRAINT CK_Fin02Recibo_Valor CHECK(ValorLiberado>0),
  CONSTRAINT CK_Fin02Recibo_Versao CHECK(VersaoOrigem>0)
 );
GO
