# Restaurar navegação ao atualizar

## As Is
navigation.js inicia em inicio; PC04 mantém contratação/aba somente na memória.

## To Be
F5 mantém tela, contratação e aba e consulta novamente os dados autorizados.

## Requirements
1. Registrar a tela atual na URL e restaurá-la após autenticação.
2. Registrar contratação aberta e aba, reabrindo-as após carregar catálogo/lista e detalhe atualizados.
3. Fechar detalhe e sair da conta removem o estado correspondente; destino inválido ou indisponível tem recuperação segura.
4. Preservar aparência e mudanças anteriores. Tokens e formulários não salvos não são persistidos.

## Acceptance Criteria
1. Reload em Tablets/Contratações conserva a tela.
2. Reload em Tokens reabre mesma contratação/aba e reflete entrada consumida desde a última leitura.
3. Reload após fechar não reabre modal; logout limpa navegação; ID inacessível não exibe dados nem repete abertura; hash inválido volta ao início.
4. Sem escritas API por restauração ou persistência de tokens.

## Principal Regression Test
node --test integration/reload-navigation-ui.test.mjs. Browser real usa reload e componentes do shell com HTTP sintético para comprovar encadeamento auth/navegação/detalhe; antes falha voltando ao início.

## Testing Plan
ADMIN/GESTOR: reload de página, detalhe e abas; dados atualizados; fechamento, logout, destino inválido/403. Regressão PC04 e tablet/provider existente. Sem alteração visual ou SQL.

## Implementation Plan
1. Teste de reprodução e red.
2. Persistir rota em fragmento via history.replaceState e restaurar somente após login.
3. Persistir detalhe/aba e reabrir sequencialmente após lista, preservando controle de concorrência.
4. Green e regressões; verificar arquivos servidos pelo portal local sem reiniciar backend desnecessariamente.

Serena e Lad indisponíveis nesta sessão. Referência API: https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState

## Resultado
- RED: node --test integration/reload-navigation-ui.test.mjs falhou após reload em Tablets, que voltava ao início.
- GREEN: mesmo teste aprovado, incluindo reload em contratação/aba Tokens e Histórico, nova leitura que reflete entrada 08:03, fechamento, logout, 403 sem reabertura repetida, hash desconhecida e feature PC04 desligada sem buscar detalhe. Somente POST de logout; restauração sem escrita.
- Regressão: node --test integration/reload-navigation-ui.test.mjs integration/pc04-model-a-ui.test.mjs integration/pc04-planned-ui.test.mjs integration/tablets-provider-ui.test.mjs — 4 PASS, zero skips/falhas. Caso extra flag desligada passou em rodada focal posterior.
- node --check public/navigation.js e public/pc04.js; git diff --check: PASS.
- Revisão independente Luna high, somente leitura: aprovado sem achados materiais.
- Local http://127.0.0.1:3211 serve navigation.js com routePage e pc04.js com saveDetailRoute via HTTP 200. Não houve alteração SQL ou backend; runtime ativo preservado. Sem publicação.
- Estado salvo somente na hash (tela/ID/aba), sem token nem rascunho. A primeira atualização carrega o código novo; navegações seguintes são restauráveis.
