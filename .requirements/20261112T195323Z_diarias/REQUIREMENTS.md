# Diárias — implementação local

## As Is
Contratações tem lista, detalhes e geração individual PC05. A opção C do protótipo organiza o dia por etapa, com dados fictícios.

## To Be
Nova aba Operação → Diárias com dados autorizados de contratações reais, grupos da opção C e geração de tokens individuais em lote. Pedido e remoções aprovados na mensagem do usuário. Somente checkout/ambiente local, sem push ou deploy.

## Requirements
1. Criar aba Diárias ao lado de Contratações para perfis operacionais com PC04/PC05, sem substituir a tela atual.
2. Remover breadcrumb, descrição, banner “Uma data. Um lote.” inteiro, rodapé explicativo da seleção e rótulo de prévia. Manter título, indicadores, filtros, grupos e barra de seleção.
3. Consultar por data e depósito autorizado; buscar por prestador/número. Carregar todas as páginas do dia antes de permitir seleção em lote. Limpar seleção ao mudar filtros.
4. Selecionar abertas individualmente ou todas as abertas visíveis. Grupos: aguardando entrada, em serviço, com pendência e liberadas/concluídas (inclui canceladas identificadas).
5. Revisar entrada, saída ou ambas. Usar elegibilidade atual, entrada consumida para saída, versão concorrente e permissões existentes. Nunca gerar antecipadamente a saída. Mostrar ignoradas e motivo.
6. Emitir sequencialmente pelos endpoints PC05 existentes, após confirmação e MFA existente; mostrar sucesso/código/validade ou falha por contratação. Não repetir automaticamente uma emissão e não repetir sucessos em novas tentativas. Limpar códigos ao fechar, navegar ou encerrar sessão. Não persistir códigos.

## Acceptance Criteria
1. Menu e rota #diarias funcionam; perfis sem operação não têm a aba. Contratações mantém o fluxo anterior.
2. Os cinco elementos anotados e controles de protótipo não aparecem na nova tela.
3. Data/depósito mudam consulta e limpam seleção; carregamento incompleto/falha bloqueia lote; itens de página seguinte também aparecem.
4. Checkboxes e contagens refletem seleção e elegibilidade, itens fechados não são selecionáveis.
5. Revisão consulta detalhes atuais; entrada manual não habilita saída; pendências/fechados não emitem; concorrência aparece como falha.
6. Lote misto produz entradas/saídas corretas, sem POST antes de confirmar, com falha parcial explícita. Códigos copiam individualmente e desaparecem ao sair; navegação durante resposta tardia impede próximos envios.

## Principal Regression Test
`node --test integration/diarias-ui.test.mjs`: portal real servido com Express e contratos HTTP controlados, navegação → filtros → seleção → revisão → geração → resultados, com paginação, entrada manual, pendências, conflito e transição de tela. Deve falhar antes porque o menu Diárias não existe. Não substitui prova SQL real.

## Testing Plan
- Red/green do fluxo público em navegador, desktop e mobile, controle de acesso, respostas tardias/logout e falha parcial.
- Teste do contrato público de listagem PC04 com indicador de entrada consumida sob feature flag PC05; regras e escopo já cobertos pelas suítes PC04/05.
- Suites adjacentes PC04/PC05 e navegação; sintaxe.
- Smoke local em 127.0.0.1:3211; não emitir tokens de contratações operacionais reais para tirar screenshots. Prova SQL de emissão usa dados sintéticos isolados quando disponível.

## Implementation Plan
1. Escrever testes de fluxo e listagem, executar red.
2. Acrescentar indicador de entrada consumida à listagem apenas quando PC05 ativo; preservar escopo e paginação.
3. Adicionar menu, rota e módulo Diárias com estilos próprios e endpoints existentes.
4. Rodar green, regressão adjacente e smoke local; registrar limites/evidências.

## Referências verificadas
Anotação posterior aprovada pelo usuário: retirar também “Selecione as contratações para o lote” da faixa de contagem da aba Diárias. Ajuste somente de texto, sem mudança de comportamento.

- https://playwright.dev/docs/api/class-locator
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal

Serena, Kindly e Lad indisponíveis nesta sessão. Pesquisa de documentação feita pelo web disponível.
