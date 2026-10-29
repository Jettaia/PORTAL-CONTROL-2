-- PC08 additive schema, installer or disposable database only.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
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
