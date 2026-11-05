# As Is
Tablets revogados permanecem listados. Admin e Gestor gerenciam tablets; tokens consumidos exigem FK para o tablet.
# To Be
Admin pode confirmar a exclusão de tablet revogado, removendo-o da listagem sem apagar apontamentos.
# Requirements
1. Oferecer Excluir apenas para Admin e tablet REVOGADO, com confirmação.
2. Validar Admin, sessão/MFA e revogação no servidor; negar reativação/edição de excluídos.
3. Exclusão lógica com auditoria atômica, preservando tokens, serviços e histórico técnico.
# Acceptance Criteria
1. Gestor não vê Excluir; Admin não vê em ativos; cancelar não grava; confirmar remove a linha.
2. Gestor recebe 403; não revogado recebe 409; inexistente/excluído recebe 404; MFA e origem mantidos.
3. Tokens consumidos e eventos permanecem intactos; falha de auditoria reverte operação.
# Principal Regression Test
node --test tests/pc05.test.mjs integration/tablet-deletion-ui.test.mjs
API HTTP com serviço real e adaptador SQL controlado; navegador com script real, confirmação e atualização da lista. Antes: rota/botão ausentes. Depois: contratos e fluxo passam.
# Testing Plan
Red/green API e UI, regressões PC05, integração SQL descartável se disponível, sintaxe.
# Implementation Plan
1. Testes de contrato e UI e execução red.
2. Coluna nullable ExcluidoEmUtc em migração aditiva idempotente; aplicar antes do código. Versão antiga continua compatível. Rollback do código mantém coluna/dados; não remover coluna com exclusões registradas.
3. Serviço e rota usam transação e auditoria existentes; filtros impedem restauração.
4. Botão e confirmação usam fluxo write existente; executar green e regressões.
# References
Express 4 routing: https://expressjs.com/en/4x/guide/routing/
Serena e Lad não disponíveis nesta sessão.

# Evidence
- Red: API /excluir retornava 404 (rota inexistente); navegador não encontrava Excluir Antigo. Log: artifacts/tablet-deletion/tablet-delete-red.txt.
- Green: 60 testes passaram em tests/pc05.test.mjs, tests/pc05-app.test.mjs, integration/tablet-deletion-ui.test.mjs e integration/tablet-revocation-ui.test.mjs.
- SQL real: integration/tablets.integration.mjs passou, incluindo migração a partir do esquema anterior com tokens consumidos e rejeição de restauração. Banco descartável removido.
- Instalação nova: integration/chapa-bootstrap.integration.mjs passou com 39 migrações. Banco descartável removido.
- Sintaxe: 725 arquivos, zero falhas. Diff sem erros com core.whitespace=cr-at-eol, respeitando CRLF existente.
- Não houve alteração do banco operacional, push ou deploy. Migração antes da aplicação exigida para banco existente; procedimento em docs/tablet-deletion.md.
