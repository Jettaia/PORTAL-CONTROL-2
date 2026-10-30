# As Is
Situações da tabela financeira usam o mesmo badge amarelo; detalhe mostra texto simples.
# To Be
Aplicar distinção visual no padrão dos badges de Contratações: amarelo pendente, azul recibo emitido, verde pago; fallback neutro.
# Requirements
1. Aguardando pagamento amarelo, Recibo gerado azul, Pago verde.
2. Usar o mesmo badge na tabela e no detalhe, mantendo texto legível.
# Acceptance Criteria
1. As três situações exibem fundos distintos, bordas e cores de texto correspondentes.
2. Ao abrir detalhes, situação mantém a apresentação da tabela; filtros e paginação continuam funcionando.
# Principal Regression Test
integration/fin01.visual.mjs: carregar tabela, paginar para revelar os três estados, verificar cores computadas e abrir detalhes. Antes falha por cores iguais; depois passa com três cores.
# Testing Plan
Teste visual red/green para ADMIN, FINANCEIRO, GESTOR; responsividade 1440/768/390 e inspeção de screenshot. Regressão de recibo para mudança de situação após emissão.
# Implementation Plan
Estender fixtures e asserções do teste; executar red; criar badge por situação e estilos locais baseados em public/pc04.css; executar green e inspecionar.

# Validation
- Red: FIN01 visual falhou na cor computada do badge, que ainda usava o estilo único anterior.
- Green: integration/fin01.visual.mjs passou nos três perfis, com verificação de cores renderizadas, detalhe, filtros, paginação e 1440/768/390.
- Regressão adjacente: integration/fin02.visual.mjs passou, incluindo emissão e reconsulta do estado.
- Evidência visual: artifacts/fin01/situacoes.png, três estados coloridos renderizados na tabela real.
- Referência: public/pc04.css, paleta e formato dos badges de Contratações. Alteração limitada a assets estáticos; basta atualizar a página.
