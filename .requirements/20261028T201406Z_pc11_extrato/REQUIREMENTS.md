# PC-11 — Extrato do prestador

## As Is
Fonte canônica: docs/SPEC.md, PC-11, autorizado pelo usuário. PC04/08/10 implementados no checkout com ledger persistido PC10. PC09 ainda sem módulos de emissão; não inventar recibos. Preservar alterações existentes.

## To Be
Consulta somente leitura do ledger canônico, por prestador e escopo servidor, datas efetivas e de registro distintas, saldo anterior/final, movimentos e totais, grupo restrito, anexos protegidos e impressão/salvar PDF do mesmo resultado.

## Requirements
1. ADM/financeiro ativos globais; gestor somente UsuarioFilial não revogada. Todas as consultas, grupos, anexos e exportação compartilham a restrição. Sem mutações financeiras.
2. Filtros nome, prestadorId, filialId, inicio/fim; datas ISO válidas. Ordenação DataEfetiva, RegistradoEmUtc, MovimentoId; eventos retroativos recompõem os saldos. Nome filtra prestadores, sem duplicação de CPF ou criação de cadastros.
3. Fonte única PC10Movimento. DataServico identificável. Filial, gestor responsável, tipo, contratação/número, pagamento, valor decimal exato e saldo por movimento. Saldo anterior inclui eventos antes de inicio; final inclui até fim. Totais pagos líquidos (baixa/quitação menos estorno/devolução) no período; aberto/a devolver calculados por contratação até fim.
4. Grupo mostra somente itens autorizados do prestador, independentemente do recorte temporal do extrato; não expor total global ao gestor. Anexos PC08/PC10 no mesmo escopo. Recibo ausente explicitamente indicado; integração PC09 bloqueada até existir contrato real.
5. Tela responsiva com formulário e tabela; impressão com filtros e mesmos dados consultados, podendo salvar como PDF pelo navegador. Não exportar consulta parcial silenciosamente; limite explícito de movimentos com erro para estreitar filtros.

## Acceptance Criteria
1. HTTP real serviço/ODBC controlado: autorizações e negativos; SQL real isolado para certificar escopo/persistência.
2. Jornada duas filiais, liberação, pagamento retroativo agrupado, retirada, reconferência, estorno, quitação/devolução: saldo anterior + movimentos = final; saldo e totais por persona.
3. UI headless exerce consulta, filtros, grupo, erro, logout, impressão e layouts 1440/820/390; PDF verificado contra dados exibidos.
4. Tipos decimais sem float; sem writes, sem segundo fluxo de baixa.

## Principal Regression Test
node --test tests/pc11.test.mjs; rota HTTP pública com serviço real e adaptador ODBC controlado. Red esperado módulo ausente; green após implementação. Mock não certifica SQL real.

## Testing Plan
Testes nativos node:test e regressões PC04/08/10; npm run check. Headless com Playwright instalado. Integração SQL opt-in somente em banco descartável; não migrar banco instalado.

## Implementation Plan
1. Escrever teste HTTP/ledger, executar red; implementar serviço e rotas, green.
2. Integrar flags explícitas, painel e impressão; executar testes de UI.
3. Revisão independente de autorização/integridade, corrigir achados e repetir provas afetadas.
4. Registrar QA e limitações no ticket existente.

## Ferramentas e decisões técnicas
Serena ativada; get_symbols_overview falhou: Active language servers: []. LAD tentativa real verify_mcp.py --lad falhou No provider credentials configured; system_design_review/code_review indisponíveis e não executados. Revisão própria e por subagente não substituem LAD.
Documentação: https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql (SERIALIZABLE preserva leitura transacional); https://playwright.dev/docs/api/class-page#page-pdf (PDF usa mídia print). Sem pacote novo.

## Resultado atual e evidências
Candidato implementado no checkout; QA local PASS; aceite integral BLOCKED pelos gates SQL real, LAD e integração PC09. Revisão própria e independente por subagente (GPT-6.1 Sol medium) realizadas; nenhuma revisão/aprovação LAD. Sem deploy, push, migration ou alteração de dados instalados.

- TDD red backend: node --test tests/pc11.test.mjs falhou ERR_MODULE_NOT_FOUND src/pc11-routes.js antes da implementação. TDD red UI: node integration/pc11.visual.mjs falhou esperando #pc11Page ausente. Green backend 22 testes PC11; UI PASS.
- QA final: node --test tests/pc01.test.mjs tests/pc04.test.mjs tests/pc08.test.mjs tests/pc10.test.mjs tests/pc11.test.mjs integration/pc10.integration.mjs — 121 testes, 120 PASS, 0 FAIL, 1 SKIP (SQL explícito). Saída em artifacts/pc11/unit.log. Personas ADM/financeiro/gestor, anônimo/inativo e acesso alheio; centavos, saldo anterior sem movimentos, grupos, retroatividade e comprovantes.
- node integration/pc11.visual.mjs — PASS; shell real, HTTP sintético, filtros, grupos/anexos, XSS, erros, logout/respostas tardias, impressão/PDF, 1440/820/390. Capturas e extrato.pdf em artifacts/pc11. PDF extraído com pypdf: uma página landscape, filtros e saldos correspondentes. Capturas de celular e impressão inspecionadas.
- node scripts/check-all.mjs — 644 arquivos / zero erros. npm não disponível no PATH; executado o script definido em package.json diretamente pelo Node.
- Revisão independente encontrou P2 CSS print: extrato oculto ocupava páginas e regra global alterava orientação dos recibos. Corrigido com regra hidden e @page pc11statement nomeada. Teste troca extrato → início → print; rerevisão independente Chromium: display:none/altura 0, outro documento em Y=8, page:auto. Sem achados materiais restantes.
- SQL real BLOCKED: nenhum serviço local SQL inventariado; conexão ODBC localhost/master somente leitura falhou 08001/HYT00. Reutilizada/ampliada jornada em integration/pc10.integration.mjs com reconciliação global/por filial, corte, grupo e comprovantes autorizados/negados. Retomar com PC10_SQL_TESTS=YES e PC10_SQL_SERVER apontando instância local explícita; o script usa banco descartável aleatório e nunca banco instalado.
- LAD BLOCKED: inicialização verify_mcp.py --lad falhou No provider credentials configured. Retomar após credencial/reinício disponibilizar system_design_review/code_review; não executados neste candidato.
- PC09 BLOCKED: módulos de recibos ausentes; nenhuma referência fabricada. API identifica PENDENTE_PC09 e UI indisponibilidade. Consumir contrato persistido e validar escopo/documentos quando PC09 estiver implementado, sem criar política neste ticket.
- Sem schema novo: PC11 consulta PC10/08. Flag explícita pc11 no instalador novo/contexto de sessão; configurações antigas não são ligadas automaticamente.
- Fingerprint SHA256 agregado dos arquivos src/pc11.js, src/pc11-routes.js, public/pc11.js, public/pc11.css, public/index.html, public/navigation.js, src/server.js, src/auth-db.js, pilot-local/runtime-config.mjs, pilot-local/install.mjs, tests/pc11.test.mjs, integration/pc11.visual.mjs, integration/pc10.integration.mjs (nome+bytes nesta ordem): 3f7ed65404f3df5e2e3e7e874224f6491e59abb516b31a01b5e6cdc8a9f0f1f7.
