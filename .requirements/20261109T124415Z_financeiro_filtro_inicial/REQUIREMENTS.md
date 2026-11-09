# As Is
FIN01 inicia Situação em Todas e envia consulta sem situação. Limpar filtros e troca de autenticação usam form.reset.
# To Be
Situação inicial Aguardando pagamento, aplicada também na consulta. Demais situações continuam disponíveis. Limpar restaura padrão.
# Requirements
1. Selecionar AGUARDANDO_PAGAMENTO como default real do formulário, coerente com requests, reset e troca de conta.
2. Preservar consulta manual de Todas, Recibo gerado e Pago.
# Acceptance Criteria
Inicial e limpar enviam situacao=AGUARDANDO_PAGAMENTO; selecionar Todas remove filtro; selecionar Pago envia PAGO; autenticação restaura padrão sem estado de outro usuário.
# Principal Regression Test
node --test integration/fin01-default-status-ui.test.mjs: formulário real, requests reais interceptadas e conteúdo da tabela coerente com filtro. RED em seleção/request inicial; GREEN depois.
# Testing Plan
Headless com script real FIN01, inicial/submit/todas/pago/reset/troca de autenticação. Prévia existente adjacente. Sem dados operacionais, API ou banco alterados.
# Implementation Plan
Regressão RED, menor alteração no default select, GREEN e prévia. Somente local.
# Fora do escopo de implementação
Emissão em lote foi solicitada para discussão: apresentar proposta por data do serviço inclusiva, liberadas sem recibo, prévia/quantidade, confirmação, recibos individuais, falhas parciais e impressão conjunta. Não implementar lote sem decisão do usuário.

# Resultados
RED do teste UI: situação inicial vazia em vez de AGUARDANDO_PAGAMENTO. GREEN: node --test integration/fin01-default-status-ui.test.mjs integration/preview-ui.test.mjs, 2/2 sem skips/falhas. Exercitados script/formulário reais, consulta filtrada, seleção Todas/Pago/Recibo gerado, reset e troca de autenticação. Sintaxe dos arquivos e diff --check aprovados. Alteração somente no atributo selected do formulário público; API, banco e autorização preservados. Sem emissão de recibo, commit, push ou deploy. Emissão em lote permanece proposta, sem implementação.
