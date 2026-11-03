# Excluir conta em Cadastro → Usuários

## As Is
ADM pode criar/editar/inativar contas, mas não excluir.

## To Be
Botão Excluir em cada conta, com confirmação. Exclusão lógica definitiva para a administração: conta sai da lista, não pode ser reativada pelo editor e perde acesso imediatamente. Identidade e referências históricas permanecem; e-mail continua reservado. Inativação continua disponível e reversível pelo editor.

## Requirements
1. Somente ADM autenticado pode excluir, com as proteções de origem/sessão/MFA existentes.
2. Confirmar nome/e-mail antes de excluir; cancelar não altera estado. Sucesso remove linha e limpa edição da conta; erro mantém conta e permite tentar novamente.
3. Preservar histórico e registrar exclusão/ator/data. Revogar sessões/convites e vínculos de autorização atomicamente. Impedir reativação e redefinição de senha da conta excluída.
4. Proteger a própria conta e o último ADM ativo; preservar criação/edição/inativação atuais.

## Acceptance Criteria
1. Visitante/gestor não excluem por API direta; ADM válido exclui e relê o resultado.
2. Fluxo DOM cobre cancelar, falha e sucesso; botão alcançável desktop/mobile.
3. Conta excluída não aparece no catálogo, login/sessão antiga falham, histórico continua referenciando a identidade. Falha de auditoria reverte tudo, decisão concorrente tem um vencedor.
4. Autoexclusão negada; inativação/reativação de conta não excluída continuam funcionando.

## Principal Regression Test
`DELETE_SQL_TESTS=YES PC01_SQL_SERVER=localhost\SQLEXPRESS node --test integration/delete-account.integration.mjs`. HTTP/SQL reais em banco descartável: excluir, reler, bloquear login/sessão/edição, preservar histórico. RED esperado: DELETE indisponível antes da implementação.

## Testing Plan
Teste SQL acima; fluxo headless da interface real com API sintética; testes PC01/senha e regressão visual atuais. Revisão independente de auth.

## Implementation Plan
1. Teste SQL/DOM e RED.
2. Migration aditiva, exclusão transacional e rota DELETE; GREEN SQL.
3. Botão/confirmar/estados e GREEN DOM; revisão independente.
4. Migração local com backup, reinício e registro das provas.

## Resultado — concluído em 03/11/2026
- RED SQL: DELETE real retornou 404 em vez de 200. RED DOM: botão Excluir ausente. Primeiro GREEN revelou serialização bigint na auditoria; corrigida com projeção explícita sem dados de credenciais.
- GREEN SQL: `DELETE_SQL_TESTS=YES PC01_SQL_SERVER=localhost\SQLEXPRESS node --test integration/delete-account.integration.mjs`, 1/1 PASS (~10s), banco descartável removido. Exclusão persistida com ator/data; identidade/auditoria anterior preservadas; sessão/login negados; catálogo omite conta; edição/reset/exclusão repetida recusados. Visitante/gestor/autoexclusão/ID inválido negados. Trigger de falha de auditoria reverte todos os efeitos. Inativação seguida de reativação segue funcionando; exclusão concorrente 200/404; CHECK SQL nega reativação.
- GREEN UI: `node integration/delete-account.visual.mjs` com JETTA_PLAYWRIGHT_ROOT configurado. DOM/CSS reais, HTTP sintético: cancelar não escreve, falha mantém editor e permite repetição, sucesso remove linha/limpa edição, própria conta protegida, botão em cor de exclusão verificada na cascata real. Desktop 1440/mobile390; capturas `artifacts/delete-account/users-*.png` e inspeção visual do mobile.
- Regressões: testes PC01/senha 5/5 PASS; SQL solicitações de acesso e senhas 2/2 PASS; UI PC01, solicitações e senhas 3/3 PASS. Sintaxe dos módulos alterados e diff focado conferidos.
- Limitação conhecida: `integration/pc01.integration.mjs` FAIL linha50 ao esperar 200 em POST `/api/b3/atividades`, rota aposentada (404). `src/b3-routes.js` idêntico byte a byte ao HEAD e não contém essa rota antes/depois; não é regressão desta alteração. Teste/rota legados não alterados. Não executada suíte integral.
- Revisão independente GPT-6.1 Sol medium (`review_access`): sem achados materiais na feature nem no script de upgrade/documentação.
- Piloto local atualizado pelo script `upgrade-delete-account.mjs`, após parada oficial, backup verificado e reconciliação das 74 tabelas preexistentes. Todos os campos originais de Usuario preservados pela projeção fixa. Reiniciado pelo launcher oficial oculto; identidade HMAC confirmada, JS novo disponível, DELETE anônimo401, schema pronto e zero contas excluídas no piloto instalado. Nenhuma conta real foi excluída para teste.
- Sem push, deploy remoto ou ações externas.
