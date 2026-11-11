# As Is
Breadcrumbs e duas descrições indicadas permanecem visíveis. Status vazio reserva espaço. A tabela cresce com todos os registros.
# To Be
Remover somente textos anotados; status vazio sem espaço; tabela operacional com até 15 registros visíveis e demais acessíveis por rolagem.
# Requirements
1. Ocultar breadcrumbs das telas início, depósitos, prestadores, usuários, perfis, atividades, tablets, contratações, financeiro e extrato; remover as duas descrições indicadas.
2. Recolher status vazio e conservar mensagens preenchidas acessíveis.
3. Limitar a área da tabela operacional à altura de cabeçalho mais 15 linhas, conservando filtros, edição, paginação e todas as linhas. Cabeçalho fixo, scroll por teclado, adaptação ao tamanho das linhas.
# Acceptance Criteria
1. Navegação real conserva títulos e controles, sem textos selecionados.
2. Status vazio tem altura zero, preenchido permanece visível.
3. Com 22 registros, somente primeiros 15 cabem antes da rolagem; último alcançável. Lista pequena não reserva altura extra. Desktop e viewport estreita funcionam.
# Principal Regression Test
node --test integration/annotated-layout-ui.test.mjs. Portal real servido com respostas HTTP sintéticas somente GET, sem SQL. Deve falhar antes por breadcrumb/status/tabela e passar depois.
# Testing Plan
Teste Playwright com geometria renderizada, navegação e rolagem. Regressão de filtros/exportação e checagem de sintaxe. Capturas desktop/estreita com registros longos.
# Implementation Plan
Remover cópias, recolher status vazio, adicionar limite dinâmico de 15 linhas e cabeçalho sticky; executar testes focais e inspecionar capturas.

# Verification
- RED: node --test integration/annotated-layout-ui.test.mjs falhou em início sem breadcrumb antes da implementação.
- GREEN: node --test integration/annotated-layout-ui.test.mjs integration/pc04-export-ui.test.mjs integration/fin01-default-status-ui.test.mjs — 3/3 PASS, sem skips.
- Teste antigo de exportação esperava mensagem Consulta atualizada já removida pelo trabalho anterior; sincronizadas duas esperas com status vazio, preservadas as assertions de exportação e segurança de sessão.
- Persona ADMIN sintética, HTTP interceptado somente GET; nenhuma gravação SQL. Escopo é UI, sem mudanças em autorização ou persistência.
- Capturas artifacts/annotated-layout-27832: tema claro, 22 registros com nomes longos, viewports 1531x764 e 700x764; inspecionadas capturas equivalentes da rodada 21796. Primeiras 15 linhas, última por teclado, cabeçalho sticky, lista de 3 registros sem scroll vertical, mensagem de erro visível.
- Sintaxe de pc04.js, navigation.js, fin01.js PASS. Servidor ativo 3211 retornou HTTP200 e JS atualizado.
- Detector Impeccable: apenas dois avisos de bordas preexistentes pc04.css, sem alteração dessas regras; pilot-design.css já ajusta essas bordas para 1px.
- Base f8857a0bc093db5049f790b41a00cf235810d6df, working tree com alterações anteriores preservadas.
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\navigation.js SHA256 AC3D4B21D13EBDD0AF31F5372ADAD59CACBE44348D0A583E5A6307D34BD4A7ED
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\fin01.js SHA256 B1CAD29764001DCAD56988B136D5329F4D36C81940FCE81C0507C1B1873F9B2B
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\pc04.js SHA256 3518DAFF8B7484F87AC6AAD9C217DBD424809763447F5AC3F7E04F21BF759DEA
C:\Users\Jetta\Desktop\PORTAL CONTROL 2\public\pc04.css SHA256 1068926B96E570FBEBE609212841CAA5C16CD69B93860F532A7EC2A1B10A08CD
