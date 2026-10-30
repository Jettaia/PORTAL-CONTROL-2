# As Is
O SQL Express local foi instalado e aceita autenticacao Windows. O piloto aponta para Ferretti, depende de Node/ODBC e exige evidencias de integracao, regressao e recuperacao ausentes no clone. Usuario autorizou aplicar a preparacao e instalacao descritas na conversa.

# To Be
Conexao do piloto com localhost\SQLEXPRESS validada nesta maquina; instalacao persistente somente depois de todos os gates reais aprovados e identidade inicial informada.

# Requirements
1. Usar a instancia SQLEXPRESS local de forma consistente no instalador e ensaio do piloto.
2. Remover do instalador o caminho de ferramentas exclusivo do usuario anterior.
3. Manter destino separado, autenticacao Windows, modo financeiro simulado e gates existentes.
4. Executar validacoes disponiveis e registrar bloqueios reais sem fabricar evidencias.

# Acceptance Criteria
1. connectPilot('master') identifica a maquina atual e instancia SQLEXPRESS.
2. Caminho padrao de ferramentas acompanha o perfil Windows atual; override existente preservado.
3. Banco operacional legado recusado; instalador nao cria banco sem evidencias validas.
4. Resultados de testes, integridade do manifesto e estado final do banco documentados.

# Principal Regression Test
node --test pilot-local/connection.integration.mjs: conexao real pelo ODBC com o destino padrao. Antes falha tentando Ferretti; depois conecta na instancia local. Consulta somente master, sem dados operacionais.

# Testing Plan
Red/green da conexao real; testes unitarios existentes; check de sintaxe; manifesto e ensaio SQL sintetico quando as dependencias estiverem disponiveis. Testes de gates existentes antes de qualquer instalacao persistente. Serena e Lad indisponiveis.

# Implementation Plan
1. Instalar dependencias conforme package-lock e escrever teste de conexao; observar red.
2. Ajustar o destino local de forma consistente na conexao, instalador, diagnostico e ensaios; observar green.
3. Corrigir caminho do perfil; verificar sintaxe e regressoes.
4. Avaliar gates e instalar apenas com validacao completa e identidade fornecida.
