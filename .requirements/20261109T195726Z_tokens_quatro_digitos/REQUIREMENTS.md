# Tokens de contratação com quatro dígitos

## As Is
PC05 gera oito dígitos; CódigoHash é único no histórico; cópia contém apenas código.

## To Be
Plano aprovado no chat: quatro dígitos e texto de entrada/saída; reutilização após expirar.

## Requirements
1. Gerar string de quatro dígitos, inclusive 0000, com aleatoriedade criptográfica.
2. Reservar códigos globalmente até ExpiraEmUtc, inclusive consumidos e invalidados; permitir reutilização posterior preservando histórico. Saturação retorna erro sem substituir anterior.
3. Consumir quatro dígitos e aceitar legado de oito enquanto válido. Preservar escopo, tentativas, MFA, uma hora, consumo único e entrada antes de saída.
4. Copiar `Token de entrada: 0042` ou `Token de saída: 0042`; fallback seleciona texto completo.
5. Migração idempotente sem perda de dados, instalador atualizado; sem deploy nem migração em base operacional.

## Acceptance Criteria
1. API emite quatro dígitos; teste determinístico preserva zeros.
2. SQL real comprova reserva, expiração/reuso, histórico, concorrência e saturação sem efeitos indevidos.
3. HTTP autenticado comprova consumo, legado, negação fora de depósito e replay.
4. UI real headless comprova clipboard e fallback para ambos os tipos em desktop/mobile; tablet envia quatro e oito, recusa comprimentos intermediários.
5. Reaplicar migração preserva linhas; rollback de schema só antes de duplicatas e runtime parado; após reutilização, rollback de aplicação requer versão compatível, sem apagar histórico.

## Principal Regression Test
`node --test integration/pc05-token-copy-ui.test.mjs`: clique no botão e leitura do clipboard devem falhar antes (copia apenas código) e passar depois (texto completo).
`PC05_SQL_TESTS=YES PC05_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc05.integration.mjs`: API real e SQL descartável devem falhar antes na asserção de quatro dígitos.

## Testing Plan
Executar RED antes da implementação. GREEN: HTTP com serviço real, SQL isolado, UI headless e regressão adjacente. Revisão independente de segurança/concorrência/migração. Sem runtime ERP Move: este repositório é Jetta Control com harness SQL Server próprio.

## Implementation Plan
1. Atualizar testes de UI e API e observar RED.
2. Ajustar cópia e fallback; provar GREEN UI.
3. Alterar alocação/consumo, adicionar migração e instalador; provar GREEN API/SQL.
4. Conferir tablet, migração repetível, histórico e limites; revisão independente e regressões.

## References
Node crypto.randomInt: https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback
Clipboard.writeText: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText

## Tool availability
Serena e Lad indisponíveis; testes nativos e review independente substituem ferramentas ausentes, sem alterar os requisitos.


## Resultado e evidências
- RED UI: `node --test integration/pc05-token-copy-ui.test.mjs` falhou porque clipboard continha `0123` em vez do texto completo.
- RED SQL: com `PC05_SQL_TESTS=YES` e `PC05_SQL_SERVER=localhost\SQLEXPRESS`, o teste real falhou porque a API emitiu oito dígitos.
- RED HTTP serviço real: falhas esperadas em emissão quatro, consumo quatro, zeros, saturação e colisões.
- GREEN: `node --test tests/pc05.test.mjs` — 64 PASS, incluindo 9999 reservas com último código livre, 10000 reservas sem escrita e mais de dez colisões.
- GREEN: `node --test tests/pc05-app.test.mjs` — 2 PASS; `node --test integration/pc05-token-copy-ui.test.mjs` — 1 PASS em desktop e mobile, entrada/saída, clipboard negado/ausente, texto integral visível/selecionado e restauração da cópia nativa.
- GREEN: `node --test integration/tablet-revocation-ui.test.mjs` — 1 PASS: quatro e oito dígitos, rejeição de comprimentos intermediários, revogação e responsividade.
- GREEN SQL: `$env:PC05_SQL_TESTS='YES'; $env:PC05_SQL_SERVER='localhost\SQLEXPRESS'; node --test integration/pc05.integration.mjs` — 1 PASS, sem SKIP, 203s. HTTP/autenticação/SQL Server reais, banco aleatório descartável removido no finally. Escopos A/B, ator anônimo, MFA, concorrência, uma hora, uso único, substituição, legado oito, saturação global incluindo consumidos/invalidados, preservação do token anterior, expiração/reuso com histórico, consumo da nova emissão e replay recusado. Migração/down antes de duplicatas e up duas vezes preservam snapshot de todos os dados; down após duplicatas é recusado sem apagar histórico.
- `node scripts/check-all.mjs` — 768 arquivos, zero falhas.
- Revisão independente GPT-6.1 Sol medium (review_tokens), somente leitura: aprovado, sem achados materiais em segurança/concorrência/migração. Delta final também aprovado.
- Inspeção focal das capturas mobile: texto de cópia completo visível, tablet sem overflow. Artefatos: artifacts/pc05-copy/mobile.png e artifacts/tablet-simplified/2026-11-09T20-04-40-971Z/390.png.
- Não houve commit, push, deploy nem migração na base operacional. `scripts/upgrade-token-digits.mjs` está preparado para atualização offline com backup, mas não foi executado contra a base instalada. Aceite de produto demonstrado no laboratório; ativação operacional depende dessa migração.
