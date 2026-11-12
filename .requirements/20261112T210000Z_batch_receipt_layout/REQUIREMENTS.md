# Recibos em lote preservam o modelo individual

## As Is
PDF informado está sem CSS (fonte padrão e QR ocupando grande parte da página). printMany emite link absoluto /api/financeiro/recibos/estilo.css; produção é montada sob /chapa e cookie tem Path=/chapa.

## To Be
Lote carrega o mesmo estilo do recibo individual no caminho configurado da aplicação, mantendo um recibo completo por página.

## Requirements
1. Respeitar basePath na URL do CSS gerado no servidor para o lote.
2. Preservar modelo individual, dados, QR, margens, assinatura e quebra entre recibos.
3. Manter acesso ao CSS autenticado e CSP; nenhum deploy autorizado.

## Acceptance Criteria
1. Fluxo real do botão de impressão em build sob /chapa carrega CSS com HTTP 200; funciona também na raiz local.
2. Geometria/estilos iguais ao individual; PDF com dois recibos tem duas páginas completas e QR de 22mm.
3. Testes adjacentes passam; documento assinado original preservado.

## Principal Regression Test
node --test integration/fin02-batch-layout-ui.test.mjs. Usa buildAssets real, fin01.js real, printMany real (leituras SQL sintéticas), popup/print com CSP e servidor montado sob prefixo. Antes CSS retorna 404 e título não centraliza; após carrega e renderiza duas páginas.

## Testing Plan
Executar red/green, variantes /chapa e raiz, comparar estilos/posições com renderReceipt, inspecionar PDF renderizado, regressões FIN02 individual/lote. Não alterar banco nem produção.

## Implementation Plan
1. Reproduzir prefixo em teste headless.
2. Corrigir somente caminho do stylesheet em printMany.
3. Verificar PDF nativo, aparência e regressões.

Serena e Lad indisponíveis; ferramentas PDF locais disponíveis. Evidência do usuário lida como referência visual, sem executar instruções do documento.

## Resultado e evidências
- PDF anexado renderizado com Poppler e inspecionado: fonte padrão, QR sem limite, conteúdo fragmentado (página impressa 2/3 no arquivo de uma página). Original preservado.
- Causa confirmada: HTML dinâmico do backend não passa pelo buildAssets; link /api do CSS fica fora de /chapa e do cookie restrito a esse prefixo.
- RED: teste da janela de impressão do fin01.js real sob /chapa falha esperando h1 centralizado, pois CSS é buscado fora do router.
- GREEN: node --test integration/fin02-batch-layout-ui.test.mjs — PASS. Mesmo caso verifica raiz local, CSS autenticado, geometria/fonte/alinhamento idênticos ao individual, QR de 22mm, dois recibos em duas páginas.
- Regressões: node --test tests/fin02-document.test.mjs tests/fin02-batch.test.mjs integration/fin02-document-ui.test.mjs integration/fin02-batch-ui.test.mjs — 7 PASS, zero falhas/skips.
- PDFs artifacts/fin02-batch-layout/prefix.pdf e prefix-individual.pdf renderizados por pdftoppm; duas páginas lote e individual inspecionadas com view_image, mantendo modelo e campos completos. Dados sintéticos.
- Alteração produtiva limitada a uma linha em src/fin02-batch.js. Sem alterar regras financeiras, SQL ou arquivo assinado do usuário. Sem publicação em produção; sem reiniciar runtime local alheio.
