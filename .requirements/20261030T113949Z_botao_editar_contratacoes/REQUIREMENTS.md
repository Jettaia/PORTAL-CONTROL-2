# As Is
Última coluna da tabela Contratações mostra Ação e botões Abrir + número.
# To Be
Última coluna sem título visível e botões Editar + número, com mesmo destino.
# Requirements
1. Retirar texto visível Ação no cabeçalho, mantendo estrutura e identificação acessível.
2. Substituir Abrir por Editar nos botões da tabela sem alterar handler ou permissões.
# Acceptance Criteria
Cabeçalho final vazio visualmente; Editar 2 abre Contratação 2; filtros e responsividade continuam funcionais.
# Principal Regression Test
node integration/contracts-table.visual.mjs atualizado para cabeçalho vazio e Editar, com clique real.
# Testing Plan
Reusar teste da tabela e filtros, sem novas suites, banco ou mutações. Conferir captura mobile e arquivo estático servido no piloto.
# Implementation Plan
Atualizar expectativas existentes, executar red, alterar somente texto/cabeçalho, executar green e registrar resultado.

# Resultado
Concluído: cabeçalho final vazio visualmente, identificado por aria-label para acessibilidade; botões Editar + número com handler original. Teste existente red confirmou Ação versus vazio antes da mudança. Green: node integration/contracts-table.visual.mjs e node integration/contracts-filters.visual.mjs passaram (clique Editar 2 abre Contratação 2, sete filtros, desktop/mobile e zero escritas). node --check public/pc04.js passou. Captura artifacts/contracts-table/table-390-status.png inspecionada: título retirado e Editar visível/alcançável. GET /pc04.js no piloto ativo coincide com arquivo atualizado; não requer reinício de backend.
