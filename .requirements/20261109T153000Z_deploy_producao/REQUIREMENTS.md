# Deploy de produção de 09/11/2026

## As Is
Revisão e346a9c publicada no GitHub. Produção usa imagem anterior, schema com 39 migrações e não instala navegador para a nova exportação PDF. Teste de bootstrap ainda espera 39 migrações e falhou com resultado real 40.

## To Be
Publicar as alterações autorizadas em /chapa/, com dados e credenciais preservados, backup verificado e imagem anterior disponível para recuperação.

## Requirements
1. Instalar Chromium e dependências na imagem, acessível ao usuário node.
2. Atualizar a expectativa do bootstrap para as 40 migrações existentes.
3. Validar candidato isolado, aplicar somente migração 40 em transação e trocar somente a API do Portal Control.

## Acceptance Criteria
1. PDF real gerado pela imagem com as restrições de execução da produção.
2. Bootstrap SQL descartável aprovado com 40 migrações.
3. Backup CHECKSUM/VERIFYONLY, snapshots das tabelas iguais antes/depois da migração, HTTPS e consultas/exportações autenticadas aprovados.

## Principal Regression Test
`CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs`: execução vermelha observada, 40 migrações reais versus 39 esperadas. Smoke real de PDF na imagem candidata comprova navegador e bibliotecas disponíveis; Dockerfile anterior não instala Chromium.

## Testing Plan
Gate integral local, integração SQL descartável, testes de backup, imagem candidata sem publicação, migração com rollback em ensaio e validação pública autenticada sem alterar registros de negócio.

## Implementation Plan
Atualizar expectativa do teste; instalar Chromium em caminho compartilhado na imagem; gerar e testar imagem; backup e migração com snapshot; promover imagem; validar domínio e registrar recibo privado.
