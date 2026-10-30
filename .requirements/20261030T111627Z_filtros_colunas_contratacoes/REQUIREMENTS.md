# As Is
Tabela com sete colunas de dados e Ação, consulta paginada em blocos de 200 sem filtros.
# To Be
Sete filtros no cabeçalho, combináveis e aplicados no servidor em todo o escopo autorizado; Ação continua abrindo a contratação.
# Requirements
1. Número exato, nomes por trecho (Prestador, Depósito, Gestor responsável), data exata, valor decimal exato e situação por seleção.
2. Aplicar filtros por botão/Enter, limpar filtros, preservar filtros ao atualizar e paginar; reiniciar cursor ao aplicar/limpar e limpar estado ao trocar sessão.
3. Manter tabela/cabeçalho no resultado vazio e ação Abrir correta. Preservar RBAC e paginação existentes, sem escritas.
# Acceptance Criteria
Sete controles associados às colunas; nenhum na coluna Ação. Combinação usa AND, busca além da página atual. Entrada inválida/duplicada é rejeitada antes do banco. Filtros não ampliam visibilidade por perfil/depósito. Limpar recupera primeira página.
# Principal Regression Test
node integration/contracts-filters.visual.mjs: componente e cliques reais com API sintética paginada; red por não haver filtros, green após implementação.
node --test tests/pc04.test.mjs: HTTP e serviço reais com adaptador SQL controlado; red por ausência de predicados e validação, green após implementação.
# Testing Plan
Sete campos isolados e combinação, zero resultado/limpar, paginação, refresh, Abrir correto, perfis ADMIN/GESTOR/FINANCEIRO, data/valor inválidos, payload hostil e isolamento existente. Inspeção desktop/mobile focal, sem banco permanente.
# Implementation Plan
1. Testes e red. 2. Filtros validados na consulta existente. 3. Controles no cabeçalho e estado de paginação. 4. Green, regressões e captura focal.
# Referência técnica
CHARINDEX documentado em https://learn.microsoft.com/en-us/sql/t-sql/functions/charindex-transact-sql (consulta 30/10/2026); literais Unicode pelo helper atual nvarcharLiteral. Sem nova dependência. Serena/Lad indisponíveis.

# Resultado
Implementado: sete filtros no cabeçalho, combinados no servidor antes da paginação, Aplicar/Enter/Limpar, preservação em refresh/paginação, reset de sessão, vazio com cabeçalho e Ação intacta. Sem novas dependências, alterações de dados ou deploy.

# Evidências
- Red: integration/contracts-filters.visual.mjs falhou 0 controles versus 7; tests/pc04.test.mjs falhou nos novos casos por ausência de predicados/validação. Log artifacts/operation-navigation/filters-red.log.
- Green: node integration/contracts-filters.visual.mjs passou sete filtros isolados, combinação, acentos, busca fora da página, Enter, vazio, limpar, refresh, paginação com filtro, Abrir correto e reset de sessão. API sintética, componente real.
- node integration/contracts-table.visual.mjs passou oito títulos, datas, badges, Abrir, geometria desktop/mobile e zero escritas. Teste atualizado para título separado do controle e contêiner real de scroll. Capturas artifacts/contracts-filters/table-1440.png e artifacts/contracts-table/table-390-status.png inspecionadas: controles alinhados, padrões existentes, Abrir acessível pela rolagem interna.
- node --test tests/pc04.test.mjs tests/pc07.test.mjs tests/pc05-app.test.mjs: 95/95 passaram; log artifacts/contracts-filters/regressions.log. Serviço/HTTP reais com ODBC controlado, incluindo Financeiro restrito, filtros inválidos/duplicados, literal hostil e fluxo adjacente.
- SQL Server real: predicados gerados pela chamada ao serviço list foram executados via ODBC em SELECT sobre VALUES sintéticos em master (sem tabelas/mutações), com os sete filtros juntos. Caso positivo retornou somente Numero=1; situação incompatível retornou vazio. CHARINDEX comprovou busca sem distinção de acento/caixa e símbolos %_[] literais.
- node --check public/pc04.js, src/pc04.js, src/pc04-routes.js: passaram.
- Revisão independente GPT-6 Luna high: sem achados materiais de SQL, escopo, paginação ou estado.

# Limitações
UI usa API sintética; serviço/HTTP usa adaptador ODBC controlado. SQL real valida os predicados produzidos, sem percorrer login/banco operacional completo. Nenhuma alteração de autorização. Sem deploy. Não foi repetida suíte geral (falha PC09 preexistente registrada na tarefa anterior).
