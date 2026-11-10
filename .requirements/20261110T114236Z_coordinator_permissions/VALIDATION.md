# Validação local — ampliação do COORDENADOR

## Entrega
- COORDENADOR cria depósitos e edita os autorizados, incluindo centro de custo. O criador recebe acesso ao novo depósito; outros coordenadores/gestores não herdam o vínculo.
- Cria/edita tipos de atividade no cadastro compartilhado.
- Usuários > Senhas da equipe lista somente GESTOR/FINANCEIRO ativos com todos os depósitos dentro do escopo do coordenador e ao menos um vínculo. Contas com função superior/customizada, ADMIN, COORDENADOR, raízes e usuários fora do escopo continuam bloqueados. O reset revalida essa regra dentro da transação, revoga sessões/convites e registra auditoria; não altera funções/vínculos.
- Aprova/recusa ajustes próprios ou de terceiros nos depósitos autorizados, mantendo bloqueios pós-liberação/pagamento. Registro direto de horários continua ADMIN; o coordenador pode decidir a própria solicitação.
- Sem alteração de schema, push, deploy ou acesso à produção. Sem usuários de teste no piloto persistente.

## TDD e provas
1. RED real: `integration/coordinator.integration.mjs` retornou 403 AUTOAPROVACAO_NEGADA ao coordenador recusar a própria solicitação, em vez do 200 esperado.
2. GREEN real: mesmo comando com COORDINATOR_SQL_TESTS=YES e COORDINATOR_SQL_SERVER=localhost\SQLEXPRESS passou, 1 integração/0 falhas/0 skips (118,99 s). Exercita login/cadastro real, depósito criado e vínculo exclusivo, CC editado, original desatualizado 409, depósito alheio 404 sem escrita, criação/edição de tipo, resets de gestor/financeiro, login novo/antigo, revogação, alvos protegidos/mistos/sem depósitos negados sem alterar banco, auditoria e funções preservadas; recusa e aprovação dos próprios horários e regressões de operação/financeiro/tablets.
3. RED UI: frontend antigo não apresentou o botão Alterar senha de Gestor Teste.
4. GREEN UI: `node integration/coordinator.visual.mjs` passou. Cadastra coordenador, troca sessão, redefine senha da equipe, limpa senha do formulário, cancela para senha própria, cria depósito/CC, cria e edita atividade, permite decisão própria e mantém financeiro em consulta. Backend sintético apenas neste teste visual; autorização/persistência comprovadas no teste HTTP/SQL real.
5. Capturas da nova seção em desktop/tablet inspecionadas; sem overflow no viewport de 768 px. `artifacts/coordinator-permissions/senhas-desktop.png` e `senhas-tablet.png`.
6. Regressões focadas PC01, senhas, PC02 e PC04: 92 pass/0 fail. O mock SQL do teste de ADMIN revogado foi atualizado para incluir a verificação adicional da função COORDENADOR.
7. Regressão padrão do checkout: 482 testes/481 pass/1 timeout de 4 s no teste não relacionado de importação de PDF, com concorrência 2. Repetição isolada de `integration/fin03-import-ui.test.mjs`: 1 pass/0 fail. Nenhum ajuste de timeout/código dessa funcionalidade foi feito.
8. SQL adjacente `integration/pc01-password.integration.mjs`: PASS, persistência, login, revogação, privilégios, MFA, rollback e concorrência.
9. SQL adjacente `integration/pc02.integration.mjs`: falha anterior confirmada em cópia isolada de HEAD via git archive: linha 63 espera 200 no POST de atividade planejada `/api/b3/atividades`, rota aposentada que retorna 404. Mesma falha com/sem alteração. Logs `artifacts/coordinator-permissions/adjacent-sql.log` e `baseline-sql.log`.
10. Sintaxe dos arquivos JS/MJS alterados e `git -c core.whitespace=cr-at-eol diff --check`: PASS. Finais de linha originais preservados.

## Runtime local
Servidor reiniciado pelo iniciador oficial `node pilot-local/start.mjs`, com backup CHECKSUM/RESTORE VERIFYONLY antes da abertura. A tentativa inicial via Start-Process foi rejeitada pela política da ferramenta; a execução direta do iniciador foi permitida e funcionou. Endereço http://127.0.0.1:3211/. Nenhuma mudança de senha operacional ou de cadastro real feita durante os testes.

## Limites
Serena e Lad indisponíveis. Novos contratos são internos ao repositório, sem dependências externas novas. Tipos de atividade continuam compartilhados. Contas com depósitos parcialmente fora do escopo ou sem depósitos precisam de ADMIN para reset. As evidências completas de autorização usam banco descartável local; UI usa frontend real com respostas sintéticas.
