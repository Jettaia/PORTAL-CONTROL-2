# Aprovação de horários e bloqueio após liberação
## As Is
Gestores gravam horários diretamente. Horários, revisão e cancelamento podem reabrir contratação liberada. Botão Conferir precede revisão e cancelamento.
## To Be
GESTOR solicita horários; ADMIN analisa entrada, saída e justificativa e aprova/nega. Usuário confirmou: ADMIN grava diretamente. Conferir e liberar para pagamento fica após o bloco de cancelamento. Liberação bloqueia horários manuais/tokens, revisão e cancelamento para todos.
## Requirements
1. Solicitação de gestor não altera horários reais até aprovação ADMIN; guardar autor, horários, justificativa, decisão e histórico.
2. Apenas ADMIN decide solicitação; preservar autenticação, escopo e concorrência. Pendência bloqueia liberação e uso de tokens conflitantes. Recusa mantém horários válidos anteriores e permite nova solicitação.
3. ADMIN grava horários diretamente, dentro das validações atuais.
4. Contratação liberada bloqueia horários, revisão e cancelamento inclusive API direta e tokens. Não criar reabertura/override.
5. Botão Conferir e liberar para pagamento posicionado após Cancelamento da contratação; campos bloqueados após liberação e mensagem explicativa.
6. ADMIN encontra pendências na tela Contratações e no detalhe; aprova/nega vendo horários e justificativa.
## Acceptance Criteria
Gestor solicita e relê pendência; outro depósito e financeiro não acessam/decidem; ADMIN aprova ou nega uma única vez; horários só mudam na aprovação ou gravação direta ADMIN. Nenhuma liberação com pendência. Concorrência/versão não sobrescreve decisão. Liberada preserva horário, valor, situação e ledger ante qualquer tentativa bloqueada. UI mostra fila ADMIN e detalhe, botão na ordem e bloqueios.
## Principal Regression Test
SQL/HTTP descartável com ADMIN, GESTOR A/B e FINANCEIRO: solicitar, negar, solicitar/aprovar, conferir e tentar mutações bloqueadas. Red antes: grava imediatamente e revisão reabre LIBERADA.
## Testing Plan
Testes HTTP/serviço red/green, fluxo SQL real e concorrência, UI headless de gestor/ADMIN/pós-liberação em desktop/mobile; revisão independente autorização/migração/ledger. Reusar runners e registrar limitações reais.
## Implementation Plan
Contrato de solicitação e migração aditiva; endpoints e bloqueios; UI de pendências/decisão/ordem/bloqueios; integração por persona; review; backup e upgrade local sem apagar dados; reinício.
## Decisões
ADMIN grava diretamente (confirmação do usuário). 'Depois de cancelamento' é posição depois do bloco, preservando proibição de liberar contratação cancelada. Critérios de liberação atuais preservados; somente acrescentar ausência de pendência.
## Ferramentas
smart-orchestrator direto; jetta-qa proporcional. Serena/Lad indisponíveis no inventário anterior. Sem novas dependências, ODBC e transações existentes.

## Resultado e evidências
- Implementado: solicitação separada, fila ADMIN, decisão única por versão/identidade sob lock PC04, ADMIN direto, cancelamento encerra pendência. Aprovação aplica horários; negativa conserva válidos. Tokens e liberação negados durante pendência.
- Campo LiberacaoBloqueada persistente, com backfill para LIBERADA, já paga ou evento CONFERIR anterior. Guardas antes de efeitos no contrato/ledger bloqueiam horários, revisão, cancelamento e tokens, inclusive ADMIN e histórico reaberto.
- Red/green dos testes HTTP/serviço e UI realizado pelos implementadores. `node --test tests/pc04.test.mjs tests/pc05.test.mjs tests/pc10.test.mjs`: 133 PASS, também executados pelo reviewer independente. Lote de tests/ completo dentro do escopo anterior sem pc09.test.mjs: 348 PASS; PC09 continua excluído, não certificado.
- `HOURS_SQL_TESTS=YES HOURS_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/manual-hours.integration.mjs`: PASS em banco descartável; ADMIN/GESTOR A/B/FINANCEIRO, inválido sem escrita, pedido sem alterar horários, fila e decisão ADMIN, negativa/reenvio, decisões concorrentes (uma aceita/uma409), publicação e ledger, tentativas bloqueadas sem efeitos, ADMIN direto, cancelamento pendente, token real pendente e injeção de falha de invalidação sem bypass, backfill histórico. Banco removido.
- Runners SQL PC04/05/10 PASS; cenários antigos de reabertura foram substituídos por negações conforme requisito. Conciliação/estorno/extrato de ajustes preexistentes permanecem provados por fixtures históricas explícitas, sem endpoint de override.
- `integration/manual-hours.visual.mjs` PASS: gestor solicita, ADMIN localiza/abre/nega/aprova/grava diretamente, justificativa tratada como texto, ordem do botão, bloqueios no DOM e handlers, estado histórico, 1440/390 sem overflow; screenshots em artifacts/manual-hours inspecionados por view_image.
- Revisão independente Sol medium APROVADA, sem achados materiais; sintaxe global 663 arquivos/zero falhas.
- Migração31 aplicada em localhost\\SQLEXPRESS/JETTA_CONTROL_PILOTO_LOCAL após parada e backup COPY_ONLY/CHECKSUM/VERIFYONLY. Snapshots confirmaram 68 tabelas anteriores e 1 contratação preservadas; somente novo campo de bloqueio/backfill e tabela de solicitações adicionados. Credenciais e registros preservados, sem reset.
- Piloto reiniciado, HMAC/health200/schema/interface atualizados confirmados. Sem commit/push/deploy externo. Evidência local artifacts/manual-hours/regressions.txt.
