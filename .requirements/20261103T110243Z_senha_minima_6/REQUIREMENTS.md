# As Is
Criação de contas, ativação por convite e bootstrap exigem no mínimo 14 caracteres; os formulários informam 14.

# To Be
Aceitar senhas a partir de 6 caracteres, preservando as demais regras existentes.

# Requirements
1. Reduzir o mínimo de 14 para 6 na criação, ativação e bootstrap.
2. Atualizar os campos e instruções exibidos nos formulários e CLI.

# Acceptance Criteria
1. Senha válida de 6 caracteres aceita; 5 rejeitados; máximo de 128 e composição atual preservados.
2. Formulários orientam mínimo de 6 e possuem minlength=6.

# Principal Regression Test
node --test tests/pc01.test.mjs tests/b25b.test.js
O POST de criação exercita a validação real normalizeAccount por HTTP. Antes deve rejeitar Aa1!bc com 400; depois deve aceitar com 201. Ativação compartilha validNewPassword, coberto nos limites.

# Testing Plan
Testar 5, 6, 13, 14, 128 e 129 caracteres e composição; executar testes adjacentes de autenticação. Nenhuma nova API ou dependência.

# Implementation Plan
1. Adicionar casos de fronteira ao teste HTTP e ao validador; executar red.
2. Alterar somente os limites e os textos correspondentes; executar green e testes adjacentes.

# Validation Results
- Red: 2 falhas esperadas; senha de 6 recusada no validador e POST com status 400 em vez de 201.
- Green: node --test tests/pc01.test.mjs tests/b25b.test.js tests/security.test.js — 9 testes passaram.
- Campos de criação/ativação conferidos com minlength=6; instruções atualizadas; sintaxe do CLI validada.
- Teste HTTP usa serviço simulado para persistência e validação real normalizeAccount; nenhum dado real criado.
