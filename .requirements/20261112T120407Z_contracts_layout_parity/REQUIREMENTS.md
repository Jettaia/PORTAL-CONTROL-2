# Contratações — fidelidade ao modelo A e exportação

## As Is
Usuário relata aplicação real diferente da prévia aprovada e menu Exportar sobrepondo Excel/PDF. Teste reproduziu em 1531×764: itens de 110×58 px, y=219 e 262 (15 px de sobreposição). CSS global max-width:100% limita botões ao details de 110 px; itens posicionados individualmente em offsets fixos.

## To Be
Restaurar composição do modelo A aprovado, mantendo toda regra real de backend, permissões, datas completas, exportação e copiar token. Somente local, sem deploy/push/banco.

## Requirements / Acceptance Criteria
1. Exportar abre lista única com largura própria, itens no fluxo normal, texto em uma linha e sem sobreposição. Critério: caixas não se interceptam; largura >=180 px; dentro do viewport desktop/celular; download e validações existentes preservados.
2. Filtros principais em uma linha compacta: busca prestador/número, depósito e situação. Critério: altura desktop <=48 px; filtros adicionais/aplicar/atualizar disponíveis em Mais filtros, sem impor altura permanente; parâmetros atuais preservados.
3. Contadores clicáveis e pontos coloridos, tabela com densidade/cores do modelo A, ação por seta. Critério: contagens identificadas como página, status legíveis, ações acessíveis, paginação/rolagem de 15 preservadas.
4. Popup com cabeçalho, nome, situação, resumo em seis grupos, tokens em duas linhas com copiar, valor atual destacado. Critério: mesmas abas e operações reais, dados adicionais preservados em detalhes recolhidos, nenhuma simulação ou perda de permissão.
5. Verificação com shell do piloto local e comparação da referência arquivada em condições equivalentes. Critério: capturas novas desktop 1531×764 e celular 390×844, menu aberto, tabela, resumo/tokens/valor; nenhum overflow e nenhuma regra real alterada.

## Principal Regression Test
`node --test integration/pc04-layout-parity-ui.test.mjs`. Red confirmado antes da correção: caixas Excel/PDF se interceptam e texto quebra; exerce scripts e CSS reais com HTTP sintético. Também exige toolbar compacta, seis grupos no resumo e tokens em linhas separadas.

## Testing Plan
Executar teste novo e regressões PC04 model A/planned/export, PC05 token copy e anotações/rolagem. Adaptar somente seletores do percurso visual se necessário. Smoke renderizado no shell servido em 3211 com API interceptada, sem escrever dados reais. Verificar CSS calculado, capturar referência e implementação no mesmo viewport/dados, registrar hashes.

## Implementation Plan
1. Red e diagnóstico das dimensões (concluído).
2. Menu com container, remover offsets e limites herdados; toolbar e apresentação do A preservando contratos.
3. Popup com grid/resumo e organização visual do A, sem mudar handlers.
4. Green, regressões e evidências.

## Ferramentas
Skills diagnosing-bugs, impeccable e TDD vigente. Serena/Lad indisponíveis. Contratos de dialog/clipboard previamente consultados nesta sessão; nenhuma API externa nova.

## Diagnóstico confirmado
1. O limite global max-width:100% reduzia itens absolutamente posicionados à largura do details. As duas linhas de texto faziam os botões crescerem além dos offsets fixos. Correção: container do menu com largura própria e botões no fluxo normal, sem offsets individuais.
2. A tela real acrescentara labels e ações sempre abertas, contadores estáticos e resumo linear. Correção: restaurar busca/seletores sem labels visuais, contadores clicáveis, ação por seta, resumo de seis grupos em duas colunas, tokens em duas linhas e valor atual destacado, conforme referência renderizada.
3. O CSS compartilhado usa `:is(...,#pc01Users,...)`, elevando a especificidade mesmo ao casar pc04-table. A ordem de carregamento restaurava a borda e raio da tabela. Correção escopada ao container PC04, confirmada via CSS calculado (borda 0 e raio 0); sem mudar o design de outros módulos.

## Resultado
- Red: teste novo falhou nas caixas Excel/PDF sobrepostas. Green: passou com largura >=180 px e sem interseção, branco preservado em uma linha, dentro do viewport em 390/700/1531.
- `node --test --test-concurrency=1 integration/pc04-layout-parity-ui.test.mjs integration/pc04-model-a-ui.test.mjs integration/pc04-planned-ui.test.mjs integration/pc05-token-copy-ui.test.mjs integration/pc04-export-ui.test.mjs integration/annotated-layout-ui.test.mjs`: 6/6. Inclui busca numérica/nome e limpeza dos parâmetros, contadores/filtro de situação, exportação, CRUD, versão, MFA, horários, tokens/cópia/fallback, consulta sem permissão, bloqueios, sessão e rolagem.
- Teste de paridade também executado com PC04_PARITY_URL=http://127.0.0.1:3211/: passou sobre HTML/CSS/scripts do piloto ativo, interceptando apenas APIs com fixtures. Nenhuma escrita em dados reais.
- Comparação visual lado a lado usa a branch aprovada codex/prototype-contratacoes-20261112 e um registro idêntico em ambas as renderizações. Mesmo HTML de shell do piloto, tema claro, 1531×764 e 390×844. Referência conserva apenas os indicadores de protótipo; aplicação mantém o aviso real do piloto e as permissões. Extras de negócio permanecem em Mais filtros/Mais informações; contagens continuam explicitamente da página, e atualização/paginação ficam no rodapé.
- Capturas finais e hashes são registrados pelo script `.scratch/compare-contracts-layout.mjs` em diretório novo `artifacts/pc04-parity-final-<timestamp>/evidence.json`. Ver também `artifacts/pc04-model-a-19156/evidence.json` para dados extremos, vazio e bloqueios da regressão real.
- `node --check` nos JS alterados e `git -c core.whitespace=cr-at-eol diff --check`: passaram. Detector Impeccable em pc04.js/pc04.css: sem achados.
- Somente alterações locais; sem push, deploy, alteração de esquema ou dados do banco. Alterações anteriores de app.js/index.html/avatar preservadas.
