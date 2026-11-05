# Número da contratação centralizado
## As Is
A coluna usa alinhamento à esquerda no extrato e na impressão.
## To Be
Centralizar horizontalmente número e cabeçalho da contratação, mantendo alinhamento vertical ao meio, na tela e impressão/PDF.
## Requirements
1. Centralizar somente a coluna de número da contratação nas duas apresentações.
2. Preservar resumo por prestador, valores, filtros e paginação.
## Acceptance Criteria
1. Browser confirma text-align center e vertical-align middle nas células de número, inclusive mídia print; cabeçalho centralizado.
2. Resumo mantém alinhamento original; testes existentes de extrato continuam passando.
## Principal Regression Test
integration/fin05.visual.mjs: fluxo real de abertura do extrato e popup, com API sintética e CSS/JS reais. Antes falha em text-align left; após passa center em screen e print.
## Testing Plan
Runner visual nativo com personas ADMIN/FINANCEIRO/GESTOR, captura da tela e impressão e geração de PDF existentes. Sem SQL necessário para delta de apresentação.
## Implementation Plan
1. Acrescentar assertions no runner e executar RED.
2. Aplicar classe restrita ao número em cabeçalho/células nas duas renderizações e CSS compartilhado; GREEN.
3. Inspecionar capturas e diff.

## Resultado
RED confirmado no fluxo real: text-align left em vez de center. GREEN: JETTA_PLAYWRIGHT_ROOT=<checkout>/node_modules node integration/fin05.visual.mjs, exit 0.
Personas ADMIN/FINANCEIRO/GESTOR; filtros, totais, paginação, detalhes, impressão integral 102 linhas/PDF, cancelamento de impressão, logout e viewports 1440/390 passaram. Assertions de alinhamento no CSS computado em screen e print passaram.
Capturas individual-1440.png e print-alignment.png inspecionadas: números e cabeçalhos centralizados, demais colunas preservadas. PDF gerado em artifacts/fin05/extrato.pdf. APIs sintéticas; arquivos de UI e cascata reais. Sem alteração de banco/API e sem deploy. Serena/Lad não disponíveis; nenhuma dependência nova.
