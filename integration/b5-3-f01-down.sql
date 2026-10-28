IF LEN(DB_NAME())<>34 OR LEFT(DB_NAME(),22)<>'JETTA_CONTROL_B3_TEST_' OR RIGHT(DB_NAME(),12) COLLATE Latin1_General_100_BIN2 LIKE '%[^a-f0-9]%' THROW 55200,N'Somente laboratorio',1;
DROP TRIGGER IF EXISTS Operacao.F01_FixarContrato;
DROP TABLE IF EXISTS Financeiro.EtapaAlcadaLab;
DROP TABLE IF EXISTS Financeiro.DecisaoExcecaoVencimentoLab;
DROP TABLE IF EXISTS Financeiro.ExcecaoVencimentoLab;
DROP TABLE IF EXISTS Financeiro.EventoRegraFuncional;
DROP TABLE IF EXISTS Financeiro.RegraFuncional;
DROP TABLE IF EXISTS Operacao.ContratoIndividual;
-- CT de seguranca preservado: down nao desabilita rastreamento que pode ser preexistente.
