# PC-10 — Correções, estornos e ajustes

## As Is
PC04 rejeita alteração após pagamento; PC08 preserva baixa/itens/anexos. PC09 tem requisitos/testes, mas seus módulos estão ausentes. Banco instalado não será migrado.

## To Be
Revisão e cancelamento preservam dinheiro entregue; diferenças são regularizadas separadamente, com data e comprovante. Estorno justificado compensa a baixa sem apagá-la.

## Requirements
1. Gestor no escopo/ADM revisa e reconfere valores, inclusive pagos; financeiro não altera acordos.
2. Financeiro estorna somente sua baixa; ADM pode estornar todas. Motivo, MFA, transação e unicidade obrigatórios.
3. Movimentos imutáveis: liberação, retirada da obrigação, pagamento, estorno, quitação/devolução. Saldo positivo significa pagar, negativo devolver. Revisão suspende regularização até reconferência; cancelamento permite devolução.
4. Decisão P06 confirmada: diferença integral com data efetiva e comprovante em operação separada, sem alterar pagamentos anteriores.
5. Decisão P07 confirmada: original preservado e marcado cancelado/substituído; substituto exige nova assinatura. Publicar invalidação por versão para integração PC09, sem inventar documento ausente.

## Acceptance Criteria
1. API permite gestor da filial e ADM; nega outro escopo, financeiro operacional e usuário inativo.
2. Estorno duplicado/concorrente não duplica compensação; baixa original/anexos permanecem.
3. Liberação → revisão → reconferência não duplica obrigação; baixa → correção/cancelamento mantém saldo explicável.
4. Regularização valida saldo e versão no servidor, data e comprovante; falha não grava parcialmente.
5. Consulta por contratação preserva origem, autor, registro e data efetiva. Integração documental final bloqueada até PC09 disponível.

## Principal Regression Test
`node --test tests/pc10.test.mjs`: HTTP real com serviço/ODBC controlado, incluindo PC04 e PC08. Red esperado módulo PC10 ausente. SQL real exigido para aceite de persistência/concorrência.

## Testing Plan
node:test por persona; regressões PC04/05/07/08; SQL descartável se instância local disponível; UI headless para gatilho, consulta, regularização, erro e logout. Não tocar dados instalados.

## Implementation Plan
1. Testes HTTP red; ledger aditivo, serviço e rotas; green.
2. Integrar hooks PC04/08 na mesma transação e configurar flag opt-in.
3. Interface e interação headless; revisão independente e QA focal.

## Gates
Serena ativada; get_symbols_overview falhou: Active language servers []. LAD inicialização real via verify_mcp.py --lad falhou em 28/10/2026: No provider credentials configured. system_design_review/code_review não executados, gate BLOCKED. Revisão própria/subagente não substituem LAD.
Referência técnica: https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql — lock Transaction exige transação; retorno negativo exige abortar.

## Resultado atual e QA
- Candidato implementado e integrado ao checkout; sem commit, push, deploy ou migração do banco instalado.
- RED: `node --test tests/pc10.test.mjs` falhou com ERR_MODULE_NOT_FOUND pc10-routes.js antes da implementação. GREEN: mesmo comando, 25 testes passaram.
- `node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/pc05.test.mjs tests/pc07.test.mjs tests/pc08.test.mjs tests/pc10.test.mjs integration/pc10.integration.mjs`: 158 PASS, 0 FAIL, 1 SKIP (SQL real). Saída local: artifacts/pc10/tests-final.txt.
- `node integration/pc10.visual.mjs` e `node integration/pc10-shell.visual.mjs`: PASS em Edge headless, HTTP sintético. Consulta, pagar/devolver, comprovante/link, conflito, MFA/logout, menu do portal e revisão → conferência → cancelamento pago; flag desligada e horários protegidos. Capturas em artifacts/pc10/, 1440/820/390.
- `node scripts/check-all.mjs`: 639 arquivos sintáticos, 0 falhas na execução; scripts acrescentados depois conferidos com node --check e execução headless. npm ausente no PATH, utilizado runner Node equivalente.
- Revisão independente por subagente GPT-6.1 Sol medium: identificou CK_PC04_Pago incompatível e perda de ledger ao desligar flag; corrigidos e rerevisados, sem achados materiais remanescentes nesses deltas. Autorrevisão adicional não equivale a LAD.
- Schema gerado com 28 arquivos e manifest atualizado. Em banco provisionado, flag pc10 desligada bloqueia gravações PC04/PC08 antes de transação, impedindo lacunas. Configuração antiga sem schema continua sem PC10.
- SQL real BLOCKED: Driver ODBC18 instalado, sem serviço/instância SQL local inventariada; tentativa real localhost/master retornou 08001/HYT00. Teste opt-in pronto: PC10_SQL_TESTS=YES e PC10_SQL_SERVER apontando instância local explícita, sempre banco aleatório descartável. Não certifica persistência/concorrência até executado.
- Documental BLOCKED: PC09 não dispõe dos módulos de produção neste checkout. PC10 mantém marcadores por contratação e versão de corte para documentos até a versão, sem alterar/apagar snapshot. Emissão do substituto e obtenção da nova assinatura ainda dependem do PC09. PagoEmUtc e painel PC08 preservam a baixa original; saldo corrente é demonstrado no painel PC10.
- LAD BLOCKED pela falta de credencial; chamadas reais system_design_review e code_review não executadas. Aceite integral do ticket pendente desses gates e integração documental.
