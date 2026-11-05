# Token visível no tablet
## As Is
O campo dos oito dígitos usa password e mascara os números.
## To Be
O usuário vê os dígitos enquanto preenche o token de entrada/saída.
## Requirements
1. Mostrar os oito dígitos do token no painel.
2. Manter teclado numérico, limite de oito dígitos, zeros iniciais, limpeza após confirmação e alteração anterior de revogação.
## Acceptance Criteria
1. Campo renderizado como texto sem mascaramento CSS; screenshot com token visível.
2. Teclado físico filtra não dígitos, teclado da tela preserva zero inicial e limite; confirmar envia o token e limpa o campo.
## Principal Regression Test
node --test integration/tablet-revocation-ui.test.mjs
Falha antes porque o campo real renderiza password; passa após mudar para text. Browser executa HTML/JS reais, API sintética.
## Testing Plan
Reaproveitar teste de browser existente; verificar tipo/cascata, digitação, confirmação, ausência de encerramento e revogação remota simulada. Regressão HTTP PC05 adjacente.
## Implementation Plan
1. Adicionar assertions ao browser e executar red.
2. Mudar somente type do campo de token para text; green e inspeção da captura.

## Resultado
RED confirmado no browser: password !== text. GREEN: 56 testes passaram com node --test integration/tablet-revocation-ui.test.mjs tests/pc05.test.mjs tests/pc05-app.test.mjs tests/chapa-production.test.mjs.
Verificados dígitos sem máscara CSS, filtragem, zero inicial, limite, envio e limpeza após confirmação; remoção anterior do encerramento preservada.
Captura artifacts/tablet-revocation/token-visible.png, Edge headless 768x1100, inspecionada visualmente. Nenhuma dependência ou API nova. Mudança de produto restrita ao type do campo code, mantendo inputmode numeric. Sem banco necessário para este delta. Sem deploy.
