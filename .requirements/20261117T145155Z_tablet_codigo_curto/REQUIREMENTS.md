# Ativação de tablet por código numérico curto
## As Is
Pareamento usa newToken de 64 caracteres, mesmo gerador da sessão interna. Expira em 5 minutos e é consumido uma única vez. Endpoint compartilha limite de 20 chamadas/minuto com apontamento.
## To Be
Novo pareamento: 9 números criptograficamente aleatórios, exibidos XXX-XXX-XXX. Sessão interna permanece 256 bits. Campo aceita números crus ou agrupados; códigos antigos de 64 caracteres continuam válidos no prazo original.
## Requirements
1. Pair/rePair geram 9 dígitos com zero inicial permitido, sem colisão com códigos pendentes; regeneração invalida autorização anterior.
2. Armazenar somente HMAC contextual do código curto, sem número puro no SQL/auditoria. Código legado mantém hash original apenas na ativação.
3. Preservar prazo de 5 minutos, uso único, revogação, emissor/depósitos ativos e sessão HttpOnly longa.
4. Limite de ativação: 5 tentativas inválidas por IP/5 minutos, mais 50 por instância/5 minutos; apontamento mantém limite existente. Sem reduzir tamanho da sessão.
5. UI mantém padrão visual; código numérico visível/agrupado, teclado numérico, aceita colagem e compatibilidade temporária com legado.
## Acceptance Criteria
1. API gera XXX-XXX-XXX; colisão provoca nova geração sob lock PC04; 10 colisões falham sem gravar.
2. Nada em texto puro nos comandos SQL/auditoria; usar chave privada já existente, sem alteração de schema.
3. Ativação com/sem hífen produz cookie 64 hex. Reuso, expiração, código substituído e não autorizado recusados.
4. 6ª tentativa mesmo IP retorna 429 antes do banco; 51ª entre IPs distintos bloqueada. Status/apontamento não consomem limite de ativação.
5. Navegador envia código curto e chega à operação; cadastro mostra código agrupado. Tablets já autorizados permanecem ativos.
## Principal Regression Test
node --test tests/pc05-pairing-code.test.mjs integration/tablet-revocation-ui.test.mjs
Testes exercitam rotas/serviço e formulário reais. Red esperado: geração longa e rejeição do código curto/UI minlength64.
## Testing Plan
API/serviço geração-colisão-consumo-reuso-regeneração-expiração; limites por IP/global; regressões PC05; UI de ativação. SQL real via integração descartável de tablets.
## Implementation Plan
1. Escrever regressões e red.
2. Implementar geração/HMAC/normalização e limites dedicados; green API.
3. Ajustar HTML/JS e exibição; green UI e suites adjacentes.
4. Validar SQL real e reiniciar somente runtime local.
## Sources
Node crypto.randomInt: https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback (API evita modulo bias).
RFC8628: código humano curto exige prazo curto e limitação de tentativas; sessão interna mantém alta entropia.
## Compatibility
Schema atual comporta os hashes; credenciais de tablets existentes e códigos antigos de 5 minutos preservados. Rollback simples apenas antes de emitir novos códigos; depois manter ativador que entende ambos os formatos.

## Evidências finais
- Red: API gerava 64 caracteres, 6ª tentativa não bloqueava; UI não agrupava 9 números.
- Green: 45 testes focados de PC05/tela passaram; teste principal ampliado com formato inválido e 10 colisões também passou.
- SQL real: integração tablet-pairing-code passou (banco descartável, login/HTTP reais, expiração, renovação, uso único, sessão longa e mais de 5 ativações válidas no mesmo IP). Integração tablets-multidepot também passou.
- Integração legada tablets.integration.mjs falhou ao exigir 200 da geração antiga de token de apontamento; código HEAD anterior já retorna 410 GERACAO_TOKEN_DESATIVADA. Baseline executado confirma falha anterior, não foi alterada essa regra.
- Sem migração nem alteração em tablets reais; códigos/sessões anteriores mantidos. Captura: artifacts/tablet-pairing-code/mobile.png. git diff --check sem erros.
