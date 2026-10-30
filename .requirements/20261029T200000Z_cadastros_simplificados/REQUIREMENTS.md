# Cadastros simplificados
## As Is
Filial usa endereço único; depósito tem endereço próprio e edição separada; prestadores têm busca global e tipos próprios.
## To Be
Cadastros conforme pedido e imagens do usuário, preservando escopo e alterações anteriores.
## Requirements
1. Filial: endereço, cidade, estado e CEP separados na criação/edição/persistência.
2. Depósito: editar nome/situação na linha da tabela, salvar/cancelar; endereço consultado da filial, sem entrada própria.
3. Prestadores: retirar busca global e listar minhas filiais; filtros de nome/CPF, situação e filial sobre lista autorizada.
4. Retirar Tipo de Prestador da aplicação ativa; atividade permanece determinante. Histórico SQL antigo não será apagado.
5. Reiniciar piloto local existente e verificar disponibilidade.
## Acceptance Criteria
1. Salvar/reler campos separados; validar UF/CEP e preservar proteção contra edição concorrente.
2. Abrir edição na linha; cancelar não grava; salvar persiste; leitura reflete alteração de endereço na filial.
3. Filtros combinam e restauram lista sem alterar escopo do servidor.
4. Sem menu, formulário ou endpoints ativos para tipos de prestador.
5. Piloto responde em 127.0.0.1:3211 após reinício.
## Principal Regression Test
Testes HTTP/SQL PC02 estendidos, fluxo headless de filiais/depósitos e PC03. Executar red antes da implementação e green depois.
## Testing Plan
Node test para contrato/validação e orquestração; SQL descartável para persistência e personas ADM/GESTOR/FINANCEIRO; Playwright para interações e visual em desktop/mobile.
## Implementation Plan
Campos e migração aditiva; edição de depósito na tabela; filtros PC03; remoção categoria ativa; regressão focal, revisão independente e reinício. Sem novas dependências. Serena/Lad indisponíveis.

## Resultado e evidências
- Implementado e integrado no checkout atual, preservando alterações anteriores. Sem commit/push.
- Red: catalog-changes (campos recusados/endereço enviado), depósitos UI (sem Editar na linha), PC03 UI (botões antigos), categorias HTTP (rotas existentes), catálogo SQL (200 em vez de 206).
- Green: `node --test tests/catalog-changes.test.mjs tests/pc02.test.mjs tests/pc03.test.mjs tests/b24b.test.js`: 43 testes PASS.
- `node scripts/check-all.mjs`: 652 arquivos, zero falhas. npm não está no PATH; executados runners Node equivalentes.
- SQL descartável: `PC02_SQL_TESTS=YES PC02_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc02.integration.mjs` PASS: persistência campos, endereço herdado após alteração da filial, edição depósito, concorrência, ADM/GESTOR/FINANCEIRO, histórico.
- SQL descartável: `PC03_SQL_TESTS=YES PC03_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc03.integration.mjs` PASS: 206 registros ADMIN, escopo gestor, CPF concorrente, vínculos, edição e histórico.
- Playwright Edge headless: pc02.visual.mjs, pc03.visual.mjs e deposits-inline.visual.mjs PASS. Filiais/prestadores 1440/768/390; depósitos 1440/390. HTTP sintético para UI, SQL certificado separadamente acima.
- Inspeção visual por view_image: artifacts/pc02/branches-1440.png, artifacts/pc03/providers-1440.png, artifacts/cadastros/deposits-1440.png e deposits-390.png. Campos e filtros coerentes com telas existentes; tabela usa rolagem horizontal mobile. Botões de depósito receberam estilo da família e nova captura/teste PASS.
- Review independente Sol medium: identificou truncamento 200, corrigido e protegido por SQL red/green; sem outro achado material.
- Upgrade instalado explícito `node scripts/upgrade-local-catalog.mjs` PASS, backup COPY_ONLY/CHECKSUM/VERIFYONLY antes da alteração; campos aditivos e atualização dos dois procedimentos de depósitos. Dados históricos de categorias e coluna antiga de endereço permanecem preservados, sem uso pela aplicação; instaladores novos não criam categorias.
- Reinício pelo sinal oficial de encerramento e `pilot-local/start.mjs`, backup verificado no encerramento/abertura. HTTP 200, HMAC da identidade e HTML atualizado confirmados em http://127.0.0.1:3211/.
- Limites: suite global não executada, sem publicação externa. Seleção global de CPF removida da UI conforme pedido; filtros respeitam filiais autorizadas.
