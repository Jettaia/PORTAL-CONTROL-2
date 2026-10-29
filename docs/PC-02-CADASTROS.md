# PC-02 — Filiais e tipos de atividade

Data: 28/10/2026. Estado: implementação e validações locais concluídas; homologação SQL e integração operacional PC-04 pendentes. Autorização: pedido explícito de implementação do ticket 2. Workspace: `C:/Users/Jetta/Desktop/PROJETOS-JETTA/PORTAL CONTROL` (a pasta `PORTAL CONTROL 2` estava vazia).

## Resultado
- Reutilizados `Cadastro.Filial` e `Cadastro.TipoServico`, IDs e referências existentes. Filial inclui nome, código interno e endereço (obrigatório para criar/editar). Tipo global inclui nome, descrição opcional e situação; sem exigir categoria do prestador.
- Listagem, criação, edição, inativação e reativação pelos endpoints existentes `/api/b24a/filiais` e `/api/b24a/servicos`. PUT mantém o ID e exige `original`, com endereço/descrição inclusive quando vazios no registro anterior.
- Apenas ADM ativo com `UsuarioRaiz` altera; sessão/MFA recente são revalidados dentro da transação. Origem protegida na API, SQL literals seguros, auditoria atômica, comparação do estado original e serialização das gravações. Código de filial segue formato já existente, normalizado para maiúsculas, único inclusive inativos; nome do tipo também é único.
- Inativação não exclui entidades. Consultas de atividades mantêm filial inativa no histórico autorizado. Seletores de novos lançamentos continuam limitados a ativos, e adicionar um novo participante também verifica filial e tipo ativos.
- Endereço integra o contrato de filial para consumo posterior pelo recibo PC-09; formatação da localidade continua naquele ticket.

## Ativação e banco
A configuração privada de execução exige `pc01: true` e `pc02: true`. O instalador de um **novo banco vazio** já prepara ambos. A extensão aditiva `pilot-local/pc02-catalog.sql` está incorporada ao gerador/manifesto como `23-pc02-catalog.sql`, com transação e proteção de destino. Campos antigos podem permanecer NULL até edição; não foi inventado endereço ou descrição.

Nenhum banco instalado foi migrado, nenhuma configuração privada existente foi alterada e não houve commit, push ou deploy. Ativar em instalação existente exige primeiro uma atualização de schema autorizada separadamente; ligar só a flag sem schema não torna o ambiente homologado.

## Validação executada
- RED: `node --test tests/pc02.test.mjs` falhou com `ERR_MODULE_NOT_FOUND` antes da implementação das rotas/serviço.
- GREEN: 10 testes PC-02 passaram, abrangendo HTTP/validação e serviço de produção com transporte ODBC substituído: ADM revogado, MFA expirado, CAS desatualizado, código duplicado, rollback de falha na auditoria e commit. Transporte simulado não comprova execução SQL.
- Regressão: `node scripts/test-all.mjs` — 92 testes passaram; `node --test pilot-local/unit.test.mjs` — 2 passaram.
- Sintaxe: `node scripts/check-all.mjs` — 598 arquivos verificados sem falha na primeira execução. As adições finais foram verificadas também diretamente com `node --check`.
- UI real com backend HTTP sintético: `integration/pc02.visual.mjs` passou criação, edição de endereço/descrição, conflito mantendo formulário, inativação preservando linha, troca filial/tipo sem campo obrigatório oculto e gestor sem ações de escrita. Viewports 1440, 768 e 390 px; sem erros de página e sem overflow do formulário. Capturas em `artifacts/pc02/branches-*.png`, com inspeção visual da versão móvel.
- `node pilot-local/build-schema.mjs` gerou 23 arquivos; apenas geração, sem instalação.
- `node --test integration/pc02.integration.mjs` — 1 teste **SKIP**, não PASS, por ausência de SQL Server local. O teste preparado exige `PC02_SQL_TESTS=YES`, `PC02_SQL_SERVER=localhost` (ou instância local explícita), cria banco aleatório `JETTA_CONTROL_B3_TEST_<12 hex>`, testa API autenticada, campos persistidos, concorrência/código/CAS, referências e histórico após inativação, bloqueio de novos lançamentos e MFA; remove apenas seu próprio banco ao terminar.

## Revisões e ferramentas
Revisão própria e revisão independente por subagente GPT-6.1 Sol (medium) executadas. Parecer independente: **aprovado com ressalva de homologação**, sem defeito material identificado; SQL real e integração PC-04 continuam pendentes.

**LAD não executado e não aprovado:** não exposto nas ferramentas e marcado `enabled = false` em `C:/Users/Jetta/.codex/config.toml`. **Serena não ativada:** servidor configurado, mas ferramentas ausentes nesta sessão. `C:/Users/Jetta/.codex/mcp-setup/README.md` não existe; diagnóstico consultou os arquivos existentes `lad-README.md` e `serena-README.md`. Não houve alteração dessas configurações. `npm` não está no PATH; os runners nativos foram executados por `node`.

## Trabalho restante / limites do aceite
1. Executar a prova SQL descartável em instância local disponível. Persistência e concorrência reais permanecem não homologadas.
2. Integrar e provar em PC-04 a conclusão ou cancelamento explícito de contratação anterior após inativação. O fluxo operacional legado ainda possui verificações de filial/tipo ativos nessas etapas; esta entrega não certifica esse aceite integrado. Não migrar nem liberar operação real como se essa integração estivesse concluída.
3. A revisão LAD solicitada depende de o servidor estar habilitado e disponível na sessão; a revisão por subagente não é aprovação LAD.

Referências técnicas verificadas: [ALTER TABLE](https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/t-sql/statements/alter-table-column-constraint-transact-sql.md) e [sp_getapplock](https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/relational-databases/system-stored-procedures/sp-getapplock-transact-sql.md), documentação oficial Microsoft.


## Jetta QA — 28/10/2026

**Veredito: PASS local; aceite integrado INCONCLUSIVE/BLOCKED.** Nenhuma falha nos cenários efetivamente executados. Não equivale a homologação de banco/autorização persistida.

Lote executado nesta solicitação:
- `node scripts/test-all.mjs`: 92/92 PASS.
- `node --test pilot-local/unit.test.mjs integration/pc02.integration.mjs`: 2 PASS; 1 SQL SKIP explícito.
- `node integration/pc02.visual.mjs`, com Playwright instalado no runtime e Edge headless: PASS, seis tentativas de gravação e viewports 1440/768/390. Backend HTTP sintético, sem SQL. Captura tablet inspecionada visualmente; formulário legível e alinhado, tabela com rolagem horizontal própria.

Personas/casos: ADM autorizado cria/edita/inativa, gestor e financeiro têm escrita recusada no contrato HTTP, anônimo é recusado, origem inválida e MFA ausente são negados. O serviço de produção com ODBC simulado cobre ADM revogado, MFA expirado, código duplicado, edição desatualizada, rollback em falha de auditoria e commit. Na UI real, gestor fica sem formulário/ações, conflito preserva campos e edição continua utilizável, descrição vazia é aceita, endereço é conservado na edição e a troca para tipo remove a exigência de endereço oculto.

**Fronteiras ainda sem prova real:** autenticação e escopo persistidos entre filiais, salvamento/releitura SQL, unicidade concorrente/CAS no SQL Server, preservação operacional e novos lançamentos após inativação. O teste descartável existe, mas a máquina não apresenta serviço/instância SQL Server registrado; não foi apontada outra instância local. Não foram localizados `sqlcmd` ou Docker no PATH. Não houve tentativa em banco instalado/remoto nem instalação de infraestrutura.

A integração de conclusão/cancelamento após inativação permanece pendente de PC-04 conforme o ticket; o QA não a promoveu a PASS. A revisão independente anterior foi reaproveitada, sem novas mudanças de produto. Não houve revisão LAD nem ativação Serena nesta execução; indisponibilidades registradas acima. Nenhum código de produto, banco instalado, configuração privada, push ou deploy alterado.

Condição de retomada: disponibilizar instância SQL Server local isolada e executar `integration/pc02.integration.mjs` com as variáveis opt-in já documentadas; provar conclusão/cancelamento quando o contrato PC-04 estiver implementado.
