# Prévia visual navegável

## As Is
Frontend estático em 3212 exibe apenas login; SQL e instalação privada indisponíveis.

## To Be
Expor telas reais para inspeção sem banco, sem registros inventados e sem gravação.

## Requirements
1. Servidor separado, exclusivamente loopback, com aviso persistente de prévia sem autenticação/banco.
2. Navegação pelas telas PC01–05/07/08/10/11 com coleções vazias. Não apresentar legado como PC06/09 concluídos.
3. Nenhuma conexão SQL, credencial ou gravação. Métodos mutantes recusados e GETs desconhecidos indisponíveis.

## Acceptance Criteria
Abrir usuários, filiais, atividades, prestadores, contratações, pagamentos, ajustes, extrato e tablet; formulários reais visíveis, sem erros JS. Respostas de coleção vazias. POST/PUT/PATCH/DELETE não operam. Página recarregada conserva destino solicitado.

## Principal Regression Test
`node --test integration/preview-ui.test.mjs`: browser real navega entre painéis e verifica formulário/coleção vazia; HTTP confirma recusa de escrita. RED esperado por módulo preview-ui ausente, GREEN após implementação.

## Testing Plan
Reutilizar Express/Edge/Playwright instalados, testar HTTP efêmero e UI headless, sem SQL. Não altera servidor/autenticação do produto.

## Implementation Plan
1. Teste de navegação e recusa de gravação.
2. Servidor visual separado e metadados explicitamente locais de apresentação; endpoints de coleção vazia somente por allowlist.
3. Executar teste e iniciar na porta 3212 após encerrar somente nossa prévia anterior.

## Revisões
Serena ativada; instruções já lidas. Símbolos indisponíveis por ausência de language server, constatada nesta conversa. LAD não exposto e desabilitado por falta de credencial conforme README local; system_design_review/code_review indisponíveis, sem aprovação LAD. Revisão própria; nenhum subagente.

## Resultado
RED executado: import de scripts/preview-ui.mjs ausente. GREEN: `node --test integration/preview-ui.test.mjs`, 1 PASS, zero falhas; navegação efetiva em oito painéis, formulários vazios, recusa HTTP dos quatro métodos de escrita, GET desconhecido indisponível e alternância autorização/teclado do tablet. Durante ajuste do teste, dois timeouts foram diagnosticados como interação com menu Financeiro recolhido/seletor de ancestral; corrigidos no teste com clique real no summary, sem alterar navegação do produto. Log final: test.log.

Prévia independente em loopback 3212. Metadados de apresentação identificados como Prévia visual, sem criar conta, cookie ou autenticação real. Não importa servidor/ODBC/configuração privada do produto. Todas as gravações recusadas, nenhum registro fictício retornado. Requisitos SQL/LAD do produto continuam pendentes e esta prévia não os certifica.
