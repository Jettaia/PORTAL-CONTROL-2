# As Is
Importação limitada a10MiB/20páginas, parser15MiB, seleção/grupo20, imagens prévias40MiB e processamento180s.
# To Be
Suportar lotes de pelo menos50páginas, com margem:100páginas e50MiB por PDF.
# Requirements
1. Aceitar até100páginas e50MiB no upload/interface/backend; parser compatível com base64.
2. Grupo e confirmação aceitam até100páginas/itens; manter proteções de vínculo, escopo, duplicidade e anexo individual5MiB.
3. Adequar tempo e orçamento de prévias, mantendo limites explícitos de recursos.
# Acceptance Criteria
PDF de51páginas acima do antigo limite de tamanho entra pela API autenticada, permite vínculo da página51 e descarte sem baixa. PDF de100páginas processa;101é recusado. UI aceita arquivo acima de10MiB e informa50MiB/100páginas.
# Principal Regression Test
tests/fin03-import.test.mjs: PDF100páginas e rejeição101. RED esperado no limite20. Integração SQL/HTTP existente ampliada para51páginas/17MiB e vínculo/descarte. UI usa12MiB no percurso já testado.
# Testing Plan
RED/GREEN de processamento e UI; SQL isolado existente cobre transporte/autorização/vínculos/persistência. Revisão focal do delta.
# Implementation Plan
Atualizar testes antes dos limites; elevar upload/parser/páginas/itens/tempo e memória limitada de imagens; alinhar mensagens e README; rodar provas focais.

# Verification
- RED: teste100páginas falhou PDF_LIMITE_20_PAGINAS. UI12MiB falhou ao abrir prévia por bloqueio do limite antigo.
- GREEN processamento:5/5, incluindo100páginas, split das páginas1/50/100, rejeição101,51páginas raster com QR e uma adicionalOCR, proteção de imagem excessiva e interrupção de pagamento.
- GREEN UI + admissãoHTTP:2/2. UI aceita12MiB. Middleware testa autorização antes deparse (JSON inválido sem sessão401/leitor403), corpo16MiB autorizado, segunda requisição409 e liberação posterior.
- Revisão independente apontou parser grande antes da autenticação; corrigido com admissão de upload antes do parser: origem/sessão/autorizaçãofinanceira/MFA, rate limit20/min e um corpo grande ativo por processo. Revisão do delta aprovada e testeHTTP independente1/1.
- Limites finais:50MiB/100páginas/100itens; parser70MiB para base64 somente POST de upload; demais rotas com limites menores. Imagens de prévia acumuladas até200MiB; análise até10min. Mantidos25MP por imagem,2prévias/15min,um worker,heap256MiB e anexo individual5MiB.
- SQL ampliado inicial PASS1/1 (~177s):51páginas/17MiB viaHTTP autenticado, vínculo das51páginas e descarte sem baixa, seguido da regressão financeira original completa. Banco sintético removido/verificado. Rerun após admissão de upload em andamento.
- Sintaxe dos módulos alterados validada. Alterações anteriores preservadas; sem deploy/reinício operacional.

# Final acceptance
VALIDADO. Rerun final com admissão autenticada antes do parser: `FIN03_IMPORT_SQL_TESTS=YES node --test integration/fin03-import.integration.mjs`, PASS1/1 (~49s), zero skips.51páginas/17MiB aceitos, vínculo completo/descarte sem escrita e regressão de pagamentos/anexos/escopos/duplicidade/revogação durante lote aprovados. Banco sintético removido e ausência confirmada. Revisão independente sem achados materiais pendentes. Não realizado deploy ou reinício da aplicação operacional.
