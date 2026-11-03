# Recibo direto na tabela do Financeiro
## As Is
Tabela tem coluna Consulta/Detalhes; geração e impressão só no detalhe.
## To Be
Coluna Recibo imediatamente após Consulta, com Gerar recibo para ADM/Financeiro quando não emitido, e Abrir recibo para documento existente, inclusive leitura do gestor.
## Requirements
1. Reutilizar endpoints e regras de recibo existentes, sem alterações financeiras/backend.
2. Geração pela linha informa andamento, impede clique repetido, atualiza tabela e mostra detalhe com impressão; falha permite tentar novamente.
3. Recibo existente abre impressão original sem POST; gestor não gera; filtros/paginação/logout e detalhe existentes preservados.
## Acceptance Criteria
Coluna e ações em desktop/mobile; contrato correto no POST (ID da linha e corpo vazio/cabeçalho de proteção); recibo existente não gera novamente; teste por ADMIN/FINANCEIRO/GESTOR, erro/repetição e tabela vazia com colspan10.
## Principal Regression Test
`node integration/fin01-receipt-column.visual.mjs` com JETTA_PLAYWRIGHT_ROOT configurado. DOM/CSS reais e HTTP sintético com interação de clique na linha. RED esperado: coluna/ação ausente.
## Testing Plan
Teste principal headless e regressões fin01.visual, fin02/03 pertinentes; backend permanece inalterado e aproveita testes atuais de emissão/autorização se disponíveis.
## Implementation Plan
Teste/RED; coluna/ações reutilizando endpoint; GREEN e regressões; inspeção focal de captura; disponibilizar assets no piloto local e registrar provas.

## Resultado — concluído em 03/11/2026
- RED: teste principal falhou porque as últimas colunas eram Situação/Consulta, sem Recibo.
- GREEN final: `JETTA_PLAYWRIGHT_ROOT=C:\Users\Jetta\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules node integration/fin01-receipt-column.visual.mjs` PASS. DOM/CSS reais, HTTP sintético: ADM/Financeiro geram pela linha com ID correto/corpo vazio/cabeçalho web, erro permite repetir, duplo clique não duplica POST, tabela atualiza e detalhe oferece impressão, recibo existente abre sem nova emissão, Gestor não gera e pode imprimir existente; vazio colspan10; viewports1440/390 sem overflow da página.
- Regressões: `node integration/fin01.visual.mjs`, `node integration/fin02.visual.mjs`, `node integration/fin03.visual.mjs` PASS (filtros/paginação/detalhes/logout, emissão pelo detalhe/documento de impressão, baixa/anexo/desfazimento).
- Fronteira real reutilizada: `FIN02_SQL_TESTS=YES node --test integration/fin02.integration.mjs`, 1/1 PASS (~52s), emissão/reimpressão HTTP, persistência/snapshot, permissões, concorrência/versão em banco descartável. Backend não alterado.
- Revisão independente GPT-6.1 Sol medium por review_access: aprovada, sem achados materiais. Sintaxe/diff focados conferidos.
- Capturas artifacts/fin01-receipt-column/ADMIN-1440.png e demais personas/mobile; inspeção visual do botão/coluna ao lado de Detalhes. Capturas da regressão FIN01 validam contexto completo/cascata do portal e rolagem interna da tabela.
- Piloto local: identidade HMAC confirmada e /fin01.js remoto idêntico ao arquivo local atualizado. Mudança servida como asset estático, sem reinício ou migration. Nenhum recibo/dado real criado para teste. Sem push/deploy remoto. Suíte integral não executada.
