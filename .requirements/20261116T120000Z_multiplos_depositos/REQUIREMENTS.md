# As Is
Contratações permite filtrar somente um depósito por select e depositoId.

# To Be
Selecionar um ou vários depósitos com caixas de seleção, aplicar a seleção e consultar/exportar o conjunto autorizado.

# Requirements
1. Oferecer seleção múltipla no filtro de Contratações com aplicação explícita e opção Todos os depósitos.
2. Listagem, paginação e exportação devem usar os mesmos depósitos e preservar permissões e filtros adicionais.
3. Preservar compatibilidade com depositoId único e rejeitar listas inválidas antes de consultar o banco.

# Acceptance Criteria
1. Marcar dois depósitos, aplicar e visualizar registros de ambos; reabrir mantém marcações; remover seleção retorna a todos.
2. Paginar/exportar conserva seleção; usuário continua limitado ao escopo autorizado.
3. depositoIds aceita IDs positivos separados por vírgula; listas vazias internamente, SQL e mistura com depositoId são recusados.

# Principal Regression Test
node --test tests/pc04-depots-ui.test.mjs tests/pc04.test.mjs tests/pc04-export.test.mjs
UI real em navegador com HTTP sintético: marca dois depósitos, aplica e confere registros, paginação, remoção e exportação. Antes falha pela ausência das caixas. HTTP real com banco simulado valida SQL IN e preservação do escopo.

# Testing Plan
Executar red antes da implementação e green depois. Cobrir seleção única/múltipla/todos, filtros combinados, exportação, mobile e entradas malformadas; rodar testes PC04 adjacentes e sintaxe.

# Implementation Plan
1. Adicionar testes UI/HTTP/exportação e executar red.
2. Aceitar depositoIds no mesmo construtor de filtros com validação estrita e escopo existente; executar testes HTTP/exportação.
3. Substituir select por detalhes com checkboxes e aplicar; executar UI desktop/mobile e checks adjacentes.

# References
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details
https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event

# Validation Results
- Red: HTTP e exportação recusavam depositoIds com CAMPOS_INVALIDOS; UI não possuía seletor múltiplo.
- Green: 102 testes passaram com `node --test tests/pc04-depots-ui.test.mjs tests/pc04.test.mjs tests/pc04-export.test.mjs tests/pc04-export-xlsx.test.mjs tests/pc04-period.test.mjs tests/pc04-legacy.test.mjs`.
- Navegador Edge headless usando a tela real e respostas HTTP sintéticas: selecionar dois, remover um, aplicar, paginar, exportar Excel e retornar a todos em 1440 e 390px, sem erros JavaScript.
- Serviço/rotas com banco simulado: predicados IN, escopo de usuário e entradas malformadas. Não houve acesso ao banco de produção nem deploy.
- Capturas verificadas em artifacts/pc04-multiple-depots/1440.png e 390.png.
- Sintaxe dos módulos alterados e git diff --check aprovados.
- Serena e Lad indisponíveis no catálogo de ferramentas da sessão.
