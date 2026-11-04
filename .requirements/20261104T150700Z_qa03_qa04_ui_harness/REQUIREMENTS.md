# Prioridade 7 — QA-03/QA-04: provas de UI reproduzíveis

## As Is
Gate reprova2casos: VM do cadastro sem Option e prévia visual com fixtures/seletores do contrato antigo. Playwright é importado de caminho absoluto de outro ambiente. O formulário atual de serviços usa descricao e jettaProtectedFetch, não codigo de filial. Prévia usa filial/financeiro legado e catálogo de contratações sem depositos, provocando falha de renderização.

## To Be
Ambiente simulado suporta Option e exercita formulário+wrapper de proteção reais, com confirmação/cancelamento sem perda de campos. Prévia usa contratos/telas atuais vazias, permanece sem SQL e sem escrita, com Playwright instalado no projeto e navegador headless do ambiente.

## Requirements
1. Corrigir a VM do teste (não o código do produto) e atualizar entrada para serviço/nome/descrição. Provar que formulário mantém valores/botão bloqueado e não envia escrita antes da confirmação; cancelamento não grava.
2. Importar Playwright pelo pacote do projeto; declarar devDependency compatível com Node>=20. Usar Edge no Windows e Chromium padrão nas demais plataformas, permitindo PLAYWRIGHT_CHANNEL explícito.
3. Atualizar exclusivamente o helper de prévia/fixture para contratos e telas vigentes, incluindo depósitos e FIN01/extrato substitutos do legado. Manter todas as mutações API recusadas405, catálogo/listas vazias, sem autenticação real ou SQL.
4. Exercitar navegação headless real com assertivas de carregamento/dados vazios/ausência de pageerror e tablet em ambos layouts. Não contornar falhas com skip/filtros.

## Acceptance Criteria
1. Teste de formulário carrega b24a.js e mfa-b2b.js reais; só DOM/transporte/decisão MFA são simulados. POST só ocorre após confirmação com nome/descrição corretos; cancelamento preserva valores e não chama fetch.
2. Nenhum caminho de usuário na importação da prévia; dependência resolvida por npm ci.
3. Teste da prévia passa em navegador real no ambiente, sem consultas SQL/escritas. Telas aposentadas não são restauradas.
4. Gate amplo passa nas etapas pertinentes; qualquer falha nova é investigada sem mascarar.

## Principal Regression Test
node --test integration/mfa-enrollment-ui.unit.test.mjs integration/preview-ui.test.mjs. RED já comprovado no gate da prioridade6 (mesmos fontes): Option undefined e timeout #pc04Page form. Nova prova focal da fixture deve reprovar o catálogo sem depositos antes da correção do helper.

## Testing Plan
VM com confirmação/cancelamento e wrapper real; prévia HTTP real + navegador Edge headless; gate test:release completo (testes, sintaxe, piloto/conexão SQL somente leitura) e revisão independente. Sem navegador interativo: runners existentes observam as fronteiras necessárias.

## Implementation Plan
1. Declarar Playwright dev e adicionar asserções de fixture atual para RED específico.
2. Corrigir VM/teste do formulário e fixture/seletores da prévia, preservando somente leitura.
3. Executar focais, gate/revisão e atualizar relatório existente.

## Resultado
- RED histórico Option/timeout comprovado na prioridade6; RED focal catálogoPC04 semdepositos e fingerprints sempackagejson/lock comprovados nesta etapa.
- VM com Option + wrapper real: confirmação1POST serviços correto, cancelamento0fetch/reset, campos preservados e double-submit bloqueado.
- Prévia atualizada somente no helper, semSQL/escritas; navegador Edge headless7telas e tablet2modos, sempageerror/APIerror/envioescrita.
- Playwright1.64.1 importado do projeto; instalação limpa em temporário96pacotes com scriptsdesativados, importnormal funcionou. Audit0 vulnerabilidades conhecidas.
- Focal12/12, semskips/TODO. Review independente review_seg01 (GPT-6.1Sol):PASS; repetiu11/11 sembrowser/SQL.
- Gate test:release REGRESSIONS_PASS:410/410testes +719sintaxes +7/7piloto/gate/conexãoSQL, semfalhas/skips/TODO/cancelamentos. Sem aprovação de instalação/produção.
- Evidências em docs/Relatório.md e registros locais existentes. Sem alterações em src/public, commit, push ou deploy.

## Referências
- https://playwright.dev/docs/library
- https://playwright.dev/docs/browsers#google-chrome--microsoft-edge
