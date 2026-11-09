# As Is
O botão Encerrar sessão está no final do conteúdo do dashboard compartilhado.

# To Be
Encerrar sessão no canto inferior esquerdo, dentro da barra azul, em todas as telas do portal.

# Requirements
1. Mover o botão existente para o rodapé da sidebar compartilhada.
2. Preservar o fluxo de logout e ocultar a ação sem sessão.
3. Manter acesso em menu extenso, barra recolhida e celular.

# Acceptance Criteria
1. Um único botão dentro da sidebar, visível junto à base em desktop, sem acompanhar a rolagem do conteúdo.
2. Clique envia o POST existente e retorna à tela de login; a ação some ao sair.
3. Menu rola independentemente; barra recolhida oferece ícone com nome acessível; celular mostra saída no menu expandido.

# Principal Regression Test
`node --test integration/sidebar-logout-ui.test.mjs`: usa o frontend real com HTTP de prévia e logout sintético. Antes falha porque o botão está fora da sidebar. Depois verifica localização renderizada, navegação, responsividade e clique de logout.

# Testing Plan
Teste de navegador desktop, altura reduzida, menu extenso/recolhido, celular e fim de sessão. Regressão adjacente: integration/preview-ui.test.mjs. Capturas desktop e celular com dados vazios de prévia, sem banco real.

# Implementation Plan
1. Escrever e executar regressão antes da mudança.
2. Mover markup, sincronizar visibilidade com estado existente e ajustar CSS do rodapé/menu.
3. Executar regressão, conferir capturas e checagem sintática.

# Validation
- Base HEAD: `043999899eaccb341ca66dbc769f8a08dce4a2ae`; workspace com alterações. SHA256 no aceite: index.html `8DA18576592B72BD60127F82C5EE17C9C00D48D54159847E43FE15ECD41E197E`; app.js `EB9FAD03E7D4F604D505D57F32A82752F625865A5558B668465E98D21B7F2310`; pilot-design.css `E2B495DD896DE7BF0C77337C106FAFE4F2CA7BAE9E5DCE483AC26F29D948370B`.
- RED: `node --test integration/sidebar-logout-ui.test.mjs` falhou em `saída deve pertencer à barra lateral` (0 !== 1), antes da implementação.
- GREEN: `node --test integration/sidebar-logout-ui.test.mjs integration/preview-ui.test.mjs` passou: 2/2.
- `node --check public/app.js` passou.
- Capturas inspecionadas: `artifacts/sidebar-logout/round-1/desktop.png` (1440×900, página rolada) e `mobile.png` (390×844, captura de página completa). Tema claro, sidebar azul, prévia com listas vazias. O banner amarelo pertence somente ao servidor de prévia.
- Geometria também validada em 1024×600 com grupos abertos e menu rolado/recolhido.
- Logout testado no frontend real, com resposta HTTP sintética; sem alterar sessões ou dados do banco.
- Detector visual executado uma vez: avisos em elementos preexistentes (tablets-card, login-card e sombras herdadas); nenhum aviso referente ao botão novo.
- Alterações anteriores e concorrentes no workspace preservadas. Não realizado deploy.
