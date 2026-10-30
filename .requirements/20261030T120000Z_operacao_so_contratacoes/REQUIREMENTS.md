# Operação somente com Contratações

## As Is
Operação contém Contratações, Planejamento legado, Acompanhar jornada, Apontamentos, Conferência e Fechamento. As telas antigas têm scripts e endpoints próprios e atalhos na fila financeira.

## To Be
Somente Contratações permanece em Operação; telas e endpoints exclusivos antigos são retirados. Regras e dados compartilhados com Contratações, parâmetros e Financeiro são preservados.

## Requirements
1. Remover os cinco itens antigos, suas telas, scripts exclusivos e destinos de navegação, inclusive atalhos financeiros.
2. Retirar endpoints exclusivos de planejamento, apontamentos, conferência e fechamento; manter políticas de limite em Parâmetros.
3. Preservar Contratações e serviços internos compartilhados, sem apagar dados ou alterações anteriores.

## Acceptance Criteria
1. O menu Operação contém apenas Contratações; eventos de navegação antigos não abrem telas removidas nem disparam seus carregamentos.
2. Requests GET/POST aos endpoints removidos retornam 404 sem acessar SQL; políticas e Contratações continuam registradas.
3. ADMIN, GESTOR e FINANCEIRO conseguem abrir Contratações pelo componente real; scripts carregados não produzem erros e não há links para destinos retirados.

## Principal Regression Test
`node integration/operation-navigation.visual.mjs`: serve o HTML e scripts reais com respostas de API sintéticas, abre Operação e Contratações por clique e tenta eventos antigos; deve falhar antes por conter seis itens e passar após a remoção. Não testa autorização do servidor, que não muda.
`node --test tests/operation-retirement.test.mjs`: createApp real, endpoints removidos e preservados sem SQL. Antes retorna 401 em endpoints legados; depois 404.

## Testing Plan
Red/green dos casos acima, testes adjacentes de Contratações e políticas, checagem de sintaxe e captura focal do menu. Sem mutações reais, deploy ou banco necessário.

## Implementation Plan
1. Adicionar regressões e registrar red.
2. Remover HTML/navegação/scripts antigos e atalhos financeiros; preservar CSS compartilhado e políticas.
3. Remover registro/implementação das rotas exclusivas e manter catálogo/políticas necessários a Parâmetros.
4. Rodar green, regressões e inspecionar captura do menu.

## Resultado e verificação
- Concluído: menu, destinos de navegação, HTML, scripts/CSS e fragmento exclusivos retirados; rotas antigas removidas. Tablet PC05 de Contratações preservado; fallback para tablet legado retirado. Catálogo/políticas e modelos internos compartilhados com Financeiro preservados. Nenhum dado ou schema alterado.
- Red: `node integration/operation-navigation.visual.mjs` mostrou seis itens em vez de Contratações; `node --test tests/operation-retirement.test.mjs` mostrou 401 em `/api/b3/atividades`, antes da retirada da rota.
- Green: os mesmos testes passaram. Navegador headless com HTML/scripts reais e APIs sintéticas cobre ADMIN/GESTOR/FINANCEIRO, clique em Contratações, fallback dos seis destinos antigos e abertura de Políticas. Zero erros JavaScript. Captura `artifacts/operation-navigation/sidebar.png` inspecionada: somente Contratações em Operação, padrões atuais preservados.
- `node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/operation-retirement.test.mjs`: 63/63 passaram. Após ajuste do contrato de retirada do tablet legado, `tests/pc05-app.test.mjs` também passou; última execução focal dos três testes de retirada/legado/tablet: 3/3 passaram.
- `node integration/contracts-table.visual.mjs`: PASS, tabela e ação Abrir em desktop/mobile, sem escritas.
- `node scripts/check-all.mjs`: 659 arquivos com sintaxe válida antes da exclusão final do gerador antigo. Arquivos JavaScript alterados depois também foram executados/verificados.
- `node scripts/test-all.mjs`: 351 testes, 350 passaram, 1 falhou. Falha preexistente em `tests/pc09.test.mjs`: `src/pc09-routes.js` ausente inclusive no HEAD, já documentada em `.requirements/20261029T150500Z_pc09_missing_files/REQUIREMENTS.md`. Nenhum teste excluído ou pulado para obter aprovação.
- Revisão independente GPT-6 Luna high: fragmento público órfão encontrado e corrigido; verificação final sem achados materiais.
- Limites: provas de UI com respostas sintéticas; sem SQL real, deploy ou validação de ambiente publicado. Autorização de Contratações coberta pela suíte existente de serviço/HTTP. Serena/Lad indisponíveis nesta sessão. `npm` ausente no PATH; executados diretamente os runners Node indicados pelo package.json.
