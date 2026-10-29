# PC-03 — Prestadores e vínculos com filiais

Data: 28/10/2026. Estado: implementação local pronta, verificação local PASS; aceite integrado INCONCLUSIVE/BLOCKED por SQL indisponível e integração de conclusão PC-04. Autorizado pelo usuário com smart-orchestrator e, durante a execução, Jetta QA. Base utilizada: `C:/Users/Jetta/Desktop/PROJETOS-JETTA/PORTAL CONTROL`, preservando os deltas anteriores PC-01/PC-02.

## Resultado
- Mantidos Cadastro.Prestador, IDs, CPF único e referências operacionais existentes. Nome completo e CPF obrigatórios; telefone/CNPJ opcionais. Nenhum endereço, banco ou categoria exigidos.
- Cadastro inicial exige ao menos uma filial ativa autorizada. Busca exata por CPF é global para ADM/gestor, inclusive prestador sem vínculos. Listagem normal e vínculos retornados respeitam as filiais do gestor; não retornam contratos ou vínculos alheios.
- Criação duplicada retorna 409 e orienta buscar/vincular a pessoa existente; não sobrescreve seus dados. CPF continua protegido pela unicidade SQL existente e pelas transações serializadas do novo serviço.
- Gestor edita dados comuns de pessoa com vínculo em seu escopo; só ADM corrige CPF e altera situação. Versão impede sobrescrita de edição desatualizada. Não há bloqueio local ao prestador.
- Vínculos adicionados/removidos individualmente, somente em filiais autorizadas, com revogação em vez de exclusão. Remover último vínculo e remover com pendências é permitido. Adição idempotente não duplica vínculo. Prestador inativo não recebe novo vínculo.
- Gravações revalidam ator, papel, escopo e sessão/MFA no serviço, usam auditoria atômica e rollback em falha. Não confiam no papel enviado pela tela.
- Inclusão no planejamento exige prestador ativo e vínculo atual na filial da atividade; seletor filtra pela filial da atividade escolhida. Consulta histórica não depende de vínculo atual. Conclusão/cancelamento de contratação anterior após inativação será provado na integração PC-04.
- UI no painel existente: busca CPF, cadastro inicial, edição, gestão de vínculos e mensagens de conflito. Mantido estilo da família de cadastros; categorias legadas não são exigidas nesta experiência.

## Ativação e schema
`pc03: true` exige PC-01/PC-02 já provisionados e ativos. Novos pilotos vazios incluem a extensão `pilot-local/pc03-providers.sql`, gerada como `24-pc03-providers.sql`, adicionando CNPJ/Versao e PrestadorFilial com chaves estrangeiras. Gerador/manifesto têm 24 arquivos. Nenhum vínculo é inferido do histórico: cadastro preexistente pode ser encontrado por CPF e vinculado explicitamente. Planejamentos anteriores permanecem referenciados.

Nenhum banco instalado ou configuração privada existente foi alterado. Não houve commit, push ou deploy. Atualizar uma instalação com dados depende de migração autorizada separadamente; ativar a flag isoladamente sem o schema não é ambiente homologado.

## Evidências de TDD
- `node --test tests/pc03.test.mjs`: RED inicial ERR_MODULE_NOT_FOUND antes dos módulos; GREEN inicial de 18 testes.
- Inclusão sem vínculo: RED por ausência da rejeição esperada; após o gate de produção, GREEN. Caso positivo com vínculo também passa.
- QA: CNPJ numérico 0 chegava ao transporte SQL em vez de retornar 400; teste RED, validação corrigida e GREEN.
- Estado final do arquivo: 28 testes passaram (25 subcasos HTTP com serviço real e transporte ODBC controlado, um teste agregador e dois casos operacionais). Mocks não demonstram persistência nem semântica SQL real.

## Jetta QA — 28/10/2026
**PASS local; aceite integrado INCONCLUSIVE/BLOCKED.**

Personas/casos locais: ADM corrige/inativa preservando ID e unicidade; gestor cadastra/edita/vincula/desvincula; gestor fora do escopo tem alteração recusada; gestor não corrige CPF nem inativa; financeiro isolado e ator revogado são recusados; anônimo e origem forjada são recusados no HTTP. Cobertos entrada inválida sem SQL, conflito de versão, CPF duplicado, timeout de trava, MFA expirado e rollback de falha de auditoria.

`node integration/pc03.visual.mjs` com Edge headless e Playwright do runtime: PASS. UI real com backend HTTP sintético: busca de pessoa global sem vínculo, adição, edição com CPF somente leitura do gestor, conflito preservando formulário, remoção do último vínculo, cadastro sem filial recusado, opcionais vazios, correção/inativação ADM, botão de vínculo inativo indisponível, financeiro sem formulário/lista, troca PC-02/PC-03 e filtro operacional ao abrir atividades de filiais diferentes. Capturas 1440/768/390 em `artifacts/pc03/`; tablet/celular inspecionados. Formulários sem overflow, tabela com rolagem horizontal própria. Dois timeouts do harness foram corrigidos (sidebar móvel e submenu fechado); nenhum exigiu alteração do produto.

Comandos finais: `node scripts/test-all.mjs` — **120/120 PASS**; `node --test pilot-local/unit.test.mjs integration/pc01.integration.mjs integration/pc02.integration.mjs integration/pc03.integration.mjs` — **2 PASS e 3 SKIP SQL**. `node scripts/check-all.mjs` — **606 arquivos, zero falhas**; scripts visuais/SQL finais também passaram `node --check`. `git -c core.whitespace=cr-at-eol diff --check` sem erros. Total local: 122 testes aprovados; SKIPs não contam como aprovação.

Regressão visual reaproveitada: `integration/pc01.visual.mjs` PASS (4 gravações, 1440/1024/768); `integration/pc02.visual.mjs` PASS (6 gravações, 1440/768/390), após integração de PC-03. Ambos também usam API sintética, sem SQL.

Prova SQL preparada: `node --test integration/pc03.integration.mjs` executado como **1 SKIP**, não PASS. Habilitar apenas em instância local isolada com `PC03_SQL_TESTS=YES` e `PC03_SQL_SERVER=localhost` ou instância local explícita. Cria banco aleatório `JETTA_CONTROL_B3_TEST_<12 hex>`, instala schema vazio, autentica ADM e dois gestores com MFA, testa CPF/edição concorrentes, filiais distintas, vínculos, histórico após remoção, bloqueio de inclusão nova e correção/inativação. Remove somente o próprio banco ao terminar. Não aponta para banco instalado. Serviço/instância SQL Server local não foi detectado; não foi instalada infraestrutura.

Persistência, unicidade/concorrência e autorização entre filiais no SQL real permanecem não homologadas. Consulta/conclusão de pendências após inativação não foi promovida a PASS; conclusão depende PC-04. Condição de retomada: disponibilizar SQL Server local isolado, executar prova opt-in e integrar PC-04.

## Revisões e ferramentas
Revisão própria executada. Revisão independente por subagente GPT-6.1 Sol medium, conforme smart-orchestrator: sem achados materiais no delta final. Observação sobre botão de vínculo inativo corrigida e revalidada visualmente. Reviewer executou 27 testes focais e confirmou SKIP SQL; teste positivo operacional adicional foi executado pelo principal.

Serena: instruções lidas e projeto ativado; consulta real de símbolos falhou porque o language server TypeScript não encontra npm no PATH. Investigação continuou por leitura direta. LAD: sem ferramentas nesta sessão; diagnóstico `C:/Users/Jetta/.codex/mcp-setup/README.md` informa servidor desabilitado por credencial pendente. Não houve chamadas bem-sucedidas system_design_review/code_review, nem aprovação LAD. Revisão própria/subagente não substitui LAD.

Referência técnica verificada: [sp_getapplock, Microsoft Learn](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql): lock Transaction dentro de transação e retorno negativo tratado como recusa.
