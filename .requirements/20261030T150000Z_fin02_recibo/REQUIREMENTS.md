# FIN-02

## As Is
FIN-01 fornece fila e detalhe autenticados. Não há recibo persistido no novo fluxo. Checkout contém alterações anteriores preservadas.

## To Be
Implementar o ticket autorizado `.scratch/financeiro/issues/02-recibo-individual.md`, seguindo `docs/FINANCEIRO-SPEC.md` e o DOCX em `recibos`. Baixa/anexos são FIN-03; limpeza/ativação definitiva são FIN-04.

## Requirements
1. ADMIN/FINANCEIRO emitem um recibo por contratação com liberação vigente. GESTOR somente consulta/imprime dentro do vínculo vigente.
2. Persistir snapshot, identidade, versão/dados de origem, autor, instante e dia America/Sao_Paulo; reenvio/concorrência não duplicam. Divergência impede nova emissão e será consumida por FIN-03 sem reemissão silenciosa.
3. Documento segue o modelo fornecido: pagador/CNPJ originais, valor liberado, atividade, data do serviço, cidade/UF, emissão e nome completo; extenso/CPF/assinatura manuais.
4. Integrar ações ao detalhe e situação RECIBO_GERADO à fila, mantendo pendência e nenhuma baixa.

## Acceptance Criteria
1. HTTP autenticado permite admin/financeiro globais, nega mutação gestor/anônimo, nega leitura alheia e após revogação.
2. SQL real prova uma emissão concorrente, snapshot após edição cadastral e mudança de dia, rollback sem registro parcial e origem incompatível identificada. Documento anterior preservado.
3. Comparação visual do modelo e impressão A4 com cidade fora de Sumaré e conteúdo longo; campos manuais em branco, sem cortes/sobreposições.
4. Interação UI real em headless emite, atualiza situação e oferece impressão; gestor não recebe emissão; erro permanece visível. FIN-01 e PC04 não regridem.

## Principal Regression Test
`$env:FIN02_SQL_TESTS='YES'; node --test integration/fin02.integration.mjs`: emissão/reimpressão reais por HTTP com sessão e SQL descartável. RED esperado: endpoint ausente; GREEN: conteúdo/autorizações/estado persistidos. UI: `node integration/fin02.visual.mjs`, gatilho de emissão e resultado visível.

## Testing Plan
Banco aleatório sintético isolado; nenhum acesso de escrita ao piloto. Interações UI com HTTP sintético mais testes integrados de serviço real. Capturas do recibo e detalhe. Regressões FIN01/PC04 e sintaxe. Revisão independente focal obrigatória por finanças/autorização.

## Implementation Plan
1. Testes HTTP/SQL e UI antes do código; provar RED.
2. Persistência/serviço/rotas com locks e snapshot; provar GREEN.
3. Renderer fiel ao DOCX e UI reutilizando FIN01; testar emissão, erros e impressão.
4. Revisão independente, correções focais, registrar resultado no ticket existente.

## Referências técnicas e ferramentas
Serena/LAD indisponíveis na sessão. Documentação primária consultada: [Playwright page.pdf](https://playwright.dev/docs/api/class-page#page-pdf) usa mídia print; [SQL Server table hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table) para UPDLOCK/HOLDLOCK. Requisitos já autorizados pelo pedido de execução do ticket; nenhuma ampliação funcional.
