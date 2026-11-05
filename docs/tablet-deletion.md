# Exclusão de tablets revogados

Admin pode excluir um tablet revogado após confirmação. O registro desaparece da listagem e não pode ser editado, revogado novamente ou receber novo pareamento pela API. Gestor recebe 403. A operação exige a sessão, a origem e a validação MFA já usadas nas demais ações.

A exclusão usa `Operacao.TabletPC05.ExcluidoEmUtc`. Tokens consumidos exigem o vínculo com o tablet; por isso os dados técnicos e a auditoria são preservados, sem apagar serviços, valores ou horários.

## Atualização de banco existente

Aplicar a migração aditiva `pilot-local/delete-tablet.sql` antes de iniciar o código novo. Ela adiciona a coluna nullable e a restrição de exclusão somente em tablets revogados sem credenciais. É idempotente. A versão antiga continua compatível com a coluna; após exclusões, retornar ao código antigo pode voltar a mostrar linhas excluídas, portanto rollback de código exige suspender a gestão de tablets até reaplicar a versão nova.

No piloto local, com o app encerrado: `node scripts/upgrade-delete-tablet.mjs`. O script exige instância local, valida identidade, faz backup verificado e confirma preservação dos dados. Não foi executado no banco operacional nesta tarefa.

Instalações novas recebem `39-delete-tablet.sql` pelo manifesto. O SQL gerado possui proteção de destino de piloto/laboratório; não executá-lo diretamente em produção. Na publicação em banco de produção existente, incorporar os mesmos comandos aditivos ao procedimento de migração com a validação de identidade desse ambiente, antes da troca da aplicação. Nenhum deploy foi realizado nesta tarefa.

## Validação

- `node --test tests/pc05.test.mjs integration/tablet-deletion-ui.test.mjs`
- `$env:JETTA_B3_RUN_SQL_TESTS='YES'; node --test integration/tablets.integration.mjs` (banco sintético descartável).
- API: Admin/revogação, recusas de Gestor, sessão, origem, MFA e rollback em falha de auditoria.
- UI: visibilidade por perfil/status, cancelamento, erro de permissão e remoção da linha após confirmação.
- SQL real: expansão com dados existentes, reaplicação, preservação de tokens consumidos e eventos, auditoria e impedimento de restauração.
