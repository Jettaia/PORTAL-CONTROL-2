# FIN-01 — Fila financeira única e permissões por perfil

Status: implementado, integrado ao checkout e validado localmente em 30/10/2026. Ativação definitiva/limpeza do legado permanecem em FIN-04.

Fonte canônica: [FINANCEIRO-SPEC](../../../docs/FINANCEIRO-SPEC.md). Esta fonte prevalece sobre regras financeiras anteriores.

## Resultado

Financeiro/admin consultam contratações liberadas de todos os depósitos em uma tela única. Gestor consulta somente o depósito vinculado, sem ações de escrita. A entrada na fila decorre da liberação da contratação, sem lançamento financeiro manual.

## Escopo e delta sobre a base

- Reutilizar sessão, usuários, papéis, vínculos de depósito e origem de liberação das contratações existentes.
- Implementar consulta e detalhe financeiros com autorização no servidor: financeiro/admin globais; gestor limitado ao vínculo vigente. Não ampliar permissões operacionais fora do financeiro.
- Substituir a listagem antiga por tela única, sem abas. Filtros combináveis por situação, depósito, prestador e período, com busca pelo número da contratação.
- Mostrar número, prestador, depósito, atividade, data do serviço, valor liberado, data da liberação e situação. Detalhe inclui dados da contratação e responsável pela liberação.
- Usar as situações Aguardando pagamento, Recibo gerado e Pago. Neste incremento, recibos e baixas serão consumidos pelos contratos dos tickets seguintes; não simular funcionalidades ausentes.
- Ordenar pendências pela liberação mais antiga, com desempate estável e acesso a todos os resultados, inclusive quando houver paginação.
- Consultar somente liberações vigentes, sem duplicar contratações. Revisão/cancelamento na origem devem retirar a elegibilidade conforme regras operacionais existentes.
- Registrar junto ao código alterado o contrato de consulta/detalhe e a identidade da contratação consumidos por FIN-02/03. Não criar um documento de arquitetura ou controller adicional.

## Critérios observáveis

1. Liberação feita por gestor/admin produz exatamente um registro Aguardando pagamento; contratação não liberada não entra na fila elegível.
2. Financeiro/admin sem vínculo com determinado depósito consultam seus registros; gestor não consulta registros alheios nem por ID direto ou filtro forjado.
3. Gestor não recebe ações financeiras de escrita; as rotas de mutação dos próximos tickets também aplicarão essa restrição no servidor.
4. A tela e o detalhe exibem os campos especificados; filtros e busca funcionam juntos sem ampliar acesso, e pendências antigas permanecem alcançáveis.
5. O período tem referência explícita na interface. Adotar como convenção proposta a data do serviço, já indicada na SPEC; não apresentar essa escolha técnica como decisão expressa da entrevista.
6. Revisão que retire a liberação e cancelamento permitido na contratação não mantêm um registro elegível para nova emissão ou baixa.

Cobertura da SPEC: critérios 1–9; aspectos de consulta de 24. FIN-02/03 completam o acesso a documentos e a proibição de suas mutações.

## Dependências por etapa

- Implementação: contratos existentes de autenticação e liberação de contratação; não depende do fechamento de tickets de outros módulos.
- Integração das situações Recibo gerado/Pago: depende dos registros de emissão e baixa de FIN-02/03. Consulta e tela podem ser desenvolvidas antes.
- Ativação definitiva e remoção dos caminhos financeiros antigos: FIN-04. Durante a transição, não expor gravações antigas que contornem o fluxo novo.

## Verificação focal

- Teste HTTP autenticado da consulta/detalhe com dois depósitos, financeiro global, admin e gestor restrito, incluindo tentativa de acesso direto alheio.
- Prova com persistência de liberação, revisão/cancelamento e consulta sem duplicação. Aproveitar os testes existentes de contratação e pagamentos, sem reproduzir a ordem interna de SQL como aceite.
- Verificação visual da tela única, filtros combinados, leitura do gestor e ordem das pendências. Ampliar os testes apenas se surgir impacto concreto.

## Fora desta entrega

Emissão, baixa e correções pertencem a FIN-02/03. Não executar limpeza do financeiro antigo neste ticket. Sem cards, vencimentos, exportações ou relatórios novos.

## Registro de execução

Resultado: FIN-01 concluído no escopo deste incremento. Nova consulta em `/api/financeiro/contratacoes`, detalhe em `/:ContratacaoId` e catálogo em `/api/financeiro/catalogo`. Contrato e identidade para FIN-02/03 documentados em `src/fin01.js`. A fila é derivada da contratação, sem tabela de lançamentos duplicados, e usa liberação ASC/ID ASC com cursor. O período considera data do serviço. Financeiro/ADMIN têm leitura global; gestor tem leitura limitada aos vínculos vigentes. Permissões operacionais PC04 foram preservadas.

Tela única integrada à navegação com filtros combináveis e detalhe. O runtime do piloto habilita FIN01 quando PC04 está habilitado; será carregado na próxima inicialização do processo. Caminhos financeiros antigos redirecionam à fila e suas mutações HTTP ficam bloqueadas durante a transição. Dados antigos e suas leituras técnicas permanecem preservados para FIN-04. Recibo gerado/Pago são situações reservadas aos registros reais de FIN-02/03: filtros aceitos sem inventar documentos, baixas ou usar o marcador legado como quitação nova.

Verificação executada pelo principal em Windows, Node v24.19.0, ODBC Driver 18 e SQL Server Express local, com banco aleatório descartável `JETTA_CONTROL_B3_TEST_*`, dados sintéticos e sessões por login real. Nenhuma escrita no banco do piloto instalado.

| Critérios | Comando / prova | Resultado |
|---|---|---|
| 1, 2, 3, 4, 5, 6 | `$env:FIN01_SQL_TESTS='YES'; node --test integration/fin01.integration.mjs` | PASS: ADMIN e FINANCEIRO sem vínculo, gestores A/B, anônimo/inativo, liberação por gestor/admin, valor liberado sem recálculo por horas, acesso direto/filtro alheio negado, vínculo revogado, filtros combinados/inválidos, abertas/canceladas ausentes e 206 registros em três páginas sem duplicação. |
| 3 e transição | Mesmo teste HTTP/SQL | PASS: gravações antigas recusadas para ADMIN/FINANCEIRO/GESTOR, incluindo caixa mista em três prefixos. |
| 4 e 5 | `$env:JETTA_PLAYWRIGHT_ROOT='C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; node integration/fin01.visual.mjs` | PASS: scripts/tela/navegação reais com HTTP sintético, ADMIN/FINANCEIRO/GESTOR, filtros juntos, mais resultados, detalhe, ausência de abas/formulários financeiros, destinos antigos redirecionados, limpeza no logout; 1440/768/390, sem overflow da página, escritas ou erros JS. Capturas em `artifacts/fin01/fila-{1440,768,390}.png`; inspeção visual pelo principal. |
| Regressão adjacente | `node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/pc08.test.mjs tests/depot-legacy.test.mjs pilot-local/unit.test.mjs` | PASS — 108/108. |
| Sintaxe | `node scripts/check-all.mjs` e `node --check src/server.js` após correção focal | PASS — 670 arquivos; revisor também verificou os três arquivos do delta final. |

TDD: RED inicial HTTP 404 na rota ausente; RED visual por ausência de `fin01Page`; GREEN de ambos após implementação. Durante a montagem da fixture SQL, dois erros de dados de teste (constraint de liberação e literal datetime) foram corrigidos sem alterar regras operacionais. A revisão independente encontrou P1: regex sensível a caixa permitia alcançar writers antigos por URL maiúscula. Regressão autenticada comprovou RED (400 `DATA_INVALIDA` do writer em vez de 409 do gate); comparação `/i` corrigiu e a execução final SQL terminou PASS. Revisor distinto `fin01_review`, GPT-6.1 Sol medium: Standards + Spec aprovados após reavaliação focal, sem achados materiais pendentes.

Limites: a prova de revisão usa contratação reaberta de fixture compatível com o modelo anterior ao bloqueio definitivo e executa a revisão PC04 real; o bloqueio vigente de contratações já liberadas continua preservado e coberto na regressão adjacente. A prova visual usa HTTP sintético; autorização/persistência foram comprovadas separadamente pelo HTTP autenticado com SQL real. Integração das situações emitido/pago, documentos, baixas, histórico financeiro e reset/ativação definitiva são FIN-02/03/04. Processo do piloto instalado não foi reiniciado; sem limpeza, commit, push ou deploy. Serena/LAD não estão disponíveis nesta sessão; revisão independente realizada pela skill smart-orchestrator.

Fingerprint do candidato testado/revisado: SHA256 `1e55eac174103851655726faffe0b1ac1be95af72f46cd79ae4f3663f4fa6894`, calculado sobre a concatenação UTF-8 (separador LF, sem LF final) de `caminho:sha256` para, nesta ordem: `src/fin01.js`, `src/fin01-routes.js`, `src/server.js`, `src/auth-db.js`, `public/fin01.js`, `public/fin01.css`, `public/navigation.js`, `public/index.html`, `pilot-local/runtime-config.mjs`, `integration/fin01.integration.mjs`, `integration/fin01.visual.mjs`.
