# As Is
As telas contêm os textos explicativos selecionados nas 17 anotações. O rodapé compartilhado foi removido no pedido anterior.
# To Be
Remover somente os textos indicados, inclusive o rodapé em todas as telas do portal.
# Requirements
1. Remover aviso de acesso por depósito e os três textos selecionados da administração de usuários.
2. Remover descrições selecionadas de tipos de atividade/serviço, tablets, contratações, financeiro e extrato.
3. Remover os dois avisos de contratações e a mensagem de sucesso Consulta atualizada desse módulo.
4. Preservar controles, regras, permissões, mensagens de erro e outros textos.
# Acceptance Criteria
Os trechos selecionados não aparecem; formulários, filtros e títulos permanecem disponíveis. O rodapé não reaparece ao navegar.
# Principal Regression Test
Smoke de UI com módulos reais e respostas sintéticas de consulta, navegação nas telas afetadas e confirmação de ausência dos textos. Smoke HTTP no piloto local para o rodapé.
# Testing Plan
Checar sintaxe dos JS modificados e executar suítes adjacentes de contratações, financeiro e extrato. Edição mecânica de conteúdo: sem novo teste permanente nem exigência de captura visual.
# Implementation Plan
Remover parágrafos/avisos estáticos completos, esvaziar descrições selecionadas da navegação e somente a mensagem de sucesso de consulta PC04. Validar os controles adjacentes.

# Resultado
Concluído: textos das 17 anotações removidos (rodapé compartilhado preservado como ausente). Cinco arquivos de UI alterados, sem mudanças de regras ou autorização.
Validação: node --check nos quatro módulos JS; git diff --check; smoke .scratch/verify-copy-removal.mjs no piloto localhost:3211 com dados sintéticos em sete telas, zero erros JS e nenhuma gravação; três suítes existentes aprovadas: pc04-planned-ui, fin01-default-status-ui, fin05-grouped-ui.
Impeccable: contexto carregado, refinamento mecânico sem redesign. Detector executado uma vez: avisos de padding, sombras e repetição de Solicitar acesso em estruturas preexistentes fora do delta. Nenhuma mudança CSS neste pedido.
Alcance: UI real e módulos existentes, consultas simuladas; sem homologação de dados operacionais ou alterações no backend.
