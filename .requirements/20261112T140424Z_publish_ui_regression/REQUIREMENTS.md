# As Is
Publicacao autorizada das alteracoes locais. Regressao serial: 490/492; preview e sidebar aguardam #pc04Page form removido pelo modelo A. Imagem candidata e endpoints aprovados.

# To Be
Publicar o modelo aprovado com regressao de navegacao e logout atualizada.

# Requirements
1. Atualizar somente o alvo de espera dos dois testes para a barra de filtros visivel do modelo atual.
2. Manter navegacao, estados vazios, recusa de escrita, sidebar desktop/mobile e logout existentes.
3. Publicar fontes commitados, com backup e validacao autenticada. Dados e schema preservados.

# Acceptance Criteria
1. Os dois testes passam sem alterar produto, timeout ou assertions de fluxo.
2. Suite completa passa sem falhas/skips; arquivos publicados coincidem com a imagem.

# Principal Regression Test
node --test --test-concurrency=1 integration/preview-ui.test.mjs integration/sidebar-logout-ui.test.mjs
RED comprovado na regressao: ambos aguardaram formulario inline inexistente. GREEN esperado com a barra real de filtros.

# Testing Plan
Dois testes focados e regressao completa serial. Prova candidata e publica de consultas autenticadas, assets e exportacoes.

# Implementation Plan
Substituir somente #pc04Page form por #pc04Page .pc04-filters nos dois testes; verificar; commit e push; promover a imagem testada.

Serena/Lad ausentes nesta sessao. Sem mudanca de requisitos funcionais. Referencia: https://playwright.dev/docs/api/class-locator#locator-wait-for (12/11/2026).
