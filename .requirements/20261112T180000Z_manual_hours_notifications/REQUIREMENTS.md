# Notificações de horários manuais

## As Is
O sininho é decorativo. PC04 persiste solicitações e decisões, com aprovação por ADM/coordenador e autorização por depósito.

## To Be
Sininho funcional com histórico persistente e leitura individual, abrindo o detalhe atual da contratação.

## Requirements
1. ADM recebe solicitações de todos os depósitos; coordenador somente de depósitos autorizados.
2. Solicitante recebe aprovação/recusa; todo acesso revalida perfil ativo e depósito.
3. Lido não resolve solicitação; decisões atualizam o estado do aviso original.
4. Contador de não lidos, histórico paginado, atualização a cada 30 segundos e após operação; erro visível com repetição manual.
5. Clique abre aba Horários da contratação; Escape/fechar/clicar fora fecha painel; logout limpa dados e chamadas antigas não podem repovoá-los.

## Acceptance Criteria
1. API recusa acesso sem sessão; coordenador não vê nem marca avisos de outro depósito; ADM tem escopo global.
2. Decisão produz aviso distinto para solicitante; leitura persiste por usuário e não duplica.
3. Aviso decidido mostra APROVADA/NEGADA/CANCELADA, sem nova possibilidade de decidir pelo sininho.
4. Contador considera todo histórico autorizado; paginação não perde avisos; falha não se apresenta como lista vazia.
5. Clique muda rota para #contratacoes/<id>/horarios; painel cabe em desktop e celular.

## Principal Regression Test
tests/notifications-ui.test.mjs: navegador abre sininho, lê aviso, navega e preserva estado de leitura; falha antes por ausência do controle/painel. tests/notifications.test.mjs cobre contrato HTTP e acesso.

## Testing Plan
Red/green das novas suítes, regressão PC04, sintaxe. Prova SQL de escopo/leitura e renderização desktop/celular. Padrão: C:/Users/Jetta/.codex/skills/_shared/tdd-decente.md.

## Implementation Plan
1. Testes HTTP/UI antes do código.
2. Consulta de avisos derivada da solicitação original, tabela aditiva de leituras e rota autenticada.
3. Painel no sininho e atualização integrada ao fluxo PC04.
4. Migração local com backup e preservação de tabelas; iniciar piloto e verificar.

## Decisions and risks
Escopo confirmado pelo usuário em 12/11/2026. Histórico anterior também é elegível; não haverá criação de solicitações artificiais no banco operacional. Origem única: ContratacaoHorarioSolicitacao. Volume inicial baixo, paginação de 30 itens. Permissões reavaliadas em toda requisição. Ausência da migração resulta em erro recuperável. Sem novas dependências. Leituras idempotentes com UPDLOCK/HOLDLOCK conforme documentação Microsoft: https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table .

## Validation
- Red: teste HTTP falhou pela ausência de notifications-routes.js; teste em navegador falhou pela ausência do sininho funcional.
- Green: 79 testes em `node --test tests/notifications.test.mjs tests/notifications-ui.test.mjs tests/pc04.test.mjs`.
- SQL real: `NOTIFICATIONS_SQL_TESTS=YES` com instância local explícita; `node --test integration/notifications.integration.mjs` PASS. Usa banco sintético novo e descartável; cobre solicitação via gestor, coordenadores em dois depósitos, decisão real, leitura idempotente concorrente, revogação de acesso, ADM sem vínculos e paginação sem duplicatas.
- Regressão adjacente: `node --test pilot-local/unit.test.mjs integration/pc04-model-a-ui.test.mjs integration/pc04-planned-ui.test.mjs`: 4 PASS.
- Sintaxe: `node scripts/check-all.mjs`: 802 arquivos, zero falhas. Executado diretamente porque npm não está disponível no PATH desta sessão.
- Desktop 1440x900 e celular 390x900 inspecionados visualmente. Capturas e hashes em `artifacts/notifications-*/evidence.json`. Detector visual: nenhum achado.
- Migração local: backup verificado; hashes e contagens das 75 tabelas existentes preservados. Piloto reiniciado em http://127.0.0.1:3211/ . Consulta real do ADM: 2 avisos não lidos, sem inserir registros operacionais para demonstração.
- Serena/Lad indisponíveis; validação feita com ferramentas locais. Nenhum push/deploy remoto.
