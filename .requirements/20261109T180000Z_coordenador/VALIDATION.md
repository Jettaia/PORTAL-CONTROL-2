# Validação — COORDENADOR local

## Resultado
Implementado no checkout atual; upgrade aditivo aplicado ao piloto local JETTA_CONTROL_PILOTO_LOCAL e runtime reiniciado em http://127.0.0.1:3211/. Sem push, deploy ou acesso à produção. Nenhuma conta operacional foi promovida ou criada. Contas de teste foram usadas somente em bancos descartáveis.

## Evidências
- RED real: `integration/coordinator.integration.mjs` falhou no POST autenticado `/api/pc01/usuarios`, 400 FUNCOES_INVALIDAS em vez de 201.
- GREEN HTTP/SQL: mesmo teste passou após implementação. Cobre cadastro/login/contexto, múltiplos depósitos, depósito novo sem concessão, escopo de gestores, negações administrativas, aprovações e autoaprovação, bloqueio pós-liberação, financeiro/recibos/anexos/exportações, combinação de funções, tablets/tokens, migração idempotente e revogação de sessões.
- `node integration/coordinator.visual.mjs`: PASS. Frontend real com HTTP sintético: ADMIN seleciona COORDENADOR e dois depósitos com CC; edição preserva seleção; coordenador escolhe gestor, troca depósito, aprova solicitação de outra pessoa, não recebe ação de autoaprovação e consulta financeiro. Capturas desktop/tablet em `artifacts/coordinator/` inspecionadas.
- Regressão padrão: todos os arquivos `.test.js`/`.test.mjs` de `tests/` e `integration/`, com `node --test --test-concurrency=2`: **456 pass, 0 fail, 0 skipped**. A primeira execução com concorrência padrão provocou timeouts de navegadores; a execução limitada passou integralmente. Log: `artifacts/coordinator/regression.log`.
- `node scripts/check-all.mjs`: 751 arquivos JS verificados, zero falhas. Os novos arquivos adicionados depois foram também verificados com `node --check`.
- `node --test pilot-local/unit.test.mjs`: **2 pass**.
- SQL adjacente `integration/fin03.integration.mjs`: PASS, incluindo concorrência, rollback, anexos e baixas financeiras.
- Upgrade local `node scripts/upgrade-coordinator.mjs`: PASS, backup CHECKSUM/RESTORE VERIFYONLY, **74 tabelas preservadas**; único acréscimo no catálogo PerfilAcesso. Preservação de todas as outras tabelas conferida por contagem/hash e catálogo anterior comparado integralmente.
- Runtime local reiniciado pelo iniciador oficial. GET `/`: 200, opção COORDENADOR presente.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS. Preservados os finais de linha existentes.

## Falhas anteriores confirmadas
Dois testes SQL opt-in falham igualmente em uma cópia isolada de HEAD anterior, sem a implementação, e no checkout modificado:
1. `integration/pc01.integration.mjs:50`: espera 200 no POST de atividade planejada legado `/api/b3/atividades`, rota aposentada que retorna 404.
2. `integration/manual-hours.integration.mjs:79`: pareamento antigo sem depositoId, retorna 400 IDENTIFICADOR_INVALIDO em vez de 200.

Comparação reproduzida usando `git archive HEAD` em `artifacts/coordinator/baseline/`, com SQL descartável e as mesmas flags de teste. Logs: `artifacts/coordinator/sql-regression.log` e `artifacts/coordinator/baseline-sql.log`. Não foram alterados fluxos aposentados nem relaxadas validações para fazer esses testes antigos passarem.

## Limites
Serena e Lad indisponíveis nesta sessão. Nenhuma dependência ou contrato externo novo foi introduzido. A prova de autorização usa API real e SQL descartável; a validação visual usa frontend real e respostas HTTP sintéticas. O piloto persistente recebeu somente migração e smoke sem dados de teste. ADMIN deve criar/editar a conta real, selecionar COORDENADOR e autorizar os depósitos desejados. Centro de custo permanece atributo do depósito.

## Revalidação focal solicitada — jetta-qa
Executado novamente com login real, API real e SQL Server local, sem mocks de autorização: `$env:COORDINATOR_SQL_TESTS='YES'; $env:COORDINATOR_SQL_SERVER='localhost\SQLEXPRESS'; node --test integration/coordinator.integration.mjs`.

Resultado final: **PASS — 1 teste integrado, 0 falhas, 0 skips; 92,35 segundos**, incluindo espera deliberada para respeitar o limite real de 90 requests/minuto. A primeira execução do teste existente também passou; a cobertura ampliada inicialmente atingiu HTTP 429, corrigido no ritmo do teste, sem desativar nem alterar proteções da aplicação.

- ADMIN criou COORDENADOR com depósitos A e B, e o login retornou exatamente esses vínculos.
- Coordenador criou/consultou contratações em A e B. C ficou ausente da listagem e exportações; filtro direto por C retornou lista vazia, leitura direta retornou 404 e criação retornou 403.
- HTTP 403 confirmado para consultar/criar/editar/excluir usuários, promover outro usuário a ADMIN, conceder depósitos, redefinir senha de terceiro, criar/editar depósitos e tipos de serviço, consultar catálogo de perfis e acessar diagnóstico.
- Snapshots por contagem/hash de todas as tabelas antes/depois das tentativas administrativas e fora do escopo foram idênticos: nenhuma alteração indevida em contas, credenciais, sessões, permissões ou operação.
- Demais casos existentes passaram: aprovação sem autoaprovação, financeiro somente consulta, anexos/exportações por escopo, tokens de tablet e revogação de autorização/sessão.
- Banco descartável removido pelo finally do teste; nenhuma conta ou depósito de teste criado no piloto operacional. Nenhuma mudança no código da aplicação nesta revalidação.
