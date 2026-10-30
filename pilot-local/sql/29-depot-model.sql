-- Canonical depot model. Only empty operational data may cross this boundary.
IF NOT ((DB_NAME()='JETTA_CONTROL_PILOTO_LOCAL' OR (LEN(DB_NAME())=34 AND LEFT(DB_NAME(),22)='JETTA_CONTROL_B3_TEST_' AND RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-f0-9]%' AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_TEST' AND CONVERT(varchar(1),value)='1'))) AND EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE' AND LEN(CONVERT(varchar(64),value))=64)) THROW 55900,N'Destino do piloto recusado',1;
IF @@TRANCOUNT=0 THROW 55930,N'Modelo de depositos exige transacao externa',1;
IF OBJECT_ID('Cadastro.Filial','U') IS NOT NULL BEGIN
 IF EXISTS(SELECT 1 FROM Cadastro.Filial) OR EXISTS(SELECT 1 FROM Cadastro.Deposito)
  OR EXISTS(SELECT 1 FROM Cadastro.PrestadorFilial) OR EXISTS(SELECT 1 FROM Operacao.Contratacao)
  OR EXISTS(SELECT 1 FROM Operacao.CodigoApontamento) OR EXISTS(SELECT 1 FROM Financeiro.ObrigacaoPreparada)
  OR EXISTS(SELECT 1 FROM Financeiro.RegraFuncional)
  THROW 55931,N'Limpeza explicitamente autorizada necessaria antes de remover filiais',1;
END;
DROP TRIGGER IF EXISTS Cadastro.tr_PC01_DepositoAbrangencia;
DROP PROCEDURE IF EXISTS Cadastro.sp_B24A_CriarFilial;
DROP PROCEDURE IF EXISTS Cadastro.sp_B24C_CriarDeposito;
DROP PROCEDURE IF EXISTS Cadastro.sp_B24C_AtualizarDeposito;
GO
-- Remove the redundant parent check from existing operational procedures/functions.
DECLARE @definition nvarchar(max),@changed nvarchar(max),@object int;
-- Freeze module definitions before ALTER changes the sys.sql_modules catalog being scanned.
DECLARE depot_modules CURSOR LOCAL STATIC READ_ONLY FOR
 SELECT o.object_id,m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
 WHERE m.definition LIKE '%Filial%' AND o.type IN('P','IF','FN','TF','TR','V');
OPEN depot_modules;FETCH NEXT FROM depot_modules INTO @object,@definition;
WHILE @@FETCH_STATUS=0 BEGIN
 SET @changed=REPLACE(@definition,N'INNER JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1',N'');
 SET @changed=REPLACE(@changed,N'INNER JOIN Cadastro.Filial f ON f.FilialId=d.FilialId',N'');
 SET @changed=REPLACE(@changed,N'JOIN Cadastro.Filial f ON f.FilialId=d.FilialId AND f.Ativo=1',N'');
 SET @changed=REPLACE(@changed,N'JOIN Cadastro.Filial f ON f.FilialId=d.FilialId',N'');
 SET @changed=REPLACE(@changed,N' AND f.Ativo=1',N'');
 SET @changed=REPLACE(@changed,N' OR f.Ativo=0',N'');
 SET @changed=REPLACE(@changed,N' OR c.FilialId<>d.FilialId',N'');
 SET @changed=REPLACE(@changed,N'd.FilialId filialId,',N'');
 IF @changed LIKE '%Filial%' THROW 55932,N'Dependencia de filial nao reconhecida; migracao interrompida',1;
 IF @changed<>@definition BEGIN
  -- SQL modules may retain any of the three legal declaration forms.
  WHILE UNICODE(LEFT(@changed,1)) IN(9,10,13,32) SET @changed=SUBSTRING(@changed,2,LEN(@changed));
  IF UPPER(@changed) LIKE 'CREATE OR ALTER %' SET @changed=STUFF(@changed,1,15,N'ALTER');
  ELSE IF UPPER(@changed) LIKE 'CREATE%' SET @changed=STUFF(@changed,1,6,N'ALTER');
  ELSE IF UPPER(@changed) NOT LIKE 'ALTER %' THROW 55932,N'Declaracao SQL nao reconhecida',1;
  EXEC sys.sp_executesql @changed;
 END;
 FETCH NEXT FROM depot_modules INTO @object,@definition;
END;
CLOSE depot_modules;DEALLOCATE depot_modules;
IF EXISTS(SELECT 1 FROM sys.sql_modules WHERE definition LIKE '%Filial%') THROW 55932,N'Dependencia de filial remanescente',1;
GO
IF OBJECT_ID('Cadastro.Filial','U') IS NOT NULL BEGIN
 -- Drop only foreign keys to the entity being removed; every remaining FK is checked.
 DECLARE @cmd nvarchar(max)=N'';
 SELECT @cmd=@cmd+N'ALTER TABLE '+QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))+N'.'+QUOTENAME(OBJECT_NAME(parent_object_id))+N' DROP CONSTRAINT '+QUOTENAME(name)+N';'
 FROM sys.foreign_keys WHERE referenced_object_id=OBJECT_ID('Cadastro.Filial');
 EXEC sys.sp_executesql @cmd;
 DROP TABLE Seguranca.UsuarioFilial;
 EXEC sys.sp_rename N'Cadastro.PrestadorFilial',N'PrestadorDeposito';
 EXEC sys.sp_rename N'Cadastro.PrestadorDeposito.FilialId',N'DepositoId',N'COLUMN';
 ALTER TABLE Cadastro.PrestadorDeposito ADD CONSTRAINT FK_PrestadorDeposito_Deposito FOREIGN KEY(DepositoId) REFERENCES Cadastro.Deposito(DepositoId);
 EXEC sys.sp_rename N'Operacao.Contratacao.FilialId',N'DepositoId',N'COLUMN';
 ALTER TABLE Operacao.Contratacao ADD CONSTRAINT FK_Contratacao_Deposito FOREIGN KEY(DepositoId) REFERENCES Cadastro.Deposito(DepositoId);
 ALTER TABLE Financeiro.RegraFuncional DROP CONSTRAINT CK_F03_Abrangencia;
 ALTER TABLE Financeiro.RegraFuncional DROP COLUMN FilialEscopoId;
 ALTER TABLE Financeiro.RegraFuncional ADD CONSTRAINT CK_Deposito_RegraAbrangencia CHECK(
  (Abrangencia='DEPOSITO' AND DepositoId IS NOT NULL) OR
  (Tipo IN('MODALIDADE','CORRESPONDENCIA','COMPETENCIA') AND Abrangencia='ORGANIZACAO' AND DepositoId IS NULL));
 ALTER TABLE Operacao.CodigoApontamento DROP COLUMN FilialId;
 ALTER TABLE Financeiro.ObrigacaoPreparada DROP COLUMN FilialId;
 ALTER TABLE Cadastro.Deposito DROP COLUMN FilialId;
 DROP TABLE Cadastro.Filial;
END;
GO
IF COL_LENGTH('Cadastro.Deposito','CentroCusto') IS NULL BEGIN
 ALTER TABLE Cadastro.Deposito ADD CentroCusto nvarchar(80) NOT NULL,Rua nvarchar(200) NOT NULL,
  Numero nvarchar(30) NOT NULL,Bairro nvarchar(120) NOT NULL,Cidade nvarchar(120) NOT NULL,
  Estado char(2) NOT NULL,CEP char(8) NOT NULL;
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Deposito_Campos')
 ALTER TABLE Cadastro.Deposito ADD CONSTRAINT CK_Deposito_Campos CHECK(
  LEN(LTRIM(RTRIM(Nome)))>=2 AND LEN(LTRIM(RTRIM(CentroCusto)))>0 AND LEN(LTRIM(RTRIM(Rua)))>0
  AND LEN(LTRIM(RTRIM(Numero)))>0 AND LEN(LTRIM(RTRIM(Bairro)))>0 AND LEN(LTRIM(RTRIM(Cidade)))>0
  AND Estado IN('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  AND LEN(CEP)=8 AND CEP COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%');
DELETE pp FROM Seguranca.PerfilPermissao pp JOIN Seguranca.Permissao p ON p.PermissaoId=pp.PermissaoId WHERE p.Chave LIKE 'filiais.%';
DELETE Seguranca.Permissao WHERE Chave LIKE 'filiais.%';
-- New depots do not grant access to any other user implicitly. ADMIN is global by role.
GO
