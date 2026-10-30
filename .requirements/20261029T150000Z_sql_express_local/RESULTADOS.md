# Resultado da preparacao local — 29/10/2026

Configuracao aplicada a `localhost\SQLEXPRESS`, autenticacao Windows e ODBC Driver 18. SQL confirmou a instancia `PAT-3010\SQLEXPRESS`, Express 64 bits. Dependencias instaladas conforme package-lock, sem alteracao do lockfile.

## Evidencias

- Red real: conexao padrao falhou tentando Ferretti (ODBC 08001/HYT00).
- Green: `node --test pilot-local/connection.integration.mjs pilot-local/unit.test.mjs`: 5 aprovados. Inclui conexao real, recusa do banco legado e diagnostico em clone sem plan.json. O diagnostico teve red por plan.json ausente antes da correcao.
- Manifesto: hashes dos 28 SQLs conferidos; instalacao completa em banco temporario aprovada.
- `node pilot-local/integration.mjs`, com SQL sintetico habilitado e runtime Playwright local: PASS, 16 verificacoes; inclui login, MFA, navegador desktop/mobile, cadastros, perfis, abrangencias, operacao, persistencia, backup com checksum, restore, DBCC CHECKDB e reconciliacao. Cleanup confirmado. A primeira tentativa falhou no backup antes da aplicacao das ACLs; repeticao apos ACLs aprovada. Evidencia local: pilot-local/integration-evidence.json.
- `node scripts/check-all.mjs`: 646 arquivos, zero erros de sintaxe; arquivos alterados em pilot-local tambem verificados por node --check.
- `node scripts/test-all.mjs`: 301 aprovados, 1 arquivo de teste falhou ao importar modulo ausente. Nao foi declarado PASS.
- `git -c core.whitespace=cr-at-eol diff --check`: aprovado, preservando CRLF existentes.
- Identidade inicial salva em secrets/pilot-local/administrator.json, ignorado pelo Git. ACLs concedem acesso privado ao usuario, SYSTEM e administradores; servico SQL tem travessia na pasta privada e Modify somente em backups.

## Pendencias que impedem instalar o piloto persistente

1. `tests/pc09.test.mjs` ja esta no HEAD, mas `src/pc09-routes.js` e `src/pc09-document.js` nao estao no clone nem no HEAD. A propria especificacao PC09 registra o teste vermelho por modulo ausente. Nao implementar recibos nem omitir o teste como parte da configuracao SQL.
2. A regressao integral deve passar antes de produzir `release.json` com status de liberacao. Nao fabricar relatorio nem contornar assertReleaseReady.
3. O Windows PowerShell recusou executar protect-private.ps1 por politica de execucao. Nenhuma politica foi modificada. ACLs da preparacao local foram aplicadas diretamente por icacls, mas a chamada do instalador continua sujeita a politica e requer tratamento antes da instalacao.

## Estado final

Nenhum banco persistente do portal criado, nenhum runtime privado gerado e nenhum servidor do portal deixado ativo. Os bancos sinteticos do ensaio e da restauracao foram removidos. Backups sinteticos verificados permanecem na pasta privada. Conexao e schema foram homologados neste ambiente, mas a entrega ainda nao esta liberada para inicializacao persistente.
