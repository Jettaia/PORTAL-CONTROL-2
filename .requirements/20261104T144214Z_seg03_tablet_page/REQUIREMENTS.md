# SEG-03 — respeitar a flag PC05 nas páginas de tablet

## As Is
Com pc05 desligado, /tablet.html retorna 404, mas /tablet-pc05.html é entregue pelo middleware estático com 200.

## To Be
As duas páginas ficam indisponíveis quando pc05 está desligado/ausente e continuam disponíveis quando ligado.

## Requirements
1. Condicionar ambos os caminhos HTML à flag pc05 antes da entrega estática, incluindo nomes equivalentes normalizados pelo bloqueio já existente (URL codificada, barras, caixa e sufixos NTFS).
2. Preservar conteúdo da página com pc05 ligado e os gates de sessão, origem e credencial do tablet existentes.

## Acceptance Criteria
1. GET e HEAD sem sessão para /tablet.html e /tablet-pc05.html retornam 404 com pc05 false ou ausente; variantes não expõem HTML. GET retorna erro Nao encontrado, HEAD sem corpo.
2. Com pc05 true, ambos retornam 200 e mesmo HTML contendo /tablet-pc05.js. Os testes existentes dos gates tablet continuam passando.

## Principal Regression Test
Novo caso SEG-03 em tests/pc05-app.test.mjs: node --test tests/pc05-app.test.mjs. Deve falhar antes com /tablet-pc05.html retornando 200 quando desligado, e passar depois com 404. Usa createApp/express.static e HTTP reais, loopback e porta efêmera, sem banco.

## Testing Plan
RED/GREEN, GET/HEAD com flag ligada/desligada/ausente; variantes da URL quando desligado; testes existentes de PC05 e suíte principal. Sintaxe dos arquivos alterados; revisão independente focal de segurança.

## Implementation Plan
1. Adicionar regressão no runner existente e comprovar a falha.
2. Aplicar guard PC05 sobre o nome normalizado já usado pela SEG-02, antes de express.static.
3. Repetir provas e registrar resultados no relatório existente.

## Resultado
- RED: /tablet-pc05.html recebeu 200 com pc05=false, em vez de 404.
- GREEN: GET/HEAD das duas páginas com flag false/ausente/true e aliases com flag desligada; página ativa idêntica em ambos os caminhos.
- Lote focal PC05 + SEG-02: 57/57, sem falhas/pulos.
- Suíte principal: node scripts/test-all.mjs, 384/384, sem falhas/pulos, incluindo SEG-01/02.
- Sintaxe focal dos dois arquivos e diff check (CRLF preservado): aprovados.
- Revisão independente review_seg01 (GPT-6.1 Sol): PASS, lote focal reexecutado 57/57.
- Registro em docs/Relatório.md. Sem banco real, commit, push ou deploy.
