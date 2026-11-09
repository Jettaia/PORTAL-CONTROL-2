# As Is
Lista paginada100 e recibo individual idempotente com snapshot/auditoria. ADMIN/FINANCEIRO emitem; gestor só consulta.
# To Be
Prévia por DataServico inclusiva, todas liberadas sem recibo além da página100; quantidade/total exatos; confirmação, geração independente, retry idempotente e impressão conjunta.
# Requirements
1. Datas obrigatórias; depósito/prestador/número opcionais. Situação da lista não restringe lote. Informar já emitidos ignorados.
2. Prévia assinada pelo servidor, ligada ao ator, validade15min e origem conferida (IDs/versão/valor/data/depósito/liberação). Só emitir IDs confirmados, não incluir registros novos depois da prévia. Origem alterada exige nova prévia.
3. Sessão, ADMIN/FINANCEIRO, mesma origem, MFA e trava/auditoria existentes; falhas parciais preservam sucessos; retry e concorrência sem duplicação. Nunca confirmar pagamento.
4. UI confirma/cancela, resultados individuais/contagens, repete pendentes e imprime gerados. Duploclique bloqueado; filtros/conta novos invalidam estado, inclusive respostas tardias.
5. Impressão autenticada em documento único com um recibo por página, mesma origem/snapshot/layout; autorização atual validada integralmente, dados escapados e CSP.
6. Somente local; sem migração/emissão de teste no banco operacional/commit/push/deploy. Extenso permanece pendente e fora escopo.
# Acceptance Criteria
Mais de100 incluídos; datas/filtros/zero corretos; token adulterado/expirado/outro ator e perfis negados não escrevem; alteração de origem bloqueia item; auditoria com falha real reverte só o item; retry não duplica; impressão não altera snapshot nem baixa pagamento; UI cobre confirmação/cancelamento/erro/retry/print/logout.
# Principal Regression Test
FIN02_BATCH_SQL_TESTS=YES node --test integration/fin02-batch.integration.mjs: HTTP autenticado/SQL sintético. RED rota404 antes; GREEN com prévia/geração parcial/retry/print. UI: integration/fin02-batch-ui.test.mjs com script real e API sintética.
# Testing Plan
SQL descartável com ADMIN/FINANCEIRO/GESTOR,103fixtures para prévia e poucos itens emitidos; trigger de auditoria real; testes de token/filtro e regressão FIN02/filtro/documento. Headless desktop/mobile e inspeção visual. Revisão independente auth/integridade.
# Implementation Plan
Testes RED; backend prévia/token/emissão reaproveitada/print; UI delegada em arquivos exclusivos; GREEN SQL e UI; revisão/correções; reiniciar portal local com backup habitual.
# Notas
Serena/Lad indisponíveis. Principal responsável backend/registro/integridade. Subagente UI dono exclusivo public/fin01.js, public/fin01.css e integration/fin02-batch-ui.test.mjs. Diffs anteriores preservados.

# Resultado atual
Implementado no checkout local: prévia, confirmação, resultados individuais, retry sem duplicar, tratamento de origem alterada/expiração e impressão conjunta. CSS externo autenticado evita bloqueio por herança CSP da janela. Tokens maiores que8KiB são aceitos na rota específica2MiB; prévia muito extensa pede dividir o período antes de confirmar. Nenhuma migração.

# Evidências
- UI RED por botão inexistente; SQL RED válido com rotas anteriores retornou404 em vez de401 esperado. A primeira execução SQL encontrou um erro na fixture de timestamp ISO sem segundos, corrigido antes da prova RED válida. Roteiro temporário de RED restaurou as rotas no finally e foi removido após uso.
- GREEN SQL lote: FIN02_BATCH_SQL_TESTS=YES node --test integration/fin02-batch.integration.mjs PASS1/1, sem skips (última execução81s). ADMIN/FINANCEIRO/GESTOR,103registros além de100, limites de datas inclusivos, aberta/fora período excluídas, filtros, corpo/token real>8KiB, token adulterado/expirado/outro ator, origem alterada, trigger real de falha de auditoria, sucessos preservados, retry e concorrência sem duplicar. Nenhuma baixa financeira criada, quatro recibos e quatro auditorias correspondentes. Banco sintético removido no finally.
- Impressão no mesmo SQL teste: browser com cookie autenticado em createApp/CSP reais, popup aboutblank carregou CSS,3recibos em PDF nativo com exatamente3páginas. Artefatos sintéticos artifacts/fin02-batch/recibos-sinteticos.pdf e impressao.png. Snapshots/corpo individual preservados.
- Regressão SQL individual: FIN02_SQL_TESTS=YES node --test integration/fin02.integration.mjs PASS1/1, sem skips (63s).
- Focais UI/documento/filtro:7/7 e teste adicional de serviço com total de centavos além da precisão Number/MFA/sessão/token:1/1. Preview UI105registros, confirmação/cancelamento, erro real200 por item, expiração com print dos sucessos preservado, logout/resposta tardia e mobile.
- Suíte completa padrão paralela:433/436, três timeouts de navegador (PC04, prévia, tablets). Reexecutado o MESMO inventário regressionTests() com --test-concurrency=1, sem exclusões nem ampliar timeout:436/436, zero skips/falhas em61s. Log artifacts/fin02-batch/regression-serial.txt. Resultado consistente com contenção de recursos na execução paralela.
- Sintaxe dos arquivos alterados/adicionados e git -c core.whitespace=cr-at-eol diff --check PASS.
- Visual: capturas previa-desktop.png, resultado-mobile.png e impressao.png inspecionadas com view_image. Usados CSS reais do portal; tabela com scroll próprio, ações e mensagens legíveis, recibos mantêm layout anterior. Mobile usa emulação Chromium, não dispositivo físico.
- Revisão independente GPT-6.1 Sol medium: APROVADO após corrigir contrato da chave HMAC>=40 (teste nãohex) e tratamento UI de origem alterada por item. Revisor executou2/2 testes focais aprovados.
- Somente local; sem commit/push/deploy, sem emissão no banco operacional. Extenso de recibo continua pendente e fora deste escopo.

Disponibilização local concluída: sinal de parada oficial, backup verificado na saída/abertura, node pilot-local/start.mjs --open. HTTP200 na raiz e HTTP401 sem sessão na rota nova de prévia. Portal reaberto para teste do usuário; nenhum recibo operacional emitido.
