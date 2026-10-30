# As Is
O piloto local exige TOTP no painel e nas escritas.
# To Be
Cenário atual do piloto funciona com senha e sessão, sem segundo fator. Infraestrutura legada fica preservada para eventual retomada.
# Requirements
1. Desativar MFA no runtime do piloto, inclusive com flags antigas no ambiente.
2. Não dispensar sessão, perfil, escopo, validação ou auditoria.
3. Ocultar painel e solicitações de código quando MFA estiver desativado.
# Acceptance Criteria
1. ADM autenticado cria/edita cadastro sem TOTP e relê persistência; anônimo e perfil sem permissão continuam negados.
2. Sessão inválida não passa pela validação de ação.
3. Fetch protegido envia escrita sem modal ou chamada de verificação.
# Principal Regression Test
integration/no-mfa.integration.mjs: cenário PC02 com SQL descartável, login apenas por senha; deve falhar antes no cadastro por exigir MFA.
# Testing Plan
Red/green de integração HTTP/SQL; teste de interação do script MFA; regressões adjacentes existentes.
# Implementation Plan
Configurar dispensa explícita no piloto; adaptar gates e validadores preservando sessão; adaptar painel ao contrato de autenticação; executar testes e revisão independente.

# Resultado
- Piloto configurado explicitamente sem MFA; modo legado fora do piloto preservado.
- API/SQL reais em banco descartável: login por senha, criação/edição e releitura de cadastro, política de planejamento sem TOTP, negações para anônimo/gestor/financeiro e sessão inválida: PASS.
- Red: criação retornou 403 MFA_REQUIRED antes da alteração. Green: node --test integration/no-mfa.integration.mjs com NO_MFA_SQL_TESTS=YES e NO_MFA_SQL_SERVER=localhost\SQLEXPRESS: PASS.
- UI automatizada: painel oculto e escrita sem modal/código: PASS. Testes focais de UI/instalação: 6 PASS; regressões adjacentes de MFA/PC01/PC02: 30 PASS.
- node scripts/test-all.mjs: 304 PASS, 1 FAIL por src/pc09-routes.js ausente (arquivo já ausente antes desta tarefa). Não corrigido fora do escopo.
- Revisão independente Sol medium: propagação de cfg e gates SQL corrigidos; sem novos achados materiais. Revogação específica de sessões via endpoint MFA conserva o contrato legado.
- Atualização SQL instalada é transacional e idempotente no próximo início do piloto, com verificação de identidade do banco. Não reiniciada a instância instalada nem alterado seu banco nesta tarefa.
- Inspeção visual interativa não executada; alteração de painel coberta por teste automatizado de interação.
