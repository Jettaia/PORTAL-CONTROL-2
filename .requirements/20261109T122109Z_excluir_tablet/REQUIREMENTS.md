# As Is
ADMIN só vê Excluir em tablet revogado; servidor rejeita exclusão direta do ativo. Exclusão lógica, auditoria e preservação histórica já existem.
# To Be
ADMIN vê Excluir para qualquer tablet cadastrado. Confirmar encerra autorização, remove da lista e preserva histórico. GESTOR continua sem essa permissão.
# Requirements
1. Oferecer Excluir para ADMIN em todos os estados, confirmando nome e encerramento do acesso.
2. Revogar e excluir logicamente na mesma transação, mantendo sessão/origem/MFA/admin, trava e auditoria existentes.
3. Preservar tokens, apontamentos, auditoria e demais tablets; cancelamento/negação/falha não escrevem.
# Acceptance Criteria
ADMIN exclui ativo/pendente/revogado; dispositivo excluído não aponta/ativa; gestor não exclui via interface/API; token/apontamento antigo permanece; falha de auditoria reverte tudo.
# Principal Regression Test
node --test tests/pc05.test.mjs integration/tablet-deletion-ui.test.mjs: ativo passa a oferecer Excluir e POST antes rejeitado passa a revogar/excluir. RED antes de código, GREEN depois.
# Testing Plan
UI real headless para confirmar/cancelar/recusar/excluir e viewport mobile; HTTP/SQL descartável em integration/tablets.integration.mjs para sessão, preservação histórica, exclusão ativa, pareamento e rollback; regressão PC05 existente.
# Implementation Plan
Atualizar testes e executar RED; ajustar serviço/UI sem migração; executar GREEN e SQL; revisão independente da revogação/integridade; reiniciar portal local. Sem exclusão de tablet operacional, push ou deploy remoto.

# Verificação
- RED: UI não oferecia Excluir Atual (0 em vez de 1); API retornava 409 TABLET_NAO_REVOGADO em vez de 200.
- GREEN: node --test tests/pc05.test.mjs integration/tablet-deletion-ui.test.mjs, 57/57 sem skips/falhas. Inclui exclusão lógica ativa/revogada, MFA, origem, gestor negado, rollback, confirmação cancelada e API recusada.
- UI repetida após prova de geometria mobile: 1/1. Botão alcançável por rolagem horizontal da tabela existente e contido no viewport390; nenhuma mudança de layout da tabela.
- Capturas artifacts/tablet-delete-direct/desktop.png e mobile.png; desktop inspecionado mostrando Excluir em ativo/revogado. Screenshot mobile inicial mostrou apenas lado esquerdo; prova refinada rolou até ações antes da captura e mediu botão.
- Revisão independente GPT-6.1 Sol medium: aprovado sem achados materiais de auth/integridade.
- Sintaxe e diff --check aprovados. SQL real e disponibilização local em andamento; nenhuma exclusão em dados operacionais.

- SQL real: JETTA_B3_RUN_SQL_TESTS=YES JETTA_B3_SQL_SERVER=localhost\SQLEXPRESS node --test integration/tablets.integration.mjs PASS 1/1, sem skips (167s). Cobriu administrador, gestor e financeiro; ativo excluído perde sessão e apontamento; pendente excluído não ativa; trigger real de falha na auditoria reverte e mantém autorização; tokens antigos e eventos preservados. Banco sintético removido no finally.
- Captura mobile refinada inspecionada com view_image: Excluir visível e acessível na área de ações após rolagem horizontal, conforme tabela existente.
- Todas alterações permanecem locais, extenso de recibo continua pendente e fora deste escopo. Nenhum tablet operacional excluído na validação.

Portal local reiniciado pelo sinal/iniciador oficiais; backups verificados na saída/abertura e HTTP 200 confirmado. Disponível para teste como ADMIN, sem commit/push/deploy.
