# As Is
O piloto usa Trusted_Connection com a identidade Windows humana que possui sysadmin no SQL. start.mjs mistura backup/migração e servidor HTTP. SQL é Windows-only, e o shell atual não está elevado.

# To Be
Processo HTTP sob conta Windows local padrão dedicada; bootstrap/backup sob conta humana administrativa. Conexões HTTP recusam identidade incorreta e privilégios de servidor/DDL. Scripts de preparação e lançamento concretos, sem alteração da conta humana ou do modo SQL.

# Requirements
1. Conceder DML/EXECUTE somente nos schemas necessários ao runtime, sem db_owner/sysadmin/DDL/backups.
2. Guard em toda conexão restricted antes de qualquer operação da aplicação.
3. Conta local padrão, senha somente SecureString/DPAPI, ACLs seletivas: código/config leitura; estado exclusivo gravável; credenciais administrativas e backups inacessíveis.
4. Separar servidor restricted de backup/migrações; exigir bootstrap administrativo antes da abertura.
5. Provisionamento confirma instância/banco e backup, recusa porta ocupada e conta existente sem vínculo conhecido. Sem execução elevada nesta sessão.

# Acceptance Criteria
Conexão imprópria não chama callback de negócio; identidade correta limitada passa. SQL descartável prova DML permitido e DDL/backup/controle negados. Script Windows sintaticamente válido; aplicação real de conta/ACL e autenticação deve ser declarada pendente até execução elevada.

# Principal Regression Test
tests/sql-runtime.test.mjs com ODBC simulado na fronteira withDb e integration/sql-runtime.integration.mjs com usuário SQL WITHOUT LOGIN no banco descartável para validar permissões; isso não substitui autenticação Windows real, que exige provisionamento elevado.

# Testing Plan
RED por módulo/guard ausente; GREEN nos testes de conexão e SQL grants. Suíte adjacente do piloto. Review independente pelo principal. Sem alteração de banco operacional/configuração privada, restart, commit/push/deploy.

# Implementation Plan
1. Testar guard. 2. Implementar política SQL/grants e guard. 3. Adicionar servidor separado/bootstrap/launcher/provisionamento. 4. Testar SQL isolado e sintaxe PowerShell. 5. Documentar etapa administrativa pendente.

Serena/LAD não disponíveis; decisões Microsoft oficiais pesquisadas por sql_identity_research no chat principal.

# Resultado atual
- Unit fronteira withDb: RED antes do guard (nenhuma query de identidade); GREEN3/3 com piloto. Conta divergente e 20 flags1/null recusadas antes de negócio, conexão fechada.
- integration/sql-runtime.integration.mjs: SQL real PASS1/1, grants DML/SP e negações DDL/owner/schema externo; BACKUP/CONTROL flags0. Banco sintético removido. Fixture Windows fictícia inicial15401 corrigida para usuário WITHOUT LOGIN sintético. Não representa login Windows real.
- Scripts PowerShell passam parser; conta/ACL/DPAPI/StartProcess não aplicados por falta de elevação. Nenhuma conta, login SQL ou configuração privada real foi alterada.
- Constraint UQ_PC04_DepositoNumero preexistente em HEAD e confirmada readonly no piloto, sem upgrade.
- Operação administrativa concreta e estado parcial documentados em docs/SQL-RUNTIME.md.
- Revisão independente encontrou divergência HMAC no launcher (rawhex versus UTF8 do endpoint). Corrigida por helper real; paridade Node/PowerShell GREEN4/4 com guard/piloto. Execução helper usou Bypass somente no subprocesso após política local recusar dot-source; nenhuma política persistente foi alterada.
- Scripts e conta permanecem não aplicados. Etapa humana concreta documentada em docs/SQL-RUNTIME.md; nenhuma aprovação de produção emitida.
- Correção adicional ACL Windows: helper private-isolation usa openSync('r')+closeSync sem ler bytes. RED com accessSync reproduziu falso positivo sob ACL Windows real ReadDataDeny no próprio arquivo temporário; GREEN6/6 (isolamento/HMAC/guard/piloto). Nenhuma ACL real de produto alterada. Código congelado para coleta FULL e revalidação independente.
