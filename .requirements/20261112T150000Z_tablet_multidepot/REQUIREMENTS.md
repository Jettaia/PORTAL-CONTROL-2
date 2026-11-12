# Tablet com vários depósitos

## As Is
TabletPC05.DepositoId limita cadastro e consumo de códigos a um depósito.

## To Be
O tablet pode ser vinculado a vários depósitos autorizados e consumir códigos de qualquer vínculo ativo, preservando as demais verificações.

## Requirements
1. Aceitar `depositos` não vazio, sem duplicados, conservando `depositoId` singular legado.
2. Persistir e listar todos os vínculos; mudanças invalidam sessões anteriores.
3. Gerir tablet exige autorização sobre todos os vínculos atuais e pretendidos.
4. Consumir código exige vínculo ativo e autorização atual dos emissores sobre o depósito do contrato.
5. Migração aditiva e idempotente conserva todas as linhas e valores existentes.

## Acceptance Criteria
1. Cadastro com dois depósitos salva e retorna ambos; lista vazia, IDs inválidos e duplicados falham sem escrita.
2. Releitura HTTP retorna os vínculos; editar invalida a sessão e substitui o conjunto.
3. Gestor com escopo parcial não lista, edita, revoga nem reemite tablet compartilhado.
4. Um tablet registra entrada nos dois depósitos vinculados e recusa terceiro depósito; vínculos inativos e autorização revogada não permitem consumo.
5. Reaplicar SQL não altera valores existentes nem duplica vínculos.

## Principal Regression Test
`JETTA_B3_RUN_SQL_TESTS=YES node --test integration/tablets-multidepot.integration.mjs`: HTTP autenticado com SQL descartável; antes falha ao cadastrar com `depositos`; depois salva, relê e consome tokens dos dois depósitos.

## Testing Plan
Executar regressão HTTP+SQL nova e `integration/tablets.integration.mjs`, além dos testes PC05 adjacentes. Somente bancos novos com nome JETTA_CONTROL_B3_TEST e marcador, removidos no finally.

## Implementation Plan
Teste red; migração de tabela auxiliar para vínculos adicionais; adaptação mínima das queries e validação; green e regressões. Não há contração destrutiva. Rollback de código após novos vínculos exige manter leitor novo ou reduzir explicitamente vínculos antes, pois o binário antigo só conhece o primeiro depósito. SQL auxiliar permanece preservado.

## Evidence
- Red: nova integração real HTTP+SQL falhou com 400 CAMPOS_INVALIDOS no cadastro com dois depósitos (antes do código).
- Green: nova integração passou (última execução 18s), incluindo persistência, consumo em A/B, recusa C/inativo/emissor sem escopo, gestão parcial negada, rollback de edição em falha de auditoria e reaplicação da migração preservando vínculos.
- Regressão SQL: integration/tablets.integration.mjs passou, inclusive sessões, tokens de uso único, movimentação e exclusão preservando histórico.
- Adjacentes: node --test tests/pc05.test.mjs tests/pc05-app.test.mjs: 66 PASS.
- Bancos descartáveis removidos no finally; nenhuma migração no banco operacional.
- Docs consultadas: https://learn.microsoft.com/en-us/sql/relational-databases/json/solve-common-issues-with-json-in-sql-server e https://learn.microsoft.com/en-us/sql/t-sql/queries/from-transact-sql (FOR JSON PATH/derived tables). JSON deixado por último no SELECT para compatibilidade ODBC SQLGetData.
