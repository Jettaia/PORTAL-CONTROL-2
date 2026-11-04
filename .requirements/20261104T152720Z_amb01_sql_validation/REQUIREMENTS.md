# Prioridade8 / AMB-01 — integração SQL local

## As Is
Relatório original tinha bloqueio de driver/SQL indisponíveis. Ambiente atual possui Driver18 e SQLEXPRESS ativo. Primeiro lote real: acesso PASS, conexão3/3PASS, FIN03timeout240s e PC04falha em numeração global. Migração36/serviço usam numeração por depósito; teste PC04 podia comparar depósitos distintos porque a corrida anterior tem vencedor não determinístico.

## To Be
Provar acesso/contratação/baixa em bancos descartáveis locais com dados sintéticos; corrigir apenas contratos de teste desatualizados e diagnosticar timeout antes de concluir. Nunca usar banco instalado/operacional.

## Requirements
1. Executar suites opt-in ACCESS/PC04/FIN03 com instância local explícita e conexão readonly real; inventário de bancos sintéticos antes/depois e cleanup confirmado.
2. Alinhar comparação de números ao depósito vencedor na PC04, preservando controle de ocupação global do prestador/data, acesso e histórico.
3. Localizar timeout FIN03 com etapas/limite de requisição antes de mudar código financeiro ou enfraquecer prova determinística.

## Acceptance Criteria
1. Suites chegam às assertivas de negócio e passam sem skips/cancelamentos; limpeza deixa baseline de bancos sintéticos intacta.
2. Próxima contratação PC04 é do mesmo depósito/gestor responsável que a primeira antes de exigir Numero maior; operações subsequentes usam o gestor desse depósito.
3. FIN03 preserva dois SPIDs aguardando lock real, unicidade, rollback/retry. Falha/timeout não vira PASS.

## Principal Regression Test
PC04_SQL_TESTS=YES PC04_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/pc04.integration.mjs. RED observado quando depósitoB vence e próxima contratação do depósitoA recebe número1. FIN03_SQL_TESTS=YES node --test integration/fin03.integration.mjs reproduziu timeout no lote; diagnóstico por etapas necessário.

## Testing Plan
Reexecutar apenas PC04/FIN03 afetadas após correção/diagnóstico; reutilizar acesso/conexão válidos se nenhum contrato mudar. Revisão independente de contratos/provas; teste gate proporcional se houver alteração no produto. Registrar limites: segredoMFA semeado para verificar STEPUP real; corridas Access/PC04 sem barreiraSQL.

## Implementation Plan
1. Reconciliar PC04 com contrato por depósito e manter autorização do gestor correto.
2. Instrumentar fases FIN03 e impor timeout em fetch para isolar espera sem mascarar.
3. Executar provas reais, conferir cleanup e registrar relatório.

## Retomada e resultado
- Após interrupção: nenhum processo das integrações nem banco sintético; patches anteriores preservados.
- FIN03 instrumentada passou1/1 em231s; catálogo agrupado em transação como ACCESS/PC04. Limite diagnóstico15s teve falha posterior; anexos grandes usam60s, global240s preservado. Nenhuma asserção financeira removida.
- PC04: correção de comparação por depósito e uso de owner em criação/conferência/cancelamento; revisão detectou a conferência fixa emA e foi corrigida.
- PASS final PC04:1/1 semskip, depósitoB vencedor,122s. PASS final FIN03:1/1 semskip,22s, catálogo1s, cadeia84→57→60 e todas provas financeiras/anexo5MB aprovadas.
- Conexão readonly final3/3PASS. ACCESS1/1PASS anterior reutilizado com equivalência de fonte/contrato.
- Zero bancos sintéticos e zero processos de integração após execução. Baselinezero preservada; sem banco operacional.
- Gate da prioridade7 validado novamente por hashes/lista com validateFullRegression:410testesPASS,719sintaxes,7pilotoPASS. Não reexecutado desnecessariamente; mudanças apenas em duas integrações opt-in fora desse inventário.
- Sintaxe focal/diffcheck aprovados. Revisão independente review_seg01 (GPT-6.1Sol):PASS final de contrato/evidência fornecida; SQL executado pelo principal.
- Evidências em docs/Relatório.md. Sem src/schema de produção alterado, commit, push ou deploy. Sem afirmação de SLA ou homologação das suítes históricas fora do recorte.
