# As Is
PC04 exige data do serviço e horários previstos separados, impede prestador/dia repetido no serviço e em UNIQUE SQL, não permite editar previsão e combina depósito/atividade no resumo.

# To Be
Entrada prevista determina a data operacional. Gestor no seu depósito e ADMIN alteram previsão após criar. Múltiplas contratações por prestador/dia são permitidas. Resumo tem depósito e atividade separados.

# Requirements
1. Remover data de início do formulário e derivar DataServico de inicioPrevisto no servidor e na comparação de valores. Preservar campo interno para consumidores e filtros; clientes antigos podem enviar data correspondente.
2. Editar entrada/saída previstas com versão, MFA, escopo e auditoria. Preservar bloqueios de liberada/paga/cancelada e consistência dos horários reais; pendência de aprovação conserva seu contexto.
3. Remover exclusividade prestador/dia, incluindo participação legada; preservar identidade, numeração e histórico. Migração idempotente sem excluir dados, índice não exclusivo e atualizador com backup verificado.
4. Separar depósito e atividade no resumo, reutilizando estilos locais.

# Acceptance Criteria
1. Criar sem dataServico; data derivada da entrada, saída posterior e até dia seguinte. Comparação usa essa mesma data.
2. Gestor autorizado e ADMIN salvam e releem horários; financeiro/outro depósito não escrevem; versão antiga e período inválido não escrevem. Histórico contém antes/depois.
3. Criar simultaneamente duas contratações para mesmo prestador/dia, inclusive após liberação, com IDs/números distintos e dados anteriores preservados.
4. DOM renderizado apresenta duas linhas independentes, sem campo de data no formulário.

# Principal Regression Test
`PC04_SQL_TESTS=YES PC04_SQL_SERVER=localhost\\SQLEXPRESS node --test integration/pc04.integration.mjs`: HTTP autenticado com SQL descartável, permissões e releitura. Antes: repetição retorna 409, criação sem data retorna 400 e previsão não tem rota. Depois: criação 201 e edição 200. UI headless cobre criar/editar e resumo.

# Testing Plan
Testes HTTP locais existentes para negativos e regressão; SQL descartável para persistência, concorrência, isolamento e auditoria; Playwright headless com UI real e API sintética para interações e aparência focal. Nenhuma escrita no banco operacional na validação.

# Implementation Plan
1. Atualizar testes e demonstrar red.
2. Derivar data e liberar repetições; adicionar migração e edição prevista com regras existentes.
3. Ajustar formulário, comparação, resumo e edição; executar provas verdes e regressões adjacentes.
4. Revisão independente das permissões e integridade; registrar resultados e limitações.

# Resultados
+- RED SQL real: criação sem dataServico retornou 400 DATA_INVALIDA, quando o fluxo autorizado esperava prosseguir. RED UI: formulário nativo bloqueou criação por data separada obrigatória.
+- GREEN `node --test tests/pc04.test.mjs`: 77/77.
+- GREEN `PC04_SQL_TESTS=YES PC04_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc04.integration.mjs`: 1/1, sem skips. HTTP com sessão/MFA e SQL descartável: ADMIN, gestor autorizado, gestor de outro depósito, financeiro, concorrência, múltiplos acordos, releitura/filtro por nova data, versões, períodos inválidos, tokens invalidados, reais e pendências preservados, bloqueio após liberação e migração repetida sem alterar conteúdo. Banco sintético removido no finally.
+- GREEN `node scripts/test-all.mjs`: 426/426 no inventário anterior à inclusão do novo teste UI. Novo `node --test integration/pc04-planned-ui.test.mjs`: 1/1 adicional, incluído no inventário automático futuro. Sem falhas ou skips nesses lotes.
+- GREEN `node scripts/check-all.mjs`: 729 arquivos, zero falhas; os arquivos acrescentados/editados depois foram conferidos individualmente.
+- GREEN `node integration/pc04-create-feedback.visual.mjs`: erro de gravação preserva formulário, valor inválido não envia request e correção permite criar.
+- Visual: capturas artifacts/pc04-planned/desktop.png e mobile.png inspecionadas com view_image; depósito e atividade em linhas separadas, campos previstos/botão legíveis e empilhamento mobile consistente com estilo local. APIs sintéticas; autorização e persistência comprovadas separadamente no SQL real.
+- Revisão independente GPT-6.1 Sol medium, somente leitura: aprovado, sem achados materiais em auth/integridade.
+- Migração local: `node scripts/upgrade-contract-planning.mjs` PASS, backup verificado, 74 tabelas preservadas. Portal já estava parado e permaneceu parado; iniciar pelo launcher habitual.
+- Sem push ou deploy remoto. Serena e Lad indisponíveis nesta sessão. npm ausente no PATH; scripts equivalentes executados diretamente com Node.
