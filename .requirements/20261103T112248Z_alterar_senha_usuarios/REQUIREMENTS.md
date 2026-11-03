# As Is
Usuários permite criação/edição de contas pelo administrador; edição oculta senha. Não existe troca de senha própria ou redefinição administrativa.

# To Be
Na tela Usuários, usuário autenticado troca sua própria senha informando a atual; administrador redefine senha de qualquer conta pelo botão da lista. Usuário confirmou expressamente as duas opções.

# Requirements
1. Troca própria com senha atual, nova senha e confirmação, sem acesso ao cadastro de terceiros.
2. Redefinição por ADM com autorização/MFA conforme política existente.
3. Nova senha mantém política de 6 a 128 caracteres e composição atual; confirmação obrigatória.
4. Atualização atômica de credencial, revogação de sessões/convites e auditoria sem segredos; identidade e escopo conferidos no servidor.
5. Interface limpa senhas ao cancelar, concluir, sair ou mudar de conta; evita envio duplicado e informa resultado.

# Acceptance Criteria
1. Gestor/financeiro acessa Usuários para alterar apenas a própria senha; senha atual incorreta não altera credencial.
2. ADM redefine terceiro; demais personas recebem 403 para alvo direto; anônimo/origem indevida negados.
3. Seis caracteres válidos aceitos, cinco rejeitados; confirmação divergente não escreve.
4. Login antigo falha, novo funciona; sessões e convites antigos revogados; falha da transação preserva credencial.
5. Formulário real passa por abrir/cancelar/erro/sucesso e autorrevogação; layout mantém padrões de pc01.css.

# Principal Regression Test
node integration/pc01-password.visual.mjs (frontend real, API sintética): botão de alteração e formulário ausentes antes.
node --test tests/pc01-password.test.mjs e integration/pc01-password.integration.mjs: rotas novas inexistentes antes; prova de persistência em SQL descartável.

# Testing Plan
Testes HTTP por persona, validação e erros; integração em banco local de teste isolado; navegador Edge headless com formulário real, ações, foco, descarte, resposta de erro e sucesso; inspeção de captura. Revisão independente de auth/segurança com GPT-6.1 Sol medium após candidato pronto.

# Implementation Plan
1. Testes antes do código, capturar red da ausência do fluxo.
2. Implementar serviço e rotas transacionais; implementar formulário e ações reutilizando estilos atuais.
3. Executar green, suites adjacentes e SQL real; revisão independente, corrigir achados e verificar delta.

# Ownership
Agente password_backend: src/pc01.js, src/pc01-routes.js, testes backend e integração SQL nova. Principal: UI, teste visual e integração final. Sem deploy ou mutação do piloto instalado.

# Final Result — validated
- Implementado: troca própria com senha atual; redefinição por ADM; confirmação; mensagens; descarte/limpeza; autorrevogação; menu Usuários disponível para troca própria sem expor catálogo administrativo.
- Red frontend: botão Alterar senha ausente (timeout 5s). Red HTTP backend: rota inexistente retornou 404 em vez do contrato 401.
- Green SQL/HTTP: PC01_PASSWORD_SQL_TESTS=YES PC01_SQL_SERVER=localhost\SQLEXPRESS node --test integration/pc01-password.integration.mjs tests/pc01-password.test.mjs tests/pc01.test.mjs tests/b25b.test.js tests/security.test.js — 12 PASS, zero falhas/skip. Banco descartável JETTA_CONTROL_B3_TEST_5dfbbbb9231e removido com verificação.
- SQL real: senha antiga/atual/nova, sessões/convite revogados, conta própria/terceira, acesso negado/MFA, ausência de segredos na auditoria, rollback e concorrência.
- Green UI: node integration/pc01-password.visual.mjs — confirmação divergente e senha curta não enviam, cancelamento limpa, ADM redefine terceiro, gestor troca própria, erro recuperável, autorrevogação, screenshots desktop 1440/mobile390. API sintética, frontend real.
- Regressão UI: node integration/pc01.visual.mjs — PASS, 4 escritas, desktop/tablets1440/1024/768. Fixture legada de filiais atualizada para contrato atual de depósitos.
- Inspeção de pixels: capturas artifacts/pc01-password/admin-reset.png, self-1440.png e self-390.png; formulário legível, campos e ações alinhados, estilo atual preservado.
- Revisão independente: password_review, GPT-6.1 Sol medium, Standards+Spec/auth; nenhum achado material, incluindo delta final.
- Correção remanescente do pedido anterior: configuração inicial do piloto ainda exigia 14. Red SQL com senha inicial de 6 demonstrou a falha; app.mjs/setup.html alinhados para 6. Green SQL acima já cria administrador com 6 caracteres válidos.
- Escopo: código local. Nenhum deploy e nenhuma mutação de contas/banco do piloto instalado. Testes UI não provam SQL; integração SQL separada prova a persistência real.
