# As Is
Botões Editar + número na tabela.
# To Be
Texto visível apenas Editar.
# Requirements
1. Retirar número do botão e preservar destino de cada linha.
# Acceptance Criteria
Todos os botões mostram Editar e o da linha 2 abre Contratação 2.
# Principal Regression Test
node integration/contracts-table.visual.mjs, texto exato e clique na linha correta.
# Testing Plan
Reusar testes da tabela e dos filtros.
# Implementation Plan
Atualizar expectativas, red, mudar texto, green.

# Resultado
Red confirmou botões com números. Green: testes existentes de tabela e filtros passaram, com texto Editar e clique da linha 2 abrindo Contratação 2, desktop/mobile, sem escritas. Alteração somente no texto, arquivo estático.
