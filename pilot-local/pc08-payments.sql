-- PC08 additive schema, installer or disposable database only.
/*PILOT_GUARD*/
IF @@TRANCOUNT=0 THROW 55914,N'PC08 exige transacao externa',1;
IF OBJECT_ID('Financeiro.PC08Pagamento','U') IS NULL
 CREATE TABLE Financeiro.PC08Pagamento(
 PagamentoId bigint IDENTITY PRIMARY KEY,PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
 DataPagamento date NOT NULL,RegistradoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
 RegistradoEmUtc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),ValorTotal decimal(20,2) NOT NULL CHECK(ValorTotal>=0));
IF OBJECT_ID('Financeiro.PC08Item','U') IS NULL
 CREATE TABLE Financeiro.PC08Item(
 ContratacaoId bigint NOT NULL PRIMARY KEY REFERENCES Operacao.Contratacao(ContratacaoId),
 PagamentoId bigint NOT NULL REFERENCES Financeiro.PC08Pagamento(PagamentoId),
 VersaoLiberada int NOT NULL CHECK(VersaoLiberada>0),Valor decimal(18,2) NOT NULL CHECK(Valor>=0));
IF OBJECT_ID('Financeiro.PC08Anexo','U') IS NULL
 CREATE TABLE Financeiro.PC08Anexo(
 ContratacaoId bigint NOT NULL PRIMARY KEY REFERENCES Financeiro.PC08Item(ContratacaoId),
 Nome nvarchar(180) NOT NULL,Conteudo varbinary(max) NOT NULL CHECK(DATALENGTH(Conteudo) BETWEEN 1 AND 1048576));
