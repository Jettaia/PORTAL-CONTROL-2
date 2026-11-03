# Banco de dados

## Exclusão de contas — 03/11/2026

Cadastro → Usuários oferece Excluir além da edição/inativação. A exclusão exige confirmação e ADM autenticado, remove a conta do catálogo, revoga sessões, convites e permissões e bloqueia edição/reativação/redefinição de senha. A própria conta e o último ADM ativo são protegidos. Identidade, auditoria e referências históricas permanecem; o e-mail da conta excluída continua reservado. Inativação permanece reversível pelo editor.

A migration aditiva `38-delete-account.sql` acrescenta `ExcluidoEmUtc` e `ExcluidoPor` a `Seguranca.Usuario`, com restrição que impede ativar contas excluídas. Em instalação local existente, encerre o piloto, execute `node scripts/upgrade-delete-account.mjs` e reinicie pelo launcher habitual. O script exige destino/identidade corretos e backup verificado; compara todos os campos e linhas preexistentes antes do commit. Nenhuma conta é excluída pela migração.

Provas: `DELETE_SQL_TESTS=YES PC01_SQL_SERVER=localhost\SQLEXPRESS node --test integration/delete-account.integration.mjs` para HTTP/SQL descartável e `JETTA_PLAYWRIGHT_ROOT=<node_modules com playwright> node integration/delete-account.visual.mjs` para interação e aparência desktop/mobile.

## Solicitação de acesso — 03/11/2026

No piloto PC-01, a tela de login recebe solicitações com nome e e-mail. Cadastro → Usuários mostra a fila pendente; o ADM aprova definindo senha inicial, funções e depósitos, ou recusa. A senha é informada manualmente pelo ADM ao usuário. Solicitar acesso não cria conta nem credencial. Aprovação/recusa, ator, data e auditoria são persistidos; aprovação e criação da conta pertencem à mesma transação.

A migration aditiva `37-access-requests.sql` cria `Seguranca.SolicitacaoAcesso`. Para atualizar uma instalação local existente, encerre o piloto e execute `node scripts/upgrade-access-requests.mjs`, depois inicie pelo launcher habitual. O script verifica destino e identidade, exige backup verificado e preserva as linhas existentes. Não execute o instalador de banco novo em uma instalação existente. O endpoint público tem limite de solicitações e responde da mesma forma para e-mail já cadastrado ou já pendente.

Provas focais: `ACCESS_SQL_TESTS=YES PC01_SQL_SERVER='localhost\\SQLEXPRESS' node --test integration/access-requests.integration.mjs` em banco descartável, e `JETTA_PLAYWRIGHT_ROOT=<node_modules com playwright> node integration/access-requests.visual.mjs` para interação/visual com HTTP sintético. Não há envio automático de e-mail, push ou deploy neste fluxo.

## Regressão vigente — aposentadoria PC-09 (30/10/2026)

O PC-09 antigo foi substituído pelo FIN-02/03. Seus assets, ensaio visual e teste de módulos ausentes foram retirados. URLs antigas continuam bloqueadas; recibos atuais, baixas, anexos, auditoria e as 35 migrações permanecem preservados. PC-08/10/11 não foram excluídos nesta limpeza.

O perfil de exceção sem PC-09 e seu runner foram aposentados. Execute `node scripts/validate-pilot.mjs`: executa a suíte completa de `tests/`, sintaxe e testes do piloto/gate/conexão local, sem exclusões, e grava `pilot-local/regression.json` com escopo `FULL`, lista completa e hashes atuais. Exige SQL Express/ODBC para a verificação de conexão; não instala, migra, limpa ou inicia o banco operacional.

O verificador de liberação exige escopo `FULL` também em `release.json`, regressão atual e integração atual com limpeza confirmada. Relatórios antigos, inclusive `regression-without-pc09.json`, são históricos e não liberam instalação. O runner não gera `release.json` nem renova evidências SQL/recuperação automaticamente. Suíte verde não é aprovação de produção.

Os registros de 29/10 abaixo descrevem o estado histórico anterior ao financeiro atual e à aposentadoria do PC-09; seus comandos e pendências não são o roteiro vigente.

## SQL: recuperação atual e identidade restrita (30/10/2026)

O ensaio de recuperação agora trata também as autorizações permanentes de `Operacao.TabletPC05` e os tokens pendentes de `Operacao.ContratacaoToken`, além das sessões, convites e contextos antigos. As revogações são transacionais, preservam tokens consumidos e são permitidas somente em banco sintético identificado pelo nome, marcador de teste e identidade da instalação. Não executar invalidação ou restauração no banco operacional por esse mecanismo de ensaio.

Prova atual: `SQL_RECOVERY_TESTS=YES node --test integration/recovery-current.integration.mjs`, 1/1 PASS com backup CHECKSUM, restore, CHECKDB completo, reconciliação dos dados, rollback por falha real de auditoria e consumidores PC05/FIN02/03. Credenciais anteriores foram recusadas, novo login/pareamento funcionaram, recibo/baixa/anexo foram preservados. Fonte e destino sintéticos removidos. O banco operacional não foi restaurado nem alterado nessa validação.

A separação entre bootstrap administrativo e servidor HTTP restrito está preparada em [SQL-RUNTIME.md](SQL-RUNTIME.md), com grants testados em SQL isolado. A conta Windows dedicada, ACLs efetivas e autenticação do processo sob essa identidade ainda dependem da etapa elevada documentada: a sessão atual não é administradora do Windows. O processo instalado mantém a identidade anterior até esse corte. Não declarar o bloqueio de privilégios resolvido antes da prova real da nova identidade.

## Piloto atual — branch main

O piloto utiliza SQL Server, banco `JETTA_CONTROL_PILOTO_LOCAL`, autenticação integrada do Windows e ODBC Driver 18. A aplicação permanece em localhost. O financeiro registra pagamentos externos por contratação, com recibo individual e evidência assinada; não executa pagamentos bancários.

Versionamos estrutura e código SQL, não o banco instalado. Incluímos:

- `pilot-local/sql/manifest.json` e seus 35 arquivos SQL ordenados e identificados por SHA-256;
- `pilot-local/build-schema.mjs` e `operational.sql`, que geram essa estrutura;
- os 20 SQLs de origem em `integration/`, além de scripts de teste e rollback existentes;
- `pilot-local/database.mjs`, `install.mjs` e `seed-catalog.mjs`.

O manifesto aplica fundamentos, RBAC, operação, MFA, patches B3, módulos B4/B5, administração e estrutura operacional do piloto, nessa ordem. O seed cria permissões e perfis; não transporta usuários nem cadastros operacionais existentes.

O instalador existente exige banco novo e vazio, valida hashes, habilita CHANGE_TRACKING e aplica o schema em transação. Ele cria também as tabelas de inicialização e versão. Não aplique os scripts manualmente a um banco existente nem use a pasta `sql/` legada como substituto do manifesto.

## Pendências para instalar em outra máquina

1. O piloto, seu diagnóstico e os ensaios SQL usam `localhost\SQLEXPRESS`. Instale essa instância na máquina que executará a API. O instalador busca as ferramentas no perfil Windows atual; `JETTA_PLAYWRIGHT_ROOT` permite informar outra pasta. O servidor legado iniciado por `npm start` continua com sua configuração própria.
2. Homologar novamente e gerar as evidências exigidas por `pilot-local/release-gate.mjs`. Os relatórios locais foram excluídos. O relatório anterior incluía caminho absoluto externo ao projeto; não serve como autorização automática de uma nova instalação.
3. Definir identidade inicial e configuração privada, guardar chaves/tokens fora do Git e verificar permissões de arquivos e do SQL Server. O instalador também executa proteção de diretórios privados.
4. Validar instalação isolada, autenticação/MFA e recuperação antes de autorizar uso operacional.

O diagnóstico local, que consulta somente `master`, pode ser executado depois de instalar as dependências:

```powershell
node scripts/inspect-local-pilot.mjs --sql-readonly
node --test pilot-local/connection.integration.mjs pilot-local/unit.test.mjs
```

O diagnóstico funciona também sem o antigo `pilot-local/plan.json` e registra os bloqueios em `pilot-local/installation-assessment.json`. Não cria o banco nem libera a instalação. O teste de conexão verifica a máquina atual e a instância `SQLEXPRESS`.

Em 29/10/2026, a conexão Windows/ODBC com a instância local foi validada, assim como a integridade das 28 migrações. O ensaio completo em banco temporário passou nas 16 verificações, incluindo fluxos funcionais, backup, restauração e CHECKDB; os bancos de teste foram removidos. A instalação persistente permanece pendente: a suíte geral contém `tests/pc09.test.mjs`, mas o clone não contém `src/pc09-routes.js` nem `src/pc09-document.js`. Não gerar uma liberação enquanto a regressão integral não estiver aprovada. Os detalhes desta preparação estão em `.requirements/20261029T150000Z_sql_express_local/RESULTADOS.md`.

O instalador também executa `protect-private.ps1`. Nesta máquina, a política do Windows PowerShell recusou a execução desse arquivo; essa pendência deve ser resolvida antes da instalação. Nenhuma política foi alterada. A pasta privada local foi protegida diretamente com ACLs e a identidade inicial foi salva fora do Git.

## Atualização de escopo local em 29/10/2026

O usuário autorizou seguir com SQL sem o ticket PC-09. O perfil explícito `LOCAL_PILOT_WITHOUT_PC09` executa todos os testes de `tests/` exceto `tests/pc09.test.mjs`, que permanece intacto e continua fazendo parte da suíte integral. Não há aprovação integral de recibos. A instalação mantém `pc09:false` e a configuração de runtime não habilita esse módulo; o trabalho parcial de interface foi preservado.

Validação reproduzível do perfil: `node scripts/validate-pilot-without-pc09.mjs`. O relatório `pilot-local/regression-without-pc09.json` identifica a exclusão e vincula os resultados aos hashes do runtime, testes e runner. A liberação exige também o ensaio SQL atual com backup, restauração, CHECKDB e limpeza. A política `Bypass` do script de ACL aplica-se somente ao subprocesso do instalador, sem alteração persistente do Windows.

As jornadas SQL reais PC-01/02/03/04/05/07/08/10 foram executadas em bancos descartáveis; PC-11 foi validado no percurso de PC-10. Foram corrigidos IDs `BIGINT` internos e serialização de auditoria, além de fixtures incompatíveis com o schema atual. As evidências locais estão em `pilot-local/tickets-sql-final.txt` e `pilot-local/tickets-sql-final-remaining.txt`; o resultado final da instalação está em `.requirements/20261029T163000Z_sql_without_receipts/RESULTADOS.md`.

Instalação concluída: 28 migrations, health `UP`, banco permanente sem fixtures, financeiro simulado e configuração de senha pendente do usuário. Portal em `http://127.0.0.1:3211/`. Ensaio atual de recuperação aprovado com 16 verificações e limpeza confirmada; perfil de regressão sem PC09 aprovado com 304 testes. Reabrir pelo iniciador `node pilot-local/start.mjs --open`, que confere a instância e realiza backup antes de iniciar.

## Versão anterior — branch antigo

Usa o banco `JETTA_CONTROL`, com scripts históricos 601/602/603/690. Esses arquivos não reconstituem todo o banco instalado: faltam definições históricas de objetos. A branch preserva código antigo e registra essa lacuna; não constitui um pacote de instalação completo.

## Arquivos privados

Atualização local de 29/10/2026: Depósito substitui Filial como única unidade de cadastro, operação e autorização. A migration `29-depot-model.sql` é aplicada após os schemas históricos e exige dados de negócio vazios para remover a entidade antiga. Nome, CentroCusto, Rua, Numero, Bairro, Cidade, Estado e CEP são obrigatórios. Gestores dependem de vínculos explícitos em UsuarioDeposito. No financeiro de contratações, FINANCEIRO e ADMIN operam todos os depósitos; o acesso amplo não amplia permissões operacionais ou cadastrais.

O usuário autorizou a limpeza do piloto preservando a conta ADMIN existente. A ferramenta explícita `scripts/reset-local-depots.mjs --reset-data-preserve-admin` exige piloto parado, confere instância, verifica backup, executa transação e conserva a credencial sem mudar a senha. Não executar essa ferramenta como atualização de rotina: ela exclui os demais usuários e dados de negócio. `scripts/upgrade-local-catalog.mjs` aplica somente o modelo de forma idempotente e recusa dados legados pendentes; não executa limpeza. `scripts/verify-local-depots.mjs` verifica, sem escrita, o estado vazio esperado imediatamente após a limpeza.

Não versionar `.env`, `secrets/`, identidade de administrador, runtime, sessões, perfis do navegador, exports e backups (`.bak`, `.mdf`, `.ldf`, `.trn`, dumps). A recuperação de dados reais deve seguir um processo separado e autorizado.

## Financeiro de contratações — FIN-04 (30/10/2026)

O piloto usa FIN-01/02/03: fila única, recibo individual e baixa integral com recibo assinado. Rotas e páginas financeiras antigas ficam desativadas, inclusive extratos, ajustes, recibos agrupados e ferramentas laboratoriais. A liberação operacional deixa de escrever no ledger PC10. Instalações novas aplicam os schemas históricos e a substituição final pelo manifesto, sem reativar esses módulos.

Em atualizações, encerrar o piloto e aplicar `scripts/upgrade-fin02.mjs` (migração 33) com `JETTA_FIN02_UPGRADE=YES`, depois `scripts/upgrade-fin03.mjs` (34) com `JETTA_FIN03_UPGRADE=YES`, e `scripts/upgrade-fin04.mjs` (35) com `JETTA_FIN04_UPGRADE=YES`. Cada script exige instância local identificada, porta parada e backup verificado. O FIN-04 exclui somente a lista explícita de tabelas financeiras antigas e reconcilia `PagoEmUtc` com a baixa ativa nova. Preserva os registros FIN-02/03, auditoria, contratações, cadastros e vínculos. Não usar o reset amplo de depósitos para essa atualização.

O iniciador recusa abrir o novo financeiro sem tabelas de recibo/baixa e marcador `JETTA_FIN04_RESET=1`. Configurações privadas antigas com `finance: SIMULADO` continuam legíveis, mas não reativam as flags financeiras aposentadas. Configurações novas usam `REGISTRO_EXTERNO`. O registro da aplicação e das provas está no ticket FIN-04 em `.scratch/financeiro/issues/04-substituicao-legado-integracao.md`.


## Numeração das contratações por depósito (migração 36)

A instalação nova inclui `36-contract-numbering.sql`. Para atualizar o piloto existente, encerre-o pelo mecanismo normal (`secrets/pilot-local/encerrar.sinal`) e execute `node scripts/upgrade-contract-numbering.mjs`; depois inicie com `node pilot-local/start.mjs`. O atualizador recusa piloto ativo, verifica backup, confere a identidade da instalação e executa a migração em transação.

Na primeira execução, as contratações são renumeradas desde 1 dentro de cada depósito, ordenadas por `CriadoEmUtc, ContratacaoId`. `Operacao.ContratacaoNumeracaoMigracao` preserva `ContratacaoId`, depósito, número anterior e novo. Reexecuções não renumeram novamente. IDs, versões, pagamentos, eventos e recibos já emitidos permanecem intactos; documentos históricos conservam a numeração da emissão. A unicidade agora é `(DepositoId, Numero)` e novas contratações seguem o maior número do depósito, incluindo canceladas. A paginação PC04 usa o ID interno; filtros por número podem retornar vários depósitos.

Para recuperação, use o backup verificado e o mapa de numeração. Não volte somente o código antigo: ele depende do default global removido. Inserts SQL de manutenção também precisam informar `Numero` explicitamente e respeitar a mesma transação/lock da API.
