# Detalhes da contratação — padrão branco dos cadastros

## As Is
Nova contratação segue os modais de prestador/usuário; consulta ainda usa faixa azul e conteúdo com recuos próprios.

## To Be / Requirements / Acceptance Criteria
Aplicar superfície branca, borda/radius/sombra, título, fechamento e campos do padrão recém-aprovado à consulta. Preservar as seis abas, indicadores, dados, ações, permissões, locks, payloads e navegação de teclado. Manter largura operacional da consulta para acomodar abas; celular com rolagem de abas e interna, sem overflow horizontal do modal.

## Principal Regression Test / Testing Plan
Mudança cosmética sem comportamento novo: usar a suíte existente `integration/pc04-model-a-ui.test.mjs`, que cobre criação → consulta, seis abas, tokens, horários, valor, cancelamento/liberação, locks e somente leitura. Capturas reais de desktop/celular geradas por essa suíte, com HTTP sintético. Sem nova suíte para CSS reversível de baixo impacto.

## Implementation Plan
Compartilhar somente regras visuais do modal aprovado entre create/detail; estilos específicos para header/contexto, abas e rodapé de consulta; sem edição de JavaScript. Executar regressão, inspecionar capturas e registrar hashes/resultados. Sem backend, gravação no banco ou deploy.

## Resultado
Alterado somente public/pc04.css nesta rodada. Header branco, título escuro, fechamento discreto, borda/sombra/radius e recuos compartilhados com criação/cadastros. Consulta mantém 900px para suas seis abas, com aba ativa laranja, contexto e situação visíveis, footer branco e controles no padrão. Dados e fluxos JavaScript permanecem os mesmos.

`node --test integration/pc04-model-a-ui.test.mjs`: PASS 1/1, sem skips, 18 verificações MFA simuladas e 9 escritas HTTP controladas; cobre transição criação/detalhe, abas, teclado, tokens, horários, revisão, cancelamento/liberação, bloqueios e consulta sem edição. Nenhuma escrita no banco real. Evidências/hashes: artifacts/pc04-model-a-25008/evidence.json; capturas desktop-summary, desktop-token, desktop-history e mobile-locked/mobile-pending/mobile-readonly inspecionadas em tema claro, 1531×960 e 390×844. Fonte real com dados sintéticos; não certifica SQL/auth reais. Sem overflow horizontal do modal/celular. Detector Impeccable e diff check focados sem achados.
