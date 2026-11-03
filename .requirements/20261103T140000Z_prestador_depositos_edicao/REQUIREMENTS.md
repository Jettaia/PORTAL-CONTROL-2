# As Is
A tabela de Prestadores oferece botões Vincular/Remover por depósito. A edição oculta a seleção de depósitos e salva somente os dados comuns.

# To Be
A tabela informa somente os depósitos vinculados. Editar apresenta a seleção atual; Salvar alterações persiste dados e vínculos juntos e Cancelar edição descarta o rascunho.

# Requirements
1. Exibir nomes dos depósitos vinculados, ou “Nenhum depósito vinculado”, sem ações de vínculo na tabela.
2. Permitir selecionar/desmarcar depósitos na edição e persistir somente ao salvar; cancelar não escreve.
3. Preservar escopo, MFA, auditoria, criação, versões e vínculos fora do acesso do gestor. Permitir remover o último vínculo, conforme contrato existente. Depósitos inativos podem ser mantidos/removidos; novos vínculos exigem depósito e prestador ativos.

# Acceptance Criteria
1. Cada linha mostra apenas seus vínculos; não há botões Vincular/Remover.
2. Editar carrega as seleções; salvar atualiza a tabela e o filtro; cancelar conserva o estado anterior. Falha mantém o rascunho.
3. A atualização é transacional. Gestor não pode enviar depósito alheio ou apagar vínculos fora de seu acesso. Dados inválidos e versões antigas não escrevem. Chamadores antigos sem depositos continuam válidos.

# Principal Regression Test
`node integration/provider-depots.visual.mjs`: componente real pc03.js com HTTP sintético; falha antes pela presença de botões na coluna, depois exerce editar, cancelar, salvar, erro, vazio e filtro. Persistência/autorização: `node --test integration/provider-depots.integration.mjs` com SQL descartável e sessões reais.

# Testing Plan
UI headless com Playwright instalado (https://playwright.dev/docs/input), inspeção das capturas desktop/mobile; suíte tests/pc03.test.mjs e provider-document.visual.mjs. SQL real isolado: administrador salva seleção, gestor preserva depósito alheio, tentativa inválida reverte, remoção do último vínculo e releitura. Nenhuma base operacional é alterada.

# Implementation Plan
1. Escrever e executar regressão UI e escrever regressão SQL em red.
2. Aceitar depositos opcional na edição; validar/diferenciar vínculos no escopo dentro da transação existente; testar API/SQL.
3. Reutilizar fieldset/checkboxes existentes na edição; tabela textual; salvar/cancelar; executar UI e capturas.

# Verification
PASS — implementação direta e revisão independente focal concluídas.
- Red UI: `node integration/provider-depots.visual.mjs` falhou porque a coluna tinha 3 botões (esperado 0). Green: mesmo comando passou com componente real, HTTP sintético, sem erros de página.
- `node integration/provider-document.visual.mjs`: PASS criação CPF/CNPJ, edição, cancelamento, validação e busca.
- `node --test tests/pc03.test.mjs`: 36 PASS (API/serviço com transporte SQL simulado).
- `$env:PC03_SQL_TESTS='YES'; $env:PC03_SQL_SERVER='localhost\SQLEXPRESS'; node --test integration/provider-depots.integration.mjs`: PASS em base descartável, sessões reais e MFA. ADMIN salva/rele, GESTOR não escolhe depósito alheio e conserva vínculos de outro gestor; remoção do último vínculo, inválidos, versão antiga, depósito/prestador inativo e rollback real provocado por falha de auditoria.
- Revisão independente identificou perda de vínculo concorrente pelo endpoint legado. Regressão SQL reproduziu red (200 em vez de 409); corrigido incremento de versão somente quando o vínculo muda; green, incluindo idempotência. Reavaliação independente: aprovado sem novos achados.
- Capturas inspecionadas: `artifacts/provider-depots/edit-1440.png` e `edit-390.png`, Edge headless, fixture sintética, CSS completo extraído de public/index.html, estilos pilot-tokens/pilot-design e contexto #dashboard/.view-section. Seleção legível, ações acessíveis, formulário sem overflow. Tabela mantém rolagem horizontal existente em celular. Referência: captura do usuário e fieldset/checkbox canônico de public/b24a.css.
- Sintaxe dos quatro JS/MJS alterados/adicionados: PASS. Diff preserva CRLF dos fontes originais.
- Limitação histórica: integration/pc03.integration.mjs parou em 404 na antiga rota /api/b3/atividades, removida do produto; arquivo preservado. A nova prova SQL específica dispensa essa rota e passou. Não executada suíte integral nem deploy. Nenhuma base operacional alterada.
- Runtime Playwright usado: C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules, via JETTA_PLAYWRIGHT_ROOT.
