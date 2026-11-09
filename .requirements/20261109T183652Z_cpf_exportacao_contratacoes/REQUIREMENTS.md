# As Is
As exportações de contratações possuem oito colunas e não consultam o CPF cadastrado.
# To Be
Excel e PDF exibem Número, Prestador, CPF/CNPJ do prestador, seguidos pelos campos existentes.
# Requirements
1. Consultar Cadastro.Prestador.CPF na exportação autorizada.
2. Inserir o documento como terceira coluna em ambos os formatos, preservando texto e zeros à esquerda.
3. Preservar filtros, totais, permissões, demais campos e exportação financeira compartilhada.
# Acceptance Criteria
1. Endpoint exporta o documento do prestador vinculado à contratação.
2. XLSX contém documento textual em C e PDF contém cabeçalho e valor na terceira coluna; ausência não interrompe a exportação.
3. Datas, moeda, filtros, mesclagens, estado vazio e relatórios financeiros continuam corretos.
# Principal Regression Test
node --test tests/pc04-export.test.mjs tests/pc04-export-xlsx.test.mjs
Verificar artefatos gerados e complementar com integração HTTP/SQL real em integration/pc04-export.integration.mjs.
# Testing Plan
Executar testes alterados antes da implementação (red), depois (green), integração HTTP/SQL e regressão financeira adjacente.
# Implementation Plan
1. Acrescentar testes de documento e deslocar expectativas das colunas existentes.
2. Projetar p.CPF na consulta de exportação sem alterar predicados.
3. Acrescentar coluna, ajustar larguras, totais e intervalos do XLSX e PDF preservando opções financeiras.
4. Executar validações e registrar resultados.

# Validation Results
- Red: testes focados falharam em 8 casos pela terceira coluna ausente e deslocamento dos campos existentes.
- Green: 18/18 testes focados de contratações e financeiro aprovados.
- Integração HTTP/SQL real: 1/1 aprovada, com CPF do cadastro na célula C6, filtros, escopos, totais e PDFs multipágina.
- Fluxo de exportação na UI: 1/1 aprovado.
- Prévia HTML do PDF inspecionada visualmente; nove colunas, CPF/CNPJ e zeros à esquerda preservados. Ajustada largura de Número.
- Serena e Lad indisponíveis na sessão. Nenhuma dependência ou API externa adicionada.
