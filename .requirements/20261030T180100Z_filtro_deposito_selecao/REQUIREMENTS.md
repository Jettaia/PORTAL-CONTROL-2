# Filtro de depósito por seleção
## As Is
Coluna Depósito usa texto livre; Situação usa select nativo.
## To Be
Depósito usa o mesmo select com Todos e depósitos autorizados, inclusive inativos para consultar histórico.
## Requirements
1. Selecionar depósito exato por ID, com opção Todos.
2. Aplicar, limpar, atualizar, combinar e paginar preservam escolha e escopo.
3. Catálogo de filtros respeita permissões; criação conserva catálogo de depósitos ativos.
## Acceptance Criteria
Select lista depósitos por nome; seleção restringe ID exato; limpar volta Todos; Situação continua funcionando. Dados fora do escopo permanecem inacessíveis.
## Principal Regression Test
node integration/contracts-filters.visual.mjs: interação real selectOption falha antes (input texto), passa depois.
## Testing Plan
Atualizar teste de browser headless existente, testar serviço PC04 e validar GET autenticado no piloto sem alterações de negócio; inspeção focal screenshot.
## Implementation Plan
Teste red de seleção; adicionar filtro depositoId e catálogo próprio usando escopo existente; reutilizar select de Situação; testes green; reiniciar runtime e validar endpoint.

## Resultado — ACEITO local
- RED: teste de browser encontrou zero opções no antigo input, esperado Todos e depósitos.
- GREEN: `node --test tests/pc04.test.mjs`: 74 testes PASS, incluindo filtro ID exato, entrada inválida e escopo conservado.
- GREEN: `node integration/contracts-filters.visual.mjs` (Playwright runtime existente): oito filtros, combinação, Enter, vazio, limpar, refresh, paginação, edição/reset de sessão; desktop/mobile, sem escritas.
- GREEN: `JETTA_DEPOT_FILTER_LIVE=YES node integration/depot-filter-live.mjs`: GET autenticado para cada depósito, validação inválida, lista real, aplicar/limpar na tela do piloto. Sessão temporária removida, sem alterações de negócio.
- Piloto reiniciado normalmente; logs sem erro. Sintaxe dos arquivos alterados validada.
- Captura real inspecionada: artifacts/depot-filter-live/table.png. Select nativo usa mesmas classes/estilo do campo Situação; sem CSS novo. Referência: imagens do usuário e seletor canônico em public/pc04.js.
- Catálogo depositosFiltro mantém inativos acessíveis para histórico; catálogo de criação permanece somente ativos. Filtro legado por nome preservado para compatibilidade.
