# As Is
A auditoria confirmou que a recuperação revoga apenas tablets/tokens antigos, deixando TabletPC05 e ContratacaoToken do fluxo atual intactos. Runtime e bootstrap compartilham identidade Windows sysadmin. Usuário autorizou começar pela etapa SQL/recuperação e tratar os demais pontos depois.

# To Be
Recuperação sintética invalida sessões, convites, pareamentos, tablets permanentes e tokens pendentes atuais sem perder recibos/anexos/baixas/histórico. Execução HTTP separada do bootstrap administrativo com identidade Windows restrita, sem modificar a conta administrativa humana nem modo SQL global.

# Requirements
1. Revogar contextos atuais e antigos atomicamente após restore; preservar tokens já consumidos e todos registros financeiros.
2. Provar backup CHECKSUM, restore, CHECKDB, conteúdo e rejeição das credenciais antigas com consumidor real.
3. Preparar isolamento Windows/SQL com permissões de runtime e negativas para DDL/admin; aplicação real de conta depende de elevação Windows indisponível nesta sessão.
4. Preservar dados operacionais/configuração privada e alterações PC09 anteriores; não deployar, reiniciar SQL ou mudar modo de autenticação.

# Acceptance Criteria
Teste descartável demonstra cookie tablet antigo e pareamento recusados, token pendente invalidado mesmo após novo pareamento, sessão web revogada e novo login funcional. Recibo emitido, baixa, anexo e auditoria preservados por hashes/snapshot. Falha de invalidação não deixa revogações parciais. Conta runtime só é declarada aplicada após prova com sua identidade real; preparação/teste por impersonação é identificado separadamente.

# Principal Regression Test
SQL_RECOVERY_TESTS=YES node --test integration/recovery-current.integration.mjs: schema atual + HTTP autenticado + backup/restore reais + consumidores PC05 e FIN02/03; RED sem invalidação PC05 e GREEN após correção. Sem acesso mutante ao banco operacional.

# Testing Plan
Banco JETTA_CONTROL_B3_TEST_<12hex> criado exclusivamente pelo teste, removido em finally; conferência de limpeza. Teste fiscal/operacional reutiliza fluxos FIN04/PC05 existentes. SQL isolado e sequencial com agente de identidade; revisão independente de segurança após candidato. Regressão unitária e SQL adjacente proporcional ao delta.

# Implementation Plan
1. Preparar teste e RED. 2. Atualizar invalidação transacional e permitir inspeção sintética após restore. 3. GREEN e prova de rollback/guard. 4. Integrar código de identidade/revisão e registrar etapa administrativa pendente.

Serena/LAD indisponíveis; investigação via ferramentas locais. Não alterar migrations existentes. Conta Windows dedicada exige etapa elevada; não substituir por EXECUTE AS no processo sysadmin. Fontes oficiais de permissões e Windows serão vinculadas no registro de identidade.

# Revisão e evidência intermediária
- RED SQL real concluiu backup/restore/CHECKDB e falhou porque a rotina antiga não inspecionava nem tratava credenciais PC05. Banco sintético removido.
- Invalidação nova revisada independentemente (Sol medium); guards 2/2 PASS.
- Primeira execução após correção passou por invalidação, rollback e restore; a comparação do recibo encontrou BIGINT ODBC versus identificador JSON HTTP. Fixture corrigida com normalização textual sem perda de precisão; código financeiro permaneceu intacto. Nova execução em andamento.
- Permissões SQL: ensaio WITHOUT LOGIN 1/1 PASS, identidade Windows real ainda pendente de elevação. Scripts/guard revisados com correção de paridade HMAC PowerShell/Node, teste real PASS.
- Referências primárias: https://learn.microsoft.com/en-us/sql/t-sql/statements/backup-transact-sql?view=sql-server-ver17 e https://learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-checkdb-transact-sql?view=sql-server-ver17.

# Recuperação — resultado aceito
- SQL_RECOVERY_TESTS=YES node --test integration/recovery-current.integration.mjs: PASS1/1, zero skips/falhas, 131,6s. Backup/restore/CHECKDB completo MAXDOP1; hashes de todas as tabelas reconciliados antes da invalidação.
- Falha real de trigger no registro de auditoria comprovou rollback integral das revogações no banco sintético; snapshot posterior idêntico ao backup.
- Tablet ativo antes do backup e revogado depois não ressuscita; pareamento pendente recusado; token pendente inválido mesmo com novo aparelho; token consumido preservado. Sessão web antiga revogada, novo login funcional. Recibo/snapshot, baixa e bytes do anexo preservados pelos consumidores reais FIN02/03.
- Fonte e destino sintéticos removidos; releitura master confirmou zero bancos JETTA_CONTROL_B3_TEST_*. Não foi feita restauração, escrita de negócio ou reinício no banco operacional.

# Fechamento desta etapa
- node scripts/validate-pilot.mjs: REGRESSIONS_PASS, 376/376 gerais e 7/7 piloto/gate/conexão, zero skips/TODOs/cancelamentos/falhas; sintaxe 701 arquivos sem erro. Relatório reconferido contra inputs atuais.
- Code review independente GPT-6.1 Sol medium: APROVADO para recuperação, guard, separação de runtime e correções HMAC/ACL; sem achados materiais remanescentes. Teste de ACL exercitou somente arquivo temporário sintético; nenhum privilégio de produto alterado.
- CORTE OPERACIONAL PENDENTE: WindowsOnly=1 e shell ElevatedAdmin=false. Não foi criada conta Windows, login real ou role no banco instalado; não houve ACL/configuração privada alterada nem restart do piloto. O processo atual ainda conserva identidade anterior. Scripts elevados e instruções concretas em docs/SQL-RUNTIME.md; só após essa aplicação e autenticação real o bloqueio operacional de privilégios poderá ser encerrado.
- Sem commit/push/deploy ou homologação de produção. Demais etapas da recomendação continuam futuras.
