# Gestor responsável automático
## As Is
Nova contratação inicia Gestor responsável em Selecione, mesmo com gestor autenticado autorizado ao depósito.
## To Be
Para usuários Gestor, selecionar automaticamente o próprio usuário ao abrir criação e trocar depósito, quando presente no catálogo autorizado. ADMIN mantém escolha atual.
## Requirements
1. Preencher com identidade autenticada, sem nome/ID fixo.
2. Respeitar opções autorizadas de cada depósito; não inventar opção nem selecionar outro gestor como fallback.
3. Preservar formulário, envio e seleção ADMIN. Trata-se de valor inicial; permissões existentes continuam no servidor.
## Acceptance Criteria
Guilherme Ribeiro aparece selecionado no seu perfil, inclusive após troca de depósito autorizado. Seleção enviada em gestorId; conta sem opção própria não recebe outro gestor; logout/troca de conta não conserva identidade anterior.
## Principal Regression Test
integration/manager-default.visual.mjs usa componente real e HTTP sintético; antes encontra valor vazio, depois encontra ID autenticado e verifica payload.
## Testing Plan
Headless Edge: gestor, mudança de depósito, recarga, POST, ADMIN e troca de usuário. Backend/banco não alterados.
## Implementation Plan
Teste red; guardar identidade de auth e selecionar valor próprio disponível; teste green, sintaxe e conferir arquivo servido no piloto. Sem migração/reinício necessários.
## Ferramentas
smart-orchestrator em modo direto; execução própria proporcional. Serena/Lad indisponíveis no inventário anterior.

## Resultado
- Implementado somente em public/pc04.js: identidade da sessão como valor inicial do gestor, reaplicado ao mudar depósito/atualizar consulta; limitado às opções autorizadas. ADMIN mantém seleção atual e troca de conta limpa identidade anterior.
- Red literal: teste de componente encontrou gestorId vazio em vez de 7. Green: integration/manager-default.visual.mjs PASS em Edge headless com componente real/HTTP sintético; nome Guilherme Ribeiro selecionado, depósitos 1/2, sem fallback no 3, recarga, POST com gestorId7, ADMIN e troca de usuário para ID9.
- Sintaxe PASS. Arquivo atualizado servido pelo piloto 127.0.0.1:3211 confirmado; sem backend/banco/migração/reinício, sem gravações no piloto. Sem commit/push.
