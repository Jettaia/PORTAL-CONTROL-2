# Correções de anotações do Financeiro

## As Is
Menu Exportar usa fundo em pseudo-elemento e botões posicionados separadamente. O Extrato envia evento que navega para Financeiro para exibir detalhe, perdendo o contexto visual da consulta.

## To Be
Menu ancorado com opções contidas/alinhadas e modal financeiro compartilhado que abre sobre o Extrato sem navegar. Preservar regras, endpoints, permissões, operações e alterações locais anteriores.

## Requirements / Acceptance Criteria
1. Exportar mantém opções Excel/PDF dentro do painel em desktop/celular, sem texto cortado ou overflow. Downloads continuam pelos mesmos endpoints.
2. Abrir detalhes no Extrato conserva aba selecionada, filtros, grupos expandidos e rolagem; fecha por botão/Escape devolvendo foco; oculta ao trocar tela/logout.
3. Modal conserva dados reais, recibos, anexos, pagamento e autorização do servidor. A lista Financeiro continua abrindo seus próprios detalhes normalmente.

## Principal Regression Test
`node --test integration/fin01-context-export-ui.test.mjs`: execução dos módulos e navegação reais com HTTP controlado. RED: opções fora do painel e/ou navegação para Financeiro. GREEN: geometria contida e contexto preservado ao abrir/fechar.

## Testing Plan
Prova browser dos dois relatos, capturas desktop/celular do menu e detalhe sobre Extrato, regressões adjacentes exportação/modelo A/FIN05, fluxo FIN03 de baixa. Sem mutações reais no banco.

## Implementation Plan
1. Reproduzir com teste e registrar red.
2. Agrupar opções do menu num contêiner e tornar host/estilos do modal independentes da tela Financeiro.
3. Abrir evento do Extrato diretamente mantendo origem, com invalidação/fechamento ao sair; rodar green e gates adjacentes.
4. Capturar evidências, revisar diff e entregar localmente.

Serena/LAD indisponíveis nesta sessão. Usadas skills TDD, surgical-patch e Impeccable de refinamento; sem alteração de escopo funcional financeiro.

## Resultado

- Corrigidos `public/fin01.js` e `public/fin01.css`. Menu agora tem um contêiner real com posicionamento único e opções em grid; removidos o fundo em pseudo-elemento e posicionamento individual dos botões. Prova geométrica confirma opções contidas horizontal/verticalmente e texto sem corte em 1531/390 px.
- Modal financeiro transferido para host compartilhado fora da lista oculta. Evento `jetta:fin01-open` abre direto sobre a origem visível, sem emitir `jetta:go`. Estilos do modal passaram a ser próprios; consulta/recibos/baixa continuam pelas funções e endpoints originais. Origem acompanha reabertura após operações e modal fecha ao ocultar a tela de origem/logout.
- Teste RED antes da correção; GREEN depois. Verifica navegação ausente, filtros/grupos/scroll idênticos após fechar e devolução de foco ao botão. Inclui Escape, mudança de tela e modal mobile.
- PASS: teste novo; regressões FIN05 agrupado por persona, FIN01 modelo A, exportação, importação FIN03; fluxo visual FIN03 de pagamento/troca/desfazimento/gestor; emissão/repetição/erro/recibo pela linha. Teste histórico FIN05 atualizado para a nova expectativa explícita: detalhe sobre Extrato, Financeiro oculto.
- Capturas finais e hashes em `artifacts/financeiro-annotations-1794489395075/evidence.json`: tema claro, dados sintéticos, HTML/módulos reais e HTTP controlado. Menu em desktop/mobile e modal sobre Extrato em 1531×764 e 390×844. Evidência não representa autenticação/SQL reais; nenhuma mutação operacional foi executada.
- Detector Impeccable executado uma vez, sem achados. Sintaxe e diff check focados passaram (CRLF nativo do Windows considerado no check). Sem alteração no documento oficial, importador, backend, banco ou deploy. Alterações anteriores do workspace preservadas.
