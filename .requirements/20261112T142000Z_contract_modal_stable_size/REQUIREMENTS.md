# Detalhes da contratação — janela estável entre abas

## As Is
Modal de detalhe tem altura automática limitada pelo viewport. Abas de conteúdo curto/alto alteram altura e centralização; rolagem ocorre na janela inteira.

## To Be / Requirements / Acceptance Criteria
1. Manter x/y/largura/altura do modal iguais ao alternar Resumo, Tokens, Horários, Valor, Cancelamento e Histórico no mesmo viewport.
2. Cabeçalho, abas e rodapé permanecem visíveis; apenas corpo rola. Reservar gutter para não mudar largura do conteúdo conforme aparece scrollbar.
3. Troca de aba começa o corpo no topo. Manter criação com altura automática, responsividade, permissões, campos e operações existentes.

## Principal Regression Test
Ampliar `integration/pc04-model-a-ui.test.mjs`: alternar as seis abas em desktop 1531×764 e celular 390×844, comparar boundingBox e posição do header antes/depois de scroll interno e verificar reset de scroll na troca. RED esperado por altura/y diferentes; GREEN após ajuste. A mesma suíte mantém cobertura de regras e operações.

## Implementation Plan / Testing Plan
Adicionar prova de geometria real e rodar red. Fixar altura de detail dentro do limite atual de viewport; usar coluna flex com corpo rolável de min-height 0 e gutter estável; resetar scroll do corpo ao trocar. Rodar regressão, inspecionar capturas e registrar hashes. Sem mudança no backend ou gravação no banco; HTTP sintético.

## Resultado
Corrigido em public/pc04.css e uma linha de public/pc04.js. Detalhe aberto tem altura de 94dvh, coluna flex, header/abas/footer sem encolhimento e corpo com overflow próprio/gutter estável. display:flex condicionado a [open] preserva o fechamento nativo. Criação mantém a altura automática. Ao selecionar aba, scroll do corpo volta ao topo.

RED confirmado: Tokens mudou y de 22.921875 para 33.28125 no viewport 1531×764. GREEN: suíte existente ampliada passou (1/1) comparando x/y/width/height nas seis abas em 1531×764 e 390×844, header imóvel após rolagem interna e reset de scroll. Cobertura anterior de criação/transição, operações, bloqueios e perfis continuou passando: 18 verificações MFA e 9 escritas HTTP simuladas, sem banco real.

Evidências/hashes: artifacts/pc04-model-a-34264/evidence.json. fixed-summary-1531 e fixed-summary-390 foram capturadas após rolar o corpo até o fim, provando frame/header/footer estáveis; fixed-tokens-1531/fixed-tokens-390 mostram a aba curta começando no topo dentro da mesma janela. Tema claro, conteúdo real dos módulos e dados HTTP sintéticos. Detector Impeccable, sintaxe e diff check focados passaram. Regras, abas, campos e backend preservados.
