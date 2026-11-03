# As Is
Cadastro inicial exibe todos os depósitos como checkboxes permanentes.

# To Be
Campo compacto abre menu flutuante de múltipla seleção e resume os nomes escolhidos quando fechado.

# Requirements
1. Abrir opções somente ao clicar no campo do cadastro inicial; permitir múltiplos depósitos.
2. Fechar ao clicar fora ou Escape e conservar nomes/seleção; teclado e viewport móvel funcionam.
3. Preservar envio de depositos, rascunho após erro, reset após cadastro e navegação; edição existente permanece inline.

# Acceptance Criteria
1. Campo inicialmente “Selecione os depósitos”; marcar/desmarcar atualiza nomes e não envia formulário.
2. Clique fora, Escape e botão fecham menu; reabrir conserva checks. Menu cabe no viewport e tem rolagem com muitas opções.
3. Cadastro envia IDs escolhidos; erro não perde seleção; sucesso limpa campo. Depósito inativo não é oferecido no cadastro; edição e cancelamento existentes continuam funcionando.

# Principal Regression Test
node integration/provider-depot-menu.visual.mjs: DOM real, estilos do portal, HTTP sintético; red antes por ausência do campo que abre o menu.

# Testing Plan
Regressão principal de abertura/seleção/fechamento/reabertura, teclado, erro, envio e reset. Reexecutar provider-document.visual.mjs e provider-depots.visual.mjs. Inspecionar capturas desktop/mobile. Sem alteração de servidor ou persistência.

# Implementation Plan
1. Escrever teste real e confirmar red.
2. Reutilizar checkboxes em popover auto nativo, com botão de seleção, resumo e estilos locais.
3. Adaptar testes de criação para abrir menu; executar lote e inspecionar capturas.

# References
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover — popover auto fecha ao clicar fora/Escape, integra popovertarget e top layer.

# Verification
PASS. Red: `node integration/provider-depot-menu.visual.mjs` falhou com 0 botões de seleção em vez de 1. Green: mesmo teste passou com DOM e CSS reais e HTTP sintético, incluindo seleção múltipla, clique fora, reabrir, desmarcar, Escape/Enter sem submit, envio de IDs, erro mantendo rascunho, sucesso limpando, transição para edição/cancelar, lista longa com rolagem, nomes extensos, tela sem depósitos e saída da página sem popover residual.

Lote: `node integration/provider-depot-menu.visual.mjs`, `node integration/provider-document.visual.mjs` e `node integration/provider-depots.visual.mjs`: PASS. `node --check public/pc03.js` e diff check com cr-at-eol: PASS. Teste CPF/CNPJ adaptado para abrir o menu antes de selecionar.

Inspeção focal de imagens: artifacts/provider-depot-menu/open-1440.png, closed-1440.png, open-390.png e long-selection-390.png. Edge headless, viewport 1440/390, estilos extraídos do index real, contexto #dashboard/.view-section, dados sintéticos. Campo alinhado aos demais inputs, seleção legível, menu sobreposto sem deslocar formulário, opções acessíveis, resumo com quebra de nomes extensos e sem vazamento horizontal. Referências: formulário e checkboxes existentes de public/pc03.js e b24a.css; tokens e controles de pilot-tokens.css/pilot-design.css.

Escopo: somente UI do cadastro inicial; edição inline e contrato de dados preservados. Sem alteração de backend, migração ou base operacional. Sem deploy. Não executada suíte integral.
