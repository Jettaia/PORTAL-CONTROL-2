# Exclusão de contratações — preview aprovado

## As Is
PC04 permite cancelamento apenas antes da liberação. Não existe exclusão nem solicitação de exclusão. O financeiro FIN01/02/03 possui recibos, anexos e baixas; PC08/PC10 legados podem possuir pagamentos compartilhados e movimentos.

## To Be
Somente ADMIN ativo, validado no banco, exclui contratações de qualquer estágio e os registros financeiros exclusivamente vinculados. Coordenador, gestor e financeiro apenas solicitam no seu escopo. Admin analisa e executa manualmente ou recusa. Interface conforme último preview aprovado pelo usuário.

## Requirements
1. Exclusão ADMIN com motivo, confirmação explícita, versão e proteção de sessão/origem/MFA existentes. Sem restrição por status, liberação ou pagamento.
2. Remover atomicamente contratação, recibos, anexos, baixas ativas/desfeitas, movimentos/documentos legados, tokens e dependências operacionais. Preservar outras contratações e recalcular pagamento legado compartilhado.
3. Solicitação persistente por usuário autorizado; financeiro respeita acesso de leitura a liberadas; uma pendência por contratação. Sem excluir nem aprovar automaticamente.
4. Fila visível ao admin com solicitante/motivo; recusa fundamentada permite novo pedido; demais perfis não decidem nem excluem via API.
5. Auditoria administrativa de pedido, recusa e exclusão; manter reserva da numeração excluída para não reutilizá-la no depósito.
6. UI com Excluir apenas para admin e Solicitar exclusão para demais, em todos os estágios visíveis; mostrar impacto financeiro, motivo, checkbox e resultado; atualizar listas/contagens após mutação.
7. Migração aditiva e idempotente nos instaladores e atualização local, sem exclusão de dados de usuário na entrega.

## Acceptance Criteria
1. POST direto por coordenador/gestor/financeiro retorna 403; admin exclui aberta, cancelada, liberada, recibo gerado e paga; origem/sessão inválidas e versão antiga falham sem mutação.
2. SQL real comprova ausência das dependências após exclusão; falha intermediária reverte tudo; pagamento compartilhado conserva outros itens/valor.
3. Pedido de não-admin mantém contratação e financeiro; usuário fora de escopo é recusado; duplicidade concorrente é impedida.
4. Admin lista e recusa pedido; recusa não exclui; admin exclui manualmente com confirmação própria.
5. Auditoria mantém ator/motivo; nova contratação não reutiliza número apagado.
6. Playwright exerce pedido, troca de acesso, exclusão paga e validações; desktop e celular sem erros.
7. Instalação sintética e reaplicação da migração passam; atualização do banco local preserva registros existentes.

## Principal Regression Test
integration/contract-exclusion.integration.mjs — CONTRACT_EXCLUSION_SQL_TESTS=YES node --test integration/contract-exclusion.integration.mjs. Usa banco SQL Server sintético isolado, sessão HTTP real e financeiro real. Red esperado: rota de exclusão ausente (404); green: remoção coordenada e regras de acesso verificadas. UI: integration/contract-exclusion-ui.test.mjs testa interações reais do código de produção com API simulada.

## Testing Plan
Teste principal SQL real: permissões, escopo, todos os estágios, dependências, rollback, pagamento compartilhado, versão, pedidos/recusa, numeração. Regressões próximas: PC04, financeiro FIN01/02/03/05, autorização e navegação. Confirmar red/green no registro de evidências.

## Implementation Plan
1. Escrever teste HTTP/SQL real e executar red.
2. Migração de pedidos e reserva de números; integrar instalador e upgrade local.
3. Serviço transacional de pedido/recusa/exclusão e rotas; executar green SQL.
4. Escrever teste UI red; adaptar tabela/modal/fila no PC04 com estilos existentes; executar green e capturas.
5. Rodar regressões adjacentes e revisão final do diff; registrar evidências.

## Referências técnicas
Microsoft Learn: https://learn.microsoft.com/en-us/sql/t-sql/statements/delete-transact-sql?view=sql-server-ver17 e https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql?view=sql-server-ver17 — dependências removidas em ordem dentro da transação existente, com application lock e rollback completo.
