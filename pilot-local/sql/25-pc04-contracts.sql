-- PC-04 native individual contracts. Additive installer/disposable database only.
-- Legacy activities/participations remain unchanged; no ambiguous automatic import.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55912,N'PC-04 exige transacao externa',1;
IF OBJECT_ID('Operacao.NumeroContratacao','SO') IS NULL
 EXEC('CREATE SEQUENCE Operacao.NumeroContratacao AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE');
IF OBJECT_ID('Operacao.Contratacao','U') IS NULL
 CREATE TABLE Operacao.Contratacao(
  ContratacaoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PC04_Contratacao PRIMARY KEY,
  Numero bigint NOT NULL CONSTRAINT DF_PC04_Numero DEFAULT(NEXT VALUE FOR Operacao.NumeroContratacao),
  FilialId bigint NOT NULL REFERENCES Cadastro.Filial(FilialId),
  PrestadorId bigint NOT NULL REFERENCES Cadastro.Prestador(PrestadorId),
  TipoServicoId bigint NOT NULL REFERENCES Cadastro.TipoServico(TipoServicoId),
  GestorResponsavelId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  DataServico date NOT NULL,InicioPrevisto datetime2(0) NOT NULL,FimPrevisto datetime2(0) NOT NULL,
  EntradaReal datetime2(0) NULL,SaidaReal datetime2(0) NULL,
  EntradaOrigem varchar(12) NULL,SaidaOrigem varchar(12) NULL,
  Valor decimal(18,2) NOT NULL,
  Status varchar(12) NOT NULL CONSTRAINT DF_PC04_Status DEFAULT('ABERTA'),
  Versao int NOT NULL CONSTRAINT DF_PC04_Versao DEFAULT(1),
  CriadoPor bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_PC04_Criado DEFAULT SYSUTCDATETIME(),
  ConferidoPor bigint NULL REFERENCES Seguranca.Usuario(UsuarioId),
  LiberadoEmUtc datetime2(3) NULL,ValorLiberado decimal(18,2) NULL,PagoEmUtc datetime2(3) NULL,
  CONSTRAINT UQ_PC04_Numero UNIQUE(Numero),
  CONSTRAINT UQ_PC04_PrestadorData UNIQUE(PrestadorId,DataServico),
  CONSTRAINT CK_PC04_Valor CHECK(Valor>=0 AND (ValorLiberado IS NULL OR ValorLiberado>=0)),
  CONSTRAINT CK_PC04_Status CHECK(Status IN('ABERTA','LIBERADA','CANCELADA')),
  CONSTRAINT CK_PC04_Versao CHECK(Versao>0),
  CONSTRAINT CK_PC04_Previsto CHECK(CONVERT(date,InicioPrevisto)=DataServico AND FimPrevisto>InicioPrevisto AND CONVERT(date,FimPrevisto)<=DATEADD(day,1,DataServico)),
  CONSTRAINT CK_PC04_Real CHECK((EntradaReal IS NULL OR CONVERT(date,EntradaReal)=DataServico) AND (SaidaReal IS NULL OR CONVERT(date,SaidaReal)<=DATEADD(day,1,DataServico)) AND (EntradaReal IS NULL OR SaidaReal IS NULL OR SaidaReal>EntradaReal)),
  CONSTRAINT CK_PC04_Origem CHECK((EntradaReal IS NULL AND EntradaOrigem IS NULL OR EntradaReal IS NOT NULL AND EntradaOrigem IS NOT NULL AND EntradaOrigem IN('MANUAL','TOKEN')) AND (SaidaReal IS NULL AND SaidaOrigem IS NULL OR SaidaReal IS NOT NULL AND SaidaOrigem IS NOT NULL AND SaidaOrigem IN('MANUAL','TOKEN'))),
  CONSTRAINT CK_PC04_Liberacao CHECK((Status='LIBERADA' AND EntradaReal IS NOT NULL AND SaidaReal IS NOT NULL AND ConferidoPor IS NOT NULL AND LiberadoEmUtc IS NOT NULL AND ValorLiberado IS NOT NULL AND ValorLiberado=Valor) OR (Status<>'LIBERADA' AND ConferidoPor IS NULL AND LiberadoEmUtc IS NULL AND ValorLiberado IS NULL)),
  CONSTRAINT CK_PC04_Pago CHECK(PagoEmUtc IS NULL OR Status='LIBERADA')
 );
IF OBJECT_ID('Operacao.ContratacaoEvento','U') IS NULL
 CREATE TABLE Operacao.ContratacaoEvento(
  EventoId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_PC04_Evento PRIMARY KEY,
  ContratacaoId bigint NOT NULL REFERENCES Operacao.Contratacao(ContratacaoId),
  Acao varchar(16) NOT NULL,AtorUsuarioId bigint NOT NULL REFERENCES Seguranca.Usuario(UsuarioId),
  Versao int NOT NULL,Status varchar(12) NOT NULL,Valor decimal(18,2) NOT NULL,ValorLiberado decimal(18,2) NULL,
  CriadoEmUtc datetime2(3) NOT NULL CONSTRAINT DF_PC04_EventoUtc DEFAULT SYSUTCDATETIME(),
  DetalhesJson nvarchar(max) NOT NULL,
  CONSTRAINT UQ_PC04_EventoVersao UNIQUE(ContratacaoId,Versao),
  CONSTRAINT CK_PC04_EventoAcao CHECK(Acao IN('CRIAR','HORARIOS','CONFERIR','REVISAR','CANCELAR')),
  CONSTRAINT CK_PC04_EventoJson CHECK(ISJSON(DetalhesJson)=1)
 );
GO
