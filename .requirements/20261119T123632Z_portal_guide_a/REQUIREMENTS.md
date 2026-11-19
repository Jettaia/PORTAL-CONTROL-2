# Guia do Portal — opção A

## As Is
Três estruturas em protótipo isolado. Usuário aprovou A e pediu aplicação local.

## To Be
Guia A integrado ao portal autenticado, com menu Ajuda, seis tutoriais e ajuda contextual nas seis telas correspondentes. Sem seletor ou scripts de protótipo na aplicação.

## Requirements
1. Disponibilizar Guia do Portal no menu Ajuda para usuários autenticados.
2. Preservar conteúdo e composição A, exemplos ilustrativos, FAQ, leitura em memória e impressão.
3. Abrir tutorial correspondente pelo botão Como usar esta tela, sem modificar cadastros ou requisições operacionais.
4. Preservar login/logout, navegação existente e legibilidade desktop/tablet/celular.
5. Arquivar as alternativas em branch descartável antes de removê-las da árvore de trabalho.

## Acceptance Criteria
1. Menu abre a visão geral; hash #guia/financeiro abre diretamente o tutorial financeiro em login válido.
2. Seis tutoriais navegáveis, FAQ expansível, marcar leitura mantém foco, próximo tutorial funciona e impressão contém os seis assuntos ou o assunto atual.
3. Depósitos, prestadores, tipos, tablets, contratações e financeiro exibem ajuda contextual correta; demais telas não exibem o botão.
4. Retornar à operação oculta o guia, preserva título e dados existentes. Logout oculta guia/ajuda e reinicia progresso. Sem overflow em 1536, 768 e 390px.
5. Protótipo preservado em codex/prototype-guia-portal com ponteiro neste registro; aplicação carrega apenas código definitivo.

## Principal Regression Test
integration/guide-ui.test.mjs — navegador real com HTML/JS reais e transporte HTTP sintético apenas para autenticação e catálogos. RED esperado: não existe botão de menu Guia do Portal. GREEN: navegação, contexto, leitura e isolamento funcionam. Não certifica autenticação/SQL reais, que não são alterados.

## Testing Plan
Executar RED/GREEN do fluxo integrado; regressões adjacentes de depósitos e tipos de atividade; sintaxe; capturas novas de desktop/tablet/celular com app real e fixtures HTTP; impressão por geração de PDF; revisão independente dos pontos materiais.

## Implementation Plan
1. Criar teste do fluxo integrado e observar RED.
2. Implementar módulo definitivo isolado, CSS local ao guia e navegação/menu/contexto. Reexecutar teste.
3. Validar regressões e capturas, corrigir defeitos materiais e registrar provas.
4. Arquivar e remover arquivos descartáveis, sem commit da implementação, push ou deploy.

Serena e Lad indisponíveis. APIs DOM/Playwright seguem contratos já utilizados nos testes do repositório.

## Arquivamento
Fonte primária do protótipo A/B/C em `codex/prototype-guia-portal` (`46c1e1754cbe4aac12df0cebf56ca82cc7034f0b`). Usuário aprovou A. Arquivos descartáveis e comando removidos da árvore corrente após captura com índice Git isolado. A implementação definitiva permanece sem commit.

## Resultado final
Opção A integrada em public/guide.js e public/guide.css, menu Ajuda → Guia do Portal, rota #guia[/assunto] e botão Como usar esta tela nos seis módulos. Conteúdo, exemplos ilustrativos, FAQ, impressão e leitura em memória preservados. Logout limpa o estado. Não altera endpoints, SQL, permissões ou registros operacionais. Portal local iniciado pelo launcher existente em http://127.0.0.1:3211/ com backup prévio verificado.

RED: node --test integration/guide-ui.test.mjs falhou inicialmente por menu inexistente. GREEN: guia, reload-navigation e deposit-cards passaram (3/3); integration/activity-types.visual.mjs passou. Sintaxe geral: node scripts/check-all.mjs — 832 arquivos, zero falhas. Detector Impeccable: [].

Revisão identificou impressão normal vazia por regra global. Regressão acrescentada antes da correção falhou com true !== false; CSS passou a condicionar a ocultação à existência de #guidePrintContent. GREEN comprova impressão normal visível, shell oculto somente durante impressão do guia e restauração após limpeza. Revisor independente GPT-6.1 Sol medium (Luna indisponível) reexecutou o teste e retornou SHIP / resolved.

Evidência final: artifacts/guide-a-r3-2026-11-19T12-45-30-404Z/evidence.json, capturas de desktop/tablet/celular e ajuda contextual, print-check.json e guia-completo.pdf. Sete cenários, sem erro de página ou overflow global. PDF gerado em navegador e texto conferido: seis tutoriais e FAQs presentes em 18 páginas. Fixtures HTTP sintéticas para identidade/catálogos; não certificam autenticação/SQL reais. Impressão física não executada.

Conferência independente de identidade: tokens compartilhados, azul/laranja, Segoe UI e estrutura do portal preservados; índice responsivo e espaçamento didático são diferenças locais intencionais. Sem drift material nem necessidade de DESIGN.md global. Critérios locais concluídos; implementação permanece sem commit/push/deploy.
