# Retirar Dashboard, Relatórios e Auditoria

## As Is
O menu possui Dashboard, Relatórios e Auditoria. A entrada exibe indicadores e apresenta esses módulos; home-summary consulta APIs de resumo.
## To Be
Menu sem esses três itens e entrada simples orientando o uso do menu, sem indicadores ou consultas de resumo.
## Requirements
1. Retirar os três acessos e suas apresentações na entrada.
2. Destinos antigos devem cair na entrada neutra, sem abrir relatórios ou auditoria.
3. Preservar navegação operacional/financeira, identificação da sessão e auditoria interna.
## Acceptance Criteria
1. Nenhum dos três acessos no menu e nenhum indicador na entrada.
2. Eventos jetta:go para inicio/relatorios/auditoria exibem entrada neutra sem erros.
3. Contratações e Políticas continuam abrindo; nenhuma consulta de resumo e nenhuma escrita pelo teste.
## Principal Regression Test
node integration/retired-navigation.visual.mjs, usando HTML/JS reais em Edge headless e APIs sintéticas. Deve falhar antes pela presença dos acessos, passar após a retirada e exercitar cliques e fallback por ADMIN/GESTOR/FINANCEIRO.
## Testing Plan
Teste principal red/green; regressões adjacentes operation-navigation e fin01.visual. Captura desktop e mobile com inspeção focal. Sem alteração de API, dados, autenticação ou runtime ERP.
## Implementation Plan
1. Escrever teste real de navegação e confirmar red.
2. Retirar links, conteúdo de indicadores, carregamento de home-summary e destinos retirados.
3. Executar green e regressões e registrar resultado.

## Resultado e verificação
- Implementado em public/index.html e public/navigation.js: três acessos retirados; Dashboard substituído por entrada neutra; carregamento de home-summary removido; nomes/destinos de Relatórios e Auditoria retirados. Sessão (who/role), outros módulos, APIs, banco e auditoria interna preservados.
- RED: node integration/retired-navigation.visual.mjs falhou com 3 acessos encontrados, esperado 0.
- GREEN: mesmo comando passou para ADMIN/GESTOR/FINANCEIRO, incluindo cliques reais em Contratações/Políticas, fallback de destinos antigos, ausência de indicadores e requests de resumo, nenhuma escrita e zero erros JS. Desktop 1440 e mobile 390.
- Regressões: node integration/operation-navigation.visual.mjs e node integration/fin01.visual.mjs passaram. Financeiro cobre filtros, paginação, detalhe, logout e três larguras.
- Sintaxe de navigation.js e do teste verificada com node --check.
- Capturas desktop.png e mobile.png em artifacts/retired-navigation inspecionadas: menu preserva estilo, contém Cadastros, Operação, Financeiro e Parâmetros, sem os itens retirados. Entrada usa painel existente.
- Limites: testes UI com respostas de API sintéticas; sem banco real ou deploy. Serena e Lad não estão disponíveis nesta sessão. Execução direta proporcional ao risco baixo.
