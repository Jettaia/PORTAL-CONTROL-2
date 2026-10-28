IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55300,N'Somente laboratorio F03',1;
IF OBJECT_ID('Financeiro.RegraFuncional','U') IS NULL OR OBJECT_ID('Financeiro.ProntidaoVersao','U') IS NULL THROW 55300,N'Base F01 e B5.2B exigidas',1;
IF COL_LENGTH('Financeiro.RegraFuncional','Abrangencia') IS NULL ALTER TABLE Financeiro.RegraFuncional ADD Abrangencia varchar(12) NOT NULL CONSTRAINT DF_F03_Abrangencia DEFAULT 'DEPOSITO';
IF COL_LENGTH('Financeiro.RegraFuncional','FilialEscopoId') IS NULL ALTER TABLE Financeiro.RegraFuncional ADD FilialEscopoId bigint NULL CONSTRAINT FK_F03_Filial REFERENCES Cadastro.Filial(FilialId);
ALTER TABLE Financeiro.RegraFuncional ALTER COLUMN DepositoId bigint NULL;
GO
DECLARE @cmd nvarchar(max)=N'';
SELECT @cmd=@cmd+N'ALTER TABLE Financeiro.RegraFuncional DROP CONSTRAINT '+QUOTENAME(name)+N';' FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Financeiro.RegraFuncional') AND definition LIKE '%VENCIMENTO%' AND name<>'CK_F03_RegraTipo';
IF LEN(@cmd)>0 EXEC sys.sp_executesql @cmd;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_F03_RegraTipo' AND parent_object_id=OBJECT_ID('Financeiro.RegraFuncional')) ALTER TABLE Financeiro.RegraFuncional ADD CONSTRAINT CK_F03_RegraTipo CHECK(Tipo IN('VENCIMENTO','ALCADA','MODALIDADE','CORRESPONDENCIA','COMPETENCIA'));
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_F03_Abrangencia' AND parent_object_id=OBJECT_ID('Financeiro.RegraFuncional')) ALTER TABLE Financeiro.RegraFuncional ADD CONSTRAINT CK_F03_Abrangencia CHECK(
 (Abrangencia='DEPOSITO' AND DepositoId IS NOT NULL AND FilialEscopoId IS NULL) OR
 (Tipo IN('MODALIDADE','CORRESPONDENCIA','COMPETENCIA') AND DepositoId IS NULL AND ((Abrangencia='ORGANIZACAO' AND FilialEscopoId IS NULL) OR (Abrangencia='FILIAL' AND FilialEscopoId IS NOT NULL))));
SET @cmd=N'';
SELECT @cmd=@cmd+N'ALTER TABLE Financeiro.ProntidaoVersao DROP CONSTRAINT '+QUOTENAME(name)+N';' FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('Financeiro.ProntidaoVersao') AND definition LIKE '%BENEFICIARIO%' AND name<>'CK_F03_DossieTipo';
IF LEN(@cmd)>0 EXEC sys.sp_executesql @cmd;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_F03_DossieTipo' AND parent_object_id=OBJECT_ID('Financeiro.ProntidaoVersao')) ALTER TABLE Financeiro.ProntidaoVersao ADD CONSTRAINT CK_F03_DossieTipo CHECK(Tipo IN('BENEFICIARIO','POLITICA','CONTRATACAO'));
INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) SELECT k,'FINANCEIRO',N'F03 laboratorial sem efeito financeiro',CASE WHEN k LIKE '%consultar' THEN 0 ELSE 1 END FROM(VALUES('financeiro.f03.consultar'),('financeiro.f03.configurar'),('financeiro.f03.validar'),('financeiro.f03.publicar'),('financeiro.f03.global'))v(k) WHERE NOT EXISTS(SELECT 1 FROM Seguranca.Permissao p WHERE p.Chave=v.k);
GO
CREATE OR ALTER TRIGGER Financeiro.F03_DossieFonte ON Financeiro.ProntidaoVersao AFTER INSERT AS
BEGIN
 IF EXISTS(SELECT 1 FROM inserted i WHERE i.Tipo='CONTRATACAO' AND (
 ISNULL(JSON_VALUE(i.DadosJson,'$.prestadorId'),'')<>(SELECT CONVERT(varchar(30),p.PrestadorId) FROM Operacao.Participacao p WHERE p.ParticipacaoId=i.ParticipacaoId)
 OR NOT EXISTS(SELECT 1 FROM Financeiro.ProntidaoVersao b WHERE b.VersaoId=TRY_CONVERT(bigint,JSON_VALUE(i.DadosJson,'$.beneficiarioVersaoId')) AND b.Tipo='BENEFICIARIO' AND b.ParticipacaoId=i.ParticipacaoId)
 OR ISNULL(JSON_VALUE(i.DadosJson,'$.tipoJuridico'),'') NOT IN('PF','PJ')
 OR ISNULL(JSON_VALUE(i.DadosJson,'$.habilitadaFinanceiramente'),'')<>'false')) THROW 55302,N'Fonte do dossie juridico inconsistente',1;
END;
