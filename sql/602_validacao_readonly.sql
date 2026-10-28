USE JETTA_CONTROL;
GO
SELECT Nome, CASE WHEN OBJECT_ID(Nome,'U') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS Resultado
FROM (VALUES ('Seguranca.Usuario'),('Seguranca.Credencial'),('Seguranca.SessaoWeb'),('Seguranca.GestorDeposito')) X(Nome);
SELECT (SELECT COUNT(*) FROM Seguranca.Credencial) Credenciais, (SELECT COUNT(*) FROM Seguranca.SessaoWeb) Sessoes;
