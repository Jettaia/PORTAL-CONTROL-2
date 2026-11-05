# Simplificar os textos do tablet
## As Is
Cabeçalho JETTA CONTROL e subtítulo Registro de entrada e saída. Campo acompanhado do label Token de entrada ou saída e aviso sobre ordem dos registros.
## To Be
Cabeçalho JETTA. Manter Digite seu token e Use o código de oito dígitos recebido do responsável. Remover subtítulo, label visual e aviso conforme pedido.
## Requirements
1. Simplificar somente os textos indicados, incluindo título da aba Jetta.
2. Preservar nome e descrição acessíveis do campo, token visível, teclado, confirmação e ativação.
## Acceptance Criteria
1. Browser autenticado como tablet exibe marca JETTA e textos mantidos, sem textos removidos.
2. Campo nomeado Token e descrito pela orientação mantida; digitação/confirmação e revogação remota simulada continuam funcionando.
3. Layout em 768x1100 e 390x844 sem overflow horizontal e com controles acessíveis; capturas novas inspecionadas.
## Principal Regression Test
node --test integration/tablet-revocation-ui.test.mjs: formulário real ativado via UI, assertions de textos/nome acessível e fluxo de token. RED antes porque cabeçalho ainda contém CONTROL; GREEN após edição.
## Testing Plan
Reaproveitar integração de browser headless com arquivos reais e API sintética. Regressão HTTP das páginas e produção. Inspeção visual focal; sem banco ou operações reais necessários.
## Implementation Plan
1. Atualizar teste e executar RED.
2. Editar HTML preservando acessibilidade e comportamento; executar GREEN e regressões adjacentes.
3. Inspecionar capturas e rodar detector Impeccable.

## Resultado
RED: teste browser encontrou título Portal Control · Entrada e saída em vez de Jetta. GREEN: node --test integration/tablet-revocation-ui.test.mjs tests/pc05-app.test.mjs tests/chapa-production.test.mjs,6/6 sem falhas.
Browser Edge headless com HTML/JS/CSS reais e API sintética: ativação, nome acessível Token e descrição mantida, número visível/zeros/limite, confirmação/limpeza e revogação remota simulada passaram.
Capturas da rodada artifacts/tablet-simplified/2026-11-05T12-41-14-269Z/{768,390}.png inspecionadas. Viewports 768x1100 e390x844, tema claro, tablet autorizado, token sintético01234567 visível. Sem overflow horizontal, botões acessíveis e textos solicitados removidos.
Impeccable context permitiu refinamento no visual existente sem PRODUCT/DESIGN. Detector executado uma vez: avisos herdados sobre borda laranja inferior do cabeçalho e sombra; identidade preservada, sombra efetiva já anulada por box-shadow:none. Não introduzidos nesta edição.
Sem mudanças de backend, banco, commit, push ou publicação neste pedido.
HTML SHA256: abde1d8ca9a385f3b94463ccc743f4a9c4aa3585cd48635740431fefbd0a6fa9

## Ajuste solicitado: aviso de autorização
Retirar confirmação redundante Tablet autorizado. Digite seu token e orientação repetida ao reabrir tablet já autorizado. Manter Token aceito após confirmar e todos os avisos de erro. Sem cartão/espaço de mensagem quando vazio. Teste real de ativação e reload deve ter mensagem vazia/oculta; confirmação de token continua visível.

Aviso de autorização: RED confirmou texto redundante após ativação. GREEN6/6 no mesmo lote focal: ativação e reload sem texto/bloco vazio, Token aceito continua aparecendo após confirmar; retorno à autorização após revogação preservado. Capturas atualizadas da rodada artifacts/tablet-simplified/2026-11-05T12-43-59-027Z,390px inspecionada. Ajuste somente local.
