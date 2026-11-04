# Portal Control — relatório de segurança e processo por persona

**04/11/2026 · Windows · execução local · branch `main` · commit `99b922a194634b1b79c8a41e54d1d82de2bf5055`**

Na auditoria inicial, uma requisição sem login derrubou o processo HTTP e a proteção contra baixas simultâneas ainda não tinha prova SQL. As atualizações abaixo registram as correções e validações posteriores; o estado consolidado a seguir prevalece sobre os resultados históricos.

## Estado consolidado após revisão das prioridades 1 a 8

| Prioridade / achado | Estado local | Evidência principal |
|---|---|---|
| 1 / SEG-01 | Corrigido e validado | body-parser 1.20.9; gzip/deflate malformados não encerram o mesmo processo |
| 2 / SEG-02 | Corrigido e validado | Bloqueio 410 para nome normal e aliases NTFS dos assets financeiros aposentados |
| 3 / SEG-03 | Corrigido e validado | Ambos os HTML de tablet respeitam a flag PC05, incluindo aliases |
| 4 / concorrência e rollback FIN03 | Validado em SQL real | Duas sessões em espera, baixa única, índice único, rollback e retry |
| 5 / QA-01 | Corrigido e validado | Inventário compartilhado tests/integration e gate sem exclusões; falhas intermediárias resolvidas nas etapas 6/7 |
| 6 / QA-02 | Corrigido e validado | Testes seguem depósitos e conservam cobertura de conflito de edição |
| 7 / QA-03 e QA-04 | Corrigidos e validados | Confirmação/cancelamento na VM e prévia headless com dependência portátil |
| 8 / AMB-01 | Encerrado no recorte executado | Acesso, PC04, FIN03 e conexão SQL aprovados em bancos sintéticos; limpeza confirmada |

Gate disponível e reconferido por lista/hashes nesta revisão: **410/410 testes, 719 arquivos sem erro de sintaxe e 7/7 testes do piloto/gate/conexão**, sem skips/TODO/cancelamentos. A revisão não repetiu essas execuções, pois as evidências continuam equivalentes. As integrações SQL opt-in têm seus resultados registrados separadamente nas etapas 4/8; os totais sobrepostos não devem ser somados. Afirmações de gate reprovado nas etapas 5/6 descrevem aquele momento e foram superadas pela prioridade 7.

### O que ainda precisa de fechamento

1. **Identidade Windows restrita em execução real:** os grants SQL possuem prova sintética PASS com usuário WITHOUT LOGIN, mas isso não substitui provisionar a conta dedicada, conferir ACLs/DPAPI e autenticar o servidor com essa identidade. [SQL-RUNTIME.md](SQL-RUNTIME.md) mantém essa aplicação administrativa explicitamente pendente. As provas de acesso/PC04/FIN03 não certificam esse corte operacional.
2. **Jornada completa em navegador com autenticação real:** a prévia validada não usa banco/autenticação reais. Login, STEPUP e negócios foram exercitados via HTTP/SQL, mas ainda falta a jornada integrada na UI, inclusive configuração do autenticador. Não confundir essas duas superfícies.

### Limpeza das referências históricas

A busca por nome nas pastas acessíveis do disco C: não localizou os nove artefatos originais. Foi encontrado somente artifacts/readiness-20261030/audit.json, relativo a outra auditoria, que não foi usado como substituto. Nenhuma referência aos nove destinos foi encontrada no restante do projeto fora deste relatório. Eles não são dependências do portal ou dos runners atuais; as referências quebradas foram retiradas a pedido do usuário. Nenhum arquivo do aplicativo, teste atual ou evidência de outra auditoria foi excluído. Os resultados iniciais abaixo permanecem como registro histórico, sem seus anexos originais disponíveis; as provas atuais presentes no checkout são vinculadas nas seções correspondentes.

### Backup/restore — validação adiada durante a evolução do piloto

Por decisão do usuário, o ensaio de backup/restore de 30/10/2026 foi retirado das evidências consideradas para o estado atual. Ele pertence a uma versão anterior e não será reconciliado como parte desta rodada, enquanto o piloto continua evoluindo. Seus links e a descrição de PASS foram removidos deste relatório.

Uma nova prova será planejada quando houver uma versão candidata do piloto, usando o schema, os dados sintéticos e os consumidores daquela versão. Estado nesta rodada: **ADIADO**, sem aprovação atual de backup/restore e sem tarefa de reexecução nesta revisão. Esta decisão documental não altera as rotinas de backup/restore, os dados ou os gates existentes de instalação/produção.

A disponibilidade de ADMIN para aprovar horários manuais é uma dependência operacional da regra vigente, não um defeito demonstrado. As demais suítes SQL opt-in não recebem aprovação por extensão. Commit, push, deploy e corte de produção não foram executados e não fazem parte do aceite local das oito prioridades.

## Falhas reproduzidas no produto — histórico da auditoria inicial

| ID e prioridade | O que aconteceu | Impacto e verificação da correção |
|---|---|---|
| **SEG-01 · Alta** | O portal carrega `body-parser` 1.20.8. Um POST sem sessão, com JSON comprimido em gzip e bytes adicionais, atingiu o parser antes da autenticação e do limitador da API. O processo encerrou com `Z_DATA_ERROR` e código 1. | Quem conseguir alcançar o serviço pode interromper o atendimento. A reprodução ocorreu em loopback. Atualizar a dependência para uma versão corrigida da série 1.x, a partir de 1.20.9. Repetir a requisição e verificar que o **mesmo processo** continua respondendo. |
| **SEG-02 · Média** | Com o financeiro legado aposentado, `GET /pc08.js` respondeu 410. No Windows, `GET /pc08.js::$DATA` respondeu 200 e serviu o JavaScript. | A regra de bloqueio pode ser contornada pela forma como o Windows resolve esse nome de arquivo. Testar ambas as grafias na rota estática. A evidência demonstra acesso ao recurso, sem demonstrar leitura financeira ou execução de uma baixa. |
| **SEG-03 · Baixa** | Com o módulo de tablet desabilitado, `GET /tablet.html` respondeu 404, mas `GET /tablet-pc05.html` serviu a página com 200. | A interface desativada ainda pode ser aberta pelo nome físico. Aplicar a condição do módulo aos dois caminhos e testar os estados ligado e desligado. O teste não demonstrou pareamento ou apontamento indevido. |

Os anexos originais dessas reproduções não foram localizados. As correções posteriores têm provas atuais em [teste do parser HTTP](../tests/body-parser-dos.test.mjs), [bloqueio financeiro legado](../tests/fin04-retirement.test.mjs) e [páginas de tablet](../tests/pc05-app.test.mjs). Referência de segurança: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).

### Atualização SEG-01 — correção local em 04/11/2026

A prioridade 1 foi corrigida no checkout local a partir do commit indicado neste relatório. O `body-parser` passou de 1.20.8 para 1.20.9 no lockfile, com override `^1.20.9` para impedir resolução de versões anteriores à correção. Express e as regras do servidor foram preservados. Os resultados originais acima permanecem como histórico da auditoria.

- **RED:** `node --test tests/body-parser-dos.test.mjs` reproduziu encerramento do processo filho com código 1 e `Gunzip Z_DATA_ERROR` antes da atualização.
- **GREEN:** o mesmo comando passou nos dois testes. HTTP real em `createApp`, loopback e porta efêmera: persona anônima envia gzip e deflate com bytes adicionais; o mesmo processo/PID continua atendendo `/api/health` com 200. JSON normal e comprimido válido chegam à validação do login; JSON/gzip inválidos recebem 400 e o corpo descomprimido acima de 8 KB recebe 413. Não há acesso ao banco nem efeitos externos.
- **Regressão:** `npm test` passou em 381 testes, sem falhas ou pulos, incluindo os dois novos testes descobertos pelo runner principal.
- **Sintaxe:** `npm run check` verificou 718 arquivos, sem falhas.
- **Instalação:** `npm ci --ignore-scripts --no-audit --no-fund` em diretório temporário separado instalou 94 pacotes; `npm ls body-parser express` confirmou `express@4.22.3` e `body-parser@1.20.9`. Scripts nativos não foram executados nessa prova de instalação.
- **Auditoria:** `npm audit --json` retornou zero vulnerabilidades conhecidas no registro consultado.
- **Revisão independente:** agente `review_seg01`, GPT-6.1 Sol, somente leitura: PASS sem achados materiais; repetiu o teste focal com 2/2 aprovados.

O npm não estava no PATH; os comandos npm foram executados com Node e npm CLI 11.6.2 em diretório temporário. Esta entrega é local, sem commit, push ou deploy. SEG-02, SEG-03 e as demais pendências conservam seu status original.

### Atualização SEG-02 — correção local em 04/11/2026

O bloqueio estático em `src/server.js` agora compara o nome-base antes de sufixos NTFS (`:stream:$DATA` / `::$DATA`) e desconsidera pontos/espaços finais desse nome na verificação de aposentadoria. O caminho servido não é reescrito; a condição `fin01` e a lista de arquivos aposentados foram preservadas.

- **RED:** `node --test tests/fin04-retirement.test.mjs` reproduziu `GET /pc08.js::$DATA` com 200, quando o esperado era 410, no Windows desta máquina.
- **GREEN:** o mesmo comando passou nos 5 testes. Os novos casos exercitam HTTP real de `createApp`, sem sessão, banco ou efeitos externos, em loopback e porta efêmera. São 15 grafias em GET e HEAD (nome normal, NTFS literal/codificado, caixa, barras, query string, stream nomeado e pontos/espaços finais), todas com 410. GET retorna somente `FINANCEIRO_LEGADO_DESATIVADO`; HEAD não retorna corpo. Inclui PC08, PC10, PC11 e HTML legado.
- **Preservação:** `/fin01.js` permanece 200 com `fin01` ativo; `/pc08.js` permanece 200 com `fin01` desligado; codificação inválida continua 400.
- **Regressão:** `node scripts/test-all.mjs` (runner de `npm test`) passou em 383 testes, sem falhas ou pulos, incluindo a regressão SEG-01.
- **Sintaxe:** `node --check src/server.js` e `node --check tests/fin04-retirement.test.mjs` passaram. A checagem de diff passou considerando os finais CRLF preservados pelo projeto.
- **Revisão independente:** agente `review_seg01`, GPT-6.1 Sol, somente leitura: PASS sem achados materiais, repetiu 5/5 testes focais e conferiu variantes adicionais de sufixos e barras.

A prova cobre a entrega estática de arquivos, sem afirmar leitura de dados financeiros ou baixa indevida. Sem commit, push ou deploy. SEG-03 e as demais pendências conservam seu status original.

### Atualização SEG-03 — correção local em 04/11/2026

O guard estático em `src/server.js` agora recusa os dois nomes HTML de tablet quando `pc05` está desligado ou ausente, antes de `express.static`. Reutiliza o nome-base normalizado da SEG-02 para impedir contorno por codificação, caixa, barras, sufixos NTFS e pontos/espaços finais. Quando ligado, o alias `/tablet.html` e o caminho físico `/tablet-pc05.html` continuam entregando a mesma página.

- **RED:** `node --test tests/pc05-app.test.mjs` confirmou `pc05=false: GET /tablet-pc05.html` com 200, quando o esperado era 404.
- **GREEN:** novo caso SEG-03 em `tests/pc05-app.test.mjs`, HTTP real em `createApp`, loopback e porta efêmera, sem sessão ou acesso ao banco: GET/HEAD dos dois caminhos recebem 404 com flag desligada/ausente e 200 com flag ligada. Os 10 aliases adicionais testados também recebem 404 quando desligado/ausente; GET retorna apenas `Nao encontrado`, HEAD sem corpo. Com flag ligada, o conteúdo HTML dos dois caminhos é idêntico e referencia `/tablet-pc05.js`.
- **Regressão focal:** `node --test tests/pc05-app.test.mjs tests/pc05.test.mjs tests/fin04-retirement.test.mjs` passou em 57 testes, sem falhas/pulos. Inclui gates existentes de sessão, origem e credencial tablet e a SEG-02; os testes de serviço preexistentes usam ODBC simulado.
- **Suíte principal:** `node scripts/test-all.mjs` (runner de `npm test`) passou em 384 testes, sem falhas/pulos, incluindo SEG-01 e SEG-02.
- **Sintaxe:** `node --check src/server.js` e `node --check tests/pc05-app.test.mjs` passaram; diff check aprovado considerando CRLF preservado.
- **Revisão independente:** agente `review_seg01`, GPT-6.1 Sol, somente leitura: PASS sem achados materiais; repetiu o lote focal com 57/57 aprovados.

Escopo: disponibilidade dos dois caminhos HTML conforme a flag; regras de pareamento/apontamento e os arquivos JS/CSS não foram alterados. Sem commit, push ou deploy. As pendências de SQL, concorrência financeira e demais validações seguem abertas.

### Atualização prioridade 4 — concorrência e rollback FIN03 em SQL real, 04/11/2026

**VALIDADO no ambiente local sintético.** A instância `localhost\SQLEXPRESS` (Express Edition) estava ativa e o ODBC Driver 18 disponível nesta etapa. A integração confirmou a identidade da máquina SQL, criou um banco aleatório `JETTA_CONTROL_B3_TEST_<12 hex>`, instalou o schema vigente e executou login, cookies, rotas, serviços e persistência reais. Não foi necessário alterar o código financeiro ou o schema de produção.

- **Comando:** `$env:FIN03_SQL_TESTS='YES'; node --test integration/fin03.integration.mjs`. A suíte original passou; depois foi fortalecida para provar a sobreposição SQL e os efeitos persistidos. A execução final passou em **1/1, sem pulos**, aproximadamente 29 segundos de teste.
- **Concorrência:** ADMIN e FINANCEIRO enviaram a mesma confirmação por HTTP. Uma terceira sessão reteve o applock até observar dois SPIDs distintos aguardando `APPLICATION` lock no banco sintético, usando eventos ODBC reais e as DMVs SQL. Na execução final, a cadeia foi **66 → 62 → 77**; somente depois o holder 77 liberou a fila. As duas respostas foram 200 com o mesmo `BaixaId`.
- **Persistência/idempotência:** leitura posterior encontrou exatamente uma baixa ativa, um anexo e uma auditoria `FIN03_CONFIRMAR`. Uma tentativa SQL direta de duplicar a baixa, dentro de transação de teste, foi recusada pelo índice único (2601/2627); após rollback da tentativa, continuou existindo uma baixa ativa.
- **Rollback/recuperação:** uma trigger sintética lançou erro na auditoria, após as escritas de anexo, baixa e `PagoEmUtc`. O endpoint retornou 503; leitura posterior encontrou zero baixas, zero anexos, zero auditorias de confirmação e `PagoEmUtc` NULL. Removida a trigger, nova confirmação retornou 200 e persistiu uma única baixa, anexo e auditoria, com `PagoEmUtc` preenchido. Os casos existentes de rollback de substituição/desfazimento também passaram.
- **Personas e fronteiras:** ADMIN/FINANCEIRO autorizados; anônimo, gestor sem permissão, gestor de outro depósito, origem inválida, entrada inválida e versão divergente exercitados pela suíte. SQL e autenticação reais, com dados sintéticos e MFA desligado explicitamente nesta fixture. A prova não certifica MFA ou privilégios da conta restrita de produção.
- **Limpeza:** banco criado pela execução removido; `DB_ID` confirmou sua ausência. O cleanup foi condicionado ao sucesso do CREATE desta execução. Nenhum banco operacional foi alterado.
- **Diagnóstico do harness:** a primeira asserção fortalecida exigia que os dois solicitantes apontassem diretamente ao holder e falhou (1 em vez de 2); a leitura real demonstrou fila encadeada. A asserção final exige duas esperas `APPLICATION` e cadeia terminando no holder, recusando ciclos/bloqueadores externos. Não foi falha de baixa do produto.
- **Regressão:** `node scripts/test-all.mjs` passou em 384 testes, sem falhas/pulos; `node --check integration/fin03.integration.mjs` e diff check passaram.
- **Revisão independente:** agente `review_seg01`, GPT-6.1 Sol, somente leitura: PASS sem achados materiais, com revisão do teste e da evidência executada pelo principal; não repetiu SQL.

Os resultados originais deste relatório permanecem como histórico. A lacuna de concorrência/rollback FIN03 está encerrada neste recorte; as outras suítes SQL antes impedidas, jornada de navegador, permissões de runtime restrito e recuperação de backup não recebem aprovação por extensão. Sem commit, push ou deploy.

### Atualização prioridade 5 / QA-01 — descoberta e gate de testes, 04/11/2026

**QA-01 corrigido; liberação atual REPROVADA pelas falhas antes invisíveis.** `npm test` e o gate agora usam a mesma função `regressionTests()`, que descobre automaticamente os arquivos `*.test.js/mjs` na raiz de `tests/` e `integration/`. O inventário atual tem **51 arquivos: 46 de tests/ e 5 de integration/**. Não foram aplicados filtros de exclusão, skips ou correções dos pontos seguintes.

- **Comando de gate:** `npm run test:release` expõe o `scripts/validate-pilot.mjs` existente. Preserva a exigência de todos os testes aprovados, zero skips/TODO/cancelamentos, sintaxe, testes piloto/gate/conexão SQL, inventário e hashes; não concede autorização de instalação/produção. O gate para na primeira etapa reprovada.
- **RED/GREEN do mecanismo:** teste com o runner real copiado para fixture temporária, `tests/` passando e `integration/` lançando erro. Antes retornava0 ignorando a integração; depois retorna1 com o erro da sentinela. O teste do gate também rejeita relatório antigo que omita integration/.
- **Integridade da prévia:** revisão identificou `scripts/preview-ui.mjs` fora dos hashes. Incluído em `regressionInputs()` com prova do hash real e rejeição pelo gate quando omitido. RED antes da correção; GREEN depois.
- **Verificação focal:** `node --test tests/test-discovery.test.mjs pilot-local/release-gate.test.mjs`: **5/5 aprovados**, sem skips/TODO. Sintaxe dos quatro arquivos JS/MJS alterados e diff check aprovados.
- **Execuções amplas:** `npm test` e primeira execução do gate encontraram400testes (396pass/4fail). Após acrescentar o teste de fingerprint, o gate final encontrou **401 testes: 397 passaram, 4 falharam, zero skips/TODO/cancelamentos**, código de saída1. Evidências locais em `pilot-local/regression.json` (status FAIL, primeira etapa reprovada) e `pilot-local/regression-tests.txt`.
- **Falhas expostas:** duas em `integration/branch-edit.unit.test.mjs` (`Cadastro desconhecido` / `Cadastro removido.`), uma em `integration/mfa-enrollment-ui.unit.test.mjs` (`Option is not defined`) e uma em `integration/preview-ui.test.mjs` (timeout30s aguardando `#pc04Page form`). Nesta máquina o Playwright conseguiu abrir o navegador; a prévia falhou na navegação, além do problema de portabilidade já descrito no relatório original. Os próximos pontos6/7 devem tratar esses casos.
- **Revisão independente:** agente `review_seg01`, GPT-6.1Sol, somente leitura: PASS no delta QA-01 final, repetiu5/5 testes focais; não executou SQL/navegador. Nenhum achado material pendente na mudança do gate.

O README documenta escopo e pré-requisitos. As centenas de suítes históricas `*.integration.mjs` permanecem opt-in; `FULL` não é aprovação de todas elas. A prova FIN03 da prioridade4 continua registrada separadamente. Como a primeira etapa falhou, sintaxe global e testes de conexão SQL do gate não foram executados nesta rodada. O npm foi chamado pelo CLI11.6.2 temporário, pois não estava no PATH. Sem commit, push ou deploy.

### Atualização prioridade 6 / QA-02 — testes do cadastro vigente, 04/11/2026

**QA-02 corrigido.** `integration/branch-edit.unit.test.mjs` deixou de exigir criação/edição da filial aposentada. Agora exige que esse cadastro permaneça indisponível e valida o contrato vigente do depósito: centro de custo/endereço, edição com original completo e situação booleana, sem código de filial ou filialId na entrada. Nenhum código de produto ou schema foi alterado nesta etapa.

- **RED:** o arquivo original reproduziu2falhas (`Cadastro desconhecido` e `Cadastro removido.`).
- **Concorrência preservada:** novos cenários executam `save` real de PC02, substituindo somente o transporte ODBC. Original desatualizado em nome, centro de custo, endereço ou situação recebe409 `REGISTRO_ALTERADO_ATUALIZE`, sem envio de UPDATE/INSERT, com rollback1 e commit0. O controle positivo com original atual envia UPDATE/auditoria e faz commit1, rollback0. Cada cenário verifica consumo das respostas e fechamento da conexão.
- **GREEN focal:** `node --test integration/branch-edit.unit.test.mjs tests/pc02.test.mjs tests/catalog-changes.test.mjs tests/depot-legacy.test.mjs`: **28/28 aprovados**, sem pulos/TODO.
- **Gate amplo:** `npm run test:release`: **407 testes, 405 passaram e 2 falharam**, zero skips/TODO/cancelamentos, código1. As duas falhas restantes são `Option is not defined` no cadastro simulado e timeout da prévia em `#pc04Page form`, destinadas à prioridade7. As falhas antigas de filial desapareceram sem exclusão/skip. O gate continua reprovado e suas etapas posteriores não foram executadas.
- **Sintaxe/revisão:** `node --check integration/branch-edit.unit.test.mjs` e diff check aprovados. Agente independente `review_qa02`, GPT-6 Luna high, somente leitura: PASS sem achados materiais; repetiu28/28 testes focais.

A prova de concorrência deste recorte protege a comparação e a ausência de escrita na fronteira ODBC; não declara validação de persistência SQL real para PC02. Evidência ampla local em `pilot-local/regression.json` e `pilot-local/regression-tests.txt`. Sem commit, push ou deploy.

### Atualização prioridade 7 / QA-03 e QA-04 — UI e prévia reproduzíveis, 04/11/2026

**QA-03 e QA-04 corrigidos; regressão ampla aprovada.** O teste VM recebeu a API Option e passou a executar `b24a.js` junto do wrapper protegido real de `mfa-b2b.js`, usando o cadastro vigente de serviços (nome/descrição). A decisão do usuário, DOM e transporte continuam simulados; o código do produto não foi alterado nesta etapa.

- **Confirmação/cancelamento:** antes da decisão, valores permanecem preenchidos, botão bloqueado, nenhuma chamada fetch e duplo submit não duplica a operação. Confirmar envia exatamente um POST com nome/descrição; cancelar preserva valores e não faz requisição/reset. Os testes existentes de configuração,429 e STEPUP também passaram.
- **Playwright portátil:** importação por `playwright` do projeto, devDependency1.64.1 fixada no lockfile, compatível com Node>=20. Windows usa Edge instalado; outros sistemas usam Chromium do Playwright; `PLAYWRIGHT_CHANNEL` seleciona outro canal instalado. README documenta instalação e pré-requisitos, sem caminho absoluto de perfil. O manifesto e lockfile agora integram os hashes do gate.
- **Prévia atualizada:** apenas `scripts/preview-ui.mjs` e seus testes receberam fixtures atuais de depósitos, PC04 e FIN01/FIN05 vazias. Filiais e telas financeiras aposentadas não foram reativadas. O helper continua sem SQL/autenticação real e recusa POST/PUT/PATCH/DELETE em `/api` com405.
- **RED:** gate anterior comprovou Option undefined/timeout da prévia. Antes de corrigir o helper, nova asserção mostrou catálogo PC04 sem depositos; antes de vincular dependências, teste dos fingerprints reprovou ausência de package.json. As asserções passaram após os ajustes. Durante a atualização, o teste também revelou seletor antigo da mensagem PC03 e endpoints auxiliares sem fixture, corrigidos no harness.
- **Navegador real:** Edge headless navegou por usuários, depósitos, serviços, prestadores, contratações, financeiro e extrato por prestador, aguardando mensagens de carregamento concluído/listas vazias. Nenhum pageerror, erro de consulta API ou envio de escrita. Submit real via requestSubmit foi interceptado pela prévia; os modos autorização/teclado do tablet também foram exercitados.
- **Focal:** `node --test integration/mfa-enrollment-ui.unit.test.mjs integration/preview-ui.test.mjs tests/test-discovery.test.mjs pilot-local/release-gate.test.mjs`: **12/12 aprovados**, sem falhas/pulos/TODO.
- **Instalação isolada:** `npm ci --include=dev --ignore-scripts --no-audit --no-fund` em diretório temporário instalou96pacotes; importação de `playwright` pelo nome do pacote funcionou. Scripts nativos não foram executados nessa prova; o navegador foi validado na instalação de trabalho. `npm audit --json` retornou zero vulnerabilidades conhecidas.
- **Gate completo:** `npm run test:release` terminou com **REGRESSIONS_PASS**: **410/410 testes aprovados**, **719 arquivos sem erro de sintaxe** e **7/7 testes do piloto/gate/conexão SQL aprovados**, sem skips/TODO/cancelamentos. A conexão SQL é somente leitura ao master local; não amplia a homologação às demais suítes SQL opt-in. Evidências em `pilot-local/regression.json` e respectivos logs.
- **Revisão independente:** agente `review_seg01`, GPT-6.1Sol, somente leitura: PASS sem achados materiais; repetiu11/11 testes de VM/descoberta/gate sem navegador/SQL. Navegador e gate completo foram executados pelo principal.

O status aprovado é da regressão descrita, sem conceder liberação de instalação ou produção. Jornadas com autenticação real no navegador, outras suítes SQL opt-in e recuperação de backup continuam com os limites originais. Sem commit, push ou deploy.

### Atualização prioridade 8 / AMB-01 — integrações SQL concluídas, 04/11/2026

**AMB-01 encerrado neste recorte.** Driver18 disponível e serviço SQLEXPRESS local ativo. Após a interrupção, a retomada confirmou ausência de processos das integrações e zero bancos `JETTA_CONTROL_B3_TEST_*`; os patches de diagnóstico e de contrato PC04 já estavam aplicados. Não foi necessário instalar software ou alterar a configuração/banco operacional.

- **Solicitação de acesso:** `ACCESS_SQL_TESTS=YES`, `PC01_SQL_SERVER=localhost\SQLEXPRESS`, `node --test integration/access-requests.integration.mjs`: **1/1 PASS**, sem skip. Evidência do primeiro lote reutilizada após conferir que fonte/contrato não mudaram. Login/cookie e STEPUP TOTP reais, aprovação/recusa ADMIN, gestor/anônimo negados, validação, persistência, rollback em falha de auditoria e decisão concorrente201/409. O segredo TOTP é semeado na fixture; não é prova de cadastro do autenticador pela UI.
- **Contratação PC04:** primeiro lote revelou expectativa global de número incompatível com a migração36, que numera por depósito. Corrigido apenas o teste: a contratação seguinte usa depósito/gestor do vencedor da corrida e criação/conferência/cancelamento usam o owner correspondente. Execução final com `PC04_SQL_TESTS=YES`, `PC04_SQL_SERVER=localhost\SQLEXPRESS`, `node --test integration/pc04.integration.mjs`: **1/1 PASS**, sem skip (~122s). O **depósitoB venceu**, exercitando o ramo anteriormente problemático. Passaram escopo, permissões, horários/aprovação, revisão, liberação, cancelamento e preservação do pagamento. As chamadas concorrentes de acesso/PC04 não têm a barreira SQL determinística da FIN03.
- **FIN03:** o primeiro lote atingiu240s. A instrumentação localizou a espera antes das operações de pagamento; uma retomada passou em231s. A fixture passou a semear catálogo e inicialização em transação única, como ACCESS/PC04, com commit antes de completeSetup e rollback em falha. Fases agora mostram duração e erros HTTP identificam rota/categoria sem cookies/corpo. O limite diagnóstico inicial15s interrompeu uma chamada posterior; requisições com anexo grande passaram a ter60s, mantendo240s globais e todas as asserções. Execução final `FIN03_SQL_TESTS=YES node --test integration/fin03.integration.mjs`: **1/1 PASS**, sem skip (~22s), catálogo preparado em~1s. Isso comprova o fluxo funcional, sem estabelecer SLA ou atribuir toda a variação de latência a uma única causa.
- **Provas financeiras finais:** cadeia SQL **84 → 57 → 60** em espera por APPLICATION lock antes da liberação; mesma baixa nas duas confirmações, um anexo/auditoria; índice único recusou duplicação SQL; rollback integral e retry únicos; upload/download real de5MB, correções e suas recusas passaram. Serviço financeiro/schema não foram alterados.
- **Conexão após as mutações:** `node --test pilot-local/connection.integration.mjs`: **3/3 PASS**, sem skip. Identidade da máquina/instância e conexão master via Windows conferidas; destino legado recusado e diagnóstico readonly aprovado.
- **Limpeza final:** consulta ao master encontrou **zero bancos sintéticos**, igual ao baseline. Nenhum processo PC04/FIN03 remanescente. Nenhum banco instalado ou operacional foi usado pelas fixtures.
- **Regressão reutilizada com equivalência verificada:** `validateFullRegression(report, regressionInputs(runtimeInputs()), regressionTests())` aceitou os hashes/lista atuais do relatório da prioridade7:410/410testes,719arquivos sem erro de sintaxe e7/7piloto/gate/conexão. As únicas mudanças desta etapa são nas integrações opt-in PC04/FIN03; não alteram o inventário do gate. Sintaxe direta dos dois arquivos alterados e diff check aprovados.
- **Revisão independente:** agente `review_seg01`, GPT-6.1Sol, somente leitura: detectou e confirmou correção de uma conferência PC04 ainda presa ao gestorA; parecer final **PASS**, sem achados materiais. Revisou fontes e suficiência dos resultados executados pelo principal; não repetiu SQL.

O lote inicial6testes teve4PASS,1FAIL e1cancelamento; esses resultados não foram convertidos em aprovação. As duas integrações afetadas foram corrigidas/diagnosticadas e reexecutadas separadamente com PASS e limpeza confirmados. As demais suítes SQL históricas, enrollment pela UI, identidade runtime restrita e recuperação de backup continuam fora deste aceite. Sem commit, push ou deploy.

## Falhas na validação — histórico da auditoria inicial

| ID | Falha observada | Consequência |
|---|---|---|
| QA-01 | O comando principal passou nos 379 testes de `tests/`. O Super QA ampliado encontrou quatro falhas em arquivos de `integration/` fora desse comando. | Usar somente `npm test` como critério de liberação deixa essas falhas invisíveis. O registro local do Super QA foi criado durante a auditoria. |
| QA-02 | Dois testes de filial exigem cadastrar um código de um caractere e editar a filial com controle de concorrência. O código atual removeu esse cadastro. | Os testes falham em um contrato aposentado. Alinhar a expectativa com o cadastro vigente, preservando a verificação de concorrência na operação que o substituiu. |
| QA-03 | O teste de confirmação de cadastro para em `Option is not defined`. O ambiente de navegador simulado não fornece a API usada pela tela. | A execução termina antes de verificar se os campos são preservados e se a gravação espera confirmação. O resultado não estabelece falha do navegador do usuário. |
| QA-04 | A prévia visual importa o Playwright por um caminho absoluto no perfil Windows de outro usuário. | No clone desta máquina, o teste falha antes de abrir a prévia. Resolver a dependência pelo projeto ou ambiente e repetir a navegação em navegador real. |
| AMB-01 | A validação nativa do piloto teve duas falhas na conexão com o banco. As suítes específicas de solicitação, contratação e baixa também pararam no primeiro acesso ODBC. O ambiente não tinha o Driver 18 e a instância local SQL Express esperada. | Os cenários dependentes do banco não chegaram às asserções de negócio. Reexecutar com SQL Express e ODBC Driver 18 em instância local de testes com dados sintéticos. |

Os anexos da rodada inicial não foram localizados. Provas atuais disponíveis: [descoberta e integridade do gate](../tests/test-discovery.test.mjs), [cadastro vigente e conflito de edição](../integration/branch-edit.unit.test.mjs), [confirmação do cadastro](../integration/mfa-enrollment-ui.unit.test.mjs), [prévia em navegador](../integration/preview-ui.test.mjs) e [resultado atual da regressão](../pilot-local/regression.json). Esses registros correspondem às validações posteriores, não reproduzem os anexos históricos ausentes.

## Onde o processo parou e quem pôde prosseguir

O cenário enviou **28 requisições HTTP**, usando um solicitante anônimo e quatro sessões autenticadas. Login, cookies, rotas e lógica dos serviços foram executados pelo portal. Os usuários, vínculos, resultados das consultas e gravações foram simulados na camada ODBC.

| Etapa e persona | Resultado observado |
|---|---|
| Solicitação pública | O pedido válido recebeu 202. Incluir a função ADMIN no próprio pedido recebeu 400. O login antes da aprovação recebeu 401. |
| Aprovação do acesso | Anônimo recebeu 401 e gestor recebeu 403. ADMIN aprovou com 201. Uma segunda decisão sobre a mesma solicitação recebeu 409. O solicitante conseguiu entrar como gestor. |
| Contratação | Financeiro recebeu 403 ao tentar contratar. Gestor A recebeu 403 para o depósito B e 201 para o seu depósito. |
| Horário manual e conferência | Gestor A informou os horários. Conferir antes da aprovação recebeu 409 e aprovar o próprio apontamento recebeu 403. Após o ADMIN aprovar, o gestor conseguiu conferir e liberar. **Se nenhum ADMIN estiver disponível, uma contratação com horário manual pendente fica aguardando nessa etapa.** O bloqueio observado corresponde à regra implementada. |
| Recibo e baixa | Gestor A recebeu 403 tanto para emitir recibo quanto para dar baixa. Gestor B recebeu 404 ao consultar o pagamento da contratação do depósito A. Uma tentativa anônima de baixa recebeu 401. Financeiro conseguiu emitir o recibo e confirmar o pagamento. |
| Confirmações repetidas | Financeiro e ADMIN enviaram a mesma confirmação em paralelo. Ambos receberam 200 com o mesmo identificador. Outra repetição manteve uma única baixa e um anexo na simulação. Confirmar com arquivo diferente recebeu 409. |

Nenhuma das ações indevidas exercitadas foi aceita no cenário. O resultado para o depósito B dependeu de respostas SQL simuladas. A baixa usa um bloqueio transacional no serviço e o esquema define um índice único por contratação para baixas ativas. O teste simulado não executa esses mecanismos. A prova pendente exige duas sessões concorrentes, leitura posterior das linhas gravadas e verificação de rollback após falha. O pagamento testado é o registro de uma baixa externa no portal.

O arquivo e os anexos do cenário simulado original de 28 chamadas não foram localizados; sua descrição acima permanece histórica. As provas posteriores estão nos testes SQL de [solicitação de acesso](../integration/access-requests.integration.mjs), [contratação](../integration/pc04.integration.mjs) e [baixa](../integration/fin03.integration.mjs). Fontes atuais: [serviço de baixa](../src/fin03.js) e [índice de unicidade](../pilot-local/fin03-payments.sql).

## Alcance dos resultados — histórico da auditoria inicial

| Execução | Resultado |
|---|---|
| Super QA ampliado, 51 arquivos | 393 passaram, 4 falharam, nenhum pulado. |
| Suíte principal e sintaxe | 379 testes passaram. 717 arquivos passaram na verificação de sintaxe. |
| Etapa adicional do piloto | 5 de 7 passaram. As 2 falhas foram de conexão SQL. |
| Super QA focal por persona, 3 arquivos | 78 passaram, nenhum falhou ou foi pulado. Esse total inclui os testes de contas e contratações e um cenário encadeado de 28 chamadas. |

As execuções históricas têm testes em comum e seus totais não devem ser somados. Os limites originais foram parcialmente superados pelas prioridades 1 a 8: concorrência/rollback financeiro e cenários de permissão já têm prova SQL real; a prévia tem prova de navegador. Para as pendências atuais e a decisão de adiar a nova validação de backup/restore, consultar o estado consolidado no início deste documento.
