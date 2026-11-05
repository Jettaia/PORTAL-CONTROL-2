# Feedback visível ao criar contratação
## As Is
ADM tenta criar e percebe ausência de efeito. SQL de produção, somente leitura: prestador da imagem já possui contratação nº2 LIBERADA em 2026-11-05. Duplicidade é recusada por regra existente; mensagem global fica acima do formulário, fora do viewport após clicar.
## To Be
Exibir resultado da criação junto ao botão, preservando o bloqueio de duplicidade e os valores digitados.
## Requirements
1. Exibir validações e erros da criação no próprio formulário.
2. Manter criação válida e proteção de duplicidade/permissão existentes.
## Acceptance Criteria
1. Após 409 de duplicidade, mensagem é visível no viewport ao lado do envio; dados preenchidos permanecem e botão é liberado.
2. Valor inválido recebe feedback local sem POST; corrigindo dados, sucesso continua abrindo contratação.
## Principal Regression Test
node integration/pc04-create-feedback.visual.mjs: browser real com formulário/CSS/JS e API sintética, clique após preencher e rolar; mensagem deve aparecer dentro do formulário e viewport. Antes existe apenas aviso global fora do formulário; após feedback local é visível.
## Testing Plan
Cenários ADMIN de duplicidade, validação de valor e criação válida. Regressão HTTP PC04 e gate completo. Sem criar contratação real de produção para diagnóstico.
## Implementation Plan
1. Teste de fluxo e RED.
2. Mensagem local para criação, reaproveitando texto/resultado do fluxo atual; GREEN.
3. Revisão proporcional, publicação seletiva e repetição do browser com assets públicos e API sintética.

## Evidência
Consulta de produção somente leitura confirmou contratação nº2 LIBERADA para Testador um em 05/11/2026; catálogo ADMIN permite operar, todos os catálogos necessários existem, MFA desativado. Sem escrita operacional.
RED: node integration/pc04-create-feedback.visual.mjs falhou porque o aviso 409 não existe dentro do formulário. GREEN após correção, incluindo valor inválido sem POST e criação válida simulada. node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/chapa-production.test.mjs:78/78.
Screenshot artifacts/pc04-feedback/duplicate.png inspecionada. Regra de duplicidade e backend inalterados. Outros trabalhos locais de exclusão de tablet não pertencem ao pacote desta correção.
