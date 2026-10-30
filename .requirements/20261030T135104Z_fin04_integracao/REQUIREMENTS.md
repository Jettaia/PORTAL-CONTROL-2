# FIN-04 — integração e substituição

## As Is
FIN01/02/03 implementados no checkout. Piloto instalado ainda sem migrations 33/34. Legado mantém leitores, módulos e ledger chamados por PC04. Alterações locais anteriores devem ser preservadas.

## To Be
Executar exclusivamente FIN04 conforme docs/FINANCEIRO-SPEC.md e .scratch/financeiro/issues/04-substituicao-legado-integracao.md, autorização explícita do usuário em 30/10/2026. Piloto usa somente novo financeiro de contratações, com limpeza delimitada e dados operacionais preservados, sem commit/push/deploy.

## Requirements
1. Retirar navegação e acesso HTTP legado incompatível, mantendo financeiro novo e autorização existente.
2. Limpar somente financeiro antigo e reconciliar PagoEmUtc com baixas novas; preservar contratos, cadastros, vínculos, eventos operacionais e trilha FIN02/03.
3. Desacoplar liberação/revisão/cancelamento de escrituração PC10 quando FIN01 ativo.
4. Instalação e atualização adotam migrations 33,34,35 em ordem; backup verificado e piloto parado antes do banco instalado.

## Acceptance Criteria
1. Uma entrada Financeiro; rotas antigas não consultam nem gravam dados incompatíveis.
2. SQL com financeiro antigo demonstra preservação por conteúdo/identidades, idempotência, rollback e fila vigente única sem baixa órfã.
3. HTTP autenticado prova liberação → emissão/impressão → anexo/baixa → troca → desfazer; gestor somente leitura e escopo próprio, financeiro/admin globais. Liberação não repovoa ledger antigo; baixa protege operação.
4. Migrações aplicadas na ordem em banco local identificado, backup verificado, start recusa esquema incompleto. Sem deploy.

## Principal Regression Test
integration/fin04.integration.mjs e integration/fin04-reset.integration.mjs: HTTP + SQL descartável no contrato público, limpeza de legado preenchido, comparações de dados protegidos e liberação sem ledger. Antes devem falhar por reset inexistente ou escrituração antiga; depois fluxo e preservação passam.

## Testing Plan
Reutilizar FIN01/02/03 válidos; executar delta integrado com SQL Express isolado. Testar fronteiras de API e persistência com três perfis, entradas negadas e reset real. QA focal da navegação e UI existentes quando alterados, regressões PC04 e piloto. Revisão independente de integridade/autorização após candidato.

## Implementation Plan
1. Inventariar legado, preparar reset e teste SQL red/green.
2. Testar desacoplamento PC04 no HTTP e implementar mudança mínima.
3. Retirar rotas/navegação e corrigir runtime/instalador, testes focais.
4. Integrar, rever independentemente, aplicar 33/34/35 no piloto local somente após ensaio seguro, registrar evidências no ticket.

Serena/LAD indisponíveis no inventário de ferramentas desta sessão; execução usa ferramentas locais e revisão independente disponível. Sem introduzir APIs externas ou dependências novas.

## Achado de integração do instalador
O ensaio SQL descartável ficou preso por mais de 190s na migração histórica 29, no cursor que lê sys.sql_modules enquanto altera as definições. Hipótese: variação da enumeração dinâmica. Alterado para LOCAL STATIC READ_ONLY, congelando a lista antes das alterações; o ensaio integrado verifica a correção. Referência primária consultada: [DECLARE CURSOR — Microsoft](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/declare-cursor-transact-sql?view=sql-server-ver17), STATIC mantém cópia do conjunto original. Não houve reexecução da migração 29 no piloto instalado.

## Resultado final
FIN-04 aceito no piloto local. Evidência atual, comandos, revisão, fingerprint e aplicação 33→34→35 registrados no ticket canônico .scratch/financeiro/issues/04-substituicao-legado-integracao.md. SQL descartável passou após memória liberada pelo usuário; baixa antiga exclusiva restaurada na fila, novas baixas preservadas, rollback/idempotência comprovados. Piloto ativo com health/identidade confirmados em http://127.0.0.1:3211/. Nenhum commit/push/deploy externo.
