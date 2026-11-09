# As Is
Token some da tela após 30 segundos e ao ocultar a aba; não há botão de cópia.
# To Be
Último token gerado permanece visível até substituição, saída da conta ou troca de contratação/contexto. Botão copia somente o código, com confirmação e seleção manual se bloqueado.
# Requirements
1. Remover temporizador de ocultação e mensagem dos 30 segundos, preservando validade e uso único do servidor.
2. Exibir Copiar token com código selecionável; sucesso só após escrita na área de transferência e alternativa manual se API ausente/negada.
3. Substituir código ao gerar entrada ou saída; não persistir em armazenamento. Limpar ao trocar contratação, sair da conta ou deixar o módulo. Preservar ao alternar aba do navegador, inclusive para compartilhar/copiar.
# Acceptance Criteria
1. Gerar e avançar 31 segundos mantém o código; validade informada permanece.
2. Clipboard real recebe somente o código; erro/ausência oferece seleção manual sem falsa confirmação. Desktop e viewport mobile com toque têm controles acessíveis.
3. Outro token substitui anterior, falha na geração preserva anterior, troca de contratação e logout removem. Estado em memória apenas.
# Principal Regression Test
node --test integration/pc05-token-copy-ui.test.mjs: interface real com respostas sintéticas de emissão, relógio e clipboard nativos do navegador. RED: não existe campo copiável e o timer apaga. GREEN: gerar, esperar, copiar, substituir, negar cópia e trocar contexto.
# Testing Plan
Playwright headless instalado, ADMIN desktop e GESTOR viewport móvel/toque; clipboard real e fallback simulado. Suítes PC04/PC05 adjacentes para preservar contratos do servidor; não há alteração de banco/API.
# Implementation Plan
1. Executar regressão RED.
2. Ajustar apenas apresentação, seleção e cópia no PC04, reutilizando estilos locais.
3. Executar GREEN, testes adjacentes e inspecionar capturas focalizadas.
# Referências
https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText — contexto seguro, Promise e falha de permissão.
https://playwright.dev/docs/api/class-clock — avanço de relógio controlado.

# Resultados
- RED: teste UI falhou aguardando campo Token gerado no fluxo real de emissão.
- GREEN: `node --test integration/pc05-token-copy-ui.test.mjs` 1/1, ADMIN desktop e GESTOR com contexto mobile/toque. Geração, 31s com relógio nativo, troca de aba simulada via visibilitychange, clipboard real com leitura do código, substituição de entrada/saída, geração recusada preservando anterior, API clipboard negada/ausente e seleção manual, limpeza ao reabrir contratação e logout.
- Regressão adjacente: `node --test tests/pc04.test.mjs tests/pc05.test.mjs integration/pc04-planned-ui.test.mjs` 134/134, zero skips/falhas. Preserva autorização, validade/uso único e fluxo de contratação do servidor sem modificá-lo.
- Sintaxe dos arquivos JS/teste e `git -c core.whitespace=cr-at-eol diff --check`: PASS.
- Capturas desktop/mobile em artifacts/pc05-copy inspecionadas com view_image: botão/código legíveis, quebra de linha mobile e mensagem de seleção manual visível.
- Limitação: mobile validado por emulação Chromium/Edge com toque, não dispositivo físico Safari/iOS. Cópia real testada em localhost seguro; HTTP remoto sem Clipboard API usa seleção manual.
- Sem persistência de token em storage, alteração de API/banco, commit, push ou deploy. Arquivos estáticos disponíveis no portal local após atualizar a página.
- Execução direta; mudança focal de apresentação sem ampliar autorização. Serena/Lad indisponíveis nesta sessão, como registrado na tarefa anterior.
