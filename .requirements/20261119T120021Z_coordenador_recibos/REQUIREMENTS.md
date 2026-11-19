# As Is
Coordenador consulta financeiro nos depositos vinculados, mas nao emite recibos nem anexa comprovante. Upload existente confirma pagamento integral.
# To Be
Permitir emissao de recibo e envio assinado pelo coordenador, preservando escopo. Decisao sobre upload/confirmacao pendente de resposta do usuario.
# Requirements
1. Coordenador emite recibo individual e em lote no seu escopo, com auditoria, MFA e idempotencia existentes.
2. Gestor continua leitor; depositos alheios ou revogados permanecem bloqueados.
3. Novas permissoes de recibo independentes de permissoes de correcao financeira.
# Acceptance Criteria
POST recibo permitido no escopo e negado fora; dados e auditoria persistidos. UI oferece emissao. Nenhuma ampliacao implicita de desfazer/substituir baixa.
# Principal Regression Test
integration/coordinator-receipts.integration.mjs, HTTP autenticado e SQL descartavel: coordenador emite recibo.
# Testing Plan
Teste real por persona; testes existentes FIN02/FIN03 e interacoes UI pertinentes. Revisao independente por autorizacao/financas.
# Implementation Plan
Teste red; permissoes granulares em API/UI; fluxo de upload conforme resposta; green; revisao independente.

# Current Result
Emissao individual/lote e impressao para COORDENADOR implementadas com flag podeEmitirRecibo separada de podeOperar. Escopo financeiro por deposito preservado.
RED real: POST recibo retornava 403 para coordenador.
GREEN real: integration/coordinator-receipts.integration.mjs com COORD_RECEIPTS_SQL_TESTS=YES passou (13s): individual/idempotencia, lote, impressao, fora de escopo, gestor negado, revogacao, correcao financeira negada.
GREEN UI: coordinator-receipts-ui e fin02-batch-ui passaram (2 testes).
GREEN adjacente: fin02-batch, fin02-document, receipt-upload (6 testes). Syntax/diff check passaram.
Revisao independente GPT-6.1 Sol medium aprovada para emissao, apos ajustar DTO POST para nao declarar podeOperar=true ao coordenador.
PENDENTE: resposta do usuario sobre anexar recibo assinado tambem confirmar baixa integral (fluxo atual). FIN03 ainda nao alterado. Sem deploy.

# Confirmed Scope
Usuario confirmou: Sim, enviar e confirmar pagamento. Permitir confirmacao integral pelo coordenador, incluindo importacao de recibos assinados, com escopo e auditoria. Nao ampliar desfazer baixa/substituir anexo.

# Final Result
CONCLUIDO LOCAL: coordenador emite recibos individual/lote, envia assinado e confirma pagamento integral; importacao PDF usa mesma permissao. Depositos autorizados, MFA, validacoes, auditoria e idempotencia preservados. Undo/replace continuam admin/finance.
RED upload SQL: 403 em vez do acesso autorizado; RED UI: input file ausente.
GREEN SQL coordenador (18s): emissao, lote, impressao, upload, baixa integral persistida, download, idempotencia, importacao PDF, auditoria do ator, MFA negado, gestor negado, escopo alheio/revogado negado e undo/replace negados.
GREEN SQL FIN03 (20s): baixa, anexos, correcoes, concorrencia real, rollback e persistencia; base descartavel removida.
GREEN UI e adjacentes (4 testes): coordinator-receipts-ui, fin03-import-ui, fin02-batch e receipt-upload.
Revisao independente FIN03 aprovada por GPT-6.1 Sol medium, sem achados materiais. Diff/syntax checks passaram. Sem deploy.
