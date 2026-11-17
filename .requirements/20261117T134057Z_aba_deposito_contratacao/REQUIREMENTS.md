# Aba de depósito / centro de custo

## As Is
O formulário de troca está na aba Resumo.
## To Be
Aba própria Depósito / centro de custo, entre Horários e Valor, seguindo navegação e estilos existentes.
## Requirements
1. Mover seção existente do Resumo para painel dedicado, sem mudar regras ou API.
2. Preservar navegação, hash, formulário e valores ao alternar abas, layout desktop/mobile e bloqueios.
## Acceptance Criteria
1. Resumo não exibe a ação; nova aba permite realizar a mesma troca com histórico.
2. URL termina /deposito, recarga restaura aba, alternar Resumo/nova aba preserva preenchimento; estados bloqueados não oferecem ação.
## Principal Regression Test
node --test tests/pc04-depot-change-ui.test.mjs
Red esperado: aba inexistente. Exercita clique/alternância/formulário reais.
## Testing Plan
Atualizar regressão de UI, executar red/green e regressão de horários. Sintaxe JS focada e captura desktop/mobile do formulário.
## Implementation Plan
Adicionar chave/rótulo e categorizar seção existente para o painel novo. Nenhuma mudança no banco/backend.

## Evidência
Red: nova aba inexistente. Green: teste do fluxo de troca e regressão de horários passaram (2 testes). Validados clique, recarga pela URL, alternância preservando formulário, envio e histórico, desktop/mobile. Sintaxe de public/pc04.js validada. Código servido pelo portal local sem reiniciar backend.
