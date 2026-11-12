# Nova contratação — padrão visual dos cadastros

## As Is
PC04 usa o mesmo modal azul e rodapé de consulta também na criação. Prestadores/usuários usam modal branco de 580px, padding 30px, título 23px, fechamento discreto e ações com divisor à direita.

## To Be / Requirements / Acceptance Criteria
1. Aplicar a referência existente ao modal inteiro de nova contratação: branco, borda/radius/padding, título, campos, cancelamento e ação laranja à direita.
2. Preservar oito campos, busca de prestador, comparação de valor, permissões e payload de criação. Remover subtítulo redundante e rodapé duplicado somente na criação.
3. Não modificar o visual de consulta. Criação concluída deve voltar corretamente ao modo de detalhe, com abas e campos operacionais.
4. Desktop/celular sem corte de campos, rolagem interna quando necessária, fechamento por botão/cancelar/Escape.

## Principal Regression Test / Testing Plan
Mudança visual reversível: sem nova suíte de testes, conforme instrução do ambiente para mudanças de baixo impacto. Executar regressão existente `integration/pc04-model-a-ui.test.mjs`, que cria contratação e transita para detalhe/abas/locks. Comparar capturas e estilos computados dos modais reais de prestador/usuário com o alvo, com dados HTTP controlados e sem gravações reais.

## Implementation Plan
Discriminar modo create/detail no modal existente; aplicar CSS apenas ao modo create; alinhar ações do formulário e reduzir texto redundante; validar referências, viewports e fluxo existente.

Referências: public/pc03.css #pc03NewDialog e public/pc01.css .pc01-dialog. Não aplicar nosso-design (Jetta Control excluído do escopo dessa skill). Serena/LAD indisponíveis. Sem mudança de regras/backend, banco ou deploy.

## Resultado
Aplicado em public/pc04.js e public/pc04.css. Modo create usa superfície canônica branca 580px/30px/14px, borda/sombra equivalentes aos cadastros, título sem subtítulo, formulário preservado e ações à direita com Cancelar + Criar contratação. Rodapé de consulta oculto apenas na criação. Ao salvar, renderDetail restaura explicitamente o modo detail; a consulta mantém header/abas existentes.

Regressão existente `node --test integration/pc04-model-a-ui.test.mjs` passou (1/1): criação, transição para detalhe, abas, tokens, revisão, locks e encerramento, com HTTP controlado. Não houve gravação no banco real. Capturas de referência antes da alteração: artifacts/contract-create-style-1794490079995. Evidência final: artifacts/contract-create-style-1794490178469/evidence.json e imagens de prestador/usuário/contratação em 1531×764 e 390×844, tema claro, catálogo sintético, HTML real servido em localhost:3211. Campos longos e ações ao fim da rolagem mobile verificados; oito campos mantidos. Cores/borda/sombra/radius/padding desktop coincidem com referências; diferença mobile de 4px de largura decorre do limite nativo herdado e não gera corte.

Detector Impeccable, sintaxe e diff check focados passaram. Sem alterações nos demais modais, módulos, regras ou trabalhos anteriores do workspace.
