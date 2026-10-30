# As Is
Data de serviço fica em parágrafo separado após descrição da atividade e ponto final.
# To Be
Descrição e data ficam no mesmo parágrafo, separadas por vírgula.
# Requirements
1. Unir descrição e realizado na data de DD/MM/AAAA em um parágrafo.
# Acceptance Criteria
1. Primeiro parágrafo contém pagador, valor, atividade e data, sem ponto final entre atividade e data.
# Principal Regression Test
integration/fin02.visual.mjs: abrir popup pelo link de impressão e validar texto completo no primeiro parágrafo. Deve falhar antes porque data está no segundo parágrafo.
# Testing Plan
Executar teste visual red/green; manter verificação de PDF A4 em uma página e perfis existentes.
# Implementation Plan
Adicionar asserção no fluxo de impressão; executar red; unir os dois parágrafos; executar green; reiniciar piloto local.

# Validation
- Red: teste visual falhou porque o primeiro parágrafo não continha atividade e data juntas.
- Green: integration/fin02.visual.mjs passou para ADMIN/FINANCEIRO/GESTOR, incluindo impressão e PDF A4 de uma página.
- Piloto reiniciado com backup verificado e HTTP 200.
