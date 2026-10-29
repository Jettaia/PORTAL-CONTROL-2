# PC-01 — Acessos e administração de usuários

Estado em 28/10/2026: implementação e validação local concluídas; homologação SQL pendente. Revisão independente aprovada com essa ressalva. Sem instalação, migração de dados existentes, commit, push ou deploy.

## Entrega

`/api/pc01/usuarios` lista/cria contas; `PUT /api/pc01/usuarios/:id` substitui nome, e-mail, situação, funções e filiais. Apenas ADM ativo com vínculo raiz administra contas. Criação/edição exigem origem/cabeçalho protegidos e MFA recente revalidado na transação. A senha inicial usa a política existente (14–128 caracteres, maiúscula, minúscula, número e símbolo) e scrypt com salt aleatório; edição não redefine senha.

Funções internas ADMIN (ADM), GESTOR e FINANCEIRO acumulam por concessão administrativa. Os perfis `PC01_*` usam as permissões existentes. Operação do gestor fica nas filiais concedidas; financeiro consulta globalmente sem receber permissões operacionais. ADM opera globalmente. As concessões por filial alimentam os dois contratos legados de depósito; o trigger inclui novos depósitos nessas concessões. O catálogo de filiais é o existente, sem implementar PC-02.

Salvar uma conta encerra suas sessões e revoga convites pendentes, preservando usuário, credencial e autoria. A auditoria guarda os acessos anteriores e posteriores, sem senha/hash/salt/token. O último ADM ativo não pode ser removido/desativado: as alterações administrativas são serializadas por application lock transacional. Escritas legadas de perfis, permissões, escopo por depósito e pré-cadastro ficam bloqueadas quando PC-01 está ativo. Convites existentes continuam destinados às contas pendentes elegíveis; não se introduziu recuperação pública de senha.

## Configuração inicial e ativação

Preservados os gates do instalador e a identidade privada de `secrets/pilot-local/administrator.json`. O administrador é informado pelo operador; não há identidade ou senha de produção embutida. O instalador cria token aleatório privado. O link `/pilot/setup#<token privado>` define a senha, cria o primeiro ADM e consome o token em transação. Reuso e contas preexistentes são recusados. Configurar MFA pelo fluxo existente após o primeiro login.

O instalador de banco **novo e vazio**, após os gates já existentes, usa agora o manifesto de 22 arquivos e grava `pc01: true` no runtime privado. Não foi executado nesta entrega. Continuam aplicáveis os pré-requisitos de instância e homologação de [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).

Instalações anteriores mantêm PC-01 desligado por padrão (`privateConfig.pc01 !== true`). Não basta alterar o sinalizador: uma atualização autorizada precisa validar backup/destino, executar a extensão `pilot-local/sql/22-pc01-access.sql` em transação sob a proteção do instalador, executar `seedPc01Catalog(db)` na mesma preparação e validar os testes SQL antes da ativação. A extensão não deve ser executada por copiar/colar fora desse contexto. Ela recusa e-mails normalizados duplicados; esses casos precisam de reconciliação prévia. Nenhum upgrade de banco instalado foi autorizado ou realizado.

Contas anteriores conservam seu contrato de acesso até revisão pelo ADM. Não converter automaticamente um único depósito em autorização para toda a filial. Ao revisar uma conta na nova tela, selecionar as funções e filiais desejadas substitui as concessões anteriores (inclusive perfis personalizados). O ADM anterior pode revisar sua própria conta para receber o conjunto PC-01; salvar encerra sua sessão e exige novo login/MFA.

## Evidências e limites

- Red: `node --test tests/pc01.test.mjs` falhou inicialmente por ausência do módulo das rotas. Green: 3/3 testes HTTP/validação passam. Essa prova usa persistência simulada e não certifica SQL.
- `node scripts/test-all.mjs`: 82/82 testes passaram.
- `node --test pilot-local/unit.test.mjs`: 2/2 passaram.
- `node scripts/check-all.mjs`: 595 arquivos, zero erros de sintaxe.
- `node integration/pc01.visual.mjs`: PASS no frontend real com API HTTP sintética. Login, criação com funções acumuladas, edição/desativação, erro de duplicidade, limpeza de senha e autorrevogação. Desktop 1440 e tablets 1024/768; capturas em `artifacts/pc01/` (ignoradas pelo Git). Usar `JETTA_PLAYWRIGHT_ROOT` apontando ao diretório de pacotes Playwright disponível e Edge instalado (`PC01_BROWSER_CHANNEL` permite selecionar outro canal).
- `node --test integration/pc01.integration.mjs`: SKIPPED porque não há instância SQL Server disponível. O teste exige `PC01_SQL_TESTS=YES` e `PC01_SQL_SERVER` local explícito (`localhost` ou `.`, com instância opcional). Cria exclusivamente banco aleatório `JETTA_CONTROL_B3_TEST_<hex>`, verifica manifesto, setup, login/MFA, autorização, filial forjada, disponibilidade como ADM, duplicidade concorrente, revogação e disputa pelo último ADM; remove apenas seu próprio banco em `finally`. Não aponta para o piloto instalado ou banco operacional.

As capturas e testes de UI não substituem persistência/autorização no SQL Server. Aceite integrado permanece pendente até executar e aprovar esse teste em instância descartável autorizada, incluindo compilação e aplicação do schema. Não há declaração de TDD completo ou de homologação SQL.

## Verificação Jetta QA — 28/10/2026

Executada sobre o checkout `PORTAL CONTROL`, base Git `13c54f9` com as alterações locais do PC-01 preservadas. Resultado global: **INCONCLUSIVO para aceite integrado**, com os testes locais abaixo aprovados. Nenhuma falha foi observada nas execuções disponíveis; isso não certifica a fronteira SQL não executada.

| Prova executada | Resultado | Alcance |
|---|---|---|
| `node scripts/test-all.mjs` | PASS — 82/82 | Regras locais e regressões existentes. No contrato HTTP PC-01: ADM cria/edita; anônimo, gestor, financeiro, origem inválida e MFA ausente são recusados. Sessão e persistência desse teste são simuladas. |
| `node --test pilot-local/unit.test.mjs integration/pc01.integration.mjs` | 2 PASS; 1 SKIPPED | Guardas de destino/configuração do piloto passam. A jornada com SQL real não foi executada. |
| `node integration/pc01.visual.mjs` | PASS | Frontend real com API sintética: login, criação com gestor+financeiro, seleção de filial, edição/desativação, erro de duplicidade, limpeza da senha, retorno ao login ao salvar a própria conta; quatro submissões. Geometria em 1440×1000, 1024×768 e 768×1024. |
| `node scripts/check-all.mjs` | PASS — 595 arquivos | Sintaxe JavaScript. |
| `git -c core.whitespace=cr-at-eol diff --check` | PASS | Sem erro de whitespace no diff, preservando CRLF do projeto. |
| Verificação dos hashes do manifesto e comparação fonte/gerado | PASS — 22 arquivos | Integridade dos arquivos SQL e correspondência da extensão PC-01 com sua fonte; não prova compilação SQL. |

Inspeção de pixels das capturas atuais `users-768.png` e `login-1440.png`: formulário e ações visíveis, agrupamento de funções/filiais legível e formulário em uma coluna no tablet. A tabela mantém rolagem horizontal interna prevista; não foi tratada como corte indevido. Não se realizou auditoria WCAG completa nem houve aprovação humana de design.

**Bloqueio confirmado no ambiente:** há ODBC Driver 18 de 32/64 bits, mas não há serviço/instância local de SQL Server nem SQL LocalDB ou Docker disponíveis. Não se instalou outro runtime ou se apontou o teste para banco remoto/operacional. Permanecem BLOCKED: aplicação/compilação do schema, login/MFA contra SQL, persistência/releitura, isolamento real entre filiais, revogação de sessões/convites e concorrência de e-mail/último ADM.

Condição de retomada: disponibilizar uma instância SQL Server local de testes e executar a jornada descartável com `PC01_SQL_TESTS=YES` e `PC01_SQL_SERVER` explícito. Só após PASS dessa fronteira é possível aceitar integralmente PC-01. Nenhuma alteração no código de produto foi necessária nesta rodada de QA; não houve migração de dados existentes, push ou deploy.
