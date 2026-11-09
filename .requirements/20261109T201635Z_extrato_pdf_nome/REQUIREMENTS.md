# As Is
Extrato agrupado exporta XLSX e imprime um prestador por depósito. Menu e títulos usam Extrato por prestador.
# To Be
Exportar PDF completo do extrato autorizado filtrado, com agrupamento depósito > prestador > contratações e CPF/CNPJ mascarado. Nome visível da tela/menu passa a Extrato.
# Requirements
1. PDF integral preserva filtros aplicados, todos pares/contratos e totais, inclusive além das páginas carregadas; mesmo serviço autorizado do Excel, limite explícito sem truncar.
2. Hierarquia legível em A4 paisagem, CPF/CNPJ formatado, cabeçalhos repetidos e identificação do contexto ao atravessar páginas, subtotais por prestador/depósito e total geral, datas e dinheiro exatos.
3. Botões Excel e PDF disponíveis, ambos protegidos contra downloads antigos/duplicados, erros visíveis; manter impressão individual e XLSX.
4. Renomear texto visível menu, breadcrumb, títulos da tela e impressão individual para Extrato, mantendo identificadores/rotas internas.
5. Validar e reiniciar ambiente local, sem deploy remoto, preservando trabalho paralelo.
# Acceptance Criteria
1. PDF real multipágina contém última contratação e depósitos/prestadores corretos com escopo por perfil, filtros e CPF mascarado; 401/400 adequados e sem escrita.
2. Texto não é interpretado como HTML/script, nenhum clipping; prestador/CPF/depósito identificáveis nas páginas de continuação.
3. Download com MIME/assinatura PDF, filtros aplicados, erro503 e invalidação ao mudar filtros/logout; XLSX/impressão continuam funcionando.
4. Não aparece Extrato por prestador nas superfícies visíveis afetadas.
5. Servidor local responde com script novo após reinício.
# Principal Regression Test
Teste PDF real e HTML representativo + UI download pelo botão; integração HTTP/SQL real no endpoint PDF usando fixture além100.
# Testing Plan
Red antes da implementação; green gerador e UI; regressão dos PDFs compartilhados/Excel; renderizar PDF e inspecionar páginas; revisão independente de contrato e segurança; reinício local.
# Implementation Plan
1. Estender renderer compartilhado com HTML específico mantendo cleanup/lock/timeout.
2. Gerar relatório agrupado e endpoint por serviço integral existente.
3. Generalizar download da UI para PDF/Excel e renomear rótulos.
4. Verificar evidências e disponibilidade local.

# Results
- RED: endpoint PDF404; UI nome antigo Extrato por prestador; gerador ausente antes da implementação.
- GREEN: node --test tests/fin05-export-pdf.test.mjs tests/fin05-export-xlsx.test.mjs tests/fin01-export-artifacts.test.mjs tests/pc04-export.test.mjs integration/fin05-grouped-ui.test.mjs, 15/15. PDF real106contratos7páginas, última1105 e contextoCPF na página2; UI downloadPDF/Excel, erro503 e invalidação, menu/título/breadcrumbExtrato, impressão preservada.
- HTTP/SQL real: FIN05_SQL_TESTS=YES node --test integration/fin05.integration.mjs1/1 em83s. PDF completo209contratos/104pares, último prestador100 e contratação209, totais352,41/252,31; escopo COORDENADOR+FINANCEIRO e gestor parB vazio,401/400/headers/no-store/sem escrita.
- Revisão independente Solmedium: APROVADO, sem achados materiais,15/15 independentes.
- PDF renderizado via Poppler; view_image páginas1,2 e7 inspecionadas: legível, sem clipping, cabeçalhos/contextoCPF repetidos nas páginasdetalhe e totais legíveis.
- Parser pdfjs6 usa loadingTask.destroy(), conforme tipos instalados e documentação oficial https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html . Não houve nova dependência.
- Runtime local reiniciado com backup pelo iniciador existente; página/script novo HTTP200, PID13776,127.0.0.1:3211.
- Sem deploy remoto; trabalho paralelo preservado.
