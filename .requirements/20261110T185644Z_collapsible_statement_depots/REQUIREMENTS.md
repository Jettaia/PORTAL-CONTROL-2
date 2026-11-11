# As Is
Depósitos do extrato exibem sempre totais e prestadores; só os prestadores recolhem.
# To Be
Cabeçalho inteiro do depósito clicável, com seta, expandindo/recolhendo suas informações.
# Requirements
1. Cada depósito abre/recolhe independentemente por clique, Enter e Espaço, com aria-expanded e aria-controls.
2. Manter o estado inicial expandido para preservar a consulta atual. Recolher oculta totais, tabela e detalhes de prestadores, sem refazer consultas.
3. Preservar estados durante renderizações de detalhes e paginação. Novos filtros e logout limpam o estado.
4. Preservar o estilo azul/laranja, foco visível, contagem e controles existentes.
# Acceptance Criteria
Operar dois depósitos independentemente, restaurar detalhes ao reabrir e manter foco. Cabeçalho cabe em desktop/mobile.
# Principal Regression Test
integration/fin05-grouped-ui.test.mjs: cenário de recolhimento por teclado e clique em depósito, preservando fornecedor expandido. Deve falhar antes por ausência do botão.
# Testing Plan
Rodar teste antes/depois; suíte existente cobre consultas, impressão, filtros e paginação. Capturar e inspecionar estados desktop/mobile em novo diretório.
# Implementation Plan
Adicionar teste; implementar Set de depósitos recolhidos e botão acessível com região controlada; CSS restrito ao cabeçalho; testar e verificar visual.

# Validação
Red: ausência do botão Sumaré 1 prestador no teste antes da implementação. Green: suíte FIN05 por quatro personas, clique/Enter/Espaço, independência dos depósitos, preservação de detalhes e recolhimento durante paginação, filtros e logout.
Prova visual: C:\Users\Jetta\Desktop\PORTAL CONTROL 2\artifacts\fin05-depot-toggle-2026-11-10T18-59-05-982Z, desktop 1440x1050 e mobile 390x900, tema claro existente, dados sintéticos com dois depósitos e 102 contratações. Capturas de aberto/recolhido; implementação real renderizada com API simulada. Inspeção visual desktop/mobile aprovada. Sem alterações no banco.
Detector: avisos de bordas de destaque do padrão visual existente preservado conforme escopo. Sem novos estilos fora do cabeçalho do depósito.
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\fin05.js SHA256 81EC5E7A48F5E154F4D23C5FA5A3573EC84EA937118162271D4036A0C146733B
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\fin05.css SHA256 11083C2C008F0426B86D81FCE015A7CAA9A3A1DD170F6FFAC701568734C3D17C
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\integration\fin05-grouped-ui.test.mjs SHA256 472A750C6B0E5A0D2FEEBD193325581DBC71C689F19146BF2C6FC68067671AC2
