# Formulário direto na aba de depósito
## As Is
A aba exige clicar em Alterar depósito / centro de custo.
## To Be
Formulário disponível ao abrir a aba, sem botão intermediário.
## Requirements
1. Remover abertura/fechamento intermediário, mantendo formulário, validações e botão Salvar.
2. Sem destinos: mensagem direta; contratação bloqueada: mantém indisponibilidade.
## Acceptance Criteria
1. Clicar na aba ou acessar URL direta exibe campos; alternar abas preserva preenchimento.
2. Mensagem aparece sem clique extra; envio, validações, histórico e layout desktop/mobile preservados.
## Principal Regression Test
node --test tests/pc04-depot-change-ui.test.mjs
Red: formulário não existe ao abrir aba. Green: campos já visíveis e fluxo completo de troca passa.
## Testing Plan
Regressão existente de navegação/formulário e horários. Sintaxe JS focada.
## Implementation Plan
Atualizar teste e executar red; retirar wrapper de clique e Voltar intermediário; executar green e verificar capturas.

## Evidência
Red: formulário ausente ao abrir aba. Green: fluxo completo da troca e regressão de horários passaram (2 testes). Validados URL direta, alternância preservando campos, estados bloqueados e ausência de destinos, envio/histórico e desktop/mobile. Sintaxe JS válida e alteração servida no portal local.
