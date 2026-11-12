# Contratações — modelo A local

## As Is
PC04 real lista colunas separadas, formulário de criação inline e detalhe inline. As operações reais já incluem versões, MFA, autorização, aprovação de horários, revisão e cancelamento. Exportação Excel/PDF e cópia de token possuem testes existentes. Protótipo A aprovado pelo usuário, com popup por abas. Há alterações locais preexistentes em app.js/index.html/package.json que devem ser preservadas.

## To Be
Aplicar o desenho A ao módulo real, com criação em popup e detalhe por abas Resumo/Tokens/Horários/Valor/Cancelamento/Histórico. Reutilizar dados, formulários e endpoints reais, sem simulações ou importação dos arquivos prototype. Apenas trabalho local, sem push/deploy. Pedido atual confirma requisitos.

## Requirements / Acceptance Criteria
1. Tabela agrupada do A com navegação por prestador/Editar, filtros e paginação preservados. Nenhum total global inventado: contagens explicitamente da página. Critério: consulta e filtros continuam enviando parâmetros existentes, datas inclusive.
2. Criar contratação abre popup e usa POST atual. Critério: dados reais do catálogo, campos e comparação de valor preservados; sucesso exibe detalhe criado.
3. Editar abre popup acessível com seis abas. Critério: formulários existentes movidos para a aba correta, aba ativa preservada após salvar; horários previstos/reais com datetime completo e justificativas originais.
4. Tokens reais preservam autorização/MFA/regras e botão Copiar token existente com fallback. Critério: gerar/substituir entrada/saída e copiar continua pelo contrato atual; token limpo ao fechar popup, sair da aba Tokens, trocar sessão/página; requisições antigas não reabrem detalhe após fechamento.
5. Cancelamento com motivo e confirmação, liberação confirmada e bloqueios atuais. Critério: nenhuma alteração disponível após liberação/cancelamento; pendência bloqueia horários/tokens/liberação, preservando aprovação por perfil.
6. Excel e PDF mantêm formatos, colunas, filtros e endpoints atuais sem alterações de backend. Critério: testes existentes de exportação adaptados ao novo fluxo, mantendo suas verificações.
7. Layout responsivo azul/laranja com conteúdo real renderizado. Critério: capturas desktop e celular com nomes longos, vazio, popup e bloqueios; sem overflow da página ou do popup, rolagem da tabela local.

## Principal Regression Test
integration/pc04-model-a-ui.test.mjs, executado com `node --test integration/pc04-model-a-ui.test.mjs`. Exercita JS/CSS reais e cliques no portal, com HTTP sintético na fronteira API, sem simular componentes. Red esperado: botão Nova contratação inexistente. Green: criação, detalhe e transições reais funcionam, incluindo fechamento e bloqueios. Não certifica SQL/auth real.

## Testing Plan
Testes de UI do novo popup e adjacentes PC04 planned/export, PC05 copy e comparação PC07; testes de domínio/relatório sem mudança de regras. Rodar syntax checker. Evidência visual em diretório por rodada com viewport, estado e hashes. Executar smoke do runtime local existente quando disponível, sem dados sensíveis ou mutações de negócio. Não iniciar ERP Jetta: este projeto é Jetta Control.

## Implementation Plan
1. Escrever regressão principal e observar red.
2. Reorganizar módulo real em popup reutilizando os handlers existentes; agrupar tabela e manter filtros/exportação. Executar teste principal.
3. Adaptar testes que pressupõem formulário/detalhe inline para o novo percurso e executar regressões adjacentes.
4. Renderizar com scripts reais e dados de limite, corrigir layout e registrar verificação.

## Docs e ferramentas
Serena e Lad indisponíveis neste ambiente. Sem exigência de nova confirmação: usuário autorizou explicitamente o desenho e aplicação local. APIs nativas verificadas em MDN: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal e https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText (writeText exige contexto seguro e pode rejeitar; manter fallback). Mecanismos de API/autorização da aplicação não serão alterados.

## Resultado e evidência
- Red observado: `node --test integration/pc04-model-a-ui.test.mjs` falhou no clique Nova contratação ausente, antes da edição do código real.
- Green final: `node --test --test-concurrency=1 integration/pc04-model-a-ui.test.mjs integration/pc04-planned-ui.test.mjs integration/pc05-token-copy-ui.test.mjs integration/pc04-export-ui.test.mjs integration/annotated-layout-ui.test.mjs`: 5/5. Cobertura inclui criação, previsão com data/hora, horários reais, revisão/conflito de versão, cancelamento confirmado, liberação confirmada, pendência, consulta sem permissão operacional, token de entrada/saída/cópia com fallback, fechamento durante leitura, limpeza na troca de sessão, filtros/exportação/segurança de sessão, paginação e rolagem de 15 registros.
- Testes de domínio/HTTP/relatórios: `node --test tests/pc04.test.mjs tests/pc04-period.test.mjs tests/pc04-export.test.mjs tests/pc04-export-xlsx.test.mjs tests/pc05.test.mjs tests/pc07.test.mjs`: 180/180.
- `node scripts/check-all.mjs`: 792 arquivos, nenhuma falha (incluía os fontes de protótipo antes de arquivar). `node --check public/pc04.js` após a limpeza passou. Detector Impeccable em pc04.js/pc04.css: sem achados.
- Uma execução concorrente de cinco navegadores excedeu o timeout de navegação do teste de anotações. Reexecução serial, sem mudar timeout ou retirar assertions, passou. Capturas finais em `artifacts/pc04-model-a-7204/`, SHA/hashes em `evidence.json`: tema claro, 1531×960 e 390×844, nomes longos, lista de 22 registros e extremo de rolagem, vazio, criação, resumo, token, histórico, bloqueios e consulta sem permissão operacional. Capturas usam o portal real; somente HTTP é sintético. Renderização não certifica autenticação/SQL de produção.
- Correções visuais incluem escopo CSS contra pilot-design.css, abas/rodapé acessíveis na rolagem, foco/teclado, checkbox dimensionado e rolagem vertical somente acima de 15 registros. Filtros anteriores continuam disponíveis: prestador/depósito/situação à vista; número, centro de custo, gestor, valor e período em Mais filtros. Contagens rotuladas como Nesta página.
- Verificação HTTP read-only em `http://127.0.0.1:3211/pc04.js` e `/pc04.css`: status 200 e hashes idênticos aos arquivos locais. Runtime local existente não foi reiniciado; nenhum dado de negócio foi gravado nos testes.
- Exportação e cópia usam os endpoints/geradores/handlers reais existentes, sem mudança no backend. A cópia mantém o texto atual “Token de entrada/saída: código”. Nenhum script de protótipo é carregado na aplicação.
- Protótipo preservado na branch local `codex/prototype-contratacoes-20261112`, commit `443fd85b47ed8c4d1077907f5bca7b105cf2f71c`. Decisão validada: modelo A com popup por abas, exportação existente e copiar token. Conteúdo arquivado conferido byte a byte antes de remover os arquivos descartáveis desta checkout e encerrar apenas seu host em 4322. Branch corrente permaneceu a mesma; alterações reais seguem sem commit.
- Sem push, deploy, alteração de schema ou escrita em banco. Alterações anteriores em app.js/index.html e arquivos de avatar preservadas.
