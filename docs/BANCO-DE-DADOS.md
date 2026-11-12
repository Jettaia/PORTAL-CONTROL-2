# Banco de dados

## Recibos por período — 09/11/2026

Em Financeiro, ADMIN e FINANCEIRO podem informar Serviço desde/até e usar **Gerar recibos do período**. A prévia inclui ambas as datas e todas as contratações liberadas sem recibo, inclusive além da página atual. Depósito, prestador e número são opcionais; Situação não restringe esse lote. A tela mostra quantidade, total exato e quantos recibos existentes ficam fora da geração. Cancelar a prévia não escreve.

**Confirmar geração** processa individualmente os registros conferidos. A prévia assinada fica vinculada ao usuário por 15 minutos; dados de origem alterados exigem nova prévia. Sessão, perfil, MFA e origem continuam validados. Emissões concorrentes e tentativas repetidas reutilizam recibos existentes, mantendo snapshot/data originais. Falhas são informadas por contratação; os sucessos ficam salvos e os pendentes podem ser tentados novamente. A emissão não confirma pagamento.

**Imprimir recibos gerados** abre a impressão conjunta, com um recibo por página, e permite salvar como PDF no navegador. A impressão usa os snapshots existentes e valida todos os registros pedidos antes de entregar o documento. O CSS é servido por rota autenticada para respeitar a política de segurança da janela de impressão; não há escrita no banco nessa operação.

Não há migração. O lote reutiliza a tabela, unicidade e auditoria FIN02 existentes. Endpoints: `GET /api/financeiro/recibos/previa`, `POST /api/financeiro/recibos/gerar`, `POST /api/financeiro/recibos/impressao` e CSS autenticado `GET /api/financeiro/recibos/estilo.css`. O corpo dessas operações aceita até 2 MiB; períodos cujo comprovante de prévia exceda o limite exigem divisão em períodos menores, sem truncamento silencioso.

Provas: `node --test tests/fin02-batch.test.mjs integration/fin02-batch-ui.test.mjs` e `FIN02_BATCH_SQL_TESTS=YES node --test integration/fin02-batch.integration.mjs`. A integração usa SQL descartável, autorização real, mais de 100 registros, rollback por falha de auditoria, retry/concorrência e impressão em navegador autenticado com PDF nativo. Nenhum recibo operacional é emitido pela validação.

## Exclusão direta de tablets — 09/11/2026

Na aba Tablets, ADMIN pode excluir qualquer tablet cadastrado, inclusive ativo ou aguardando ativação. A confirmação informa o encerramento do acesso e a preservação dos apontamentos. Revogação e exclusão lógica são gravadas juntas: `RevogadoEmUtc` é preservado/preenchido, `ExcluidoEmUtc` é marcado e os hashes de sessão/pareamento são limpos. Tokens consumidos, apontamentos e histórico continuam intactos. GESTOR e FINANCEIRO não podem excluir.

Sessão, mesma origem, MFA, trava transacional e auditoria existentes continuam obrigatórios. Falha na auditoria reverte também a exclusão e a revogação. Não há nova migração: usa a estrutura de `39-delete-tablet.sql` já existente; não executa limpeza nem exclusão física de dados.

Provas focais: `node --test tests/pc05.test.mjs integration/tablet-deletion-ui.test.mjs` e `JETTA_B3_RUN_SQL_TESTS=YES JETTA_B3_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/tablets.integration.mjs`, exclusivamente em banco descartável.

## Previsão e múltiplas contratações — 09/11/2026

A data operacional da contratação passa a ser derivada da entrada prevista; o formulário não solicita outra data. ADMIN e GESTOR com acesso ao depósito podem editar entrada/saída previstas na contratação aberta, com MFA, versão e auditoria. Liberação, pagamento, cancelamento e solicitação pendente mantêm os bloqueios existentes. Após registrar horários reais, a previsão pode mudar de horário, mas deve preservar o dia do serviço.

A migração `40-contract-planning.sql` remove somente a exclusividade prestador/dia e acrescenta um índice não exclusivo e a ação histórica `PREVISTOS`. Preserva IDs, números, horários, valores e todo o histórico. Permite vários acordos no mesmo dia, inclusive após a liberação de outro acordo.

Para instalação existente, com o piloto encerrado, executar `node scripts/upgrade-contract-planning.mjs` e iniciar pelo launcher habitual. O atualizador confere instalação e destino, exige backup verificado, aplica em transação e compara o conteúdo de todas as tabelas antes do commit. Pode ser repetido. Nesta máquina, a atualização foi aplicada com backup verificado e 74 tabelas preservadas. Novas instalações recebem a migração pelo manifesto.

Rollback do aplicativo pode manter o schema expandido, que preserva os campos antigos. Não recriar a exclusividade ou a restrição antiga de eventos depois de existirem repetições ou eventos `PREVISTOS`; a reversão dessas restrições exige reconciliação explícita dos dados. Falha durante a migração reverte a transação automaticamente.

Provas: `PC04_SQL_TESTS=YES PC04_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/pc04.integration.mjs` (HTTP autenticado e SQL descartável) e `node --test integration/pc04-planned-ui.test.mjs` (UI real, APIs sintéticas, desktop e celular).

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


## Exportação da tabela de contratações (09/11/2026)

O menu Exportar oferece Excel (.xlsx) e PDF em A4 horizontal. Os arquivos usam os filtros aplicados, a mesma ordenação e as permissões da listagem, incluindo todas as páginas. Trazem as oito colunas da tabela, filtros, horário de Brasília, quantidade e soma dos valores exibidos. Não incluem a ação Editar. Alterações nos filtros precisam ser aplicadas antes da exportação.

ADMIN consulta o escopo global; GESTOR consulta os depósitos vinculados; FINANCEIRO consulta somente as contratações LIBERADAS dos depósitos vinculados, conforme o PC04. A geração é somente leitura e não altera contratações, recibos ou auditoria de negócio. Não requer migração. Limites explícitos: 100.000 registros no Excel e 10.000 no PDF; acima disso, refine os filtros. O PDF permite uma geração simultânea por processo.

Playwright agora integra as dependências de execução. No Windows requer Microsoft Edge instalado; em outras plataformas, o Chromium do Playwright. A planilha mantém datas e valores usuais como células nativas; valores acima da precisão segura do Excel são preservados como texto, com aviso no próprio arquivo. Esta entrega permanece somente local, sem publicação.


## Exportação da tabela financeira (09/11/2026)

O financeiro oferece o mesmo menu Exportar, em Excel e PDF, com todas as páginas dos filtros aplicados (número, depósito, prestador, início, fim e situação). O período considera a data do serviço. O arquivo contém Número, Prestador, Depósito, Atividade, Data do serviço, Valor liberado, Liberação em Brasília e Situação; as ações de consulta e recibo não são colunas do relatório. O total soma o valor liberado.

O acesso segue o FIN01: ADMIN e FINANCEIRO consultam todos os depósitos; GESTOR somente os vinculados. A exportação inclui somente contratações elegíveis na fila financeira e não emite recibos nem confirma pagamentos. Reutiliza os geradores e limites de exportação acima, sem migração ou dependência adicional. Tudo permanece local.


O filtro Data do serviço em Contratações agora oferece De e Até, com ambas as datas incluídas. Somente De consulta a partir dessa data; somente Até consulta até essa data; os dois vazios não restringem a data. Intervalos invertidos são recusados sem descartar o rascunho. Excel e PDF usam esse mesmo período aplicado em todas as páginas. A API mantém dataServico individual por compatibilidade e aceita inicio/fim para o intervalo.

## Notificações de horários manuais (12/11/2026)

A migração aditiva 44 (`pilot-local/notifications.sql`) cria `Seguranca.NotificacaoLeitura`, com leitura por usuário, solicitação e tipo de aviso. Os avisos são derivados das solicitações existentes: ADM consulta todos os depósitos; coordenador somente os autorizados; o solicitante recebe o resultado dentro de seu acesso atual. Ler um aviso não decide a solicitação. O sininho abre o detalhe atual na aba Horários e atualiza a consulta a cada 30 segundos enquanto a página está visível.

Para atualizar outra instalação local existente, encerre o piloto e execute `node scripts/upgrade-notifications.mjs`; o script exige instância local, verifica backup e preserva conteúdo e contagem das tabelas existentes. Depois inicie pelo lançador habitual. Instalações novas incluem a migração 44 no manifesto. A atualização foi aplicada apenas no piloto local deste computador, sem publicação remota.
