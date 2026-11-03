# FIN-02 — Emissão e reimpressão do recibo individual

Status: implementado, integrado ao checkout e validado localmente em 30/10/2026. Migração aditiva 33 preparada; piloto instalado não atualizado/reiniciado. Ativação definitiva permanece em FIN-04.

Fonte canônica: [FINANCEIRO-SPEC](../../../docs/FINANCEIRO-SPEC.md). Modelo: [MODELO DE RECIBO.docx](../../../recibos/MODELO%20DE%20RECIBO.docx).

## Resultado

Financeiro/admin geram e imprimem um recibo por contratação liberada. O documento mantém os dados e a data originais nas reimpressões. A geração muda a situação para Recibo gerado e mantém o valor pendente.

## Escopo e delta sobre a base

- Integrar emissão, consulta e impressão à tela/detalhe de FIN-01. Gestor pode ler o documento de seu depósito, mas não emitir.
- Usar o modelo fornecido como autoridade de conteúdo e apresentação, incluindo a empresa pagadora e seu CNPJ; não substituir por minuta laboratorial com regras antigas.
- Preencher automaticamente valor em R$ com valor vigente liberado; serviço com tipo de atividade; data do serviço com execução; cidade/UF com depósito; data após a cidade com emissão original; nome com nome completo cadastrado do prestador.
- Manter valor por extenso, CPF e assinatura para preenchimento manual, mesmo havendo CPF cadastrado.
- Persistir o conteúdo emitido e a data local de emissão em America/Sao_Paulo. Reimpressão não recalcula os dados nem gera novo documento.
- Preservar identificação unívoca do documento por contratação sem inventar nova política de numeração.
- Revalidar a liberação vigente ao emitir. Vincular o documento à versão/dados de origem para impedir baixa de valor/documento divergente se a contratação for revisada. Preservar o histórico do documento anterior; não implementar reemissão com novos dados/data neste escopo.
- Não criar fluxo financeiro de complementação cadastral: os módulos anteriores asseguram os dados, conforme resposta do usuário.

## Critérios observáveis

1. Financeiro/admin emitem para contratação elegível; gestor e usuário sem acesso não emitem. Gestor lê e imprime somente o documento de seu depósito.
2. Emitir uma vez muda Aguardando pagamento para Recibo gerado, sem baixa e sem retirar o valor das pendências.
3. Todos os campos automáticos e manuais seguem a tabela da SPEC; cidade diferente de Sumaré é respeitada e o nome do prestador vem preenchido.
4. Reimprimir em dia posterior ou após edição de cadastro retorna o conteúdo/data originais, sem criar outro recibo. Reenvios simultâneos de emissão não duplicam o documento.
5. A impressão é legível e fiel à estrutura do modelo, com espaço adequado para preenchimento e assinatura manuais, sem cortes ou sobreposições.
6. Contratação sem liberação vigente não emite. Um documento de uma versão anterior não habilita baixa de outra versão por engano; não acrescentar um fluxo de reemissão para resolver isso silenciosamente.

Cobertura da SPEC: critérios 2, 4–5 para documentos, 10–15 e parte de 24–25. FIN-03 valida o vínculo do documento na baixa.

## Dependências por etapa

- Preparação do layout e preenchimento: pode começar diretamente pelo modelo e pelos dados de contratação existentes.
- Integração HTTP/UI e persistência: depende da identidade, autorização e contrato de detalhe estabelecidos em FIN-01, sem exigir seu aceite administrativo global.
- Consumo para baixa: publicar o identificador do recibo, sua origem, data original e consulta autorizada para FIN-03.
- Ativação definitiva: FIN-04, junto à retirada da emissão financeira antiga.

## Verificação focal

- Testes HTTP de emissão/reimpressão e escopo, aproveitando precedentes de recibos quando disponíveis. Arquivos de testes antigos podem referenciar módulos removidos; não presumir que o módulo ainda existe nem restaurar suas regras.
- Prova persistida de emissão concorrente e reimpressão, com troca controlada do dia e alteração posterior de cadastro.
- Comparar visualmente a impressão com o DOCX de referência, usando pelo menos um depósito fora de Sumaré e nome/atividade longos. A extração textual sozinha não comprova a qualidade da impressão.

## Fora desta entrega

Baixa, anexação e correções pertencem a FIN-03. Sem assinatura eletrônica, OCR, preenchimento de CPF/valor por extenso ou nova data na reimpressão.

## Registro de execução

Resultado: FIN-02 concluído no escopo de código e validação local. POST `/api/financeiro/contratacoes/:id/recibo` emite ou retorna o mesmo recibo compatível; GET da mesma rota consulta os dados persistidos; GET `/impressao` retorna o HTML original. Fila/detalhe FIN-01 refletem `RECIBO_GERADO`, sem gravar baixa ou retirar pendência. ADMIN/FINANCEIRO operam globalmente; GESTOR consulta/imprime somente dentro do vínculo vigente e não emite.

Recibo mantém snapshot, HTML, autor, instante UTC e data local America/Sao_Paulo, com identificação pela contratação, valor liberado, atividade, execução, cidade/UF, centro de custo e nome. Pagador/CNPJ e estrutura seguem o DOCX fornecido; CPF, extenso e assinatura ficam manuais. Concorrência usa a fronteira transacional/lock das contratações e unicidade por contratação. Auditoria e documento são atômicos. Versão, depósito, prestador, atividade, data, valor e liberação originais compõem o vínculo publicado para FIN-03; divergência preserva o documento e impede nova emissão silenciosa. Reimpressão não recalcula nem mesmo o HTML. CSP específico permite apenas o hash SHA256 do CSS persistido, mantendo scripts bloqueados.

| Critérios | Comando / prova | Resultado |
|---|---|---|
| 1–4, 6 | `$env:FIN02_SQL_TESTS='YES'; node --test integration/fin02.integration.mjs` | PASS, executor `fin02_backend`: HTTP autenticado com SQL Express real em banco aleatório descartável; ADMIN/FINANCEIRO sem vínculo, gestores A/B, anônimo/inativo, CSRF, aberta sem emissão, concorrência sem duplicação, data São Paulo próxima à virada UTC, cidade Santos, estado pendente, snapshot/HTML após mudança de cadastro/dia, revogação, origem divergente, liberação retirada e rollback por falha SQL na auditoria. |
| 2, 3, 5 | `$env:JETTA_PLAYWRIGHT_ROOT='C:/Users/Jetta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'; node integration/fin02.visual.mjs` | PASS, principal: interação com scripts/CSS reais e HTTP sintético, emissão/falha recuperável, leitura gestor, link de impressão, campos manuais vazios, CSS autorizado por hash, captura do detalhe em 1440/390 e PDF A4 de uma página. |
| 5 | DOCX aberto em cópia somente leitura via Word, exportado para PDF e renderizado com Poppler; comparação de pixels com recibo A4 | PASS, principal e reviewer: estrutura e conteúdo correspondentes, nome/atividade longos, Santos/SP, espaços manuais legíveis e sem cortes/sobreposições. Evidências `artifacts/fin02/modelo.png`, `recibo-a4.png`, `detalhe-{1440,390}.png`. |
| Regressão FIN-01 | `$env:FIN01_SQL_TESTS='YES'; node --test integration/fin01.integration.mjs` e `node integration/fin01.visual.mjs` com o ambiente Playwright acima | PASS, principal: fila/permissões/filtros/paginação com SQL real e UI 1440/768/390. |
| Regressão adjacente | `node --test tests/pc04.test.mjs tests/pc04-legacy.test.mjs tests/pc08.test.mjs tests/depot-legacy.test.mjs pilot-local/unit.test.mjs` | PASS — 108/108, principal. |
| Sintaxe | `node scripts/check-all.mjs`; `node --check` nas rotas e testes após delta final de CSP | PASS — 676 arquivos, mais verificação focal final, principal. |

TDD: RED HTTP por endpoint ausente, RED UI por ausência de Gerar recibo, RED impressão por duas páginas e RED CSP por ausência de hash autorizado. GREEN após implementação e correções focais. Ajustes de fixture respeitaram as constraints PC04, sem mudar suas regras. Serena/LAD não disponíveis; revisão independente Standards + Spec pelo agente `fin02_review`, GPT-6.1 Sol medium: APROVADO, sem achados materiais. Revisor inspecionou código e imagens e reutilizou as provas executadas pelo principal/backend; não executou novamente mutações SQL.

Ambiente: Windows, Node v24.19.0, ODBC Driver 18, SQL Express local em `JETTA_CONTROL_B3_TEST_*` descartável e dados sintéticos. UI headless Edge/Playwright com HTTP sintético; persistência/autorização provadas separadamente pelo HTTP real. O PDF de teste foi conferido com `pdfinfo` e renderização Poppler; DOCX original preservado.

Pré-requisito operacional: **aplicar a migração aditiva 33 antes de iniciar o piloto instalado com este candidato**, pois FIN-01 passa a consultar a tabela de recibos. `scripts/upgrade-fin02.mjs` está preparado, exige `JETTA_FIN02_UPGRADE=YES`, piloto parado, backup verificado e comparação de hashes dos dados existentes. O script não foi executado no piloto instalado; seu percurso completo com backup não está certificado por esta entrega. Schema/migração foram exercitados na instalação do banco descartável dos testes. Não houve limpeza de dados, reinício do piloto, commit, push ou deploy. Baixa/anexos são FIN-03; reset/ativação definitiva são FIN-04.

Fingerprint SHA256 do candidato testado/revisado: `beb6a18e549664021999d0409a4af7c93eafd84424764b1e2387793d71a96efb`, sobre concatenação UTF-8 (LF, sem LF final) de `caminho:sha256`, nesta ordem: `src/fin01.js`, `src/fin01-routes.js`, `src/fin02.js`, `src/fin02-routes.js`, `src/fin02-document.js`, `src/server.js`, `public/fin01.js`, `public/fin01.css`, `pilot-local/fin02-receipts.sql`, `pilot-local/sql/33-fin02-receipts.sql`, `pilot-local/build-schema.mjs`, `pilot-local/sql/manifest.json`, `scripts/upgrade-fin02.mjs`, `integration/fin02.integration.mjs`, `integration/fin02.visual.mjs`.
