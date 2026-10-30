---
target: visual do Portal Control
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Jetta\\Desktop\\PORTAL CONTROL 2\\public\\index.html"
target_fingerprint: "sha256:1d3cdc82b3ac10a09146c39c7a06981d7ab170f50d3e064eb202ccb60e1aa69f"
target_path: "C:\\Users\\Jetta\\Desktop\\PORTAL CONTROL 2\\public\\index.html"
timestamp: 2026-10-29T14-48-08Z
slug: public-index-html
---
# Revisão visual — Portal Control

Alvo: public/index.html e CSS carregado. SHA: 496fd33. Duas avaliações independentes (A design; B detector e navegador). Modo Operate. Login real renderizado em tema claro, 1265x712, 1280x720 e 390x844. Dashboard autenticado não validado: API/SQL ausentes no preview estático. Fontes carregadas. Preview encerrado.

Identidade azul/laranja reconhecível; refinamento deve preservar marca e funções. Forças: labels e autocomplete, foco visível, aviso de homologação.

| Heurística | Nota /4 |
|---|---:|
| Visibilidade |3|
| Linguagem |3|
| Controle |2|
| Consistência |2|
| Prevenção |3|
| Reconhecimento |2|
| Eficiência |1|
| Minimalismo |2|
| Recuperação |2|
| Ajuda |2|
| Total provisório |22/40|

Prioridades:
1. P1 Contraste branco sobre laranja nos botões do login (style.css:1; b25b.css:4). Usar texto escuro ou fundo mais escuro. Comando: typeset/polish.
2. P2 Busca Ctrl+K decorativa (index.html:10), sem controle e handler. Implementar ou retirar aparência interativa. Comando: harden.
3. P2 Logo azul escuro na sidebar azul perde contraste (jc-refinado.css:5-7). Usar versão ou suporte apropriado. Comando: polish.
4. P2 Menu recolhido esconde rótulos visuais e subitens (style.css:1; jc-refinado.css:48). Nome acessível permanece no DOM; adicionar descoberta e acesso aos filhos. Comando: harden.
5. P2 Login e ativação sempre simultâneos (index.html:10-12); cartão 877.6px desktop/955.6px mobile e duas barras usam133px mobile. Comando: layout/distill.

Personas: Alex encontra busca inerte e navegação recolhida difícil; Sam sofre com contraste. Entrada/ativação simultâneas aumentam carga cognitiva; marca confiável perde clareza com controles decorativos.

QA visual: login sem overflow horizontal nos viewports B; não certifica tabelas, modais e dashboard autenticados. Evidências em evidence-20261029-B/. Detector: 8 avisos (2 side-tab, 1 kicker, 4 nested-cards, 1 dark-glow), sugestões estéticas e não falhas objetivas. Overlay não injetado. Nenhuma alteração na aplicação.

Questões: priorizar legibilidade/navegação, login ou todos? Corrigir preservando composição ou reorganizar entrada e ativação?

Validação final B: node scripts/check-all.mjs PASS, 646 arquivos/zero falhas. Contraste calculado 2,5552:1 branco sobre rgb(239,136,37), texto 16px: FAIL AA. Preview e processos de verificação concluídos. Primeira revisão, sem tendência histórica.
