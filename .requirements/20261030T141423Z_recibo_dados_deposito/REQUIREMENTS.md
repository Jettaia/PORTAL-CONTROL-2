# As Is
O recibo FIN02 inclui campo manual por extenso após o valor e apenas centro de custo no cabeçalho. O HTML é persistido, e snapshots antigos não incluem nome/endereço do depósito.
# To Be
O recibo apresenta valor sem campo entre parênteses e nome, centro de custo e endereço do depósito no canto superior direito, inclusive na reimpressão de recibos antigos.
# Requirements
1. Remover campo por extenso após o valor.
2. Mostrar nome, centro de custo, rua, número, bairro, cidade/UF e CEP no cabeçalho.
3. Capturar dados do depósito na emissão. Para snapshots antigos, consultar apenas informações ausentes no depósito vinculado ao recibo. Preservar dados financeiros, permissões e idempotência.
# Acceptance Criteria
1. Valor seguido diretamente por vírgula e referência ao serviço, sem campo extenso.
2. Cabeçalho alinhado à direita contém dados cadastrados, escapados para HTML; impressão em uma página A4.
3. Alterações posteriores no cadastro não afetam snapshots completos. Recibo antigo usa layout corrigido e dados disponíveis sem alterar sua emissão.
# Principal Regression Test
FIN02_SQL_TESTS=YES node --test integration/fin02.integration.mjs: emitir via HTTP com SQL real e ler impressão autenticada. Antes falha porque snapshot não contém depósito e impressão contém campo extenso. Depois valida cabeçalho e reimpressão, inclusive snapshot legado.
# Testing Plan
Executar regressão HTTP/SQL red/green. Executar integration/fin02.visual.mjs com popup de impressão, cabeçalho, ausência de extenso e PDF A4 de uma página.
# Implementation Plan
1. Estender teste HTTP/SQL e visual; executar red.
2. Incluir campos de depósito no snapshot e layout, renderizar reimpressão com fallback para legado.
3. Executar green e validação visual.

# Validation
- Red SQL/HTTP: falha esperada, snapshot.Deposito undefined em vez de Depósito A.
- Red visual: falha esperada, campo manual extenso ainda presente (1 em vez de 0).
- Green: FIN02_SQL_TESTS=YES node --test integration/fin02.integration.mjs, 1 teste aprovado com SQL real; emissão, impressão, legado, permissões, concorrência, rollback e imutabilidade dos dados.
- Green visual: node integration/fin02.visual.mjs aprovado para ADMIN, FINANCEIRO e GESTOR; PDF A4 com uma página e telas 1440/390.
- Piloto reiniciado pelo sinal oficial e iniciador pilot-local/start.mjs; backup verificado; HTTP local 200.
- Serena e Lad indisponíveis nesta sessão. Sem novas dependências ou APIs externas.
