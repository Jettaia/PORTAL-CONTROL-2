IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55000,N'Somente laboratorio',1;
DROP TRIGGER IF EXISTS Financeiro.B52B_Independencia;
DROP TRIGGER IF EXISTS Financeiro.B52B_DecisaoImutavel;
DROP TRIGGER IF EXISTS Financeiro.B52B_VersaoImutavel;
DROP TABLE IF EXISTS Financeiro.ProntidaoDecisao;
DROP TABLE IF EXISTS Financeiro.ProntidaoVersao;
-- Permissoes de catalogo preservadas; nenhuma concessao automatica criada.
