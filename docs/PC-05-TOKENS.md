# PC-05 — Tokens e página do tablet

Registro histórico de 28/10/2026 (a validação atual de quatro dígitos está abaixo). Implementação local pronta e revisão independente sem achados materiais. **Aceite integrado INCONCLUSIVE/BLOCKED** pela indisponibilidade de SQL Server local. Preservadas todas as alterações anteriores PC-01 a PC-04. Sem commit, push, deploy ou alteração do banco/configuração privada instalados.

## Comportamento entregue

Gestor/ADM com acesso atual à filial e MFA recente gera ou substitui token de entrada/saída no detalhe da contratação aberta, com versão obrigatória. Token numérico de quatro dígitos, uma hora de validade e uso único. Substituição invalida imediatamente o anterior. Código retornado somente na geração e mantido no detalhe até navegação, atualização do detalhe ou logout; banco e auditoria não guardam código puro. HMAC usa a chave privada estável `cfg.token`; alterar essa chave invalida os códigos pendentes. Códigos reservados globalmente sob trava até a expiração original, inclusive após consumo ou substituição. Após expirar, o número pode ser reutilizado sem apagar o histórico. A geração sorteia sem repetição entre os 10.000 números; se todos estiverem reservados, retorna GERACAO_INDISPONIVEL sem substituir o anterior.

**Decisão explícita do usuário:** o token de entrada precisa ser usado antes de gerar saída. A API exige token de entrada consumido e horário de entrada existente; entrada exclusivamente manual não satisfaz essa condição. O consumo da saída também exige entrada. A SPEC foi atualizada, substituindo a regra anterior de somente gerar entrada primeiro.

Na seção de autorizações, gestor/ADM emite pareamento aleatório de 256 bits, de uso único e válido cinco minutos. Em um perfil exclusivo, abre `/tablet.html` e habilita o aparelho com esse código. A sessão dura oito horas a partir da habilitação, usa cookie HttpOnly/SameSite Strict separado e aceita tokens de qualquer filial sem seleção de unidade. Somente apontamento e encerramento são permitidos; não há dados administrativos, CPF, valor ou login pessoal do prestador. Emissor/ADM pode revogar; papel e atividade do emissor são revalidados pelo banco em cada uso. Cookie de sessão pessoal impede usar API tablet nesse perfil.

O tablet tem teclado numérico, botão de confirmação, mensagem “Token aceito” e limpeza do campo. Atualizar a página restaura sessão válida; polling verifica revogação/expiração. Cinco falhas de código persistidas bloqueiam o tablet e pedem nova autorização, distinto do limite HTTP temporário de 20 requisições/minuto/IP para habilitar/apontar. Sessão tem máximo de oito horas; origem e cabeçalho de proteção exigidos nas mutações.

Horário vem do relógio SQL, convertido para Brasília para compatibilidade com datetime2 local PC-04, conservando UTC no evento. Entrada na data do serviço; saída posterior até o dia seguinte. Consumo grava horário/origem TOKEN, versão, identificação do emissor e tablet, evento e auditoria na mesma transação/trava PC-04. Não altera diária nem libera pagamento. Horários manuais justificados e cancelamento invalidam tokens pendentes na transação PC-04. Históricos anteriores e tokens consumidos são preservados.

## Atualização de quatro dígitos — 09/11/2026

O botão de cópia inclui o tipo: `Token de entrada: 0042` ou `Token de saída: 0042`. Sem permissão de clipboard, o campo apresenta e seleciona o texto completo para cópia manual. Tokens novos têm quatro dígitos, inclusive zeros à esquerda. O tablet aceita quatro dígitos e, para transição, oito dígitos antigos ainda válidos; comprimentos intermediários são recusados.

O instalador inclui `42-pc05-four-digit-tokens.sql`. Essa migração troca a unicidade histórica por índices de hash/prazo e preserva todas as linhas. Geração e consumo usam a mesma trava transacional PC04; consumo procura a emissão não expirada mais recente. Tokens usados ou substituídos continuam reservando seu número até ExpiraEmUtc. Emissões e respostas mantêm os mesmos campos da API; `codigo` permanece string.

Bases existentes: encerrar **todas** as instâncias, verificar backup e executar localmente `scripts/upgrade-token-digits.mjs` com `JETTA_TOKEN_DIGITS_UPGRADE=YES`. O script exige destino local, configuração/identidade válidas, porta parada, backup verificado e compara os dados antes/depois. Não é executado no startup. Publicar backend e tablet compatíveis juntos, após a migração e antes de retomar o runtime; versões antigas não podem operar após a primeira reutilização.

Rollback offline: o mesmo script com `--rollback` restaura a constraint antiga somente se ainda não existirem hashes repetidos. Depois de reutilizar um número, o rollback de schema é recusado sem excluir dados; manter uma versão da aplicação compatível com histórico repetido. Não reverter apenas o código antigo sobre a base com números reutilizados.

A atualização de schema foi exercitada somente em banco descartável de teste. A base operacional não foi migrada nem houve deploy.

Validação atual: 69 testes aprovados em execuções focais (64 HTTP/serviço, 2 app, 1 fluxo de cópia desktop/mobile, 1 tablet e 1 fluxo HTTP/SQL Server real). Cobertos saturação e último código disponível, reserva de consumidos/invalidados, expiração/reuso com histórico, consumo concorrente e legado, isolamento por depósito, migração reaplicável e rollback condicionado. Verificação sintática: 768 arquivos, zero falhas. Revisão independente sem achados materiais. Evidências detalhadas em `.requirements/20261109T195726Z_tokens_quatro_digitos/REQUIREMENTS.md`.

## Ativação e persistência

Requer flags e schema PC-01 a PC-04 e `pc05:true`. Novos instaladores incluem `pilot-local/pc05-tokens.sql`, gerado como `26-pc05-tokens.sql`, manifesto `1.5.0-pc05`, 26 arquivos. Inclui tablets, tokens, índices únicos, constraints e ações TOKEN_GERAR/TOKEN_USAR no evento PC-04. Script exige transação externa e destino piloto/teste validado. Gerar o arquivo não certifica instalação/semântica SQL.

`/tablet.html` usa a experiência PC-05 somente com a flag ativa; a experiência legada permanece com a flag desligada. A configuração privada existente não foi alterada. Banco instalado com dados exige migração própria antes de ativar; não ligar flag sobre schema antigo. PC-06 ainda detém a política de limite/exceções; não presumir autorização para cenários acima do limite nem declarar fluxo de produção completo. Mensageria automática, reentradas, intervalos e pagamentos não fazem parte deste ticket.

Contratos: GET `/api/pc05/status`; GET/POST `/api/pc05/tablets`; POST `/api/pc05/tablets/:id/revogar`; POST `/api/pc05/contratacoes/:id/tokens` com `{versao,tipo}`. API tablet independente: POST `/api/pc05/tablet/habilitar` com `{pareamento}`, GET `/status`, POST `/apontar` com `{codigo}`, POST `/sair`. Detalhe PC-04 informa `pc05` e `entradaTokenUsada`, sem expor verificadores ou segredos.

## TDD e provas

- Backend: RED inicial por módulo ausente; GREEN de HTTP real com serviço produção e transporte ODBC controlado. Incremento manual/cancelamento RED por ausência da invalidação, depois GREEN. Quinta falha RED com resposta antiga 429 e browser sem orientação, depois GREEN 401 TABLET_BLOQUEADO e retorno ao pareamento. `tests/pc05.test.mjs`: 39 PASS; inclui expiração exata, instante anterior, uso/substituição, colisões, zeros iniciais, entrada manual, permissões, auditoria/rollback e persistência de tentativas negadas.
- Aplicação: `tests/pc05-app.test.mjs`: 1 PASS. createApp real com gates pessoais de MFA ativos, separação da sessão tablet, origem forjada, gestão anônima e seleção da página por flag. Transporte SQL controlado; não certifica autenticação SQL real.
- UI: `node integration/pc05.visual.mjs`: PASS. RED inicial por ausência dos controles; GREEN gestor gera entrada → tablet habilita/digita/registra → gestor gera saída. Também conflito, limpeza, timeout de segredo, navegação/logout, restauro, erro técnico, bloqueio, revogação, fim de sessão e financeiro sem controles. HTTP sintético, browser Edge headless e UI de produção; 1440/768/390, sem overflow/erros JavaScript. Capturas `artifacts/pc05/tablet-{1440,768,390}.png`; 390 inspecionada por builder e principal.
- Regressão: browser PC-04 PASS, sete gravações e três larguras. Suite completa `node scripts/test-all.mjs`: 205 PASS, mais dois testes piloto: 207 testes locais aprovados. Testes de fronteira SQL PC-04/05: dois SKIP, nenhum PASS presumido.
- Checks finais: `node scripts/check-all.mjs` — 620 arquivos, zero falhas; `git -c core.whitespace=cr-at-eol diff --check` — PASS.
- SQL preparado: `integration/pc05.integration.mjs`, opt-in `PC05_SQL_TESTS=YES` e `PC05_SQL_SERVER=localhost` ou instância local explícita. Cria banco vazio aleatório `JETTA_CONTROL_B3_TEST_<12 hex>` e remove somente o próprio banco. Inclui autenticação/MFA reais, concorrência de consumo (exatamente um sucesso), persistência de horário/token/evento, duas filiais, substituição, expiração, manual e revogação. Execução local: SKIP; nenhum serviço SQL Server local disponível. Não houve instalação de infraestrutura.

Persistência real, constraints, instalação, autenticação SQL e exclusão mútua/rollback concorrente ainda não homologados. Filas ODBC e HTTP sintético não substituem essa prova. Condição de retomada: executar o teste descartável em SQL Server local isolado, depois integrar a autorização de exceções PC-06 quando sua regra for definida.

## Revisões

Serena: manual lido, projeto ativado; chamada real de símbolos falhou por `Active language servers: []`, investigação por leitura direta. LAD não disponibiliza `system_design_review`/`code_review`; diagnóstico `C:/Users/Jetta/.codex/mcp-setup/README.md` registra servidor desabilitado por credencial pendente. Não houve revisão nem aprovação LAD.

Revisão própria e revisão independente por subagente GPT-6.1 Sol medium, incluindo reavaliação da integração final, sem achados materiais. Revisor executou PC-04/05/app (81 PASS antes dos três casos adicionais de colisão/zeros iniciais), analisou schema, fronteira de auth/MFA, CSRF, escopos, tokens, ordem, invalidação e teste SQL preparado. Observação de UX da quinta falha corrigida com RED/GREEN. Revisão por subagente não é revisão LAD; sem SQL não representa homologação integrada.

Referências verificadas: [Node crypto.randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback), [Microsoft AT TIME ZONE](https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql) e [SYSUTCDATETIME](https://learn.microsoft.com/en-us/sql/t-sql/functions/sysutcdatetime-transact-sql).

## Jetta QA — 28/10/2026

**PASS local; aceite integrado INCONCLUSIVE/BLOCKED.** Rodada focal solicitada pelo usuário após a implementação do PC-05. Nenhuma falha encontrada no lote executado; nenhuma correção de produto necessária. Reutilizada a revisão independente da mesma implementação; esta rodada é QA automatizado pelo principal, sem nova revisão LAD ou por subagente.

| Persona/caso | Prova e resultado |
|---|---|
| Gestor autorizado | Emissão/substituição, validade e versão; saída recusada antes do uso da entrada, inclusive com entrada exclusivamente manual. Saída permitida após entrada consumida. PASS HTTP/serviço produção com transporte ODBC controlado e interação de UI com HTTP sintético. |
| Gestor de outra filial | Acesso direto à contratação fora do escopo e revogação de tablet de outro emissor recusados. PASS local controlado; isolamento SQL real não homologado. |
| Financeiro isolado | Emissão recusada na API; interface sem geração nem autorização de tablet. PASS local controlado/sintético. |
| Tablet habilitado/prestador | Código resolve filial sem seleção; entrada/saída mantêm diária, resposta sem dados pessoais; teclado, limpeza, restauração, erro técnico, revogação e encerramento. PASS local; tablet de outra filial coberto no serviço. |
| Anônimo, perfil com sessão pessoal e origem forjada | Gestão anônima negada; cookie pessoal bloqueia API tablet; origem forjada recusada. createApp real com gates MFA ativos, transporte SQL controlado. PASS. |
| Emissor revogado, MFA vencido e tablet bloqueado | Recusas pertinentes; quinta falha exige nova habilitação, replay/substituição/expiração não registram horário; falha de auditoria solicita rollback. PASS controlado; não comprova rollback/persistência efetivos no SQL. |
| Correções manuais e cancelamento | Invalidam tokens pendentes preservando histórico no contrato HTTP/serviço. PASS controlado. |

Comandos desta rodada:

- `node scripts/test-all.mjs` — **205/205 PASS**, incluindo 39 testes PC-05, integração createApp e regressão PC-01 a PC-04. Saída em `artifacts/pc05/qa-tests.log`.
- `node --test pilot-local/unit.test.mjs integration/pc05.integration.mjs` — **2 PASS e 1 SKIP SQL**. Total único: **207 testes locais aprovados**, zero falhas. SKIP não é aprovação.
- `node integration/pc05.visual.mjs` — **PASS**, UI de produção em Edge headless com HTTP sintético e larguras 1440/768/390, sem overflow ou erros JavaScript. Capturas renovadas em `artifacts/pc05/`; reutilizada inspeção visual anterior da mesma interface sem mudanças nesta rodada.
- `git -c core.whitespace=cr-at-eol diff --check` — **PASS**. `Get-Service -Name '*SQL*'` não retornou serviço local.

Não foi iniciado runtime persistente, instalado banco nem alterado dado operacional. Servidores de teste foram efêmeros e com dados controlados. A concessão global ADM específica do PC-05 não foi exercitada com autenticação real nesta rodada; não generalizar os testes do gestor para homologação de todas as personas SQL.

Condição de retomada do aceite integrado: SQL Server local isolado e execução do teste descartável com `PC05_SQL_TESTS=YES` e `PC05_SQL_SERVER=localhost` ou instância local explícita. Necessário demonstrar autenticação/escopos reais, persistência/releitura, constraints, expiração e consumo concorrente único no banco. Integração de limite/exceções continua em PC-06, fora deste QA. LAD continua indisponível conforme diagnóstico já registrado, sem aprovação presumida.
