# As Is
O filtro Situação do Financeiro inicia em Aguardando pagamento; limpar filtros e trocar sessão restauram esse padrão.

# To Be
O filtro inicia em Todas, sem restringir a situação na consulta inicial.

# Requirements
1. Usar Todas como padrão inicial e após limpar filtros ou trocar sessão.
2. Preservar a seleção manual das situações e os demais filtros.

# Acceptance Criteria
1. ADMIN, FINANCEIRO e GESTOR veem Todas; a primeira consulta não envia situacao. Limpar restaura Todas e consulta sem restrição.
2. Selecionar Aguardando pagamento envia situacao=AGUARDANDO_PAGAMENTO junto dos outros filtros.

# Principal Regression Test
node integration/fin01.visual.mjs: componente real e navegação autenticada com HTTP sintético. Red esperado: select inicia AGUARDANDO_PAGAMENTO, quando esperado valor vazio (Todas).

# Testing Plan
Reutilizar runner Playwright instalado: abertura, paginação, filtro manual, limpar e reset da sessão para três personas; regressões existentes de detalhe, responsividade e ausência de escritas.

# Implementation Plan
1. Ampliar testes e confirmar red.
2. Mover opção Todas para o início do select, preservando reset nativo.
3. Reexecutar teste e sintaxe.

# Verification
PASS. Red: node integration/fin01.visual.mjs falhou com AGUARDANDO_PAGAMENTO em vez de valor vazio. Green: mesmo comando passou para ADMIN/FINANCEIRO/GESTOR, com consulta inicial sem situacao, seleção manual de pendentes, limpar filtros, reset de sessão, paginação e detalhes. Fluxo de UI real com HTTP sintético e Edge headless; 1440/768/390; zero escritas e erros JS. node --check nos dois arquivos e git diff --check com cr-at-eol: PASS. Alteração somente do padrão do select, sem mudanças de layout, API ou banco. Trabalho anterior preservado; sem deploy.
