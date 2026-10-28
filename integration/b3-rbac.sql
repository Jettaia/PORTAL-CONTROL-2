-- Definicoes de fundacao capturadas de metadados, sem dados de usuarios.
CREATE   FUNCTION Seguranca.fn_Pode(@UsuarioId bigint,@Chave varchar(100)) RETURNS bit AS
BEGIN
 DECLARE @sim bit=0;
 IF EXISTS(SELECT 1 FROM Seguranca.Usuario u WHERE u.UsuarioId=@UsuarioId AND u.Ativo=1)
 AND (EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=@UsuarioId)
 OR EXISTS(SELECT 1 FROM Seguranca.UsuarioPerfil up
 JOIN Seguranca.PerfilAcesso p ON p.PerfilId=up.PerfilId AND p.Ativo=1
 JOIN Seguranca.PerfilPermissao pp ON pp.PerfilId=p.PerfilId
 JOIN Seguranca.Permissao m ON m.PermissaoId=pp.PermissaoId
 WHERE up.UsuarioId=@UsuarioId AND m.Chave=@Chave AND m.Critica=0)) SET @sim=1;
 RETURN @sim;
END;
