# Prioridade 4 — prova real de concorrência e rollback FIN03

## As Is
O relatório mantém a concorrência e o rollback financeiro como não comprovados no SQL Server. O ambiente atual tem SQL Express local e ODBC Driver 18. A suíte integration/fin03.integration.mjs já cria um banco aleatório sintético, executa HTTP/autenticação reais e remove seu banco ao terminar. Execução inicial autorizada FIN03_SQL_TESTS=YES passou em 1/1, sem pulos, em 04/11/2026.

## To Be
Evidência reproduzível em SQL Server real: duas sessões concorrentes confirmam a mesma baixa uma única vez; falha após as escritas financeiras reverte todos os efeitos; operação pode ser repetida após remover a falha.

## Requirements
1. Usar somente localhost\\SQLEXPRESS em banco JETTA_CONTROL_B3_TEST_<12 hex> novo, vazio, com atores e dados sintéticos; nunca usar o banco operacional.
2. Garantir duas sessões SQL distintas simultaneamente aguardando o applock antes de liberar as confirmações HTTP de ADMIN e FINANCEIRO.
3. Reler baixa, anexo, auditoria e estado da contratação; comprovar idempotência e proteção do índice único real.
4. Forçar erro na auditoria após as escritas, verificar ausência de baixa/anexo/auditoria/PagoEmUtc e confirmar sucesso em nova tentativa após remover a falha. Preservar os casos existentes de acesso e correções.

## Acceptance Criteria
1. Identidade SQL corresponde à máquina local; limpeza remove somente o banco criado pela execução.
2. Dois SPIDs distintos são observados aguardando APPLICATION lock, com cadeia de bloqueio terminando no SPID de controle; ambas as respostas são 200 com o mesmo BaixaId. A fila SQL pode mostrar o primeiro solicitante como bloqueador do segundo.
3. Exatamente uma baixa ativa, um anexo e uma auditoria de confirmação após a corrida; tentativa SQL de duplicação é recusada com 2601/2627 e não altera o total.
4. Falha retorna 503; leituras reais mostram rollback integral e nova tentativa retorna 200 com um único registro/auditoria.

## Principal Regression Test
FIN03_SQL_TESTS=YES node --test integration/fin03.integration.mjs. Exercita o servidor real, login, ODBC, transações, locks, índice e triggers do SQL Server. Esta etapa valida comportamento existente: a suíte original já passou; não há defeito de produção confirmado nem RED artificial exigido.

## Testing Plan
Reutilizar a suíte SQL, fortalecer asserções de sobreposição/efeitos persistidos, executá-la sem skip; rodar suíte principal se testes forem alterados; sintaxe focal e revisão independente das provas. Sem navegador: a lacuna está no banco.

## Implementation Plan
1. Confirmar SQL local e executar baseline existente (feito: PASS).
2. Acrescentar prova determinística de bloqueio, índice e rollback/retry sem editar código financeiro.
3. Executar suíte fortalecida e revisão independente, registrar resultados no relatório existente.

## Resultado
- PASS baseline SQL existente: 1/1, sem skip (~26s).
- Primeira prova fortalecida falhou no pressuposto de bloqueio direto; SQL demonstrou fila encadeada. Ajustada a observação para APPLICATION WAIT + cadeia terminando no holder.
- PASS final: FIN03_SQL_TESTS=YES node --test integration/fin03.integration.mjs, 1/1 sem skip (~29s), cadeia 66 → 62 → 77 comprovada antes da liberação.
- Ambas confirmações HTTP200, mesmo BaixaId, persistência1 baixa ativa/anexo/auditoria; índice único recusou duplicação SQL.
- Trigger após escritas causou503; rollback0 baixa/anexo/auditoria e PagoEmUtc NULL; retry200 persistiu única confirmação.
- Banco sintético removido, ausência confirmada. Nenhuma alteração no código financeiro/schema.
- Suíte principal384/384; sintaxe focal e diff check aprovados.
- Review independente review_seg01 (GPT-6.1 Sol): PASS estático e suficiência da evidência fornecida pelo principal; não executou SQL.
- Registro existente docs/Relatório.md atualizado; sem commit, push ou deploy. MFA/runtime restrito/backup fora do aceite desta etapa.

## Referências técnicas
- https://learn.microsoft.com/en-us/sql/relational-databases/system-dynamic-management-objects/sys-dm-exec-requests-transact-sql?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql?view=sql-server-ver17
