# As Is
O avatar do cabeçalho exibe JC fixo, mesmo com usuário autenticado.

# To Be
O círculo acompanha o nome do usuário da sessão: Administrador → Ad; Tiago Ferretti → TF.

# Requirements
1. Nome único usa as duas primeiras letras, primeira maiúscula e segunda minúscula. Nome composto usa as iniciais do primeiro e último nomes em maiúsculas, ignorando espaços extras.
2. Login e restauração de sessão atualizam o avatar; logout/revogação removem iniciais antigas. Nome ausente usa ?.
3. Validar localmente primeiro e publicar o mesmo ajuste em produção.

# Acceptance Criteria
1. Administrador=Ad, Tiago Ferretti=TF, nome com espaços preserva regra e nome de uma letra funciona.
2. Trocar de conta, recarregar e encerrar sessão não mantém iniciais de outra conta.
3. Teste no DOM real do portal e dos assets gerados para /chapa/ aprovado antes da publicação.

# Principal Regression Test
`node --test tests/avatar.test.mjs`: navegador Edge, HTML/scripts reais, respostas HTTP de autenticação sintéticas. Deve falhar com JC antes e passar com Ad/TF depois; passa pelo formulário de login, recarga e logout reais da interface.

# Testing Plan
RED/GREEN no teste principal; casos de nome composto, único, espaços, ausente, uma letra e revogação; regressão adjacente de autenticação e produção, sintaxe. Autenticação SQL não é alterada nem certificada por esse teste.

# Implementation Plan
1. Criar e executar regressão no navegador (RED).
2. Atualizar avatar no mesmo ponto que recebe a identidade autenticada, retirar JC estático; executar GREEN e verificações adjacentes.
3. Publicar somente assets alterados com rollback e conferir resposta HTTPS.

Serena e LAD indisponíveis na sessão. Requisitos baseados no pedido e exemplos explícitos do usuário.
