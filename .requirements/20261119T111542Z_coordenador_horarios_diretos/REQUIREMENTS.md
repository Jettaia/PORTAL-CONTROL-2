# As Is
Coordenador envia horarios reais manuais para aprovacao e pode aprovar a propria solicitacao.
# To Be
Coordenador salva horarios reais manualmente em uma etapa, como ADMIN, conforme pedido explicito do usuario.
# Requirements
1. ADMIN e COORDENADOR gravam entrada/saida reais diretamente, com motivo e auditoria, nos depositos autorizados.
2. GESTOR continua criando solicitacao; bloqueios e validacoes existentes permanecem.
3. Detalhe da API e mensagem da tela refletem a permissao direta.
# Acceptance Criteria
1. POST horarios do coordenador persiste horarios MANUAL sem inserir solicitacao, preservando valor e motivo no historico.
2. Gestor ainda recebe HorarioSolicitado; coordenador fora de escopo, com motivo vazio ou contratacao liberada e bloqueado.
3. API retorna podeRegistrarHorariosDireto=true e UI informa registro sem aprovacao.
# Principal Regression Test
integration/coordinator.integration.mjs: HTTP autenticado e SQL descartavel, salvar horarios como coordenador deve atualizar os horarios sem pendencia. Antes: HorarioSolicitado=true. Depois: horarios persistidos e nenhuma solicitacao.
# Testing Plan
node --test tests/pc04.test.mjs; COORDINATOR_SQL_TESTS=YES COORDINATOR_SQL_SERVER=localhost\SQLEXPRESS node --test integration/coordinator.integration.mjs; node integration/coordinator.visual.mjs.
# Implementation Plan
1. Atualizar testes HTTP e SQL e observar red.
2. Incluir coordenador na gravacao direta e flag da API; atualizar copy.
3. Executar testes adjacentes e interacao UI.
Sem novas APIs/dependencias. Serena/Lad indisponiveis.

# Validation Results
- RED real SQL: coordenador retornou HorarioSolicitado=true em vez de gravacao direta.
- GREEN: 92 testes HTTP/notificacoes/UI passaram.
- GREEN SQL: integration/coordinator.integration.mjs passou com login real e base descartavel (78s).
- Teste SQL legado atualizado para codigo fixo CPF, pois endpoint tokens ja retorna 410.
- Teste visual amplo antigo bloqueado por campo de deposito oculto no cadastro; teste focado novo cobre clique, formulario, mensagem e gestor.
- Syntax checks passed; git diff whitespace passed with repository CRLF support.
- Sem deploy, alteracao de schema ou migracao de solicitacoes existentes.
