# Tablets — aplicar layout C
## As Is
Tela tem formulário permanente e tabela única. Protótipo C aprovado agrupa aparelhos por depósito e usa modal para cadastro/gestão.
## To Be
Tela real com grupos por depósito/CC, filtros/busca e totais distintos; gerenciamento em modal no padrão Prestadores/Usuários.
## Requirements
1. Grupos recolhíveis por depósito, compartilhados em todos os vínculos; contadores totais sem duplicação; manter sem depósito/inativos visíveis e grupos vazios recolhidos.
2. Busca por nome/depósito/CC, filtros de situação e depósito. Não esconder registros legados nem alterar regras de acesso.
3. Novo tablet e Gerenciar usam modal branco existente no padrão visual aprovado; editar nome/depósitos, gerar código curto, revogar e excluir via APIs existentes.
4. Preservar autorização por perfil, MFA, bloqueios durante requests, confirmação de exclusão, códigos ocultos após 30s, navegação/aba oculta/logout e proteção contra respostas antigas.
5. Responsivo em desktop/mobile; manter IDs do formulário e contrato HTTP. Sem backend, SQL, migração ou deploy remoto.
## Acceptance Criteria
1. Tablet de dois depósitos aparece nos dois grupos, resumo soma uma vez; Sem depósito oferece gestão; grupo vazio recolhido.
2. Filtros alteram grupos e resultados reais, com mensagem vazia e restauração sem crash.
3. Modal abre/fecha, cria/edita, atualiza todos os grupos do mesmo ID e exibe código de ativação. Revogação/exclusão atualizam a tela.
4. Gestor sem botão Excluir; Admin/Coordenador podem excluir com confirmação; perfil sem acesso não consulta. Navegação/logout limpa modal e segredo, inclusive respostas tardias.
5. Em 390px sem overflow; controles/modal utilizáveis. Sem protótipo ou dados fictícios no portal real.
## Principal Regression Test
node --test tests/tablets-grouped-ui.test.mjs
Red esperado: agrupamento/modal inexistentes; teste percorre UI/JS/HTML reais com somente API isolada em memória.
## Testing Plan
Fluxo real de filtros, grupo vazio/sem depósito, compartilhamento, criação/edição/código/revogação/exclusão, mobile e limpeza de segredo. Adaptar regressões de UI existentes à navegação por modal e executar gates PC05 próximos.
## Implementation Plan
1. Teste red de UI.
2. Manter integrações e mover formulário para modal; agrupar e filtrar dados com estilos de C.
3. Teste green e capturas; corrigir falhas e gates adjacentes.
4. Capturar protótipo em branch separada e retirar arquivos temporários de main; validar portal local.
## Scope confirmation
Versão C explicitamente aprovada pelo usuário. Skills prototype, tdd e surgical-patch. Serena/Lad indisponíveis.

## Resultado
Versão C aplicada. Red: inexistência dos grupos/modal. Green: 48 testes focados, sem falhas, cobrindo CRUD, compartilhamento, perfis, código, navegação/logout e respostas tardias. Após ajuste final de largura, os 2 testes da tela passaram novamente. Capturas desktop/mobile em artifacts/tablets-grouped. Nenhuma alteração em backend/SQL nem em registros reais.
Protótipo completo arquivado em `codex/prototype-tablets` (`02d76d73f9ea61ba91b1aae8712dd95f79aa6570`); decisão: agrupamento por depósito com gestão em modal, no padrão visual de Prestadores/Usuários. Código real permanece sem scripts/estilos de protótipo.
