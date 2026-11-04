# Prioridade 5 / QA-01 — descoberta de testes na liberação

## As Is
scripts/test-all.mjs e regressionTests() descobrem apenas tests/*.test.js/mjs. Cinco arquivos integration/*.test.mjs ficam invisíveis a npm test e validate-pilot; incluem as falhas de filial/MFA/prévia do relatório. O gate existente já exige resumo sem skip/TODO e exit code zero.

## To Be
Um único inventário inclui *.test.js/mjs de tests/ e integration/ nos runners principal e do piloto. npm run test:release aciona o gate existente, com sintaxe e testes piloto/conexão após o lote principal. Falhas antes invisíveis passam a impedir liberação.

## Requirements
1. Compartilhar a descoberta entre npm test e o gate, incluindo os arquivos locais integration/*.test.js/mjs, ordenados e sem duplicação.
2. Reprovar quando um teste de integration/ falhar; relatórios antigos que omitam essas provas deixam de ser aceitos pelo gate.
3. Documentar o comando de liberação e seus pré-requisitos (navegador e SQL), sem ativar indiscriminadamente centenas de suítes históricas .integration.mjs opt-in.
4. Preservar os gates existentes, fingerprints e distinção entre regressão local e autorização de instalação/produção. QA-02/03/04 são correções posteriores, sem excluir seus testes nesta etapa.

## Acceptance Criteria
1. Os cinco arquivos *.test.mjs atuais de integration/ entram automaticamente no inventário de ambos os runners e em regressionInputs.
2. Uma fixture integration/*.test.mjs que falha faz o runner real retornar código 1 mesmo com tests/ passando; o gate rejeita relatório que omita integration/.
3. test:release usa validate-pilot, que mantém resumos completos sem skips/TODO como requisito; dependência ausente ou teste quebrado não vira PASS.

## Principal Regression Test
Novo tests/test-discovery.test.mjs executa cópia do runner/helper reais em diretório temporário com sentinela de integration/ falhando. Antes: runner ignora sentinela, retorna0 e teste falha. Depois: retorna1, cobrindo execução pública sem mock de child_process.

## Testing Plan
RED/GREEN do runner em fixture; testes do gate com omissão explícita de integration/; npm test e test:release reais para demonstrar exposição das falhas preexistentes, sem corrigi-las/excluí-las nesta prioridade. Sintaxe focal e revisão independente proporcional.

## Implementation Plan
1. Criar teste de regressão e executar RED.
2. Expandir regressionTests() e reutilizá-la em test-all, adicionar script test:release e documentação.
3. Rodar gates e registrar o resultado atual/falhas restantes em docs/Relatório.md.

## Resultado
- RED: runner ignorou integration sentinelaFAIL e retornou0; inventário também omitiu os5arquivos.
- GREEN: teste do runner real em fixture propaga código1 e mensagem da integração; gate recusa relatório omitindo integration.
- Revisão encontrou dependência da prévia ausente de regressionInputs. Acrescentado scripts/preview-ui.mjs e teste de hash real/rejeição de omissão (RED comprovado antes, GREEN depois).
- Lote focal final5/5, sem falhas/pulos/TODO; sintaxe focal e diffcheck aprovados.
- Inventário compartilhado51arquivos (46tests +5integration).
- npm test e primeira execução test:release:400testes,396pass,4fail, sem skips. Falhas:2filial, Option undefined e timeout na prévia; correspondem aos próximos pontos6/7. Nenhuma exclusão/skip aplicada.
- Gate final após teste adicional de fingerprint:401testes,397pass,4fail, sem skips/TODO/cancelamentos; exit1 e statusFAIL. Etapas posteriores não executadas pelo fail-fast existente.
- Revisão independente review_seg01 (GPT-6.1Sol) aprovou delta final e repetiu5/5. Liberação permanece bloqueada pelas falhas dos próximos pontos.
- Comandos npm via CLI11.6.2 temporário porque npm não está no PATH; fallback direto node scripts/validate-pilot.mjs documentado. Sem SQL de produto, commit, push ou deploy.

## Referências
- https://nodejs.org/api/cli.html#--test
- https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options
