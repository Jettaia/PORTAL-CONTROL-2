# As Is
Publicacao autorizada da exclusao de contratacoes e checkboxes de tablets. Producao na versao 8907777. Migração aditiva 45 pendente. Bootstrap SQL real falhou apenas no total 45 contra expectativa 44.

# To Be
Publicar fontes locais com schema pronto antes do novo runtime, preservando dados e acessos existentes.

# Requirements
1. Alinhar expectativa do bootstrap para 45 migracoes; manter prova de preservacao do ADMIN e recusa de sobrescrita.
2. Testar exclusao, financeiro, permissao, rollback e reserva de numero em SQL sintetico descartavel; nenhuma exclusao operacional em producao para validar.
3. Backup verificado; ensaio de migracao com rollback; aplicar schema idempotente e comparar hashes de todas as tabelas anteriores.
4. Validar candidato e live por consultas autenticadas, fila de exclusoes, assets e exportacoes; commit/push.

# Acceptance Criteria
1. Bootstrap e suite completa passam sem falhas/skips.
2. Duas tabelas novas corretas; registros, credenciais e hashes existentes iguais apos migracao.
3. Rollback preserva schema aditivo. Retorno automatico ao leitor antigo permitido somente sem numeros excluidos reservados, para evitar reutilizacao apos exclusao pelo novo codigo.
4. API publica saudavel, Git sincronizado e backup criptografado tambem fora da VPS.

# Principal Regression Test
CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs
RED comprovado: retorno real migrations 45 != 44. GREEN esperado ao corrigir apenas expectativa; instalacao completa real em SQL descartavel.

# Testing Plan
Bootstrap; contract-exclusion.integration opt-in em SQL descartavel; regressao serial; visual tablets; ensaio/aplicacao45 com snapshots; candidato/live sem deletar dados de producao.

# Implementation Plan
Corrigir expectativa; executar gates; commit/pacote/imagem; backup, ensaio/rollback, migracao45, candidato, troca da API e live; baixar backup.

Sem nova regra funcional. Serena e Lad ausentes. Mesma estrategia aditiva de producao; nenhuma limpeza ou contracao autorizada por este pedido.
