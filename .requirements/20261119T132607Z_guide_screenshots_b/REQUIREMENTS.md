# Guia ilustrado — opção B

## As Is
Guia A integrado ao portal. Prévia separada com 28 capturas e três apresentações. Usuário aprovou B e pediu aplicação local.

## To Be
Guia integrado com texto e captura de cada passo lado a lado no desktop, coluna única em larguras menores e ampliação acessível.

## Requirements
1. Integrar as 28 capturas reais com dados de treinamento e destaques em todos os seis tutoriais.
2. Preservar índice, contexto, FAQ, leitura, login/logout e demais telas. Remover seletor/estado de prévia.
3. Ampliar imagem com opção de detalhes no tamanho original; celular abre no destaque. Fechar restaura foco. Navegação/logout fecham o visualizador.
4. Impressão inclui as imagens carregadas, sem afetar Ctrl+P de outras telas.
5. Arquivar alternativas em branch descartável e preservar os PNGs definitivos.

## Acceptance Criteria
1. Número de imagens corresponde aos 28 passos; imagens carregam e têm legenda e alternativa textual.
2. Sem scripts, estilos ou URLs de prototype na interface definitiva; ajuda e navegação continuam funcionando.
3. Zoom abre, alterna tamanho, fecha com Escape/botão e restaura foco. Sem overflow global em 1536, 768 e 390px.
4. Conteúdo de impressão contém imagens prontas, todos os assuntos e FAQs. Nenhuma impressão após sair do guia/logout durante carregamento.
5. Branch preserva fontes e assets da prévia com decisão registrada aqui.

## Principal Regression Test
integration/guide-ui.test.mjs estendido: fluxo de guia real com dados HTTP sintéticos, conferindo figuras e imagens de cada passo, ampliação, responsividade, impressão e regressões existentes. RED esperado: nenhuma figura/imagem nos passos.

## Testing Plan
RED/GREEN do teste integrado; navegação e depósito como regressões adjacentes; capturas reais com fixtures HTTP do piloto local; PDF/imagens prontas; sintaxe; revisão independente visual/código proporcional.

## Implementation Plan
1. Estender teste e confirmar RED.
2. Criar assets definitivos, renderização direta de figuras, visualizador com limpeza/foco e CSS B responsivo.
3. Carregar imagens antes de imprimir e validar contra regressão de impressão normal.
4. Conferir capturas, corrigir falhas materiais, arquivar/remover protótipos e registrar resultado.

Autorização: pedido explícito da opção B. Serena/Lad indisponíveis nesta sessão. Nenhuma mudança de backend/SQL ou solicitação de deploy.

## Arquivamento
Alternativas A/B/C e 28 PNGs preservados em `codex/prototype-guia-prints` (`6b312ccbf16ad18ac82ac2a7276986e09810cb08`). Base A congelada e variantes exercitadas via navegador antes da captura. Índice Git isolado; implementação definitiva não commitada. Arquivos e comando da prévia removidos da árvore corrente, preservando assets definitivos.

## Resultado final
Opção B integrada em public/guide.js e public/guide.css com 28 PNGs em public/guide-images/. Figuras são renderizadas diretamente com cada passo, sem observer de protótipo, variante ou backend novo. Desktop mostra instrução/captura lado a lado; tablet/celular usam coluna única. Visualizador acessível, detalhes em tamanho original e foco no destaque do celular. Dados e legendas de treinamento identificados explicitamente.

TDD: teste principal falhou RED com 0 !== 4 capturas e passou após integração. Regressões guide-ui, reload-navigation e deposit-cards: 3/3 PASS. Teste cobre 28 imagens decodificadas, legendas, ampliação, Escape/foco, impressão com imagens prontas, layout menor, sessão e logout. Sintaxe dos JS alterados e git diff --check aprovados.

Revisão independente encontrou preparo de impressão persistente após navegação enquanto PNG carregava. Regressão específica acrescentada antes da correção: RED 1 !== 0 contêineres após sair; corrigido com cancelPrint e identidade de printJob. GREEN mede contêiner ausente e mídia print normal ainda com PNG bloqueado, depois garante ausência de impressão tardia. Reviewer GPT-6.1 Sol medium (fallback Luna indisponível) reexecutou o teste e aprovou resolução SHIP.

Evidência final artifacts/guide-images-b-r3-2026-11-19T13-33-24-791Z/: sete cenários desktop/tablet/celular, reading-desktop.png e zoom-desktop.png, hashes e PDF. Zero pageerrors/overflow global. PDF conferido: seis assuntos, 28 imagens incorporadas, 40 páginas; sem impressão física. Capturas de QA usam piloto real com HTTP de treinamento; browser interativo também abriu o guia definitivo em sessão local autenticada e mostrou as figuras, sem operações de escrita.

Detector: aviso único sobre img sem src do diálogo fechado, preenchido antes de abrir e limpo ao fechar. Não há imagem quebrada visível; mecanismo validado pelo teste e revisor. Identidade e tokens Jetta preservados; composição B aprovada é local ao guia, sem regra nova global.

Critérios concluídos localmente. Implementação permanece sem commit, push ou deploy.
