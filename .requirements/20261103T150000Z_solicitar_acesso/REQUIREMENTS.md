# Solicitação de acesso

## As Is
Login apresenta ativação por código. ADM cria contas com senha, funções e depósitos em Cadastro → Usuários.

## To Be
Visitante solicita acesso com nome e e-mail. ADM aprova ou recusa em Cadastro → Usuários. Na aprovação, ADM define senha inicial e permissões usando o editor atual; informa a senha ao usuário por conta própria.

## Requirements
1. Substituir ativação pública por Solicitar acesso com nome/e-mail, validação e confirmação.
2. Persistir pedidos pendentes sem conta, credencial ou acesso; evitar duplicidade e concessão de privilégios pelo visitante.
3. Somente ADM autenticado decide. Aprovação cria conta, senha e permissões atomicamente; recusa não cria conta. Registrar ator/data e auditoria.
4. Preservar criação/edição e alterações de senha atuais.

## Acceptance Criteria
1. Formulário envia somente nome/e-mail e mostra sucesso/erro sem perder dados em falha.
2. Pedido sobrevive releitura; duplicatas não geram mais pedidos; login antes da aprovação falha; campos de permissão públicos são recusados.
3. Cadastro → Usuários mostra pendentes com Aprovar/Recusar; aprovação usa senha inicial do ADM e funções/depósitos; gestor/visitante não decidem; decisão repetida/concomitante não cria duas contas; falha de auditoria reverte tudo.
4. Editor existente continua disponível. Senha nunca é retornada ou registrada em auditoria.

## Principal Regression Test
`$env:ACCESS_SQL_TESTS='YES'; $env:PC01_SQL_SERVER='localhost\SQLEXPRESS'; node --test integration/access-requests.integration.mjs`: HTTP real e SQL descartável, pedido → bloqueio de login → aprovação/recusa → login/permissões. Antes falha em POST público inexistente; depois valida persistência e autorização reais.

## Testing Plan
Teste SQL acima, casos negativos/concorrência/rollback; regressão PC01; fluxo DOM real headless em desktop/mobile e inspeção de capturas.

## Implementation Plan
1. Escrever teste SQL e executar red.
2. Adicionar migration aditiva, serviço/rotas; integrar aprovação à transação existente de contas; executar green.
3. Formulário público e fila no editor existente; testar interações/estados e aparência.
4. Revisão independente de auth e verificação focal; registrar resultados aqui.

## Resultado — concluído em 03/11/2026

- RED SQL: comando principal falhou no POST público com 401 em vez de 202, confirmando fluxo inexistente. RED UI: botão Solicitar acesso ausente.
- GREEN SQL final: `ACCESS_SQL_TESTS=YES PC01_SQL_SERVER=localhost\SQLEXPRESS node --test integration/access-requests.integration.mjs`, 1/1 PASS (execução final ~10s). HTTP/SQL reais em banco descartável removido no finally. Visitante solicita com validação e deduplicação, pedido não cria conta nem permite login, ADM lista/aprova/recusa, senha inicial e funções/depósitos persistem, gestor/anônimo não decidem. Aprovações simultâneas: 201/409 e uma conta. Falha real de auditoria reverte aprovação e conta. Auditoria de decisão sem senha.
- GREEN UI: `JETTA_PLAYWRIGHT_ROOT=C:\Users\Jetta\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules node integration/access-requests.visual.mjs`. DOM/CSS reais, API sintética: erro/reenvio, confirmação, aprovação com senha/funções/depósitos, dados de identidade bloqueados na aprovação, limpeza de senha, recusa/cancelamento, desktop 1440 e mobile 390. Capturas em `artifacts/access-requests/`; modal e editor mobile inspecionados visualmente, sem cortes nos controles.
- Regressão: `node --test tests/pc01.test.mjs tests/pc01-password.test.mjs` 5/5 PASS; `node --test pilot-local/unit.test.mjs` 2/2 PASS; `node integration/pc01.visual.mjs` PASS (4 gravações, viewports 1440/1024/768). Sintaxe dos módulos alterados validada.
- Revisão independente por `review_access`, GPT-6.1 Sol medium: aprovada para piloto PC01, sem achados materiais; revisão focal posterior de upgrade/documentação também aprovada. Ambientes legados sem PC01 não fazem parte deste aceite.
- Aplicado no piloto local usando encerramento oficial por sinal e `node scripts/upgrade-access-requests.mjs`: backup verificado, identidade/destino conferidos, 73 tabelas preexistentes preservadas. Reinício pelo `pilot-local/start.mjs` oculto; HMAC de identidade confirmado, HTML com solicitação e sem ativação antiga, POST inválido recusado com 400 sem criar pedido real.
- Sem push, deploy remoto, envio de e-mail ou criação de contas/dados de demonstração no piloto instalado. Suíte integral não executada; provas limitadas ao fluxo e regressões afetadas.
