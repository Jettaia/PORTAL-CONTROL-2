# FIN-03 — Baixa integral com recibo assinado e correções rastreáveis

Status: implementado, integrado ao checkout e validado localmente em 30/10/2026. Migração aditiva 34 preparada; piloto instalado não atualizado/reiniciado. Ativação definitiva permanece em FIN-04.

Fonte canônica: [FINANCEIRO-SPEC](../../../docs/FINANCEIRO-SPEC.md).

## Resultado

Financeiro/admin anexam o recibo assinado e confirmam o pagamento integral de uma contratação. Também podem desfazer uma baixa com motivo ou substituir um anexo incorreto, mantendo a rastreabilidade.

## Escopo e delta sobre a base

- Integrar upload, confirmação, consulta de anexo, desfazimento e substituição à tela/detalhe únicos.
- Exigir recibo emitido e arquivo do recibo assinado antes de concluir a baixa. O arquivo é a evidência exigida, sem reconhecimento automático de assinatura e sem comprovante bancário obrigatório.
- Registrar somente o valor integral liberado de uma contratação por vez. Não aceitar entrada de valor parcial ou lista de contratações para pagamento conjunto.
- Usar a data original de emissão como data do pagamento; registrar separadamente instante real e autor da confirmação para auditoria.
- Persistir evidência, baixa e estado Pago consistentemente, incluindo o marcador operacional que protege contratação paga contra revisão/cancelamento indevido.
- Revalidar liberação, valor e origem do recibo na confirmação. Emissão antiga não pode quitar outra versão da contratação inadvertidamente.
- Desfazer baixa somente com motivo, restaurando Recibo gerado e pendência, mantendo documento e trilha da baixa anterior. A operação corrige o portal, sem movimentação bancária.
- Permitir substituição do anexo incorreto sem mudar a situação Pago. Preservar versões/histórico de arquivo e registrar autor e instante da troca.
- Aplicar acesso global de financeiro/admin e leitura do gestor por depósito em anexos e histórico, inclusive por URL direta. Negar todas as mutações ao gestor.
- Definir tipos/limites de upload proporcionais a recibos digitalizados e manter os controles de conteúdo e acesso existentes; informar os limites na interface, sem impor uma política de arquivo como nova regra de negócio.

## Critérios observáveis

1. Sem recibo emitido ou sem arquivo, não há baixa; falha de upload/gravação não deixa contratação marcada como paga.
2. Baixa válida confirma o valor integral, apresenta Pago na lista/detalhe e usa a emissão original como data do pagamento, mesmo quando confirmada depois.
3. Usuário/instante real da confirmação ficam consultáveis no histórico; não há campo separado para data efetiva do pagamento.
4. Financeiro/admin operam qualquer depósito; gestor consulta apenas seu depósito e não confirma, desfaz ou troca anexo por chamada direta.
5. Reenvio/concorrência não duplica pagamento ou perde alterações. Pagamento parcial e agrupamento são recusados.
6. Desfazer sem motivo é recusado; com motivo restaura a pendência e preserva documento e histórico. Substituir arquivo mantém Pago e registra a versão anterior e a troca.
7. Proteção de contratação paga e elegibilidade para baixa permanecem consistentes com o módulo operacional, inclusive em falha e concorrência com revisão/cancelamento.

Cobertura da SPEC: critérios 2–5 para mutações/anexos, 16–25; proteção de origem integrada com FIN-01/02.

## Dependências por etapa

- Preparação de upload e apresentação: pode começar após conhecer os contratos de detalhe de FIN-01.
- Confirmação persistida: depende do recibo identificável, data original e vínculo de origem de FIN-02, e da consulta/autorização de FIN-01.
- Validação de transações/concorrência: requer SQL Server de teste com o esquema deste fluxo. Ausência do ambiente impede essa prova, não a escrita dos tickets ou código independente.
- Ativação e desligamento das rotas de pagamento antigas: FIN-04. Não permitir que a rota antiga de agrupamento contorne as regras novas.

## Verificação focal

- Fluxo HTTP autenticado com persistência: emitir, anexar, confirmar em outro dia, ler anexo, trocar arquivo e desfazer com motivo.
- Casos negativos de documento ausente, escopo alheio, gestor tentando escrever, valor/lista forjados e versão de contratação divergente.
- Prova de rollback e disputa de gravações pertinente à transação alterada, usando os precedentes de pagamentos/contratações sem depender apenas de mocks de SQL.
- Verificação visual focal das ações, mensagens e histórico no detalhe da tela única.

## Fora desta entrega

Execução bancária, parcelas, agrupamento, estorno de dinheiro real, ajustes contábeis e relatórios novos.

## Registro de execução

Resultado: FIN-03 concluído no escopo de código e validação local. POST `/api/financeiro/contratacoes/:id/pagamento` confirma baixa integral com recibo compatível e arquivo; GET consulta baixa, versões de evidência e histórico. POST `/pagamento/anexo` substitui o arquivo; POST `/pagamento/desfazer` exige motivo. GET `/anexos/:anexoId` entrega bytes somente a usuários autorizados, inclusive versões anteriores. Interface integrada ao detalhe FIN-01, sem data/valor editável nem tela adicional.

Baixa, evidência, marcador `PagoEmUtc` e auditoria são transacionais. Data do pagamento vem da emissão original; confirmação registra instante real/ator separadamente. A mesma trava PC04 serializa origem e pagamento; unicidade filtrada impede duas baixas ativas. `baixaId/anexoId` esperados protegem correções concorrentes. `ultimaBaixaId` na leitura e `baixaAnteriorId` na confirmação impedem que uma confirmação atrasada restaure pagamento depois de desfazer; nova confirmação exige estado atualizado. Recibo e versões anteriores permanecem consultáveis; desfazer retorna a Recibo gerado, substituição conserva Pago. Escritas legadas continuam bloqueadas com FIN-01 ativo.

Upload: PDF, PNG ou JPEG até 5 MiB, com nome/extensão/MIME, base64 canônico, limite e assinatura binária validados. Download autenticado usa attachment, nosniff e CSP sandbox. O arquivo não passa por reconhecimento automático de assinatura. Persistência do conteúdo é parametrizada via ODBC: o teste do limite detectou lentidão no parse do literal SQL de 10 MiB, resolvida sem reduzir o tamanho permitido.

| Critérios | Comando / prova | Resultado |
|---|---|---|
| 1–7 | `$env:FIN03_SQL_TESTS='YES'; node --test integration/fin03.integration.mjs` | PASS, `fin03_backend`, 1/1 em 19,1s: HTTP autenticado + SQL Express descartável; admin/financeiro sem vínculo, gestor A/B e revogação, anônimo/CSRF, ausência de recibo/arquivo, origem divergente, valor/lista forjados, emissão dois dias antes da confirmação real, valor integral, confirmação simultânea sem duplicação, replay pós-desfazimento recusado, reconfirmação com estado atual, rollback de confirmar/trocar/desfazer por falha SQL na auditoria, versões e bytes de download, substituições concorrentes 200/409, cancelamento pago e revisão concorrente recusados, upload/download de 5 MiB e rejeição acima do limite. |
| 2–6, interface | `$env:JETTA_PLAYWRIGHT_ROOT='C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; node integration/fin03.visual.mjs` | PASS, principal: scripts/CSS reais com HTTP sintético; ADMIN/FINANCEIRO confirmam, recuperam falha, substituem, desfazem e reconfirmam com versão atual; arquivo inválido não envia; gestor lê sem controles de mutação. Capturas em 1440/390 sem overflow, zero erros JS. |
| Regressão FIN-01/02 | `$env:FIN01_SQL_TESTS='YES'; $env:FIN02_SQL_TESTS='YES'; node --test integration/fin01.integration.mjs integration/fin02.integration.mjs` | PASS, principal, 2/2 com SQL real: fila/filtros/escopo e emissão/snapshot/reimpressão/rollback. |
| Regressão UI | `node integration/fin01.visual.mjs`; `node integration/fin02.visual.mjs` com ambiente Playwright acima | PASS, principal, filas/perfis/filtros e recibo/impressão. |
| Regressão adjacente | `node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/pc08.test.mjs pilot-local/unit.test.mjs` | PASS, principal, 103/103. Casos legados PC08 exercitam seu modo próprio; o teste FIN03 comprova bloqueio da rota legada com a fila nova ativa. |
| Sintaxe | `node scripts/check-all.mjs` e `node --check` focal nos arquivos FIN03 após delta final | PASS, principal: 681 arquivos sem falha no lote; delta final verificado focalmente. |
| Aparência / revisão | Imagens `artifacts/fin03/pago-FINANCEIRO-390.png`, `detalhe-GESTOR-1440.png` e capturas de detalhe desktop/mobile | Principal e reviewer inspecionaram pixels: ações legíveis, agrupamento consistente com FIN01, sem cortes/overflow. Revisor `fin03_review`, GPT-6.1 Sol medium, Standards + Spec: APROVADO, nenhum achado material. Revisão somente leitura, reutilizando provas SQL/UI; não repetiu mutações SQL. |

TDD: RED HTTP por endpoint ausente (404 no lugar de autorização), RED UI por campo Recibo assinado ausente e RED do controle de concorrência por `baixaAnteriorId` ausente; GREEN após implementação. Requisitos e decisões técnicas em `.requirements/20261030T134020Z_fin03_baixa/REQUIREMENTS.md`. Serena/LAD indisponíveis. Ambiente Windows, Node v24.19.0, ODBC Driver 18, SQL Express local em bancos aleatórios `JETTA_CONTROL_B3_TEST_*`, fixtures sintéticas; UI headless Edge/Playwright com HTTP sintético, persistência e autorização provadas separadamente pelo HTTP real.

Pré-requisito operacional: **aplicar as migrações aditivas 33 (FIN-02) e 34 (FIN-03), nessa ordem, antes da próxima inicialização do piloto instalado com este candidato**. `scripts/upgrade-fin03.mjs` foi preparado, exige `JETTA_FIN03_UPGRADE=YES`, piloto parado, backup verificado, identidade de instância e comparação dos dados existentes; pressupõe FIN-02 instalado. Não foi executado no piloto instalado; seu percurso completo com backup não está certificado por esta entrega. Schema/migração 34 foram exercitados na instalação dos bancos descartáveis. Não houve limpeza de dados financeiros, reinício do piloto, commit, push ou deploy. FIN-04 continua pendente.

Fingerprint SHA256 do candidato testado/revisado: `df2ed54eabcbaf6fba131fe19c1e0267b064c037567730ba5d1222b857760f07`, sobre concatenação UTF-8 (LF, sem LF final) de `caminho:sha256`, nesta ordem: `src/fin01.js`, `src/fin01-routes.js`, `src/fin03.js`, `src/fin03-routes.js`, `src/server.js`, `public/fin01.js`, `public/fin01.css`, `pilot-local/fin03-payments.sql`, `pilot-local/sql/34-fin03-payments.sql`, `pilot-local/build-schema.mjs`, `pilot-local/sql/manifest.json`, `scripts/upgrade-fin03.mjs`, `integration/fin03.integration.mjs`, `integration/fin03.visual.mjs`.
