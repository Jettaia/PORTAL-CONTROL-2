# Prioridade 6 / QA-02 — alinhar testes ao cadastro vigente

## As Is
integration/branch-edit.unit.test.mjs exige criação/edição de filiais, mas b24a removeu esse cadastro e PC02 usa depósitos. Os dois testes falham por contrato aposentado. O serviço save de PC02 já compara o registro original completo e recusa conflito com409.

## To Be
Testes devem exigir indisponibilidade da filial legada, campos vigentes do depósito e preservação do controle de concorrência na edição do depósito, sem reativar filial nem alterar código de produto.

## Requirements
1. Substituir expectativas de cadastro/edição de filial pelo contrato vigente: depósito com centro de custo/endereço e original completo na edição; código/filialId não fazem parte da entrada.
2. Preservar prova de controle otimista de concorrência no save real de PC02: original desatualizado em nome, endereço, centro de custo ou situação recebe409 antes de UPDATE/INSERT e provoca rollback; original atual permite commit/auditoria.
3. Confirmar que APIs/helpers legados de filial permanecem indisponíveis. Não excluir ou pular testes.

## Acceptance Criteria
1. Arquivo antes reprovado passa sem editar src/, schema ou contratos do produto.
2. Testes chamam normalizeCatalog e save de produção; somente transporte ODBC é simulado. Conflito409 não envia escrita, commit0/rollback1; controle positivo realiza escrita/auditoria e commit1/rollback0.
3. Gate amplo deixa de falhar pelos dois casos antigos de filial; falhas da prioridade7 permanecem expostas.

## Principal Regression Test
node --test integration/branch-edit.unit.test.mjs. RED inicial comprovado:2falhas Cadastro desconhecido/Cadastro removido. Trata-se de correção do contrato dos testes, não de bug de produto; não reintroduzir comportamento removido para satisfazer os testes antigos.

## Testing Plan
Focal do arquivo e regressão PC02/catalog/depot; gate amplo test:release para confirmar remoção exclusiva das duas falhas antigas. Não executar SQL real nesta alteração de testes: nenhuma fronteira de persistência do produto é modificada; registrar limitação dos casos com transporte simulado.

## Implementation Plan
1. Registrar RED e confirmar contrato em src/b24a.js, src/pc02.js e testes atuais (feito).
2. Atualizar testes da filial e levar cenários de concorrência para save de depósitos.
3. Executar verificações proporcionais, revisão focal e atualizar docs/Relatório.md.

## Resultado focal
- RED inicial:2/2 falhas nas expectativas de filial aposentada.
- GREEN: node --test integration/branch-edit.unit.test.mjs tests/pc02.test.mjs tests/catalog-changes.test.mjs tests/depot-legacy.test.mjs:28/28, sem falhas/pulos/TODO.
- Casos atuais: filial indisponível, depósito com CC/endereço, rejeição de codigo/filialId, original completo e booleano; quatro conflitos no save real sem envio de UPDATE/INSERT, rollback1; controle positivo envia UPDATE/auditoria e commit1.
- Somente transporte ODBC simulado: não declara persistência SQL real. Nenhum src/schema/contrato financeiro alterado.
- Sintaxe focal e diff check aprovados.
- Gate amplo test:release:407testes,405pass,2fail, zero skips/TODO/cancelamentos, exit1. Permanecem somente Option undefined e timeoutprévia (prioridade7); etapas seguintes do gate não executadas.
- Revisão independente review_qa02 (GPT-6Luna high):PASS, repetiu28/28 focais.
- Evidências em docs/Relatório.md e registros existentes do piloto. Sem commit, push ou deploy.
