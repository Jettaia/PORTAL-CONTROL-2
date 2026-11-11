# Prestadores — C + popup B + centro de custo

## As Is
PC03 renderiza tabela e formulário no mesmo painel. GET de prestadores fornece depósitos sem CentroCusto. Protótipo aprovado: lista/edição lado a lado, criação em modal, sem contagem superior, depósito acompanhado do CC.

## To Be
Integrar o desenho aprovado à aplicação local, mantendo contratos e permissões, com campos reais da API.

## Requirements
1. Lista pesquisável, filtros por depósito/situação e edição lateral; novo prestador em modal separado; sem total superior.
2. Exibir CentroCusto de cada depósito em ambos os formulários e no filtro, fornecido pela consulta de depósitos do mesmo escopo já autorizado.
3. Preservar CPF/CNPJ, telefone, Versao, vínculos com depósitos e MFA. Somente ADM corrige documento/situação; usuário sem vínculo não edita existentes. Depósito inativo já vinculado pode ser removido; não pode ser adicionado em novo cadastro.
4. Cancelar popup preserva rascunho lateral. Erro preserva formulário. Bloquear duplo envio e descartar respostas após saída/sessão. Desktop/celular, cores azul/laranja.
5. Somente aplicação local; sem deploy ou mutações de teste em SQL operacional.

## Acceptance Criteria
1. Seleção carrega lateral; busca/filtros não apagam rascunho; novo abre dialog.
2. CC exibido vem do catálogo de depósitos; IDs enviados continuam os mesmos.
3. POST/PUT com mesmo contrato; readonly de documento e situação para não ADM; versões e vínculos existentes preservados.
4. Cancelar sem escrita, conflito mantém valores, nenhuma requisição duplicada e nenhum dado reaparece após logout. Sem overflow em 390 px.
5. HTTP local entrega os fontes novos; testes não tocam dados reais.

## Principal Regression Test
`node --test integration/provider-split-ui.test.mjs`: frontend real e contrato HTTP sintético. Falha antes por ausência da lista lateral/modal. `node --test tests/pc03.test.mjs`: API/serviço reais com transporte SQL simulado para provar projeção CentroCusto e fronteira de escopo.

## Testing Plan
UI seleção/edição/cancelar/erro/MFA/POST/PUT/documentos/permissões/depósitos inativos/centro de custo, mudança atividade-prestador, sessão; API PC03; regressões de depósitos, atividades e prévia; capturas 1440/390. Sem alegação de teste SQL real.

## Implementation Plan
Adicionar CentroCusto à projeção SQL existente; reimplementar apresentação PC03 com editores independentes lateral/modal; CSS isolado; atualizar expectativa de prévia vazia; validar testes e HTTP local. Escopo já confirmado. Serena/Lad indisponíveis; sem bibliotecas novas.

## Verification
- RED UI: aguardou a lista lateral inexistente e falhou antes da implementação.
- RED API: nova projeção falhou pela ausência de f.CentroCusto; demais cenários antigos continuaram aprovados.
- GREEN `node --test integration/provider-split-ui.test.mjs tests/pc03.test.mjs`: 38/38, sem skips. UI inclui cancelamento de MFA sem escrita e rascunho preservado, conflito, POST/PUT, Versao, vínculos inativos existentes, permissões ADM/gestor, popup independente, busca, documentos, duplo submit e logout com resposta pendente.
- `node --test integration/deposit-cards-ui.test.mjs integration/deposit-cep-ui.test.mjs`: 2/2; `node integration/activity-types.visual.mjs`: PASS; `node --test integration/preview-ui.test.mjs`: 1/1.
- Capturas inspecionadas: `artifacts/provider-split/desktop.png` e `popup-mobile.png`, 1440 e 390 px, sem overflow externo.
- Sintaxe de pc03 frontend/backend/teste aprovada.
- Servidor local reiniciado pelo sinal oficial encerrar.sinal e iniciador pilot-local/start.mjs, com verificações/backup normais do iniciador. HTTP local 3211 entrega pc03.js/pc03.css iguais aos fontes atuais.
- Leitura real do serviço PC03 no SQL local confirmou CentroCusto nos 2 depósitos autorizados. Nenhum teste gravou prestadores/vínculos reais. As mutações de interação usam HTTP sintético; cenários API/serviço usam transporte SQL simulado.
- O novo cadastro mantém situação ativa padrão do contrato real (POST sem ativo). Documento e situação de edição continuam restritos a ADM. O protótipo não foi promovido diretamente.
- Fonte primária preservada em `codex/prototype-prestadores-20261111-c`, commit `e57dcb901099d63b98254da29a1c6b2250d53fff`, com os cinco arquivos descartáveis e o veredito. Índice isolado e autoria local Codex Agent; checkout, índice normal e alterações anteriores preservados. Sem push.
