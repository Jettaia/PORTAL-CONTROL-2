# Banco de dados

## Piloto atual — branch main

O piloto utiliza SQL Server, banco `JETTA_CONTROL_PILOTO_LOCAL`, autenticação integrada do Windows e ODBC Driver 18. A aplicação permanece em localhost e o financeiro é simulado.

Versionamos estrutura e código SQL, não o banco instalado. Incluímos:

- `pilot-local/sql/manifest.json` e seus 21 arquivos SQL ordenados e identificados por SHA-256;
- `pilot-local/build-schema.mjs` e `operational.sql`, que geram essa estrutura;
- os 20 SQLs de origem em `integration/`, além de scripts de teste e rollback existentes;
- `pilot-local/database.mjs`, `install.mjs` e `seed-catalog.mjs`.

O manifesto aplica fundamentos, RBAC, operação, MFA, patches B3, módulos B4/B5, administração e estrutura operacional do piloto, nessa ordem. O seed cria permissões e perfis; não transporta usuários nem cadastros operacionais existentes.

O instalador existente exige banco novo e vazio, valida hashes, habilita CHANGE_TRACKING e aplica o schema em transação. Ele cria também as tabelas de inicialização e versão. Não aplique os scripts manualmente a um banco existente nem use a pasta `sql/` legada como substituto do manifesto.

## Pendências para instalar em outra máquina

1. Revisar a instância fixa `Ferretti\SQLEXPRESS` em `pilot-local/install.mjs` e `database.mjs`, além dos caminhos locais das ferramentas. Isso requer uma alteração de configuração validada, não apenas copiar um `.env`.
2. Homologar novamente e gerar as evidências exigidas por `pilot-local/release-gate.mjs`. Os relatórios locais foram excluídos. O relatório anterior incluía caminho absoluto externo ao projeto; não serve como autorização automática de uma nova instalação.
3. Definir identidade inicial e configuração privada, guardar chaves/tokens fora do Git e verificar permissões de arquivos e do SQL Server. O instalador também executa proteção de diretórios privados.
4. Validar instalação isolada, autenticação/MFA e recuperação antes de autorizar uso operacional.

Nenhuma dessas etapas foi executada nesta preparação. Não houve conexão, exportação, migração, alteração ou cópia do banco.

## Versão anterior — branch antigo

Usa o banco `JETTA_CONTROL`, com scripts históricos 601/602/603/690. Esses arquivos não reconstituem todo o banco instalado: faltam definições históricas de objetos. A branch preserva código antigo e registra essa lacuna; não constitui um pacote de instalação completo.

## Arquivos privados

Não versionar `.env`, `secrets/`, identidade de administrador, runtime, sessões, perfis do navegador, exports e backups (`.bak`, `.mdf`, `.ldf`, `.trn`, dumps). A recuperação de dados reais deve seguir um processo separado e autorizado.
