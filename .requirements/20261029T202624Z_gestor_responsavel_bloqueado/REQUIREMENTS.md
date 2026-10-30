# Gestor responsável bloqueado para Gestor
## As Is
Campo recebe o próprio usuário como padrão, mas permite trocar responsável.
## To Be
GESTOR mantém o próprio usuário em campo bloqueado. Somente ADMIN escolhe outro responsável autorizado ao depósito.
## Requirements
1. Campo disabled para Gestor, preservando autopreenchimento em carregamento/troca de depósito e envio manual do valor.
2. API rejeita criação por não ADMIN com gestorId diferente da identidade autenticada, mesmo dentro do mesmo depósito; nenhum efeito indevido.
3. ADMIN continua selecionando outro gestor autorizado; preservar origem, escopo e sessão.
## Acceptance Criteria
Gestor vê nome próprio sem poder trocar; após recarga/busy continua bloqueado; payload usa próprio ID; forja de ID diferente gera403 sem contratação/auditoria; ADMIN pode escolher outro autorizado.
## Principal Regression Test
Teste HTTP PC04 real/serviço para corpo forjado + headless manager-default para disabled. Red antes, green após.
## Testing Plan
HTTP/serviço focal, SQL descartável com dois responsáveis autorizados e tentativa forjada, UI com identidade/troca de depósito/conta/ADMIN. Revisão independente focal da autorização.
## Implementation Plan
Testes red; regra no servidor e bloqueio persistente no formulário; regressões/SQL/UI/review; reiniciar piloto sem alterar dados ou schema.

## Provas e estado
- Red literal: cenário HTTP de corpo forjado não foi negado pela regra antes da implementação (503 do transporte scripted em vez de403). Green: 61 testes PC04 PASS após guard no servidor e fixture ADMIN para escolher outro gestor.
- integration/manager-default.visual.mjs PASS: campo bloqueado com próprio ID, troca de depósito, recarga/busy, POST com próprio ID, ADMIN habilitado e troca de conta sem identidade residual.
- Revisão independente Sol medium APROVADA; reviewer também executou 61 testes PASS. Sintaxe dos dois arquivos PASS.
- UI estática nova já servida pelo piloto. Ativação da guarda no processo backend depende do reinício normal.
- Ensaio SQL adicional interrompido por indisponibilidade do SQL: ODBC 08001/258, HYT00, atraso de pré-logon em localhost\\SQLEXPRESS. Consulta diagnóstica independente também falhou ao conectar master. Serviço constava Running; acesso ao ERRORLOG foi negado. Não reiniciamos serviço/banco sem autorização por possível impacto em outros aplicativos.
- Teste SQL deste pedido encerrado após timeout de conexão. Solicitada autorização para tentar reiniciar SQLEXPRESS. Nenhuma migração ou gravação no banco do piloto executada neste pedido.

## Conclusão
- Usuário autorizou reinício SQLEXPRESS. Reinício sem privilégio recusado; solicitação UAC nativa executou reinício elevado. PID do serviço mudou e SELECT1 voltou a responder. Sem alteração de política do Windows.
- Ensaio interrompido deixou um banco temporário vazio. Destino exato, nome seguro, horário da criação e zero tabelas foram conferidos antes de removê-lo; nenhuma base do usuário foi excluída.
- Nova execução `HOURS_SQL_TESTS=YES HOURS_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/manual-hours.integration.mjs` PASS: GESTOR tentou atribuir ADMIN elegível no mesmo depósito e recebeu403/GESTOR_RESPONSAVEL_FIXO sem criação; ADMIN criou escolhendo GESTOR autorizado; criação própria e fluxo de aprovação/liberação permaneceram válidos. Banco descartável removido no finally.
- Piloto encerrado/reiniciado pelo fluxo oficial com backup verificado. Health200, identidade HMAC e UI bloqueada confirmados. Guarda do backend carregada no novo processo. Dados e schema do piloto preservados; sem commit/push.
