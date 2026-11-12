# As Is
Publicacao autorizada das ultimas alteracoes, incluindo migracao aditiva 43 de tablets multideposito. Producao ainda na versao 8801094. Teste SQL de instalacao falhou exclusivamente em migrations 43 != 42.

# To Be
Publicar a versao local preservando dados e acessos, aplicando a expansao de schema antes da API nova.

# Requirements
1. Alinhar expectativa de instalacao e documentacao de 42 para 43 migracoes.
2. Validar instalacao, tablets multideposito e legados em SQL sintetico descartavel.
3. Fazer backup verificado e ensaio transacional com rollback na identidade de producao validada; aplicar a migracao aditiva preservando hashes de todas as tabelas existentes.
4. Publicar imagem commitada e validar endpoints autenticados, assets e exportacoes; commit/push na main.

# Acceptance Criteria
1. Teste de bootstrap preserva ADMIN/senha e recusa sobrescrita com 43 migracoes.
2. Testes SQL e regressao passam sem skips.
3. Migracao idempotente cria apenas a tabela auxiliar e conserva linhas, credenciais e apontamentos. Schema auxiliar permanece em rollback de aplicacao; retorno ao leitor antigo exige ausencia de vinculos adicionais.
4. Health e consultas de tablets publicas autenticadas passam, Git sincronizado.

# Principal Regression Test
CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs
RED comprovado: resultado real migrations 43 contra expectativa 42. GREEN esperado apos corrigir somente a expectativa. Fluxo real em banco descartavel, com hash da credencial e recusa de sobrescrita.

# Testing Plan
Bootstrap SQL; tablets-multidepot.integration e tablets.integration; regressao completa serial; visual tablets; ensaio/aplicacao da migracao com snapshot de hashes; candidato e live.

# Implementation Plan
Ajustar expectativa/documentacao; rodar teste; commit e pacote; construir imagem; gate completo; parada somente API, backup, ensaio/rollback, migracao, candidato, troca da API e live; baixar backup.

Sem alteracao de requisito funcional. Serena e Lad ausentes. Migracao CREATE TABLE com PK/FK ja testada; nao ha limpeza de dados nem contracao.
