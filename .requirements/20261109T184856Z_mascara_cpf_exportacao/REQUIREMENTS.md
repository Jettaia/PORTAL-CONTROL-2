# As Is
CPF/CNPJ exportado sem pontuação.
# To Be
CPF como 120.698.318-33 e CNPJ como 00.123.456/0001-99 em Excel e PDF.
# Requirements
1. Aplicar máscara apenas na apresentação dos documentos completos.
2. Preservar zeros à esquerda, dados cadastrados, demais campos e valores ausentes.
# Acceptance Criteria
1. Terceira coluna do XLSX e PDF contém documento formatado.
2. Documentos já formatados não duplicam pontuação; ausentes e incompletos não causam falha.
# Principal Regression Test
node --test tests/pc04-export.test.mjs tests/pc04-export-xlsx.test.mjs
Verifica o conteúdo dos artefatos reais emitidos pelos geradores.
# Testing Plan
Red antes da alteração; green após; regressão financeira adjacente.
# Implementation Plan
Testes primeiro; função comum de apresentação; aplicar aos dois geradores; reiniciar servidor local e verificar HTTP.

# Results
Red: 4 testes falharam por ausência da máscara. Green: 19/19 testes aprovados, incluindo artefatos XLSX/PDF e regressão financeira. Servidor local reiniciado e HTTP 200 confirmado.
