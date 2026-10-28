-- Suporte de fixture UAT, nunca instalador do portal principal.
IF DB_NAME() NOT LIKE 'JETTA_CONTROL_B3_TEST_%' THROW 55610,N'Destino UAT recusado',1;
GO
CREATE OR ALTER PROCEDURE Cadastro.sp_B24A_CriarPrestador
 @AtorId bigint,@Nome nvarchar(160),@CPF nvarchar(11),@Telefone nvarchar(25)=NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF ISNULL(Seguranca.fn_Pode(@AtorId,'prestadores.cadastrar'),0)<>1 OR NOT EXISTS(SELECT 1 FROM Seguranca.Usuario WHERE UsuarioId=@AtorId AND Ativo=1)
   THROW 55611,N'Cadastro sem permissao',1;
  IF LEN(LTRIM(RTRIM(@Nome)))=0 OR LEN(@CPF)<>11 OR @CPF LIKE '%[^0-9]%'
   THROW 55612,N'Dados cadastrais invalidos',1;
  INSERT Cadastro.Prestador(Nome,CPF,Telefone) VALUES(@Nome,@CPF,@Telefone);
  DECLARE @id bigint=SCOPE_IDENTITY();
  INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson)
   VALUES(N'Prestador',@id,N'CADASTRAR',@AtorId,N'{"origem":"FIXTURE_UAT_B61","dadosSinteticos":true}');
  COMMIT; SELECT @id PrestadorId;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
 END CATCH
END;
