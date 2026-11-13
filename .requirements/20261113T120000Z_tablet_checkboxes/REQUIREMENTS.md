# Checkboxes no cadastro de tablets

## As Is
Depósitos usa select multiple nativo, com Ctrl para seleção múltipla no desktop.

## To Be
Lista de depósitos com uma checkbox por item, nome à esquerda e centro de custo à direita, fundo suave nos selecionados, contador e resumo de centros de custo conforme preview aprovado pelo usuário.

## Requirements
1. Substituir select por checkboxes com seleção independente via clique/toque/teclado.
2. Manter contrato depositos array, carregamento de vínculos na edição, cancelamento/reset e bloqueio durante operações.
3. Impedir envio vazio com feedback e preservar visual aprovado/responsividade.

## Acceptance Criteria
1. Selecionar dois itens atualiza contador e centros de custo; desmarcar atualiza ambos.
2. Criar envia ambos IDs, editar restaura ambos, salvar remoção envia somente o restante; cancelar não altera registro.
3. Nenhum item selecionado não envia request; nomes longos cabem e mobile não apresenta overflow da página.

## Principal Regression Test
node --test integration/tablets-provider-ui.test.mjs. Teste existente atualizado para interação real das checkboxes; deve falhar antes pela ausência dos controles e passar depois.

## Testing Plan
Fluxo real de UI com APIs sintéticas para cadastro/edição/cancelamento/seleção vazia; suíte tablets.visual.mjs para estados, bloqueios e sessão. Screenshots desktop/mobile com CSS real e inspeção do visual. Sem alteração SQL/API.

## Implementation Plan
1. Atualizar teste antes da implementação e obter red.
2. Renderizar checkboxes; atualizar leitura/restauração/contador/validação.
3. Aplicar estilos locais conforme preview, executar green e regressões.
4. Conferir arquivos servidos localmente. Sem deploy.

## Resultado
- RED: teste atualizado falhou ao procurar #tabletsDepot input[type=checkbox], ausente na versão select.
- GREEN: node --test integration/tablets-provider-ui.test.mjs integration/tablet-deletion-ui.test.mjs integration/reload-navigation-ui.test.mjs — 3 PASS sem skips.
- node integration/tablets.visual.mjs com JETTA_PLAYWRIGHT_ROOT apontando node_modules — PASS (cadastro/edição/reemissão/revogação/status/erros/sessão/navegação/mobile).
- Cadastro envia dois IDs; edição restaura ambos, Space desmarca individualmente; cancelar descarta alterações, zero seleção não faz request; contador/centros atualizam; exclusão e reload preservados.
- Screenshots desktop/mobile em artifacts/tablets-provider; inspeção de pixels detectou borda extra do fieldset herdada do CSS global. Corrigida com escopo local, asserção de estilo computado e nova inspeção: lista única, nomes/CC alinhados, checkboxes e seleção suave conforme preview.
- node --check public/tablets.js e git diff --check: PASS.
- HTTP local 3211 já serve HTML, JS e CSS novos. Sem SQL ou backend alterados, sem reinício/deploy.
