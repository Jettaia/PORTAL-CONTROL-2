# Numeração de contratação por depósito

## As Is
Numero vem de sequência SQL global e restrição UNIQUE global. PC04 pagina por Numero.
## To Be
Cada depósito tem sequência própria desde 1. Usuário confirmou renumerar existentes pela criação.
## Requirements
1. Renumerar por DepositoId, CriadoEmUtc, ContratacaoId (desempate), preservando IDs, vínculos, valores, versões, recibos emitidos e históricos.
2. Novas contratações usam maior número do depósito + 1, inclusive canceladas; impedir duplicação no depósito e permitir número igual entre depósitos.
3. Paginação e filtros continuam completos e respeitam acesso por depósito.
4. Atualização local transacional, idempotente, com backup verificado e mapa persistente antigo/novo; não alterar documentos já emitidos.
## Acceptance Criteria
1. Histórico intercalado A/B vira 1,2 em cada; mapa recupera número anterior e reexecução não renumera novamente.
2. HTTP autenticado cria A1/B1/A2, concorrência não duplica; cancelamento não recicla número.
3. Mais de 200 registros com números repetidos não somem entre páginas; ator fora do depósito não cria nem vê registros.
4. Dados não numéricos e demais tabelas preservados, exceto mapa novo; falha faz rollback.
## Principal Regression Test
node --test integration/contract-numbering.integration.mjs (CONTRACT_NUMBER_SQL_TESTS=YES). Banco SQL descartável + API real; antes falha pois B recebe número global em vez de 1.
## Testing Plan
Teste SQL/HTTP para criação, concorrência, autorização, filtros, paginação e migração com histórico. Regressão unitária PC04 e suítes SQL adjacentes. Revisão independente de integridade.
## Implementation Plan
Teste red; migração 36 com mapa e índice composto; INSERT com MAX por depósito sob lock transacional existente; cursor por ContratacaoId; atualização local com backup e verificações; testes green e revisão.

## Referência técnica
ROW_NUMBER com PARTITION BY reinicia por depósito; ORDER BY CriadoEmUtc, ContratacaoId garante desempate determinístico: https://learn.microsoft.com/en-us/sql/t-sql/functions/row-number-transact-sql?view=sql-server-ver17
Serena/Lad indisponíveis no inventário de ferramentas desta sessão.

## Verificação em andamento
- RED SQL/HTTP: primeira contratação em A/B retornou [1,2], esperado [1,1].
- RED paginação: teste com números repetidos detectou cursor baseado em Numero.
- GREEN: 132 testes focados (PC04, PC08, PC10, FIN04 e piloto).
- `node scripts/check-all.mjs`: 694 arquivos, zero falhas. `npm` não está no PATH; executado script equivalente diretamente com Node.
- Revisão independente GPT-6.1 Sol medium: aprovada após corrigir fixtures SQL sem default global.
- Teste SQL inicial pós-ajuste avançou por criação, concorrência, escopo e migração; bulk HTTP esbarrou rate limit. Bulk transformado em fixture SQL, mantendo consultas/paginação via HTTP real.

## Resultado final — ACEITO local
- GREEN SQL principal: `CONTRACT_NUMBER_SQL_TESTS=YES node --test integration/contract-numbering.integration.mjs`: 1/1 PASS. Criação A1/B1, concorrência A2/A3, cancelamento sem reutilização, ator fora do escopo negado, filtros, migração determinística, preservação dos demais campos, idempotência, unicidade e 211 registros paginados sem perda/duplicação.
- GREEN SQL adjacente: `FIN01_SQL_TESTS=YES FIN04_SQL_TESTS=YES FIN05_SQL_TESTS=YES node --test --test-concurrency=1 integration/fin01.integration.mjs integration/fin05.integration.mjs integration/fin04-reset.integration.mjs`: 3/3 PASS.
- 132 testes focados PASS; 694 arquivos sem erros de sintaxe; revisão independente aprovada sem achados materiais restantes.
- Piloto encerrado normalmente pelo sinal, backup verificado, `node scripts/upgrade-contract-numbering.mjs` PASS: quatro contratações renumeradas (depósito 1: 1–3; depósito 2: 1). Comparação de todas as tabelas e campos exceto Numero confirmou preservação, incluindo dois recibos originais.
- Piloto reiniciado em 127.0.0.1:3211, health UP e identidade HMAC conferida; verificação SQL real confirmou sequência e mapa de quatro contratações. Sem erros no log de inicialização.
- Nenhum push/deploy executado. Sem mudança visual; browser dispensado. Recibos emitidos mantêm dados originais, inclusive número histórico; mapa preserva referência anterior.
