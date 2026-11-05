# Revogação exclusiva pela gestão

## As Is
O tablet oferece botão de encerramento e POST /api/pc05/tablet/sair, que revoga a própria sessão.
## To Be
A revogação voluntária ocorre pela gestão de tablets; a tela do tablet mantém ativação e tokens.
## Requirements
1. Remover botão e handler de encerramento do tablet.
2. Remover rota e função de autorrevogação PC05.
3. Preservar revogação administrativa, autorização por depósito e reação do tablet à revogação.
## Acceptance Criteria
1. Tablet autorizado mostra teclado e confirma token sem botão de encerramento nem erros JavaScript.
2. POST na rota antiga retorna 404 sem SQL nem limpeza de cookie.
3. Gestão autorizada revoga; outro depósito e tablet sem sessão gerencial não podem revogar. Tablet revogado volta à autorização.
## Principal Regression Test
node --test tests/pc05.test.mjs integration/tablet-revocation-ui.test.mjs
Antes: rota antiga executa SQL e botão aparece; depois: 404 sem SQL e fluxo do tablet continua sem botão.
## Testing Plan
HTTP com rotas e serviços reais e adaptador SQL controlado; browser headless com HTML/JS reais e respostas de tablet sintéticas; integração SQL descartável existente para persistência e escopos. Screenshot focal.
## Implementation Plan
1. Testes red de rota removida e UI.
2. Remover botão, handler, rota e serviço; repetir testes e regressão adjacente.
3. Validar integração SQL descartável e revisar diff. Sem deploy.

## Resultado
- RED: teste browser encontrou botão (1 em vez de 0); HTTP da rota antiga tentou SQL (503 em vez de 404).
- GREEN: node --test tests/pc05.test.mjs tests/pc05-app.test.mjs tests/chapa-production.test.mjs integration/tablet-revocation-ui.test.mjs: 56 testes passaram.
- Browser Edge headless: ativação, teclado, confirmação, limpeza do token, ausência do encerramento, sem erros JS, retorno à ativação após revogação simulada. Captura artifacts/tablet-revocation/tablet.png inspecionada, sem corte/overflow em 768x1100.
- Revisão independente GPT-6.1 Sol medium: aprovada, sem achados materiais.
- Integração SQL: BLOCKED. localhost\SQLEXPRESS sem resposta de pré-login; sqlcmd independente com timeout de 5s confirmou indisponibilidade. Runner interrompido para não deixar processo pendente. Sem PASS de persistência real.
- Visual antigo da gestão: FAIL no runner existente ao procurar botão Dashboard; interrompe antes da revogação. Não alterado por estar fora do delta.
- git diff --check passou. Serena e Lad indisponíveis no inventário de ferramentas. Sem APIs novas/dependências, sem alteração de contratos externos.
- Sem commit, push ou deploy.

## Verificação para commit/push em 05/11/2026
- Repetidos os 56 testes focados: PASS, sem skips/TODO/cancelamentos; revogação gerencial e ausência de SQL/cookie na rota removida preservadas.
- Novo teste de browser usa PLAYWRIGHT_CHANNEL, Edge no Windows e Chromium padrão nas demais plataformas, conforme a prévia existente. Sintaxe focal e diff check aprovados.
- Integração SQL antes bloqueada agora PASS: JETTA_B3_RUN_SQL_TESTS=YES JETTA_B3_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/tablets.integration.mjs; 1/1, sem skips, banco descartável removido no finally.
- integration/pc05.visual.mjs alinhado à ausência de encerramento local, sem reativação duplicada. A execução continua FAIL antes desse trecho: timeout no seletor Abrir 17, linha 39. Não representa PASS do roteiro visual histórico.
- Revisão independente confirmou preservação da autorização e os 56 testes focados. Sem validação global ou deploy nesta rodada.
