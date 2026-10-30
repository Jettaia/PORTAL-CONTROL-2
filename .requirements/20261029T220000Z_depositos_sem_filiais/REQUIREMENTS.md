# Depósitos como unidade de cadastro e acesso

## As Is
Filiais controlam usuários, prestadores, contratos e finanças; depósitos dependem de filial e herdam endereço. Checkout contém trabalho anterior que deve ser preservado.

## To Be
Depósito é a única unidade operacional. Usuário confirmou que não há dados a migrar e autorizou excluir todos os dados, preservando login ADMIN de guilherme.ribeiro@jettatransportes.com.br.

## Requirements
1. Remover Filial das telas, contratos ativos e banco canônico.
2. Depósito possui nome, centro de custo, rua, número, bairro, cidade, estado e CEP separados.
3. ADMIN cadastra depósitos e vincula usuários a depósitos; usuários não administrativos consultam somente seus depósitos, inclusive por API direta.
4. Limpar cadastros, operações e demais usuários do piloto local confirmado, preservando usuário ADMIN, credencial e permissões estruturais necessárias ao software.
5. Preservar alterações anteriores, sem push/deploy externo.

## Acceptance Criteria
1. Sem menu ou endpoint de filiais ativo; persistência canônica sem tabela Filial.
2. Criar/editar/reler endereço e CC; inválidos não gravam; cancelar não grava; edição concorrente não sobrescreve silenciosamente.
3. ADMIN permite cadastro/vínculos; gestores e financeiro A não leem/alteram dados do depósito B; revogação vale no servidor.
4. Limpeza validada em banco descartável antes do piloto, backup local verificado, apenas ADMIN preservado com mesmo hash de credencial, demais dados de negócio vazios.

## Principal Regression Test
Testes HTTP PC01/02/03/04 e integração SQL descartável: cadastro completo e isolamento entre dois depósitos. Antes, depósito exige filial e herda endereço; depois persiste campos e restringe por depósito.

## Testing Plan
Node test para DTO/HTTP; SQL Server descartável com instalação completa, persistência e personas; interface headless desktop/mobile para cadastro/edição/cancelamento; revisão independente para autorização e limpeza. Registrar red/green e limitações aqui.

## Implementation Plan
1. Testes de novos contratos, cadastro e permissões; confirmar red.
2. Adaptar APIs e frontend em fronteiras disjuntas.
3. Migração canônica após schemas históricos e ferramenta explícita de limpeza transacional com guarda de destino/identidade/admin.
4. Prova SQL isolada, revisão, backup, aplicação local autorizada e reinício.

## Ferramentas
Serena e Lad não estão disponíveis no inventário. Sem novas dependências. Transações ODBC verificadas na documentação oficial https://github.com/IBM/node-odbc .

## Resultado e evidências
- APIs e UI canônicas usam Depósito, CC e endereço separado; nenhuma referência Filial permanece em src/public. Schemas históricos permanecem como origem; migration 29 remove a entidade e suas dependências da instalação final.
- Red/green: novos contratos falharam antes das mudanças; UI solicitava filiais e não tinha campos; vínculo por ID externo e tokens sem revalidar concessão falharam nos novos testes antes da correção. Normalizador SQL falhou no ensaio por newline inicial, corrigido e repetido com sucesso.
- `node --test` sobre todos os testes de tests/ exceto `pc09.test.mjs`: 323 PASS. PC09 continua excluído conforme escopo local anterior, não foi certificado por esta entrega. Registro local: artifacts/depot-migration/regressions.txt.
- SQL real: PC01/02/03/04/05/07/08/10 PASS, PC11 dentro do percurso PC10. Fixtures atualizadas sem remover os cenários pertinentes; bancos descartáveis removidos.
- `DEPOT_SQL_TESTS=YES DEPOT_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/depot-model.integration.mjs`: instalação completa, endereço persistido, ADMIN/GESTOR/FINANCEIRO, acesso direto negado, revogação, prestador externo por ID negado, token real pareado/negado após revogação/consumido após restituição, reset e login preservado, upgrade legado e integridade de constraints.
- `integration/depot-scope.visual.mjs` PASS com Playwright Edge headless: criar/editar/cancelar/retry/CAS, vínculo de usuário, sem pageerrors; screenshots 1440/390 inspecionadas. HTTP sintético para UI; persistência certificada pelo SQL real.
- Revisão independente Sol medium: quatro achados materiais corrigidos e reavaliados; delta final de histórico, concessão somente ADMIN e guarda TCP aprovado.
- Limpeza autorizada aplicada exclusivamente a localhost\\SQLEXPRESS / JETTA_CONTROL_PILOTO_LOCAL, identidade conferida, piloto encerrado, backup COPY_ONLY/CHECKSUM/VERIFYONLY antes da transação. ADMIN guilherme.ribeiro@jettatransportes.com.br preservado com mesmo salt/hash e papéis; demais usuários, sessões e dados de negócio removidos.
- `node scripts/verify-local-depots.mjs` PASS: único ADMIN e credencial, 47 tabelas de negócio vazias, sem tabelas/colunas/módulos Filial, FKs válidas/confiáveis, HMAC da instância e health 200.
- Sem commit, push ou publicação externa; mudanças anteriores preservadas. Backup privado e configurações permanecem fora do Git.
