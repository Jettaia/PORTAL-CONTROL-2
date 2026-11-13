# Validação — exclusão de contratações

## TDD
- Principal RED: `CONTRACT_EXCLUSION_SQL_TESTS=YES node --test integration/contract-exclusion.integration.mjs` falhou com 404 em POST /api/pc04/contratacoes/:id/excluir antes de existir a rota.
- UI RED: `node --test integration/contract-exclusion-ui.test.mjs` falhou porque o botão Solicitar exclusão não existia.
- GREEN SQL: mesmo teste principal aprovado com SQL Server local em banco descartável; sessão HTTP real, emissão de recibo e baixa reais.
- GREEN UI: teste de interação do PC04 de produção aprovado em desktop 1440x1050 e celular 390x844, sem erros JS.

## Provas cobertas
- Admin exclui aberta, cancelada, liberada, recibo emitido e paga; backend recusa coordenador, gestor e financeiro.
- Versão antiga, motivo vazio, falta de confirmação, origem inválida e falta de sessão recusados.
- Motivo da solicitação e identidade obtidos do banco; financeiro/coordenador/gestor apenas solicitam no escopo; pedido não altera financeiro nem exclui.
- Admin consulta a fila e recusa; novo pedido permitido; exclusão manual elimina pedido junto com contratação.
- Registros FIN02/FIN03, inclusive documentos e anexos, removidos fisicamente.
- Tokens, solicitações de horários, leituras de notificações e documentos PC10 vinculados também removidos.
- Pagamento PC08 compartilhado mantém item e movimento da outra contratação; total recalculado; cabeçalho removido quando fica sem vínculos.
- Trigger sintético força falha na exclusão final: contratação e pagamento permanecem após rollback.
- Número de contratação excluído não é reutilizado.
- Migração 45 reaplicada duas vezes sobre dados financeiros sintéticos: hashes das tabelas preservados.
- Testes HTTP adicionais: 10 aprovados, incluindo MFA expirado, sessão revogada, lock ocupado, ADMIN efetivo e confirmação booleana.

## Regressões
- PC04, filtros/exportação, FIN01 exportação, notificações e isolamento: 92 testes aprovados.
- PC05, lote FIN02, importação de recibos e quatro testes UI PC04: aprovados na rodada adjacente.
- Três testes UI sofreram timeout quando executados junto da carga de OCR/PDF; repetidos com `--test-concurrency=1`, todos aprovados (prévia, tablet/prestador e notificações). O teste novo também passou nessa repetição.
- FIN01 UI, FIN05 UI, documentos e exportações: 21 testes aprovados.
- Integração FIN01 com SQL real: aprovada.
- Integração PC04 com SQL real: aprovada com PC04_SQL_SERVER=localhost\SQLEXPRESS. A primeira tentativa recusou corretamente execução sem a variável obrigatória.
- `node scripts/check-all.mjs`: 813 arquivos, zero erros de sintaxe.
- `node --test pilot-local/unit.test.mjs`: 2 aprovados.
- Impeccable detector: [] para public/pc04.js e public/pc04.css; capturas inspecionadas em artifacts/contract-exclusion/.
- `git diff --check`: aprovado. Migração gerada e hash do manifesto conferidos.

## Ambiente local
- `node scripts/upgrade-contract-exclusion.mjs`: PASS, 76 tabelas existentes preservadas e backup verificado. Sem exclusão de dados operacionais na atualização.
- Portal local recarregado em http://127.0.0.1:3211/; raiz 200 e novo endpoint sem sessão 401.
- Dados excluídos nos testes pertenciam apenas ao banco SQL sintético descartável, removido ao final.
- Produção/VPS não alteradas. Para publicação futura, aplicar a migração 45 antes de iniciar o novo runtime; o startup recusa schema incompleto.
