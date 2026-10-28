IF DB_NAME() NOT LIKE 'JETTA[_]CONTROL[_]B3[_]TEST[_]%' THROW 55700,N'Somente laboratorio sintetico',1;
IF EXISTS(SELECT 1 FROM Simulacao.Processo) THROW 55702,N'Rollback recusado: preservar historico simulado existente',1;
-- Rollback somente do módulo novo no banco descartável; não toca contratos B1–B6.1.
DROP TABLE IF EXISTS Simulacao.Anexo;
DROP TABLE IF EXISTS Simulacao.ReciboVersao;
DROP TABLE IF EXISTS Simulacao.Evento;
DROP TABLE IF EXISTS Simulacao.Processo;
