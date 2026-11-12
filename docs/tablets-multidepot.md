# Tablets com vários depósitos

O cadastro aceita `depositos: [id, id]`. O contrato legado `depositoId` continua aceito sozinho. A API rejeita os dois campos juntos, lista vazia, IDs inválidos e repetidos. O catálogo inclui `Depositos: [{DepositoId, Nome, CentroCusto}]`, preservando os campos singulares anteriores.

O primeiro depósito fica em `TabletPC05.DepositoId`; os demais ficam em `Operacao.TabletPC05Deposito`. Assim as linhas e valores anteriores são preservados, sem backfill ou perda de apontamentos. Todas as escritas de vínculos, credenciais e auditoria pertencem à mesma transação.

Gerir um tablet compartilhado exige autorização sobre todos os depósitos atuais; cadastrar/editar também valida todos os depósitos pretendidos ativos. Consumo de token exige que o depósito do contrato seja um vínculo ativo, além da autorização atual dos emissores do código e do tablet. Um depósito inativo não impede usar os outros vínculos ativos.

## Atualização e rollback

Aplicar `pilot-local/tablets-multidepot.sql` antes do código novo. A migração é aditiva, exige transação externa e tem proteção de destino piloto/laboratório. Instalações novas recebem `43-tablets-multidepot.sql` pelo manifesto.

No piloto local, com a aplicação encerrada: `node scripts/upgrade-tablet-depots.mjs`. O script valida a instância, faz backup verificado e verifica a preservação das tabelas existentes. Este script não foi executado no banco operacional nesta tarefa.

Para produção, incorporar a migração ao procedimento autorizado desse ambiente com validação da sua identidade. Não executar diretamente o SQL protegido de piloto em produção. Nenhuma publicação está incluída nesta tarefa.

Rollback de aplicação após novos vínculos exige suspender o uso/gestão de tablets e manter o leitor novo ou reduzir explicitamente os vínculos antes: o binário anterior só conhece o primeiro depósito. Preservar a tabela auxiliar; não há etapa de contração ou exclusão de dados.

## Provas

- `node --test tests/pc05.test.mjs tests/pc05-app.test.mjs`
- `$env:JETTA_B3_RUN_SQL_TESTS='YES'; node --test integration/tablets-multidepot.integration.mjs integration/tablets.integration.mjs`

As integrações usam HTTP autenticado e SQL real em bancos sintéticos descartáveis, removidos no `finally`.
