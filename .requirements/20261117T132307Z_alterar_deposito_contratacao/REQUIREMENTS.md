# Alterar depósito / centro de custo da contratação

## As Is
PC04 permite alterar horários/valor, mas não o depósito. Centro de custo é atributo do depósito. Numeração é sequencial por depósito e números excluídos não podem ser reutilizados.

## To Be
No Resumo, ação Alterar depósito / centro de custo, com destino autorizado, gestor válido e justificativa. Valor, prestador e horários preservados. Número novo sequencial no destino; antigo reservado e registrado em histórico.

## Requirements
1. Apenas operacional com acesso à origem e ao destino pode transferir contratação ABERTA, nunca liberada, não paga, sem horários pendentes.
2. Destino ativo, diferente da origem, com prestador ativo e vínculo vigente; conferir gestor ativo/autorizado (Gestor permanece o próprio usuário).
3. Transação serializável, lock PC04 e versão, com reserva do número antigo e próximo número no destino sem reutilizar números anteriores/excluídos. Preservar ID, valor e horários; invalidar tokens ainda não consumidos.
4. Motivo obrigatório; auditoria e histórico com depósito/CC/número anterior e novo, gestor e identidade/data.
5. UI no padrão existente, destinos filtrados por catálogo autorizado e vínculo; preservar alterações anteriores de horários.
6. Migração aditiva local idempotente, com backup verificado e prova de preservação. Nenhum deploy remoto.

## Acceptance Criteria
1. POST direto nega financeiro, origem/destino fora do acesso, paga/liberada/cancelada, pendência e versão vencida.
2. Nega destino inativo, vínculo revogado/prestador inativo e gestor inválido, mesmo com formulário adulterado.
3. ID e valores/horários intactos, versão incrementada; duas trocas não reusam número e criação posterior respeita reservas.
4. Histórico exibe origem/destino e justificativa; falha na auditoria reverte toda a transação.
5. Fluxo desktop/mobile: abrir, escolher destino/gestor, justificar, salvar e visualizar atualização/histórico; sem destinos mostra mensagem.
6. Instalação nova contém migração e atualização local conserva todas as linhas anteriores. Rollback do código mantém tabelas/reservas; não apagar eventos ou reservas após uso.

## Principal Regression Test
node --test tests/pc04-depot-change.test.mjs tests/pc04-depot-change-ui.test.mjs
Red: rota POST /deposito ausente e ação UI ausente. Testes passam pela rota, serviço e formulário reais, com apenas persistência/API isoladas. Complementar com SQL local real em transação revertida.

## Testing Plan
Positivo e negações no endpoint, reserva/concorrência/versionamento, rollback, UI e suites PC04/PC05/numeração/schema. Smoke com SQL real sem alterações persistentes nas contratações.

## Implementation Plan
1. Testes red de API/UI.
2. Migração e ação transacional; testes green API.
3. Formulário na aba Resumo, catálogo com CC e histórico legível; green UI.
4. Aplicar migração com backup, testar SQL real, reiniciar portal local e conferir.

## Constraints
Regras autorizadas pelo usuário. Skills tdd, surgical-patch e migration. Serena/Lad indisponíveis. Sem alterar regras financeiras.

## Evidência final
- Red API: POST /deposito não existia (404); red UI: ação inexistente.
- Green: 157 testes focados API/UI/PC04/PC05/exclusão/piloto passaram. Horários digitáveis: regressão também passou.
- SQL real: CONTRACT_DEPOT_SQL_TESTS=YES node --test integration/contract-depot-change.integration.mjs passou usando banco sintético descartável e HTTP com login/sessão reais. Cobriu repetição de trocas, concorrência, reservas, vínculo revogado, escopos origem/destino, falha de auditoria e exclusão posterior.
- Migração 46 local aplicada: backup verificado, 78 tabelas preexistentes preservadas. Teste de retry preservou contratos.
- Capturas desktop/mobile: artifacts/pc04-depot-change.
- Rollback seguro: desabilitar UI/rota de transferência, preservando o alocador atualizado que consulta as reservas; manter tabela/constraint/eventos. Código antigo que ignora reservas não é rollback compatível após a primeira transferência.
