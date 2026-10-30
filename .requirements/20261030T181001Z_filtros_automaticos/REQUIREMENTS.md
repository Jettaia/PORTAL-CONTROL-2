# Filtros automáticos das contratações
## As Is
Os oito filtros dependem do botão Aplicar ou Enter.
## To Be
Selecionar depósito/situação/data aplica automaticamente; texto aplica após pausa de 350ms.
## Requirements
1. Aplicar seleções e data automaticamente; texto com debounce, sem request por tecla.
2. Conservar combinação de filtros, reset da paginação, limpar, atualização e Enter.
3. Preservar foco/cursor ao atualizar texto; cancelar pendências ao limpar, sair da tela ou encerrar sessão.
## Acceptance Criteria
Sem clicar em Aplicar, todos os filtros funcionam. Digitação contínua gera só uma consulta. Não ocorre aplicação atrasada após limpar/sair. Seleção e texto persistem no resultado.
## Principal Regression Test
node integration/contracts-filters.visual.mjs: interação real nos filtros sem botão falha antes por ausência de request; passa depois.
## Testing Plan
Runner Playwright existente com seleções, digitação real, debounce, foco, Enter, combinações e paginação; smoke na tela real com sessão temporária e sem mutação de negócio.
## Implementation Plan
Adaptar teste e obter red; implementar timer e disparo automático com preservação de foco; green e smoke real. Reutilizar select e estilos existentes; sem mudança de backend.

## Verificação
- RED: runner Playwright expirou aguardando resposta depois de alterar o campo sem clicar Aplicar.
- GREEN: `node integration/contracts-filters.visual.mjs`: oito filtros automáticos, digitação sequencial com somente uma consulta, foco/cursor restaurado, combinação, Enter, vazio, limpar/cancelar debounce, refresh, paginação e reset de sessão; desktop/mobile sem escritas.
- GREEN: `JETTA_DEPOT_FILTER_LIVE=YES node integration/depot-filter-live.mjs`: seleção no portal local aplicou automaticamente sem botão; API e linhas filtradas conferidas, limpar funcionando. Sessão temporária removida.
- `node --check public/pc04.js`: PASS. Backend e dados não alterados; script frontend servido imediatamente, sem necessidade de reiniciar runtime.
- Nenhuma alteração de aparência: reutiliza os mesmos campos nativos. Capturas do runner em artifacts/contracts-filters.
