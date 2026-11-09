# Portal Control

Portal mais recente da Jetta, preservado na branch `main`. A branch `antigo` contém a versão anterior B2.5. O código desta branch veio de `Jetta_Control_B2_2_v1.0.0/lab-b4-2`, versão declarada `7.0.0-lab.2`.

## Conteúdo

- `src/` e `public/`: API e interface.
- `package.json` e `package-lock.json`: comandos e dependências Node.
- `tests/`, `integration/` e `scripts/`: testes, schemas de origem e ferramentas existentes.
- `pilot-local/`: aplicação do piloto, instalador, gerador de schema e catálogo de permissões.
- `sql/`: scripts legados; não representam uma instalação completa do portal.
- [Banco de dados](docs/BANCO-DE-DADOS.md): requisitos, ordem de instalação e limitações.

## Desenvolvimento

Requer Node.js >=20. Após instalar as dependências com `npm ci`, os comandos sem banco são:

```powershell
npm run check
npm test
node --test pilot-local/unit.test.mjs
```

O pacote `odbc` também exige o ambiente nativo compatível. O acesso ao SQL Server requer Microsoft ODBC Driver 18.

`npm test` descobre automaticamente os arquivos `*.test.js` e `*.test.mjs` na raiz de `tests/` e `integration/`, usando o mesmo inventário do gate do piloto. Inclui os testes de UI simulada e a prévia em navegador headless. Playwright está fixado no lockfile como dependência de execução, pois também gera os PDFs de contratações. No Windows a prévia e a exportação PDF usam Microsoft Edge instalado; nas demais plataformas usa o Chromium do Playwright (`npx playwright install chromium`). Para escolher outro canal instalado, defina `PLAYWRIGHT_CHANNEL` (por exemplo, `chrome`). Qualquer falha é propagada no código de saída, inclusive dependência/navegador ausente. Não é necessário abrir o navegador interativamente.

`npm start` executa o servidor legado, com configuração `.env` e destino `JETTA_CONTROL`; não é o iniciador do piloto mais recente. O piloto instalado usa `node pilot-local/start.mjs`, configuração privada em `secrets/pilot-local/runtime.json`, acesso local em `127.0.0.1:3211` e registro de pagamentos externos por contratação, sem execução bancária. A atualização financeira exige migrações 33, 34 e 35 em ordem, com piloto parado e backup verificado; veja `docs/BANCO-DE-DADOS.md`. Não copie configurações privadas de outra máquina nem execute o instalador como roteiro de produção.

## Regressão integral do piloto

O PC-09 antigo foi aposentado em favor do FIN-02/03. Execute `npm run test:release` (ou `node scripts/validate-pilot.mjs`) para validar o inventário compartilhado de `*.test.js/mjs` em `tests/` e `integration/`, a sintaxe e os testes do piloto/gate/conexão SQL local. Requer navegador da prévia, SQL Express e ODBC; gera `pilot-local/regression.json` com escopo `FULL`. O gate exige exit zero, todos os testes aprovados e nenhum skip/TODO/cancelamento; para na primeira etapa reprovada. A lista e os hashes dos testes de `integration/` fazem parte da evidência, invalidando relatórios antigos que os omitam. Não gera liberação de instalação nem aprovação de produção. Relatórios históricos do perfil sem PC-09 não são aceitos pelo gate atual.

Os arquivos `*.integration.mjs` de SQL permanecem opt-in nos comandos específicos e não são ativados em massa por esse gate. Incluem suítes históricas e precisam de sua configuração isolada; o escopo `FULL` acima refere-se às etapas descritas, não homologa todas as integrações SQL ou jornadas de navegador. Por exemplo, a prova FIN03 executa com `$env:FIN03_SQL_TESTS='YES'; node --test integration/fin03.integration.mjs` em banco sintético descartável.

## Identidade SQL

A preparação da conta Windows restrita, a separação dos iniciadores e os limites da aplicação local estão documentados em [SQL-RUNTIME.md](docs/SQL-RUNTIME.md). A conta e suas ACLs exigem a etapa administrativa indicada; os scripts não ativam essa identidade automaticamente.

## Limites desta entrega

Este repositório preserva os fontes, sem dados operacionais, credenciais, dependências instaladas, backups, capturas ou relatórios de execução locais. O instalador exige evidências de liberação que não são transportadas: `pilot-local/release.json`, `integration-evidence.json` e um relatório de regressão. A geração e validação dessas evidências, assim como a configuração da instância SQL, precisam ser tratadas antes de uma nova instalação. Nenhum gate foi removido ou contornado.

Ferramentas históricas de relatório, UAT e regressão podem depender da antiga estrutura de pastas, arquivos gerados, caminhos locais e commits do repositório de origem. Não há garantia de execução desses comandos no clone limpo. Os testes unitários são verificados separadamente; homologação SQL e navegador não fazem parte da preparação do commit.

O histórico anterior não foi importado. Os arquivos de aplicação foram copiados sem alterações de lógica. A mensagem do commit inicial é `Inicial`.
