# As Is
Publicacao autorizada das alteracoes locais de notificacoes de horarios, com migracao aditiva 44. Producao na versao c7c9e3d. Bootstrap SQL real falhou somente na expectativa migrations 43, recebendo 44.

# To Be
Publicar o sininho e API autenticada, preservando dados e acessos, com schema pronto antes da API nova.

# Requirements
1. Atualizar expectativa e documentacao de instalacao de 43 para 44 migracoes.
2. Validar fluxo real de solicitacao/decisao/leitura, escopo de deposito e paginacao em SQL descartavel.
3. Corrigir incompatibilidades de fixtures de regressao, mantendo todos os cenarios e limites da previa sem escrita.
4. Backup verificado, ensaio transacional com rollback e migracao idempotente, comparando hashes de todas as tabelas existentes.
5. Commit/push, imagem identificada e validacao publica autenticada de notificacoes/consultas/exportacoes.

# Acceptance Criteria
1. Bootstrap preserva senha ADMIN, recusa sobrescrita e retorna 44 migracoes.
2. Regressao, SQL e gates sem falhas/skips. Previa continua recusando POST/PUT/PATCH/DELETE.
3. Dados e credenciais preservados, nova tabela vazia ou leituras existentes preservadas. Rollback de API conserva tabela aditiva e marcacoes.
4. Health e API de notificacoes autenticada passam, acesso anonimo negado, Git sincronizado.

# Principal Regression Test
CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs
RED comprovado: 44 != 43. GREEN esperado apos ajuste somente da expectativa. Teste real de instalacao/credencial/recusa em banco sintetico descartavel.

# Testing Plan
Regressao completa serial; notifications.integration opt-in em SQL descartavel; bootstrap; ensaio/aplicacao 44 com hashes; candidato e live. Qualquer correcao de fixture sera comprovada pelo teste de fluxo que a revelou.

# Implementation Plan
Alinhar expectativa/docs; executar testes; tratar apenas bloqueios de validacao necessarios; commit/pacote; construir imagem; gates; backup, ensaio/rollback, migracao44, candidato, troca da API e live; baixar backup.

Sem nova regra funcional. Serena e Lad ausentes. CREATE TABLE/PK/FK/transacoes conforme documentacao Microsoft consultada no fluxo anterior; mesma estrategia aditiva, sem limpeza/contracao.

## Validation updates
- Bootstrap RED 44 != 43; GREEN depois do alinhamento, 1/1 SQL real.
- SQL notifications.integration PASS com fluxo real autenticado e banco sintetico removido.
- Regressao inicial 495/496: previa retornava 503 em /api/notificacoes. RED tambem comprovado no teste focado e na expectativa explicita da resposta vazia.
- GREEN focado: previa, sidebar/logout e sininho, 3/3. Fixture GET retorna lista vazia; POST/PUT/PATCH/DELETE seguem 405, incluindo marcacao de leitura. Produto/API reais preservados.
