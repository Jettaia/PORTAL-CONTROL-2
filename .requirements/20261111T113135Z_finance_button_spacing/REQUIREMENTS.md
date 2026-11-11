# As Is
Após remoção do aviso de período, ações de filtros e geração de recibos ficaram encostadas.
# To Be
Separação vertical de 16px entre os dois grupos, conservando controles e comportamento.
# Requirements
1. Aplicar espaçamento somente ao grupo de recibos imediatamente após filtros.
# Acceptance Criteria
Distância renderizada mínima de 16px em desktop e mobile.
# Principal Regression Test
Inspeção geométrica Playwright do Financeiro real com HTTP sintético somente GET. Alteração visual mecânica, sem novo teste permanente.
# Testing Plan
Geometria em 1531 e 390px, captura focal e teste existente de filtros.
# Implementation Plan
Adicionar margem no seletor do grupo adjacente ao formulário e validar.

# Verification
PASS: Playwright no portal local com respostas GET sintéticas; distância real de 16px entre botões em 1531x764 e 390x764. Capturas artifacts/finance-spacing-1794396698143. Teste integration/fin01-default-status-ui.test.mjs 1/1 PASS. Nenhuma escrita SQL ou alteração funcional.
