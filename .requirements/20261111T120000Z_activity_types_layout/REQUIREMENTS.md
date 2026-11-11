# Tipos de atividade — aplicar opção C localmente

## As Is
Cadastro compartilhado em b24a.js com lista em tabela e formulário acima. Protótipo C aprovado: lista/detalhe sem ícones por atividade, azul e laranja alternados.

## To Be
A aba real apresenta o desenho aprovado com dados da API existente. Prestadores e demais telas permanecem com seus fluxos atuais.

## Requirements
1. Lista e detalhe lado a lado no desktop; empilhados no celular; sem ícones por tipo; dois fundos alternados estáveis ao filtrar.
2. Busca, filtro de situação, criação e edição com campos e contrato existentes, incluindo original para concorrência.
3. Respeitar podeEditar; preservar rascunho em erro; impedir envio duplicado; ignorar respostas antigas após troca de tela ou sessão.
4. Escopo local: sem deploy, migração, dados fictícios na aplicação ou alteração dos contratos de API.

## Acceptance Criteria
1. Desktop e 390 px sem overflow externo; seleção com destaque azul; lista com dois fundos.
2. Selecionar carrega o detalhe, salvar envia PUT, criar envia POST; busca e filtros atuam na lista real.
3. Consulta sem permissão não oferece escrita; conflito mantém formulário; sessão/troca não reapresenta dados antigos.
4. Arquivos de produção não carregam seletor de protótipo; somente frontend afetado.

## Principal Regression Test
`node integration/activity-types.visual.mjs`: frontend real servido por HTTP com API sintética aderente ao contrato. Falha antes por ausência da lista/detalhe. Não comprova SQL.

## Testing Plan
Fluxo de seleção/edição/criação, conflito, busca/filtros, consulta sem edição, troca para prestadores e retorno, desktop/mobile e captura visual. Rodar sintaxe e regressão adjacente do formulário compartilhado.

## Implementation Plan
Componente dedicado à atividade; desviar apenas servicos do renderer compartilhado; incluir CSS com escopo; executar fluxo de UI e regressão. Sem novas dependências ou APIs externas. Serena/Lad indisponíveis nesta sessão. Escopo confirmado pela escolha do usuário e pedido de aplicação local.

## Validation
- Red: teste de navegador falhou aguardando a lista/detalhe inexistente antes da implementação.
- Green: `node integration/activity-types.visual.mjs` aprovado; inclui edição com contrato original, POST, conflito preservando rascunho, permissões, busca, filtros, troca prestadores/atividades e resposta atrasada após encerramento da sessão.
- `node --test integration/mfa-enrollment-ui.unit.test.mjs`: 5 testes aprovados.
- Sintaxe dos arquivos JS alterados e do teste aprovada.
- Capturas inspecionadas em `artifacts/activity-types/desktop.png` e `mobile.png`, 1440 e 390 px.
- Servidor local existente `http://127.0.0.1:3211/` responde HTTP 200 e entrega os novos JS/CSS iguais aos fontes locais. Aberto no painel.
- Prova de interação usa API HTTP sintética com frontend real. Não houve escrita de teste no SQL operacional nem deploy.
- Ordem alfabética define duas cores alternadas, preservadas durante filtros.
