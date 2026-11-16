# As Is
Diárias organiza prestadores em grupos, com checkboxes e consulta de códigos em lote. Não apresenta valor individual nem total do dia.

# To Be
Tela de acompanhamento com filtros por data/depósito e busca, total previsto do dia em destaque e prestadores em Aguardando entrada, Em serviço e Concluídas. Pendências e canceladas continuam identificadas separadamente. Sem geração, seleção ou consulta em lote de códigos.

# Requirements
1. Somar Valor de todas as contratações previstas na data/depósito, inclusive sem entrada, exceto CANCELADA. Regra confirmada pelo usuário em 16/11/2026.
2. Busca textual filtra somente a lista; o total representa todas as páginas do dia/depósito, não a busca. Usar centavos exatos, sem arredondamento de ponto flutuante.
3. Preservar três grupos principais, horários previstos/reais, valor de cada diária e link para contratação. Pendências separadas e canceladas recolhidas.
4. Remover seleção/lote/códigos da tela. Manter filtros, atualização, paginação automática, controle de acesso, loading/erro/vazio e proteção contra respostas antigas.
5. Layout consistente com o portal, legível em desktop e celular, inclusive nomes longos, muitas pessoas e valores grandes.

# Acceptance Criteria
1. Duas diárias sem entrada + em serviço + concluídas/liberadas entram no total; cancelada nunca entra. Soma atualiza ao trocar data/depósito ou atualizar.
2. Registros em segunda página entram na soma; buscar uma pessoa não muda o total. Valores como 0.10+0.20 exibem 0,30; valor indisponível não gera total enganoso.
3. Cada pessoa aparece no grupo correto e abre a contratação pelo link; pendência/cancelamento não aparecem como conclusão normal.
4. Nenhum checkbox, geração, consulta de código em lote ou POST. Erro não apresenta zero como total conhecido; resposta antiga não sobrescreve nova data/depósito ou sessão.
5. Capturas reais em 1531px e 390px, listas cheias/nomes longos, vazio e erro. Sem sobreposição dos filtros nem perda de valor/horários.

# Principal Regression Test
integration/diarias-ui.test.mjs: página real no navegador com HTTP sintético e duas páginas. Antes falha pela ausência do total e permanência do lote. Depois valida total, agrupamento, busca, atualização, escopo, centavos e layout.

# Testing Plan
Red/green da UI; regressão adjacente da listagem PC04, navegação e código fixo. Inspecionar capturas e rodar sintaxe/diff e detector visual uma vez após acabamento.

# Implementation Plan
1. Atualizar teste com total e novo acompanhamento; executar red.
2. Reorganizar somente Diárias JS/CSS, mantendo contratos de API existentes.
3. Validar desktop/mobile/extremos/erro, corrigir achados e disponibilizar no runtime local existente.

# Design Direction
Extensão da interface operacional existente, preservando navegação, paleta azul/laranja, tipografia e componentes de filtro. Faixa de total vinculada à data/depósito e três colunas de acompanhamento em desktop; seções empilhadas no celular. Não se trata de rebrand ou substituição do sistema visual do portal.

# Validation Results
- Red: `node --test integration/diarias-ui.test.mjs` falhou por ausência de #diariasTotal, antes da implementação (log .scratch/diarias-total-red.log).
- Green: teste UI completo aprovado com total 786,00/786,05, consulta em duas páginas, busca sem alterar total, centavos 0,10+0,20=0,30, inteiro acima da precisão Number, erro/valor ausente, vazio, resposta antiga, ausência de POST/checkbox e abertura real do modal da contratação.
- Regressões adjacentes aprovadas: tests/diarias-list.test.mjs, tests/pc04-period.test.mjs, tests/pc04-depots-ui.test.mjs, integration/reload-navigation-ui.test.mjs, integration/pc05-token-copy-ui.test.mjs.
- Capturas verificadas: artifacts/diarias-presenca-1794835684562, cenários normal/dense/huge e erro, 1531/390px. SHA dos arquivos consta em evidence.json. Ajustados contraste do hover de Atualizar e distribuição de valores muito grandes.
- Detector Impeccable executado uma vez: [] (nenhum achado). Sintaxe e git diff --check aprovados.
- Conferência no navegador do usuário: tela local recarregada e exibindo novo total/grupos, com Floripa em 16/11/2026 (sem contratações, total 0,00). Somente leitura; nenhum dado operacional alterado. Sem publicação em produção.
