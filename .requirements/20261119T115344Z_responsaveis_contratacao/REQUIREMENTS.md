# As Is
Catalogo e validacao de responsavel aceitam ADMIN e GESTOR vinculado, mas nao COORDENADOR.
# To Be
ADM pode selecionar gestores e coordenadores ativos vinculados ao deposito escolhido. Escopo global/compartilhado do Portal Control, sem alterar cadastros por cliente/unidade.
# Requirements
1. Incluir GESTOR e COORDENADOR ativos com vinculo nao revogado no deposito, preservando ADM.
2. Aplicar mesma regra na listagem, criacao e troca de deposito.
3. Preservar exclusao de usuarios inativos, financeiros sem funcao operacional e vinculos revogados/ausentes.
# Acceptance Criteria
1. Catalogo autenticado de ADM oferece coordenador e gestor corretos por deposito.
2. POST de contratacao aceita coordenador elegivel e recusa fora do escopo.
3. Tela filtra responsaveis ao trocar deposito e envia a escolha correta.
# Principal Regression Test
node --test integration/contract-responsibles.integration.mjs com RESPONSIBLES_SQL_TESTS=YES e RESPONSIBLES_SQL_SERVER=localhost\SQLEXPRESS. SQL descartavel, login real, GET catalogo e POST criacao. Antes: coordenador ausente. Depois: coordenador elegivel e persistido.
# Testing Plan
Regressao SQL e testes HTTP pc04/depot-change; teste de formulario com selecao de deposito/responsavel.
# Implementation Plan
1. Teste red em SQL real.
2. Alterar responsibleScope compartilhado com minimo diff.
3. Green SQL e regressao adjacente/UI.
Sem APIs externas novas. Serena/Lad indisponiveis.

# Validation Results
RED: SQL real, catalogo ADM nao inclui coordenador vinculado (assertion failure).
GREEN: SQL real, login ADM, catalogo por deposito, criacao com coordenador, troca de deposito e negativos (fora do escopo, financeiro, revogado e inativo): passou.
GREEN: 109 testes de HTTP pc04, troca de deposito e UI de nova contratacao passaram.
Causa: responsibleScope exigia apenas GESTOR para usuarios nao ADM. Ajuste inclui COORDENADOR na mesma regra compartilhada.
Sem alteracao de cadastros, schema ou deploy. Alteracoes anteriores de horarios preservadas.
