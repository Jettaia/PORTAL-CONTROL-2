# As Is
FIN01 lista contratações liberadas e permite recibos/baixas. Não há extrato agregado no modelo atual; PC11 antigo está aposentado. Navegação financeira só permite o item Financeiro.
# To Be
Segundo item Extrato por prestador sob Financeiro. Resumo por prestador e consulta individual com uma linha por contratação liberada. Histórico completo por padrão, filtros opcionais por prestador, depósito e datas da criação da contratação. Saldo apenas no final, sem ledger de movimentos nem fluxos de estorno novos.
# Requirements
1. Resumo por prestador: total liberado/devido, total pago e saldo devido; selecionar prestador abre individual.
2. Individual: Número da contratação, Data de criação, Depósito, Centro de custo, Atividade, Valor devido (liberado), Data do pagamento (confirmação no sistema), Valor pago.
3. Apenas liberadas entram. Baixa vigente compõe pagamento; pendente exibe data — e valor pago 0,00. Sem alterar cadastro/pagamento/recibo existentes.
4. Datas opcionais filtram criação no horário America/Sao_Paulo, inclusive limites. Sem datas, todo histórico. Totais sobre todos os resultados filtrados, não só página.
5. Saldo apenas no final junto aos totais, calculado devido menos pago. Sem saldo por linha.
6. ADMIN e FINANCEIRO globais; GESTOR somente depósitos autorizados. Endpoints autenticados, somente leitura; entrada inválida rejeitada sem escrita.
7. Acesso aos detalhes da contratação usando financeiro atual. Imprimir/salvar PDF com todas as linhas filtradas do prestador, cabeçalhos, identificação e totais.
8. Layout consistente com FIN01, responsivo com rolagem local da tabela, limpar dados ao logout e evitar respostas obsoletas em filtros/print.
# Acceptance Criteria
Cada requisito é validado por HTTP/SQL real (autorização, filtros, datas, totais, uma linha/contratação, paginação, pagamento) ou UI automatizada (menu, resumo/individual, filtros, detalhes, print completo, logout, responsividade).
# Principal Regression Test
FIN05_SQL_TESTS=YES node --test integration/fin05.integration.mjs: servidor e SQL isolados, ADMIN/FINANCEIRO/GESTOR e acesso negado, resumo, detalhe, datas, pagamentos e paginação. Antes: endpoint ausente. Depois: contratos e totais corretos sem acesso cruzado.
# Testing Plan
Teste HTTP/SQL real red/green; UI headless com assets reais e fixture de API para navegação, filtros, paginação, totais, popup/PDF, logout e erro recuperável; regressão FIN01/FIN02/FIN03 relevante. Revisão independente de segurança/cálculos. Inspeção de screenshots.
# Implementation Plan
1. Congelar contrato API/UI e criar testes red.
2. Serviço e rota FIN05 somente leitura sobre tabelas atuais, sem migrations.
3. Tela e navegação integradas, reutilizando detalhes financeiros.
4. Executar QA por persona, revisão independente e correções focais; reiniciar piloto e health-check.
# API contract
GET /api/financeiro/extrato, query keys prestadorId, depositoId, inicio, fim, pagina. Opcionais, strings; pagina default 1, 100 linhas por página. Datas ISO (dias locais). Sem prestadorId: resumo; com prestadorId: individual.
Response: {prestadores:[{PrestadorId,Prestador,ValorDevido,ValorPago,Saldo}],contratacoes:[{ContratacaoId,Numero,PrestadorId,Prestador,DataCriacao,Deposito,CentroCusto,Atividade,ValorDevido,DataPagamento,ValorPago}],totais:{ValorDevido,ValorPago,Saldo},totalRegistros:number,proximaPagina:number|null}. Array não aplicável vazio. Valores monetários strings decimais de duas casas. DataCriacao/DataPagamento ISO sem Z, sempre UTC; frontend converte explicitamente America/Sao_Paulo; DataPagamento null se pendente. Ordenação resumo por nome/ID, individual criação/ID crescentes. Totais incluem todas as páginas. Catálogo: endpoint FIN01 existente. API de detalhes existente; navegar para Financeiro e abrir contratação sem duplicar mutações.
# Execution
Autorizado pelo usuário em 30/10/2026 após entrevista grilling. Skills smart-orchestrator, jetta-qa e TDD. Backend/integrador: principal. Frontend: ownership separado. Sem push/deploy/migration.

# Verification so far
- Red FIN05 SQL: endpoint inexistente retornou 404 em vez de autenticação 401.
- Green FIN05 SQL/HTTP: resumo/individual, centavos exatos, paginação 107 contratações e 103 prestadores, totais de todas páginas, criação em limites de dia São Paulo, data de confirmação, recibo sem pagamento, legado PagoEmUtc ignorado, baixa desfeita/nova vigente sem duplicidade, gestor restrito, usuário ativo sem função 403, sessão ausente/inativa 401, filtros inválidos sem escrita. Última execução 1/1 PASS (~14s).
- Regressões SQL reais FIN01 e FIN03: ambas PASS, bancos exclusivos e descartáveis.
- FIN04 retirement: 3/3 PASS.
- Regressões visuais FIN01 e FIN02: PASS ADMIN/FINANCEIRO/GESTOR, navegação, filtros/detalhes, emissão/reimpressão e responsividade.
- Syntax checks src/fin05.js, src/fin01-routes.js, public/fin05.js, public/navigation.js, public/pc01.js, public/fin01.js: PASS.
- SQL timezone confirmado na documentação oficial Microsoft AT TIME ZONE: https://learn.microsoft.com/en-us/sql/t-sql/queries/at-time-zone-transact-sql
- Revisão independente Sol medium: backend sem falhas materiais, execução independente FIN05 SQL PASS. Revisão final UI/print pendente.

# Final acceptance
- FIN05 UI final: PASS ADMIN/FINANCEIRO/GESTOR; resumo/individual, valores/datas locais, filtros combinados, paginação, totais globais, estado vazio/erro, respostas obsoletas, abrir detalhes FIN01, logout limpa dados, impressão integral de 102 linhas antes de carregar segunda página, XSS tratado como texto, CSP com CSS externo, 1440/390.
- Screenshots artifacts/fin05/resumo.png, individual-1440.png, individual-390.png e print.png; PDF artifacts/fin05/extrato.pdf. Inspeção por implementador, principal e reviewer sem falha material.
- Revisão independente GPT-6.1 Sol medium: APROVADO, sem correções pendentes; teste independente FIN05 HTTP/SQL e UI final passaram.
- public/fin05-print.html é shell vazio estático na mesma origem para carregar CSS sob CSP; dados só montados após consulta autenticada e controle de geração/logout.
- Piloto local reiniciado pelo sinal oficial com backup verificado; HTTP / e assets novos 200, /api/financeiro/extrato sem sessão 401. Banco operacional não alterado pela feature; sem migration, push ou deploy.
- Status: integrado no checkout atual e aceito pelos critérios confirmados. Testes de SQL usaram bancos sintéticos isolados e descartados; aparência/fluxos usaram UI real com fixtures de API.
