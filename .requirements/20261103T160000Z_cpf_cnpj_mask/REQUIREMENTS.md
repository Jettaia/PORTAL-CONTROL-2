# As Is
O campo único de documento em Prestadores aceita números sem aplicar máscara e abre documentos existentes sem pontuação.

# To Be
O campo apresenta CPF ou CNPJ pontuado automaticamente ao digitar, colar e editar.

# Requirements
1. Aplicar CPF até 11 dígitos e CNPJ de 12 a 14 dígitos, mantendo entrada parcial e limite de 14 dígitos.
2. Formatar documentos existentes ao editar, preservando cadastro, cancelamento, validação e contrato da API.

# Acceptance Criteria
1. 12345617840 resulta em 123.456.178-40; 12345678000199 resulta em 12.345.678/0001-99. Digitação, colagem, limpeza e exclusão continuam funcionando.
2. Edição mostra máscara; gravação conserva os dígitos; documento incompleto não produz escrita.

# Principal Regression Test
`integration/provider-document.visual.mjs`, executado com Node e JETTA_PLAYWRIGHT_ROOT do runtime instalado. Usa o componente real e eventos de input no Edge headless com HTTP sintético. Antes deve falhar na máscara; depois deve passar.

# Testing Plan
Digitação progressiva CPF→CNPJ, colagem pontuada e sem máscara, exclusão, limpeza, edição, criação e validação nativa. Regressões adjacentes dos depósitos. Sem alteração de layout, backend ou autorização.

# Implementation Plan
1. Adicionar asserções de máscara ao fluxo existente e executar RED.
2. Adicionar formatador local e conectá-lo ao input e à edição. Executar GREEN e testes adjacentes.

# Verification
- RED: provider-document.visual.mjs falhou com valor 12345617840 sem máscara, como esperado.
- GREEN: provider-document.visual.mjs passou com digitação CPF→CNPJ, colagem, exclusão no meio, limite, edição, cadastro, cancelamento, inválido sem escrita e busca.
- Regressões: provider-depots.visual.mjs e provider-depot-menu.visual.mjs passaram.
- Sintaxe de public/pc03.js validada. Testes usam DOM e formulário reais em Edge headless, com API sintética; backend/SQL não alterados.

# Complemento autorizado: tabela
- As Is: coluna mostra documentos sem pontuação.
- To Be / requisito e aceite: reutilizar a máscara do campo na coluna CPF ou CNPJ para documentos existentes; manter dados e busca.
- Plano/prova: asserções no componente real para células CPF e CNPJ; RED confirmado com CNPJ sem pontuação; aplicar formatador na renderização e repetir o fluxo de cadastro, edição e busca.
- GREEN complemento: provider-document.visual.mjs passou, incluindo células CPF/CNPJ formatadas, criação, edição, cancelamento, inválido e busca por números sem pontuação. Sintaxe e diff verificados.
