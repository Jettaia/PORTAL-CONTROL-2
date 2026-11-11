# As Is
As dez anotações indicam descrições, cabeçalhos internos com ícone, aviso de tablets e contador do extrato redundantes.
# To Be
Remover esses elementos e seus contêineres, mantendo títulos principais, formulários, tabelas e paginação.
# Requirements
1. Remover descrições principais de depósitos, prestadores e usuários.
2. Remover cabeçalhos internos de depósitos e cadastro compartilhado de prestadores/tipos de atividade, incluindo ícones. Remover referências JS aos títulos eliminados.
3. Remover aviso completo de tablets, título Contratações individuais e cabeçalho Financeiro de contratações.
4. Remover contador de vínculos do extrato e sua atualização, preservando Carregar mais prestadores.
# Acceptance Criteria
Nenhum elemento selecionado aparece nem deixa bloco vazio; navegação e controles continuam funcionando.
# Principal Regression Test
Smoke local com módulos reais e dados sintéticos nas sete telas, sem erros JS; verificar ausência dos elementos e controles visíveis.
# Testing Plan
Sintaxe, smoke local, suítes existentes PC04/FIN01/FIN05. Edição de conteúdo reversível: sem novo teste permanente.
# Implementation Plan
Eliminar HTML e montagens selecionadas; retirar referências aos nós eliminados; validar navegação e controles.

# Resultado
As dez anotações foram aplicadas. Removidos contêineres completos dos títulos/ícones internos e aviso de tablets. Títulos principais e controles preservados. Referências JS a b24Title e fin05Count removidas junto dos elementos.
Validação: sintaxe dos seis módulos JS; smoke no piloto local em depósitos, usuários, prestadores PC03, tipos de atividade, tablets, contratações, financeiro e extrato, com respostas sintéticas, ausência dos blocos removidos, controles visíveis, zero erros JavaScript e nenhuma gravação. Três suítes existentes PC04/FIN01/FIN05 aprovadas; FIN05 repetido após remoção final do contador, aprovado. git diff --check com cr-at-eol aprovado. Sem teste permanente adicional para remoção de conteúdo.
