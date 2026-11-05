# Tablet sem textos de marca
## As Is
Cabeçalho JETTA, rodapé Jetta Transportes e orientação longa sobre oito dígitos.
## To Be
Remover cabeçalho e rodapé de marca, usar título de aba Digite seu token e orientação exata Use o código de 8 dígitos recebido. Manter Digite seu token, teclado e Token aceito.
## Requirements
1. Retirar marca e contêineres vazios correspondentes.
2. Substituir somente orientação solicitada; manter acessibilidade e operação.
## Acceptance Criteria
1. Browser mostra texto exato e não mostra Jetta no corpo/título.
2. Token continua visível, digitável e confirmável, com Token aceito após envio; nenhuma mensagem redundante de autorização reaparece.
3. Capturas 768x1100 e390x844 sem overflow horizontal.
## Principal Regression Test
node --test integration/tablet-revocation-ui.test.mjs: ativação e render real da página, assertions de textos/título e confirmação. RED em título de aba antigo; GREEN após HTML.
## Testing Plan
Reaproveitar browser headless real e API sintética, captura por rodada e regressão HTTP de páginas/produção. Nenhuma escrita operacional.
## Implementation Plan
1. Atualizar teste e executar RED.
2. Editar HTML e executar GREEN; inspecionar capturas.

## Resultado
RED confirmado no título antigo. GREEN6/6 no lote browser/páginas/produção. Capturas artifacts/tablet-simplified/2026-11-05T13-30-16-879Z em768/390; captura390 inspecionada: sem cabeçalho/rodapé vazio e orientação exata, teclado e ação preservados. Token aceito após confirmar validado pelo teste. Sem publicação neste pedido.
