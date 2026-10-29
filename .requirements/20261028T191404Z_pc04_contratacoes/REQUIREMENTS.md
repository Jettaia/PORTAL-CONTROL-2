# PC-04 — Contratação individual e conferência

## As Is
PC-01/02/03 implementados no checkout com deltas ainda não commitados. Modelo legado Atividade/Participacao exige depósito, permite vários participantes e tem políticas laboratoriais diferentes; preservá-lo sem migração implícita. SQL local não homologado. Serena ativada; símbolos falharam por ausência de language server. LAD indisponível no inventário; README local informa desabilitado por credencial pendente.

## To Be
Contratação individual nativa referenciando cadastros existentes, com numeração global, horários manuais, revisão e liberação versionadas. Experiência acessível no portal. Nenhum vencimento ou cálculo de diária por hora. Legado preservado, sem importar atividades multiprestador como se fossem contratações únicas.

## Requirements
1. ADM/gestor com filial autorizada cria para um prestador ativo vinculado e tipo/filial ativos. Usuário confirmou uma contratação por prestador/data em toda a empresa e saída no dia seguinte permitida. Validar início na data, término posterior e até o dia seguinte; serviços multidiários não são modelados aqui. Não expor informações de outra filial em conflitos.
2. Número global persistido, único concorrente e não reutilizado após cancelamento. Entidade nativa Operacao.Contratacao referencia cadastros sem recriar tabelas legadas; IDs de Atividade/Participacao não são convertidos automaticamente porque não há mapeamento unívoco nem depósito no novo contrato. Documentar fronteira com legado.
3. Horários reais manuais exigem motivo e autor; conferência exige ambos e preserva valor. Histórico deve continuar operável após inativação de filial/tipo/prestador ou remoção de vínculo.
4. Conferência registra valor exato, ator e instante UTC; revisão do valor liberado não pago exige motivo, remove disponibilidade e exige nova conferência. Cancelamento não pago exige motivo. Histórico/eventos preservados para PC-08/11. Mutações versionadas com MFA, auditoria atômica e rollback; financeiro isolado não altera.
5. Criador e conferente persistidos separadamente. Usuário confirmou gestor responsável escolhido explicitamente na criação. Exigir seletor e validar candidato ativo operacional autorizado à filial; persistir GestorResponsavelId separado dos autores. Financeiro vê somente liberações vigentes; não implementar pagamento, token, limite, média ou ajuste pós-pagamento.
6. UI de criação, busca de prestador por nome/CPF, consulta/detalhe e ações, responsiva e com conflitos/erros visíveis. Ativação opt-in PC-04 com schema provisionado.

## Acceptance Criteria
1. API aceita criação autorizada e recusa pessoa inativa/sem vínculo, filial alheia, tipo inativo e duplicidade prestador/data global, inclusive concorrente. Data de saída seguinte permitida; início/fim inválidos recusados.
2. IDs/números persistidos únicos; cancelamento não apaga nem reutiliza número. Prova SQL real preparada separadamente; mocks não certificam concorrência SQL.
3. Fluxo criação → horários manuais → conferência passa; conferência sem horários falha e diária permanece constante. Repetir conclusão/cancelamento após desativação/desvinculação.
4. Versão desatualizada, financeiro, anônimo, origem forjada e falha auditoria recusados; revisão/cancelamento despublicam liberação preservando eventos. Bloquear alteração de registro pago.
5. Contrato mantém criador/conferente distintos, gestor responsável escolhido obrigatório e validado na API. Consumidores futuros não devem confundir registros nativos com pagamentos laboratoriais.
6. Interações reais no browser atravessam criação, detalhe, manual, conferência, revisão/cancelamento; conferir 1440/768/390.

## Principal Regression Test
`node --test tests/pc04.test.mjs`: HTTP real + serviço de produção com transporte ODBC controlado. RED por módulo ausente/ação ainda não implementada; GREEN após implementação. Fluxo principal deve executar estado/publicação/evento, não somente helpers. `integration/pc04.integration.mjs` opt-in em banco descartável para persistência/concorrência e autenticação real.

## Testing Plan
TDD red/green focal por comportamento; suites adjacentes PC-01/02/03 e suíte nativa. UI browser headless com HTTP sintético para ações/transições/erro versão e responsividade. SQL real somente localhost descartável opt-in; registrar SKIP se indisponível. Revisão independente de segurança/integridade pelo smart-orchestrator; LAD design/code não executáveis nesta sessão, sem substituir a origem da revisão.

## Implementation Plan
1. Backend/rotas/schema opt-in e testes HTTP de fluxo e negativos. Dono exclusivo backend em subagente; principal integra flags/schema/servidor.
2. UI e teste browser em paralelo por outro agente, contrato HTTP compartilhado; principal integra navegação.
3. Integrar; preparar SQL opt-in; executar gates e corrigir achados materiais de revisão independente; atualizar SPEC e docs com provas e limitações. Sem commit/push/deploy nem alterar banco instalado.

## Decisões e revisão durante execução
- Usuário confirmou P02: uma contratação por prestador/data e saída no dia seguinte. Regra global inclui registros cancelados preservados, sem reciclar número/data. Participações antigas também são verificadas ao criar; inclusões legadas bloqueadas somente quando PC-04 está ativo.
- Usuário confirmou gestor explicitamente escolhido no cadastro; criador e conferente seguem distintos.
- Revisão independente por subagente Sol medium identificou ações visíveis em detalhe financeiro fora da filial e inacessibilidade de histórico após TOP200. Corrigir com permissão específica do detalhe e paginação por cursor, mantendo escopo SQL; novos testes de interação e HTTP.
- Consultado Microsoft Learn: sequência consome valores fora de transações, exige UNIQUE para unicidade e aceita lacunas; sp_getapplock Transaction exige transação e retorno negativo recusa. Fontes: https://learn.microsoft.com/en-us/sql/t-sql/statements/create-sequence-transact-sql e https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql .
## Resultado da execução
Implementação local pronta e revisão independente PASS com limite SQL. Backend 44 testes focais; gate legado 1. Suite completa `node scripts/test-all.mjs`:165 PASS; piloto:2 PASS (167 total local). Browser PC04 PASS (7 gravações, 1440/768/390) e regressão PC03/PC02 PASS. Sintaxe `node scripts/check-all.mjs`:613 arquivos, zero falhas. `git -c core.whitespace=cr-at-eol diff --check`:PASS.
SQL PC04:SKIP, instância local não disponível; PC01/02/03 SQL igualmente SKIP. Prova opt-in descartável preparada. Sem homologação de persistência/concorrência real, sem migração do banco instalado ou deploy. LAD não executado; revisão própria e subagente identificadas separadamente. Detalhes canônicos em docs/PC-04-CONTRATACOES.md; SPEC atualizada com decisões do usuário e resultado. Nenhum achado material pendente na revisão local; aceite integrado bloqueado apenas pela prova SQL indisponível e integrações futuras fora do escopo.
