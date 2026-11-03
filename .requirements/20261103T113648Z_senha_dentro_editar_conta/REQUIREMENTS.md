# As Is
Alteração de senha aparece em um painel separado acima da administração de usuários.
# To Be
Para ADM, exibir alteração de senha dentro da área Editar conta, abaixo dos dados do usuário selecionado. Preservar troca própria de usuários sem administração.
# Requirements
1. Integrar senha à área de edição sem aninhar formulários.
2. Selecionar o mesmo usuário para dados e senha; ocultar senha administrativa em Nova conta.
3. Preservar confirmação, cancelamento, troca própria e envio para o endpoint correto.
# Acceptance Criteria
Editar abre dados/senha da mesma conta; limpar/atualizar oculta a senha administrativa; cancelar senha limpa campos sem trocar o alvo; usuário não ADM mantém troca própria.
# Principal Regression Test
node integration/pc01-password.visual.mjs: clicar Editar e verificar que o formulário de senha está dentro da área de edição, abaixo dos dados. Deve falhar antes e passar depois.
# Testing Plan
Fluxo real de UI em Edge headless com API sintética; conferir red/green, confirmação, cancelamento, alvo após cancelamento/sucesso, desktop/celular e regressão da edição existente. Backend inalterado.
# Implementation Plan
1. Adaptar teste e reproduzir red.
2. Reposicionar formulário e conectar seleção/limpeza da edição; ajustar estilos locais.
3. Executar testes afetados e inspecionar captura.

# Validation Results
- RED: teste real de UI detectou painel de senha visível antes de editar (true em vez de false).
- GREEN: node integration/pc01-password.visual.mjs — PASS; formulário dentro de pc01AccountEditor, após pc01Form, sem formulários aninhados; conta selecionada correta, confirmação, cancelamento, envio administrativo e troca própria preservados. Edge headless, API sintética, desktop1440/mobile390.
- Regressão: node integration/pc01.visual.mjs — PASS; criação, edição, descarte, erro e autorrevogação; viewports1440/1024/768.
- Sintaxe: node --check public/pc01.js e public/pc01-password.js — PASS.
- Inspeção da captura artifacts/pc01-password/admin-reset.png: administração primeiro; Editar conta com dados e seção de senha abaixo no mesmo bloco, separada por borda sutil.
- Backend e contratos de senha inalterados. Código local, sem deploy ou alteração de dados reais.
