# As Is
Extrato financeiro lista resumo por prestador; Ver extrato troca a tabela para detalhes individuais. Prestador em vários depósitos tem valores somados na listagem.
# To Be
Na aba Extrato por prestador, agrupar por depósito, com totais completos de cada depósito. Clicar no prestador expande suas contratações do depósito na mesma tela. Manter filtros, detalhes e impressão.
# Requirements
1. Agrupar por depósito e prestador, exibindo nome, CPF/CNPJ formatado, quantidade, devido, pago e saldo.
2. Expandir/recolher cada prestador sem navegar e carregar suas contratações por demanda com paginação. Mostrar número, data do serviço/criação, atividade, pagamento, valores e saldo, preservando consulta de detalhes e impressão.
3. Somente com movimentação marcado por padrão; desmarcar inclui prestadores com vínculo ativo sem contratações elegíveis. Histórico financeiro continua visível após revogação do vínculo.
4. Filtros por prestador, depósito e criação mantêm contexto ao expandir/imprimir. Valores de um depósito nunca incluem outro. Totais completos independem da página carregada.
5. Preservar autorização atual (admin/financeiro globais e gestores/coordenadores por depósitos autorizados), ausência de escrita, validação estrita, cancelamento assíncrono em logout e troca de filtros.
6. Disponibilizar no runtime local existente após testes, sem deploy remoto.
# Acceptance Criteria
1. Mesmo prestador em A e B aparece em ambos com totais separados; CPF/CNPJ formatado.
2. Clique/teclado expande e recolhe, não troca página; paginação e impressão completas por par; erro permite tentar novamente; consulta vazia explícita.
3. Zero movimento aparece só quando opção desmarcada; período não confunde cadastro com movimentação.
4. Depósitos/totais globais exatos e filtros aplicados preservados inclusive com rascunhos diferentes nos campos.
5. HTTP/SQL nega escopos alheios inclusive dados sem movimento e acesso direto; entradas inválidas sem escrita; respostas antigas não sobrescrevem contexto atual.
6. HTTP local responde após reinício com código atualizado.
# Principal Regression Test
Integração de UI headless em integration/fin05-grouped-ui.test.mjs com componente real; deve falhar antes ao não existir agrupamento e expansão inline. Integração HTTP/SQL existente estendida em integration/fin05.integration.mjs para fronteira real de dados/permissão.
# Testing Plan
Red/green da interação; HTTP/SQL isolado por personas; impressão integral, totais e paginação; estados vazio/erro/loading e invalidação; capturas desktop/mobile com CSS integrado. Revisão independente por risco financeiro/read-only.
# Implementation Plan
1. Fixar contrato aditivo agrupamento=deposito e somenteMovimentacao=0|1, preservando endpoint individual e catálogo financeiro legado.
2. Backend/testes em ownership separado; frontend/testes pelo principal.
3. Integrar, validar gates focados, revisar candidato e corrigir achados materiais.
4. Reiniciar runtime local seguro e verificar HTTP.
# Visual Reference
Tela atual public/fin05.js, public/fin05.css e overrides public/pilot-design.css, screenshot fornecido pelo usuário. Manter shell, cores azul/laranja, fontes, campos e tabelas existentes. Skill Nosso Design exclui Jetta Control; aplicar padrões locais e prova focal Impeccable.

# Results — accepted locally
- Backend RED real: agrupamento novo retornava HTTP 400 FILTRO_INVALIDO antes da implementação.
- UI RED real: fluxo agrupado inexistente na implementação anterior, sem carregar o novo catálogo/agrupamento.
- HTTP/SQL isolado: FIN05_SQL_TESTS=YES node --test integration/fin05.integration.mjs, 1/1 aprovado, incluindo ADMIN, FINANCEIRO, GESTOR A/B, COORDENADOR e COORDENADOR+FINANCEIRO; fora do escopo vazio, vínculo zero, histórico revogado, período e paginação104 pares.
- UI full-shell: node --test integration/fin05-grouped-ui.test.mjs, 1/1 aprovado com quatro personas; expandir/recolher, paginação102 contratações e resumo por par, impressão integral com filtros aplicados, cancelamento ao filtrar, detalhes financeiros, erro/retry/vazio, respostas antigas e logout.
- Regressão adjacente: node --test tests/fin01-export.test.mjs tests/fin01-export-artifacts.test.mjs, 5/5 aprovado.
- Revisão independente GPT-6.1 Sol medium: backend e frontend APROVADOS, sem achados materiais.
- Sintaxe aprovada em src/fin05.js, src/fin01-routes.js e public/fin05.js.
- Visual inspecionado pelo principal via view_image: artifacts/fin05-grouped/desktop-expanded.png (1440x1050) e mobile-expanded.png (390x900), shell real com dados sintéticos. Corrigido auto-layout que ocultava Saldo/impressão; botão print dentro da largura visível do depósito. Tabelas com scroll interno; documento sem overflow horizontal.
- Detector Impeccable 1x: warnings de bordas da identidade local, mantidas conforme referência existente.
- Runtime reiniciado graciosamente com backup pelo iniciador existente; HTTP200 e script agrupado servido confirmados em 127.0.0.1:3211, PID25668.
- Sem deploy remoto, migração ou escrita operacional da funcionalidade. Mudanças preexistentes preservadas. Nenhuma credencial em evidências.
