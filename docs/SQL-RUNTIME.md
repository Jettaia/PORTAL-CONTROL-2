# Identidade SQL restrita do Portal Control

## Estado desta entrega

O código e os scripts estão preparados. A criação da conta Windows, a aplicação das ACLs e a autenticação real sob essa conta **não foram executadas**: o shell desta sessão não está elevado. A conexão SQL do processo atualmente instalado continua com a identidade anterior até a etapa administrativa abaixo. Esta entrega não declara o bloqueio operacional de privilégios resolvido.

Não se altera o modo Windows-only do SQL, não se reinicia o SQL Server e não se retira `sysadmin` do usuário humano. Os scripts não executam reset de dados nem reinstalam o schema. A constraint de numeração `UQ_PC04_DepositoNumero` já existia no iniciador anterior e foi confirmada por SELECT no piloto; o servidor restrito conserva essa verificação, sem executar upgrade automático.

## Separação

- `scripts/provision-runtime-windows.ps1`: exige Windows PowerShell elevado sob o mesmo usuário humano que usará o launcher. Com o piloto encerrado, valida/gera backup, cria a conta local padrão `JettaControlRuntime`, protege a credencial com DPAPI/CLIXML do usuário humano, aplica ACLs e chama o provisionamento SQL.
- `scripts/provision-runtime-access.mjs`: verifica identidade/estado do banco piloto; cria login Windows, usuário e role `JettaPortalRuntime`. A role recebe somente `SELECT/INSERT/UPDATE/DELETE/EXECUTE` nos schemas Cadastro, Seguranca, Operacao e Financeiro. Não recebe roles de servidor, `db_owner`, DDL, backup ou permissão em outros schemas.
- `scripts/start-restricted-pilot.ps1`: executa backup/bootstrap administrativo e lança `pilot-local/serve-restricted.mjs` em processo separado com a credencial Windows dedicada. Nenhuma senha é passada na linha de comando.
- `pilot-local/serve-restricted.mjs`: apenas HTTP. A abertura e cada conexão `withDb` recusam conta SQL diferente, privilégios administrativos ou resultado desconhecido de permissões. O processo também recusa leitura das credenciais do launcher, identidade inicial administrativa ou diretório de backups.
- `scripts/stop-restricted-pilot.ps1`: sinaliza o processo restrito, aguarda encerramento sem forçar processos e então executa backup sob a identidade administrativa humana.

O iniciador antigo `pilot-local/start.mjs` recusa servir HTTP assim que houver identidade provisionada ou preparação parcial. Não há fallback automático para HTTP com `sysadmin`.

## ACLs

A conta runtime tem leitura/execução de código, dependências, node.exe e leitura do runtime.json. Tem escrita somente em `secrets/pilot-local/runtime-state`. As concessões nos diretórios privados ancestrais permitem travessia, sem herança para backups, credenciais ou identidade administrativa. A pasta launcher é protegida para o usuário humano, SYSTEM e Administradores; nela ficam credencial DPAPI e registro de preparação. Código e node.exe têm escrita negada à conta runtime. Os destinos privados e ancestrais dentro do workspace são conferidos contra redirecionamentos.

Não copiar `credential.xml`, runtime.json, perfis, backups ou arquivos de launcher para o Git ou para relatórios. A senha Windows é gerada no provisionamento, mantida como SecureString e exportada por DPAPI. O launcher deve ser executado pelo mesmo usuário Windows que a exportou, na mesma máquina.

## Aplicação administrativa pendente

1. Encerrar o piloto pelo procedimento oficial existente, aguardando seu backup de encerramento. O provisionador recusa porta ocupada; não encerra processos automaticamente.
2. Abrir **Windows PowerShell de 64 bits como administrador**, usando a elevação do mesmo usuário Windows que administra este checkout. Entrar na raiz do projeto e executar:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\provision-runtime-windows.ps1
   ```

   O script procura node.exe no PATH e no runtime local do Codex. Se necessário, informar `-NodePath` com o caminho absoluto do executável instalado. Não executar com outra conta administrativa: a proteção DPAPI pertence ao usuário que faz a exportação.
3. Conferir o resultado `SQL_RUNTIME_PROVISIONED`. A ferramenta não abre o portal. Em PowerShell normal sob o mesmo usuário humano:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-restricted-pilot.ps1
   ```

4. Validar o servidor, as permissões efetivas da conta e o fluxo autenticado antes de aceitar o corte. Falhas de inicialização ficam em `secrets/pilot-local/runtime-state/stderr.log`; não publicar esse arquivo. `serve-restricted.mjs` falha fechado quando detecta permissões ou ACLs indevidas.
5. Para encerrar e gerar backup administrativo:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-restricted-pilot.ps1
   ```

## Preparação parcial e reversão

`-ExecutionPolicy Bypass` acima aplica-se somente ao novo processo PowerShell que executa o script revisado; não altera a política persistente do Windows.

O provisionador nunca reseta senha de conta existente sem vínculo. Uma execução parcial antes do SQL conserva `launcher/pending-identity.json` (principal e SID) e credencial protegida; reexecução aceita somente essa mesma conta/SID. Não remove nem toma posse de contas preexistentes.

Login/role SQL já existentes causam recusa para revisão manual, sem renovar permissões silenciosamente. Se o commit SQL ocorreu e a gravação final do marcador falhou, a preparação continua parcial e deve ser reconciliada por administrador; o processo HTTP antigo permanece bloqueado pelo registro pending. Não apagar marcadores para contornar o bloqueio. A reversão segura começa por encerrar o HTTP restrito; contas, grants e dados são preservados até decisão administrativa explícita. Não restaurar banco nem remover o acesso administrativo humano como parte dessa reversão.

## Provas e limites

- `node --test tests/sql-runtime.test.mjs tests/runtime-identity-proof.test.mjs pilot-local/unit.test.mjs`: 4/4 PASS. A fronteira `withDb` não chama negócio se identidade diverge ou qualquer uma de 20 verificações de privilégios indica elevação/valor nulo. Fecha a conexão também na recusa. O helper HMAC efetivamente executado em PowerShell foi comparado ao endpoint Node: ambos usam a string UTF-8 do token, sem decodificação hex.
- `SQL_RUNTIME_TESTS=YES node --test integration/sql-runtime.integration.mjs`: 1/1 PASS com SQL real, zero skips. Em banco descartável, usuário `WITHOUT LOGIN` executa DML e SP nos quatro schemas, mas não cria/exclui tabela, não lê tabela de outro schema e não se adiciona a db_owner. Flags de CONTROL, DDL e BACKUP são zero. Banco descartável removido com DB_ID NULL confirmado.
- Parsing dos três scripts de provisionamento/start/stop PowerShell: PASS; helper HMAC executado com sucesso no teste de paridade. Isso não comprova criação da conta, ACL efetiva, DPAPI, Start-Process ou autenticação Windows em execução. Essas superfícies permanecem pendentes da etapa elevada e de sua verificação.
- `tests/private-isolation.test.mjs`: o helper de isolamento abre e fecha o arquivo com `openSync('r')`, sem ler seus bytes. Um teste aplicou negação real de ReadData ao próprio SID em arquivo sintético temporário; reproduziu o falso positivo de `accessSync` e passou após a correção. Legibilidade indevida, diretório de backups listável e caminhos ausentes também foram exercitados. Lote focal com esses testes, HMAC, guard SQL e piloto: 6/6 PASS. [A documentação Node24 informa que fs.access não verifica ACL no Windows](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsaccesspath-mode-callback).
- O ensaio SQL prova os grants; não certifica o fluxo completo da aplicação sob a nova identidade. A homologação real dessa identidade é obrigatória depois do provisionamento.

Fontes Microsoft: [autenticação integrada](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/authentication-sql-server?view=sql-server-ver17), [contas locais](https://learn.microsoft.com/en-us/windows/security/identity-protection/access-control/local-accounts), [CREATE LOGIN](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-login-transact-sql?view=sql-server-ver17), [permissões de schema](https://learn.microsoft.com/en-us/sql/t-sql/statements/grant-schema-permissions-transact-sql?view=sql-server-ver17).
