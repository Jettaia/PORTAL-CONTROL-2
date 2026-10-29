# PC-07 — Alerta de valor acima da média

## As Is
PC-04 persiste contratações individuais e sua conferência/revisão/cancelamento; o formulário não compara preços. Checkout contém alterações anteriores PC-01–05 que devem ser preservadas. P05 estava aberta em docs/SPEC.md.

## To Be
Gestor/ADM recebe comparação informativa ao criar ou revisar valor, sem bloquear a operação. Regra confirmada pelo usuário nesta execução: últimos 20 registros conferidos do mesmo tipo/filial nos 90 dias anteriores à data do serviço, mínimo cinco; excluir própria contratação, canceladas e revisadas sem nova conferência; pagas permanecem.

## Requirements
1. Consulta autenticada e autorizada por filial, exclusiva de gestor/ADM; perfil financeiro acumulado não amplia escopo operacional.
2. Selecionar DataServico >= referência menos 90 dias e < referência, ordenar DataServico DESC, ContratacaoId DESC, limitar 20. Usar ValorLiberado de registros LIBERADA; manter pagos. Excluir id da contratação em revisão validando acesso/contexto.
3. Média sem base é null para menos de cinco; comparação estrita acima usa centavos inteiros e soma/amostra, sem arredondar antes de decidir. Média exibida em duas casas.
4. Formulários de criação/revisão mostram média/quantidade, aviso acima e ausência de base; erro de consulta é distinto, respostas antigas não contaminam o contexto. Preço acima nunca exige aprovação nem bloqueia submit.

## Acceptance Criteria
1. ADM e gestor autorizado consultam; gestor alheio, financeiro isolado, anônimo e ator revogado são recusados sem divulgação de valores.
2. Conjunto calculável demonstra filtros, fronteira 90/91 dias, exclusão do dia de referência/futuro, ordenação/desempate, limite 20, exclusão própria, revisão/reconferência/cancelamento e inclusão paga.
3. Amostras 0/4 retornam null/false, 5/20 calculam; igual/abaixo não avisam e qualquer excesso avisa, inclusive precisão decimal.
4. Fluxo DOM real demonstra avisos, troca de contexto, falha técnica, revisão e criação acima permitidas em desktop/tablet/celular.

## Principal Regression Test
`node --test tests/pc07.test.mjs`: HTTP real com serviço de produção e transporte ODBC controlado, RED esperado 404 antes da montagem da consulta; GREEN após implementação. `node integration/pc07.visual.mjs`: UI de produção e ações do usuário, HTTP sintético, RED antes dos estados de comparação. SQL isolado opt-in em integration/pc07.integration.mjs cobre o mecanismo real; SKIP não é aprovação.

## Testing Plan
Reutilizar Node test, Express, ODBC e Playwright instalados. Negativos de autorização/entrada e precisão no HTTP; SQL descartável para amostragem/persistência; UI headless para transições/submit/layout. Regressão PC-04/05 e suite nativa ao concluir.

## Implementation Plan
1. Escrever teste HTTP e obter RED; implementar consulta read-only e rota sob gate PC-04, sem schema/flag adicional; repetir GREEN.
2. Integrar estado informativo na UI com teste headless RED/GREEN e proteção contra resposta atrasada.
3. Adicionar prova SQL opt-in, executar testes disponíveis; revisão independente proporcional, corrigir achados e registrar QA no ticket canônico.

## Revisões e referências
Serena manual lido/projeto ativado; get_symbols_overview falhou (Active language servers: []). LAD system_design_review/code_review não expostos; README de instalação informa enabled=false por credencial pendente. Sem revisão/aprovação LAD. Revisão própria e eventual revisão por subagente serão identificadas separadamente.
Documentação Microsoft TOP/ORDER BY e DATEADD verificada via web; implementação usa TOP com ordem determinística e aritmética BigInt para comparar sem ponto flutuante: https://learn.microsoft.com/en-us/sql/t-sql/queries/top-transact-sql ; https://learn.microsoft.com/en-us/sql/t-sql/functions/dateadd-transact-sql .

## Resultado
Implementação local pronta e Jetta QA local PASS; aceite integrado INCONCLUSIVE/BLOCKED por ausência de SQL Server local. HTTP RED por 404 antes da implementação, GREEN 23 testes; UI RED por estado ausente e GREEN com 15 consultas/três gravações. Suíte 228 PASS e piloto 2 PASS; SQL 1 SKIP. Sintaxe 624 arquivos sem falha. Revisão independente por subagente Sol medium sem achados materiais; LAD indisponível, sem aprovação. Registro canônico completo e comandos/limites em docs/SPEC.md, seção PC-07.
