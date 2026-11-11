# Depósitos — aplicar opção B

## As Is
Cadastro real com tabela larga e formulário sempre exposto. Protótipo B aprovado: cards com CC, nome, cidade/UF, endereço e situação; cadastro/edição em modal. Breadcrumb de depósitos já oculto por alteração local anterior.

## To Be
Aplicar B no portal local e retirar “Cadastros / Depósitos”, preservando título e contrato B24A.

## Requirements
1. Cards, totais de ativos/inativos, busca e filtros com azul/laranja atuais, sem textos explicativos extras.
2. Novo/editar em modal com todos os campos, máscara de CEP, original bruto para concorrência e permissões existentes.
3. Falha mantém rascunho; cancelar não grava; envio duplicado bloqueado; saída/sessão invalida respostas antigas.
4. Mudanças restritas a depósitos; consulta de usuários e outras telas preservadas. Sem deploy nem mutação de dados operacionais em testes.

## Acceptance Criteria
1. B legível em desktop e 390 px sem overflow; breadcrumb ausente; filtros e totais coerentes.
2. POST/PUT corretos, CEP exibido formatado e original não normalizado; sem edição para podeEditar=false.
3. Modal conserva campos em conflito, fecha ao cancelar/sucesso/sair e não reabre com resposta antiga.
4. HTTP local entrega fontes atualizados; nenhuma dependência ou alteração de SQL.

## Principal Regression Test
`node --test integration/deposit-cards-ui.test.mjs`: browser com frontend real e API sintética aderente ao contrato. Deve falhar antes pela ausência de cards/modal; passar com seleção, edição, cancelamento, conflito, filtros, criação e consulta sem escrita.

## Testing Plan
Teste principal; adaptar regressão existente de CEP à nova entrada em modal; executar regressão adjacente de atividades e sintaxe dos fontes alterados. Capturas desktop, celular e modal. Não constitui teste SQL.

## Implementation Plan
Atualizar somente marcação de depósitos; reaproveitar B24C para cards/modal e contrato; CSS com escopo; validar visual e HTTP local. Requisitos já aprovados pelo pedido atual. Serena/Lad indisponíveis; sem novas APIs externas.

## Verification
- RED: teste principal falhou aguardando `.depot-card` inexistente antes da implementação.
- GREEN: `node --test integration/deposit-cards-ui.test.mjs integration/deposit-cep-ui.test.mjs` — 2/2 aprovados, sem skips. Cobertura inclui cancelamento sem escrita, conflito com rascunho preservado, POST/PUT e original bruto de CEP, consulta sem permissão, duplo submit e resposta de escrita após sessão encerrada.
- `node integration/activity-types.visual.mjs` — aprovado; navegação/atividades preservadas.
- `node --test integration/preview-ui.test.mjs` — aprovado. Seletores ajustados para os layouts atuais de depósitos e atividades. Espera de mensagem de contratações alinhada ao status vazio já documentado em 20261111T112128Z_annotated_layout, sem alteração em contratações.
- Sintaxe dos JS alterados aprovada. Capturas desktop e modal em 1440/390 px inspecionadas em `artifacts/deposit-cards/`.
- HTTP local 3211 entrega JS/CSS iguais aos fontes atuais e index com modal. Sem deploy, sem escrita em SQL operacional. Os testes de interação usam frontend real e respostas HTTP sintéticas.
- Breadcrumb de depósitos já oculto na navegação anterior; teste confirma ausência. Removido também da prévia anotada.
- Fonte primária do protótipo capturada na branch local `codex/prototype-depositos-20261111-b`, com veredito B e remoção do breadcrumb. Índice isolado, somente cinco arquivos descartáveis; branch atual, índice normal e alterações preexistentes preservados. Sem push. Registro local atribuído a Codex Agent, pois o repositório não tem identidade de autor configurada.
