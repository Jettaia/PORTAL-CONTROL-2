IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55100,N'Somente laboratorio',1;
DROP TRIGGER IF EXISTS Financeiro.B52C_FontePolitica;
DROP TRIGGER IF EXISTS Financeiro.B52C_EncaminhamentoImutavel;
DROP TABLE IF EXISTS Financeiro.EncaminhamentoPolitica;
-- Catalogo RBAC preservado; sem concessoes automaticas.
