# Histórico identificado da contratação
## As Is
Histórico exibe código técnico, timestamp UTC sem fuso explícito e Usuário ID. Eventos mantêm AtorUsuarioId e DetalhesJson, sem identificação histórica do autor.
## To Be
Ações em português, cargo/nome e horário de Brasília. Novos eventos guardam identificação do autor no momento da ação; registros anteriores consultam cadastro atual com indicação clara dessa limitação.
## Requirements
1. Mostrar ações conhecidas em português, cargo/nome, data dd/mm/aaaa e hora HH:mm:ss em America/Sao_Paulo.
2. Capturar nome/cargo do usuário autenticado no SQL da gravação, dentro da transação existente, em DetalhesJson. Conservar ID e demais detalhes.
3. Para eventos antigos sem captura, consultar nome/perfil atuais, sem inventar identidade histórica; usuário indisponível recebe fallback explícito.
4. Preservar autorização por contratação, conteúdo seguro como texto e ausência de alteração nos registros antigos.
## Acceptance Criteria
CRIAR vira Contratação criada; CONFERIR vira Liberada para pagamento; UTC19:42 vira16:42 em Brasília independentemente do fuso do navegador. Nome/cargo novos permanecem após renomear/reclassificar usuário. Motivo visível. Nenhum HTML do nome/motivo executado.
## Principal Regression Test
Histórico real em browser com eventos técnicos/UTC19:42 e identificação; SQL descartável cria evento, muda cadastro e confirma snapshot imutável e fallback legado sinalizado.
## Testing Plan
Red/green UI; SQL/HTTP real por persona já existente estendido; regressão PC04/05 (todos produtores de eventos); desktop/mobile com inspeção e teste em fuso diferente. Sem framework ou migração nova.
## Implementation Plan
Teste falhando; captura JSON no event existente e leitura com fallback; render acessível de histórico e formatter Brasília; provas focais/revisão; reiniciar piloto com backup e preservar dados.
## Ferramentas
smart-orchestrator modo direto e jetta-qa focal. Serena/Lad indisponíveis conforme inventário anterior. JSON SQL e Intl reutilizados do runtime existente.

## Resultado e evidências
- Novos eventos e auditoria recebem $.ator.nome/cargo no SQL, via usuário autenticado, dentro da mesma transação. ID/demais detalhes preservados. Nenhuma migração ou backfill de identificação antiga.
- Leitura do histórico usa snapshot ou cadastro atual com AtorIdentificacaoHistorica=0 explícito; usuário inativo continua identificável; ausência de cadastro tem fallback claro.
- UI traduz os dez eventos existentes, mostra nome/cargo, motivo e time semântico em Brasília. Legado recebe aviso de cadastro atual. Texto de nomes/justificativas não vira HTML.
- Red literal do teste headless: layout antigo não continha histórico identificado. Green integration/contract-history.visual.mjs PASS: browser em Asia/Tokyo, UTC19:42→16:42:21, UTC01h→dia anterior22h, ações, snapshots/legado/fallback, HTML inerte, 1440/390. Capturas artifacts/contract-history inspecionadas por view_image.
- `node --test tests/pc04.test.mjs tests/pc05.test.mjs`:107 PASS, repetido independentemente pelo reviewer Sol medium; revisão APROVADA.
- SQL real primeiro revelou ODBC07009 (coluna nvarchar(max) antes de colunas vinculadas); payload movido ao final do SELECT. Nova execução HOURS_SQL_TESTS=YES/HOURS_SQL_SERVER=localhost\\SQLEXPRESS integration/manual-hours.integration.mjs PASS: snapshot persiste após renomear e mudar Perfil; legado consulta cadastro atual e não recebe snapshot inventado; demais autorizações/concorrência/aprovações/liberação/tokens permanecem verdes. Banco descartável removido.
- Piloto reiniciado pelo fluxo oficial, backup verificado, sem alterar registros antigos. Health200/identidade HMAC, JS atualizado e leitura do histórico existente sem erro confirmados. Sem commit/push/publicação externa.
