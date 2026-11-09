# As Is
Recibo HTML FIN02 tem título central RECIBO — Contratação N depois do depósito e valor numérico sem extenso. Reimpressão usa o snapshot emitido, sem sobrescrever histórico.
# To Be
RECIBO alinhado à direita no cabeçalho antes dos dados do depósito. Após o valor numérico: extenso entre parênteses, inclusive centavos.
# Requirements
1. Mover título para início do cabeçalho à direita, remover número/Contratação do título visível e título da aba.
2. Renderizar valor textual em reais/centavos usando o mesmo ValorLiberado do snapshot, preservando precisão decimal(18,2) e singular/plural.
3. Aplicar modelo na emissão e reimpressão preservando snapshot, valores e autorização. Somente local.
# Acceptance Criteria
1. h1 contém apenas RECIBO e precede os dados de depósito; alinhamento direito em tela e impressão.
2. R$ 100,00 (cem reais), R$ 175,25 (cento e setenta e cinco reais e vinte e cinco centavos); cobrir zero, singular, centenas, milhares, milhões e limite decimal sem ponto flutuante.
3. Reimpressão conserva dados emitidos e acesso existente, inclusive legado. Sem migração ou edição de recibos emitidos.
# Principal Regression Test
node --test tests/fin02-document.test.mjs e integration/fin02-document-ui.test.mjs: renderização real, texto e geometria de cabeçalho. RED por título/valor atuais; GREEN por mesmo renderer corrigido.
# Testing Plan
Testes do renderer por valores, browser headless com documento real e media print, integração HTTP/SQL FIN02 descartável para emissão/reimpressão e personas ADMIN/FINANCEIRO/GESTOR/sem acesso. Nenhuma escrita de teste no banco operacional.
# Implementation Plan
1. Escrever testes/red. 2. Conversor local exato e ajustes HTML/CSS. 3. Green e regressão FIN02/inspeção visual. 4. Reiniciar somente portal local para carregar módulo novo, preservando dados.

# Estado atual
Entrega parcial: título/cabeçalho implementados; valor por extenso PENDENTE. A geração do código de conversão foi bloqueada pelo filtro de conteúdo da sessão. Não houve nova tentativa nem conversor parcial ou valor fixo no recibo. Os casos de extenso reproduziram o estado faltante no RED inicial, mas não foram mantidos como testes ativos de uma funcionalidade não implementada.

# Verificação do cabeçalho
- RED inicial: título anterior com Contratação falhou e não havia extenso (20 falhas esperadas do escopo original).
- GREEN do recorte implementado: node --test tests/fin02-document.test.mjs integration/fin02-document-ui.test.mjs, 2/2. Título exato, antes do depósito, alinhamento à direita, em tela e media print; valores e escape preservados.
- Captura artifacts/fin02-header/screen.png inspecionada com view_image: RECIBO no topo direito antes do depósito; corpo e assinaturas preservados. Media print também gerou captura própria.
- Sintaxe dos três arquivos editados/adicionados e diff --check: PASS.
- Sem migração, alteração de snapshot, commit, push ou deploy remoto. Nenhuma prova declara o extenso entregue.

- Integração real `FIN02_SQL_TESTS=YES node --test integration/fin02.integration.mjs`: PASS 1/1 (227s), sem skips. Emissão/reimpressão, snapshot, concorrência e acesso por persona preservados; banco de teste removido pelo finally.
- Portal local encerrado pelo sinal oficial e reaberto com `node pilot-local/start.mjs --open`; backups verificados ao encerrar/iniciar e HTTP 200 confirmado.

# Correção de escopo pelo usuário
RECIBO deve voltar à posição central após o depósito, como no original. Contratação + Snapshot.Numero deve ocupar o canto superior direito antes do depósito, com tipografia/alinhamento dos dados do depósito, sem número fixo. Esta decisão substitui o requisito anterior de remover o número do documento. O extenso permanece pendente pelo bloqueio já informado; não houve nova tentativa de gerar esse código.

Prova da correção: renderer com números 4,17,238 e browser headless em screen/print verificando ordem vertical, alinhamento, tipografia e texto.

Correção de cabeçalho: RED 4 falhas esperadas antes do ajuste; GREEN 5/5 em tests/fin02-document.test.mjs e integration/fin02-document-ui.test.mjs. Captura screen inspecionada: número no topo direito com fonte do depósito e RECIBO central após identificação. Portal local reaberto pelo iniciador oficial, backup verificado, HTTP 200. Sem alteração dos dados financeiros. Extenso permanece pendente pelo bloqueio de geração informado, sem nova tentativa.
