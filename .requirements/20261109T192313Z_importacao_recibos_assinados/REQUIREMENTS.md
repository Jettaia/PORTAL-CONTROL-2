# As Is
Financeiro gera recibos individuais e em lote. FIN03 confirma pagamento integral individual com recibo assinado anexado; valida emissão/origem, escopo, concorrência e mantém histórico. Ainda não há importação de PDF com vários recibos.

# To Be
Novos recibos têm QR Code de identificação. O financeiro importa PDF de recibos assinados, confere páginas/vínculos por contratação e depósito, corrige vínculos ambíguos e confirma somente pagamentos selecionados. Cada contratação recebe seu PDF separado.

# Requirements
1. QR Code legível identifica emissão/contratação, sem representar prova de assinatura ou pagamento.
2. Receber PDF multipágina; reconhecer QR e texto quando disponível, permitir vínculo manual de páginas sem identificação e agrupamento de recibo multipágina.
3. Prévia mostra contratação, depósito, prestador, valor e páginas; permite inspeção visual, seleção explícita e descarte sem baixa.
4. Confirmar pagamentos integrais selecionados reutilizando FIN03; anexos específicos por contratação, auditoria, resultados individuais e proteção contra duplicidade/origem alterada.
5. Autorização servidor ADMIN/FINANCEIRO conforme regra atual, incluindo escopo de coordenador com função financeira. Prévia privada, expiração, tamanho/páginas/recursos limitados e nenhum envio de documentos a terceiros.
6. Como números de contratação se repetem por depósito, vínculo manual exige depósito + número na interface; QR usa identificador interno e versão exatos.

# Acceptance Criteria
1. PDF impresso dos novos recibos contém QR decodificável; identificação conferida com registro servidor.
2. PDF com recibos de depósitos distintos produz associações corretas; ilegível/ambíguo não paga automaticamente. Agrupamento manual preserva páginas.
3. Prévia/discard não escreve baixa; só seleção revisada é confirmada. Erros e expiração têm mensagem compreensível.
4. Persistir e reler pagamento e anexo separado. Contratação alterada, já paga, página reutilizada ou vínculo inválido não gera nova baixa. Falha parcial informa resultado por item.
5. Negar sem login, perfil leitor e prévia alheia; revalidar autorização e dados na confirmação. Dados e sessões reais preservados.

# Principal Regression Test
Nova integração `integration/fin03-import.integration.mjs`: SQL local descartável + HTTP autenticado + PDFs de recibos reais. QR, prévia, vínculo manual, seleção, pagamento, releitura de anexos e negações. Testes de processamento PDF e UI complementam essa fronteira.

# Testing Plan
TDD em processamento/rotas e UI: RED antes, GREEN depois. Integração com banco sintético, atores ADMIN/FINANCEIRO/leitor e usuários distintos. Regressões de FIN02 documento/lote e FIN03. Capturas desktop/celular da prévia em frontend real com fixtures. Revisão independente por risco financeiro.

# Implementation Plan
1. Backend: QR, processamento local limitado, prévia privada/temporária, vínculo, divisão do PDF e confirmação existente.
2. Frontend: ação no Financeiro, upload, revisão/agrupamento/seleção e resultados; preservar filtros e acesso atual.
3. Integração SQL/HTTP, regressões focais, revisão independente e correções; registrar evidências aqui.

# Ownership
Backend: receipt_backend (módulos FIN03 importação, documento QR, dependências e testes focais). Frontend: receipt_ui (novo JS/CSS e teste de interação). SQL QA: receipt_sql_qa (nova integração isolada). Principal: requisitos, conexão server/index, integração final e revisão. Alterações existentes preservadas. Sem commit/push/deploy autorizado.

# Validation (em andamento)
- Regressão adjacente `FIN03_SQL_TESTS=YES node --test integration/fin03.integration.mjs`: PASS 1/1, SQL real isolado, concorrência, persistência, rollback e anexos de 5MiB. Banco descartável removido e ausência confirmada.
- Baseline `node --test tests/fin02-document.test.mjs tests/fin02-batch.test.mjs`: PASS 5/5 antes da alteração QR.
- RED SQL da importação: HTTP 404 no endpoint ausente em lugar de 401; banco sintético criado/removido com verificação.
- RED UI: ação de importação inexistente. GREEN UI inicial 1/1, com agrupamento, descarte, vínculo manual, seleção explícita, resultado parcial e prévia expirada (respostas HTTP sintéticas).
- Inspeção visual inicial do principal em `artifacts/fin03-import/desktop.png` e `mobile.png`: campos, seleção e ações acessíveis, sem corte horizontal. Fixture de interação usa imagem mínima; prova com páginas reais em andamento.
- APIs consultadas em fontes primárias: pdf-lib copyPages (https://pdf-lib.js.org/docs/api/classes/pdfdocument), Tesseract instalação local/API (https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), PDF.js isEvalSupported (https://github.com/mozilla/pdf.js/discussions/18168). Serena/Lad indisponíveis nesta sessão.
- Revisão independente (receipt_review, Sol medium): dois P2 corrigidos — preflight de dimensões de imagens e resultado explícito para todas as seleções após interrupção401/403. Delta aprovado, 2/2 testes focais independentes.
- Descoberta SQL: número é único por depósito, não global. Corrigidos backend e UI para desambiguação manual por depósito; preservada fixture com contratação1 nos depósitosA/B.
- GREEN integrado inicial `FIN03_IMPORT_SQL_TESTS=YES node --test integration/fin03-import.integration.mjs`: 1/1, ~55s; SQL descartável removido/verificado. Expansão focal para interrupção por revogação de ator em andamento.
- GREEN focal final de parsing: 4/4 incluindo QR raster, texto, OCR local, split e rejeição de imagem excessiva. UI após seletor de depósito + regressão unitária FIN02:6/6. Conjunto anterior de documentos/lote/UI/parsing:10/10.
- `node scripts/check-all.mjs`:763 arquivos, zero falhas. Sintaxe dos módulos modificados revalidada após correções.
- Principal inspecionou `artifacts/fin03-import-integrated/receipt-qr.png`, desktop.png e mobile.png com PDF real rasterizado/assinatura sintética: QR separado do cabeçalho, conteúdo/assinatura sem sobreposição, prévia com depósitos distintos e recibo visível. A4 de emissão real1 página. Capturas atuais do seletor manual também em `artifacts/fin03-import`.

# Final acceptance
VALIDADO localmente. Sem achados materiais pendentes na revisão independente de backend/frontend.

- Final `FIN03_IMPORT_SQL_TESTS=YES node --test integration/fin03-import.integration.mjs`: PASS1/1, ~64s, zero skips. SQL Express local com banco aleatório descartável, remoção e ausência confirmadas.
- Personas: ADMIN, FINANCEIRO, gestor leitor, coordenador com função financeira restrito ao depósitoA, usuário distinto e ator desativado durante confirmação. Sessão ausente, origem indevida, prévia alheia, escopo inválido e entradas/vínculos inválidos recusados.
- PDF image-only com QR, texto legado e vínculo manual depósito+número. Prévia/descarte sem baixa; seleção parcial, páginas agrupadas, download/releitura do PDF anexo2páginas e mudança de estado persistida. Contratações com mesmo número em depósitos distintos preservadas. Duplicação/replay, páginas sobrepostas, origem alterada e já pago protegidos.
- Revogação real: trigger somente no banco de teste desativa o ator após primeira baixa confirmada. Resposta3itens [PAGO,FALHA,FALHA], uma baixa/anexo adicional, duas contratações mantidas RECIBO_GERADO.
- Capturas finais inspecionadas pelo principal: desktop1440×1000 e mobile390×844, tema claro, recibos/assinaturas sintéticos e PNGs reais da importação, seletor obrigatório de depósito presente. Arquivos em artifacts/fin03-import-integrated.
- Limites entregues:10MiB/20páginas por PDF;25milhões de pixels por imagem; processamento worker180s/256MiB heap; uma operação PDF por processo; até2prévias temporárias de15min; anexo dividido até5MiB. Node>=22.13, dependências+modelo OCR no lockfile. Sem transmissão a serviços OCR externos.
- Não executados: deploy, reinício da instância operacional, testes com documentos reais de pessoas. Assinatura e efetivação externa do pagamento dependem de conferência humana; QR/OCR identificam vínculos.
