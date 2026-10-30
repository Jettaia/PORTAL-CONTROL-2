# Padronização visual do piloto

## As Is
O portal possui CSS acumulado por módulo: botões laranja com texto branco de baixo contraste, controles de alturas diferentes, formulários limitados globalmente a 650px e tabelas sem padrão comum. O piloto tem alterações locais anteriores, que devem ser preservadas.

## To Be
Preservar a identidade azul e laranja, confirmada pelo usuário, com uma camada compartilhada de apresentação para as telas ativas, sem alterar contratos de API ou regras operacionais.

## Requirements
1. Unificar tipografia, espaçamento, campos, botões, tabelas e foco nas telas do portal.
2. Manter uso em desktop, tablet e celular, com rolagem local de tabelas largas e ações acessíveis.
3. Aplicar a mesma linguagem à tela independente de entrada/saída, preservando alvos de toque maiores.
4. Preservar comportamento, textos, dados e alterações locais preexistentes.

## Acceptance Criteria
1. Ações principais azuis com contraste AA; destaque laranja na navegação; campos e botões de pelo menos 44px; tabelas com cabeçalho azul, linhas legíveis e numerais tabulares.
2. Sem transbordamento do documento a 1440, 1024 e 390px. Última coluna acessível por rolagem. Formulários usam a largura disponível e ações agrupadas.
3. Tela de tablet com teclado e confirmação de pelo menos 54px; token e estados existentes funcionam.
4. Navegação e testes visuais adjacentes passam; nenhuma escrita no banco é necessária.

## Principal Regression Test
`node integration/pilot-design.visual.mjs`: renderiza HTML/CSS/JS reais com respostas HTTP sintéticas, nomes longos, estados cheio/vazio/erro, checa geometria, apresentação e navegação. Antes: falha na padronização de controles e formulário financeiro. Depois: passa nos três tamanhos e preserva as ações existentes. Não certifica persistência SQL.

## Testing Plan
Capturas antes/depois e inspeção visual das telas reais. Verificar foco, altura, quebra de texto, rolagem extrema de tabelas, erro/vazio e tela do tablet. Executar verificações existentes de contratações, financeiro, cadastros, tablets e navegação conforme disponíveis. Sem testes unitários que comparem strings de CSS.

## Implementation Plan
1. Registrar a falha de apresentação no navegador e guardar capturas de referência.
2. Adicionar tokens e regras compartilhadas carregadas após os módulos. Validar a primeira tela financeira antes de ampliar as capturas.
3. Unificar a apresentação do tablet com os mesmos tokens.
4. Executar a matriz visual e regressões, inspecionar capturas, rodar detector Impeccable e registrar evidências e limitações.

## Ferramentas
Serena, Kindly e Lad não estão disponíveis nesta sessão. Não há adoção de nova API ou dependência. Verificação por navegador Edge/Playwright instalado e scripts do repositório.
