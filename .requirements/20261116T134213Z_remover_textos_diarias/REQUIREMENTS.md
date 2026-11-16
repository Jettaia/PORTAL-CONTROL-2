# As Is
Diárias exibe duas orientações que o usuário marcou para remoção.
# To Be
Remover somente “Inclui quem ainda aguarda entrada. Canceladas não entram no total.” e “Selecione um prestador para abrir a contratação”.
# Requirements
1. Retirar os dois textos, preservando total, contador, grupos e links.
# Acceptance Criteria
Os textos não aparecem na tela; os elementos funcionais continuam disponíveis.
# Principal Regression Test
Reutilizar integration/diarias-ui.test.mjs para total, grupos e navegação. Remoção de copy reversível não exige novo teste.
# Testing Plan
Executar teste existente, sintaxe e conferir assets servidos localmente.
# Implementation Plan
Remover os dois nós de texto de public/diarias.js e validar.
