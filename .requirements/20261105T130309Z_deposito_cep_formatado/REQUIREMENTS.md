# CEP formatado nos depósitos
## As Is
Backend aceita CEP com ou sem hífen e armazena oito dígitos. Tabela e edição exibem o valor bruto; formulário não aplica máscara enquanto digita.
## To Be
Tabela, cadastro e edição exibem CEP no formato 00000-000.
## Requirements
1. Formatar CEP da tabela sem alterar registros persistidos.
2. Aplicar máscara numérica no cadastro e preenchimento da edição, preservando zero inicial, limite e validação existentes.
3. Preservar original bruto para controle de concorrência e normalização do backend.
## Acceptance Criteria
1. CEP13178574 listado como13178-574; edição preenchida com mesmo formato.
2. Digitar13088150 produz13088-150, e01001000 produz01001-000. Colar formato pronto mantém valor. Cadastro e edição enviam CEP aceito pelo contrato atual.
3. Payload original da edição mantém CEP bruto recebido da API; salvar e reler exibe máscara.
## Principal Regression Test
node --test integration/deposit-cep-ui.test.mjs: browser real com tabela/formulário/JS e API sintética, criação e edição. RED antes no CEP listado sem hífen; GREEN após formatação.
## Testing Plan
Casos de tabela existente, cadastro com CEP bruto/formatado, edição e zero inicial, normalização no contrato e ausência de erros JS. Regressão PC02/produção. Sem banco necessário para delta exclusivo de frontend.
## Implementation Plan
1. Criar e executar teste RED.
2. Formatação compartilhada para tabela, edição e evento input; GREEN.
3. Verificar diff e registrar provas. Sem publicação solicitada neste pedido.

## Resultado
RED: browser encontrou tabela sem13178-574. GREEN: node --test integration/deposit-cep-ui.test.mjs tests/pc02.test.mjs tests/catalog-changes.test.mjs tests/chapa-production.test.mjs:19/19.
Fluxos browser com HTML/JS reais e API sintética: tabela, cadastro, colagem com hífen, edição, zero inicial e original bruto preservado no PUT. Backend mantém armazenamento normalizado em oito dígitos e testes de autorização/validação passaram. Sem alteração de schema, banco ou publicação.
