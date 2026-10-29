# PC-04 — Contratação individual e conferência

Data: 28/10/2026. Estado: implementação local pronta; provas locais PASS e revisão independente sem achados materiais pendentes. Aceite integrado INCONCLUSIVE/BLOCKED por ausência de SQL Server local. Usuário autorizou este ticket no checkout PORTAL CONTROL 2. Sem alteração do banco instalado, commit, push ou deploy.

## Resultado

- Contratação individual com filial, prestador, tipo, data, previsão de entrada/saída, valor decimal exato e gestor responsável escolhido explicitamente. Criador e conferente registrados separadamente.
- Decisões do usuário: uma contratação por prestador/data em toda a empresa e saída permitida no dia seguinte. Data refere-se ao início do serviço; o sistema não modela um serviço único por vários dias além do seguinte. Cancelamento mantém registro, número e ocupação da data; não recicla identidades. Ausência de regra de limite/média não foi substituída pelas políticas laboratoriais antigas.
- Novas inclusões exigem filial/tipo/prestador ativos, vínculo atual e autorização de filial; responsável ativo com papel operacional e acesso à filial (ADM verdadeiro tem acesso global). Tentativa de duplicidade é genérica, sem revelar a filial alheia. A consulta de ocupação inclui participações legadas.
- Horários manuais exigem motivo, autor e origem MANUAL. Conferência exige entrada e saída reais, registra instante UTC, conferente e valor exato. Horas não recalculam a diária. Preservadas data do serviço e datas próprias da liberação.
- Revisão justificada de valor ou horários de contratação liberada despublica a liberação, limpa o valor vigente liberado e exige nova conferência. Histórico conserva valores, estados, autor, motivo e versões anteriores. Cancelamento antes do pagamento remove disponibilidade sem apagar eventos. Registro marcado pago é protegido; ajustes pós-pagamento pertencem ao PC-10.
- Financeiro isolado consulta somente liberações vigentes e não altera a operação. Usuário com gestor+financeiro pode consultar liberações globais, mas só altera suas filiais. UI respeita a permissão específica do detalhe; API revalida papéis, escopo, usuário ativo e sessão/MFA.
- Atualizações serializadas, controle de versão, evento e auditoria na mesma transação, com rollback em falha. Numeração global por sequência SQL NO CYCLE com UNIQUE; pode conter lacunas por rollback, sem reiniciar por ano/filial.
- Listagem paginada por número descendente, até 200 por página e cursor validado, permitindo abrir pendências antigas. UI com busca de prestador por nome/CPF, responsável filtrado pela filial, detalhe e ações em computador/tablet/celular. Conflito preserva o formulário; logout remove estado da tela.

## Mapeamento e ativação

A entidade nativa `Operacao.Contratacao` referencia os cadastros existentes e mantém `Operacao.ContratacaoEvento`. O legado Atividade/Participacao exige depósito e permite vários prestadores; não possui mapeamento unívoco para o novo acordo. Não foram recriadas tabelas legadas, importados registros automaticamente ou confundidos seus IDs/obrigações com os novos. Histórico antigo continua disponível em Planejamento legado. Com `pc04:true`, inclusões antigas de atividade/participante são recusadas, para impedir contorno do contrato individual; sem a flag, comportamento legado é preservado.

A flag exige PC-01/02/03 e schema provisionados. Novos instaladores incluem `pilot-local/pc04-contracts.sql`, gerado como `25-pc04-contracts.sql` no manifesto 1.4.0-pc04, total 25 arquivos. Configuração privada existente não foi alterada. Instalação existente com dados exige migração separada; não ativar apenas a flag sobre schema antigo. Há guards de destino e exigência de transação externa; geração de arquivo não comprova instalação SQL.

Contratos de API: GET `/api/pc04/catalogo`; GET/POST `/api/pc04/contratacoes`; GET `/api/pc04/contratacoes/:id`; POST `/:id/horarios`, `/:id/conferir`, `/:id/revisar`, `/:id/cancelar`. Listagem recebe `?antes=<Numero>` e retorna `proximaPagina`. Criação exige `gestorId`; mutações exigem `versao`. Eventos são origem para consumidores futuros PC-08/11. Pagamentos, recibos, tokens, limite e média não foram implementados neste ticket; dependências permanecem explícitas na tela.

## Evidências de TDD e validação

- Backend: `node --test tests/pc04.test.mjs` — 44 PASS. RED inicial por módulo inexistente; incrementos RED/GREEN para ocupação legada, responsável obrigatório/forjado, paginação de 201 registros e cursor inválido. HTTP real + serviço de produção com transporte ODBC controlado. Casos negativos cobrem origem, sessão, MFA, papel, escopo, dados, versão, cancelado/pago, trava e auditoria/rollback. Também coberta conclusão histórica após inativação/desvinculação no contrato de serviço; essa propriedade aguarda prova SQL real.
- Caminho legado: `node --test tests/pc04-legacy.test.mjs` — RED HTTP 400 em vez de409 antes do gate; GREEN recusando os dois endpoints antigos com PC-04 ativo, sem chegar ao SQL.
- UI: `node integration/pc04.visual.mjs` — PASS, 7 gravações, portal real com HTTP sintético, 1440/768/390. RED ausência do formulário antes da implementação; RED/GREEN adicional para responsável, ações de gestor+financeiro fora da filial e registro antigo além dos primeiros 200. Criação → horários → conferência → revisão com conflito → revisão → nova conferência → cancelamento. Também seleção por filial, diária preservada, logout e financeiro sem formulários. Capturas em `artifacts/pc04/contracts-{1440,768,390}.png`, inspecionadas; sem overflow do painel ou erros JavaScript.
- Regressão: `node scripts/test-all.mjs` — 165/165 PASS; `pilot-local/unit.test.mjs` — 2/2 PASS. Total local 167 testes aprovados. `integration/pc03.visual.mjs` reexecutado após integração: PASS, incluindo PC-02, ADM/gestor/financeiro e três larguras.
- Prova SQL preparada: `node --test integration/pc04.integration.mjs` — 1 SKIP, não PASS. Suites SQL PC-01/02/03 também SKIP por mesma indisponibilidade. Não foi detectado serviço SQL Server local e não foi instalada infraestrutura. Para executar, disponibilizar instância local descartável e definir `PC04_SQL_TESTS=YES`, `PC04_SQL_SERVER=localhost` (ou instância local explícita). O teste cria banco aleatório restrito `JETTA_CONTROL_B3_TEST_<12 hex>`, instala schema vazio, autentica personas com MFA, valida concorrência global/edição, inativação/desvinculação e fluxo completo, e remove somente seu próprio banco.

Persistência real, instalação/semântica das constraints, concorrência SQL e autorização com autenticação SQL real permanecem não homologadas. Provas com transporte controlado e browser sintético não substituem essas verificações. Integrações PC-05 a PC-11 permanecem fora do ticket.

## Revisões e ferramentas

Revisão própria e revisão independente por subagente GPT-6.1 Sol medium conforme smart-orchestrator. Dois P2 encontrados e corrigidos com RED/GREEN: ações em detalhe financeiro fora da filial e inacessibilidade de registros após os primeiros 200. Revisor reavaliou ambos, responsável explícito, escopos, dinheiro, transações, histórico, schema e fronteira legada; PASS com limite SQL. Execução independente: 45 PASS e 1 SKIP SQL.

Serena: manual lido e projeto ativado. Chamada real de símbolos retornou `Active language servers: []`; investigação continuou por leitura direta. LAD: nenhuma ferramenta disponível no inventário; diagnóstico `C:/Users/Jetta/.codex/mcp-setup/README.md` informa servidor desabilitado por credencial de provedor pendente. `system_design_review` e `code_review` não foram executados com sucesso; não há aprovação LAD. Revisão própria/subagente não é revisão LAD.

Referências verificadas: [CREATE SEQUENCE, Microsoft Learn](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-sequence-transact-sql) e [sp_getapplock, Microsoft Learn](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql).

Verificação final: `node scripts/check-all.mjs` — 613 arquivos, zero falhas; `git -c core.whitespace=cr-at-eol diff --check` — PASS. Reexecução final pelo principal do browser PC-04 e regressão PC-03/PC-02 — PASS.

## Jetta QA — 28/10/2026

**PASS local; aceite integrado INCONCLUSIVE/BLOCKED.** Aplicação focal solicitada pelo usuário após a implementação do PC-04. Nenhuma falha encontrada no lote executado; nenhuma correção de código necessária.

| Persona/cenário | Prova e resultado local |
|---|---|
| Gestor autorizado | Criação individual com responsável distinto do criador; horários justificados; conferência; revisão que retira liberação; reconferência e cancelamento. PASS no HTTP com serviço real e transporte ODBC controlado; fluxo também exercitado no browser com HTTP sintético. |
| Gestor de outra filial | Consulta direta e tentativa de alteração recusadas no contrato de serviço; atribuição de responsável sem acesso recusada. PASS local controlado; isolamento SQL real não homologado. |
| ADM | Conferência global aceita pelo serviço. PASS local controlado. |
| Financeiro isolado | Não altera contratação; catálogo operacional vazio; consulta apenas liberações vigentes. Browser sem formulários de alteração. PASS local controlado/sintético. |
| Gestor + financeiro | Consulta financeira de liberação de outra filial sem ações operacionais no detalhe. PASS no browser sintético; não certifica autenticação/isolamento SQL reais. |
| Anônimo, origem forjada, ator revogado ou MFA vencido | Recusas nos testes HTTP/serviço pertinentes. PASS local; middleware de autenticação do teste é controlado. |
| Dados e concorrência | Motivo vazio, valor/data/período/identificador inválidos, duplicidade nativa/legada, versão desatualizada, trava indisponível e falha de auditoria cobertos. PASS controlado; rollback e concorrência efetivos no banco aguardam prova real. |
| Estado e navegação | Formulário preservado após conflito, logout limpa dados, responsável filtrado por filial, diária não depende das horas e pendência após os primeiros 200 continua acessível. PASS no browser em 1440/768/390. |

Comandos desta rodada:
- `node scripts/test-all.mjs` — **165/165 PASS**, incluindo os 44 testes PC-04 e o teste do bloqueio das inclusões legadas. Saída em `artifacts/pc04/qa-tests.log`.
- `node --test pilot-local/unit.test.mjs integration/pc04.integration.mjs` — **2 PASS e 1 SKIP SQL**. Total único desta rodada: **167 testes locais aprovados**, zero falhas. O SKIP não é aprovação.
- `node integration/pc04.visual.mjs` — **PASS**, sete gravações sintéticas, três tamanhos e nenhum erro JavaScript. Capturas renovadas em `artifacts/pc04/`. Reutilizada a inspeção visual anterior do mesmo componente, sem alteração de implementação nesta rodada.
- `Get-Service -Name '*SQL*'` — nenhum serviço retornado. Não foi iniciado runtime persistente, instalado banco ou alterado dado operacional. Testes usaram servidores efêmeros locais e dados controlados.

Condição de retomada do aceite integrado: disponibilizar SQL Server local isolado e executar a prova descartável com `PC04_SQL_TESTS=YES` e `PC04_SQL_SERVER=localhost` ou instância local explícita. Ela deve demonstrar persistência/releitura, constraints, concorrência, sessões reais e isolamento entre filiais. Sem essa prova, não declarar aprovação integrada de autorização, persistência nem produção. LAD permanece indisponível conforme diagnóstico registrado acima; esta rodada é QA automatizado pelo principal, não uma nova revisão LAD ou por subagente.
