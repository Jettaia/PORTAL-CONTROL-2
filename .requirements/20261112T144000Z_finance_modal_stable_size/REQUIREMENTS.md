# Detalhe financeiro — frame fixo com corpo rolável

## As Is
Modal compartilhado Financeiro/Extrato tem altura automática, com header e conteúdo rolando juntos.

## To Be / Requirements / Acceptance Criteria
Manter tamanho e posição estáveis, header/fechamento visíveis, apenas conteúdo com rolagem. Mesmo padrão branco dos detalhes de contratação; limite relativo ao viewport e adaptação mobile. Preservar detalhe no Extrato sem navegar, recibo oficial, baixa/anexo/correções/histórico, escopos, loading/erro e descarte de respostas tardias.

## Principal Regression Test / Testing Plan
Ampliar `integration/fin01-model-a-ui.test.mjs`: dados extensos, scroll interno real em 1531×764 e 390×844, header/close fixos e frame invariável, inclusive ao abrir erro de consulta. RED esperado: header se move ao rolar modal inteiro. Gates adjacentes: contexto do Extrato e fluxo FIN03 de baixa/substituição/desfazimento/perfis. Capturas/hashes com dados HTTP sintéticos e módulos reais; sem alterações persistentes.

## Implementation Plan
Prova red; introduzir corpo próprio na renderização existente sem alterar operações; altura fixa/flex/gutter estável no dialog; green, gates e inspeção visual desktop/mobile. Sem backend ou deploy.

## Resultado
Aplicado em public/fin01.js e public/fin01.css. Helper de renderização monta cabeçalho e corpo próprios em loading, sucesso e erro. Dialog de 94dvh em coluna flex, header sem encolher e conteúdo com min-height 0, scrollbar-gutter estável e rolagem contida. Padrão branco/borda/sombra/radius/padding acompanha detalhes de contratação; largura financeira preservada. Renderização nova começa no topo, fechamento continua disponível durante carregamento/erro.

RED confirmado por header movendo ao rolar. GREEN: suíte FIN01 modelo A ampliada passou, verificando scroll real até o fim, header/fechamento visíveis, boundingBox constante e erro sem redimensionamento em 1531×764 e 390×844. Gates de contexto do Extrato e FIN03 visual passaram: baixa integral, falha recuperável, substituição, desfazimento e gestor somente leitura. Sem alteração de regra, endpoint, autorização, recibo, importação ou banco.

Evidências de conteúdo longo rolado e erro curto: artifacts/financeiro-fixed-1794491811377/evidence.json e capturas scrolled-1531, scrolled-390, error-390, com hashes/SHA. Capturas de contexto do Extrato e menu: artifacts/financeiro-annotations-1794491835025. Tema claro, módulos reais com HTTP sintético; sem gravação operacional. Detector Impeccable, sintaxe e diff check focados passaram.
