# Colunas e situações da tabela de contratações
## As Is
Prestador e depósito aparecem juntos; data ISO; situação é texto sem cor.
## To Be
Oito colunas na ordem solicitada, data dd/mm/aaaa e situação com cor distinta.
## Requirements
1. Número, Prestador, Depósito, Gestor responsável, Data do serviço, Valor, Situação, Ação.
2. Data de serviço em dd/mm/aaaa sem conversão de fuso.
3. ABERTA em âmbar, LIBERADA em verde, CANCELADA em vermelho, mantendo rótulo textual.
4. Preservar consulta, paginação e botão Abrir; tabela com rolagem interna no mobile.
## Acceptance Criteria
Exatamente oito colunas separadas; valores alinhados; data 2026-10-30 aparece 30/10/2026; três estados com fundos distintos e texto legível; Abrir chega à contratação correta; sem escrita/API nova.
## Principal Regression Test
`integration/contracts-table.visual.mjs`: componente e CSS reais em Edge headless; antes falha no cabeçalho combinado, depois passa oito colunas, datas, cores e ação.
## Testing Plan
Prova headless com HTTP sintético, screenshots desktop/mobile e inspeção de pixels; teste existente PC04 para preservar ações. Backend e banco não alterados, sem necessidade de ensaio SQL.
## Implementation Plan
Teste red; separar colunas e formatar data; badges/CSS; teste green e inspeção, conferir script servido no piloto.
## Ferramentas
smart-orchestrator em modo direto, jetta-qa com prova focal do componente. Serena/Lad indisponíveis conforme inventário; sem dependências novas.

## Resultado
- Implementado em public/pc04.js e public/pc04.css: oito colunas, data sem fuso e badges ABERTA/âmbar, LIBERADA/verde, CANCELADA/vermelho. Detalhe usa a mesma data e badge para consistência.
- Red literal do teste headless: cabeçalho antigo Prestador / depósito divergiu das duas colunas pedidas. Green após alteração.
- `integration/contracts-table.visual.mjs` PASS com Edge headless/HTTP sintético: cabeçalhos e conteúdo, 01/03/2026 sem deslocamento de dia, três fundos resolvidos distintos, Abrir ID2, zero mutações, 1440/390 sem overflow externo e ação alcançável pela rolagem interna.
- Capturas em artifacts/contracts-table inspecionadas com view_image (desktop, mobile e mobile rolado até situações/ações); hierarquia e estilo existentes preservados.
- `node --test tests/pc04.test.mjs`: 46 PASS. Sintaxe PC04 PASS. Banco e backend não alterados, sem migração/reinício necessários; fetch no piloto confirmou JS/CSS novos servidos em 127.0.0.1:3211.
- Sem commit, push ou publicação externa; alterações anteriores preservadas.
