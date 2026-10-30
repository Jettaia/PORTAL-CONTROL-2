# As Is
Usuário relata resultados incompatíveis com filtros preenchidos. Processo local iniciou 11:00 UTC; código de filtros mudou 11:18 UTC. Hipótese ainda a confirmar: API antiga em memória servindo frontend novo.
# To Be
Portal ativo aplica os filtros por API autenticada real e mostra somente resultados compatíveis.
# Requirements
1. Reproduzir no servidor atual e identificar causa antes de editar.
2. Corrigir a causa e validar os sete filtros no ambiente real, sem alterar contratações.
3. Preservar dados e sessões do usuário; sessão temporária exclusiva de diagnóstico será apagada.
# Acceptance Criteria
Número inexistente retorna lista vazia; filtro inválido é rejeitado; dados retornados coincidem com consulta atual; cliques Aplicar/Limpar na tela real funcionam.
# Principal Regression Test
node integration/contracts-filters-live.mjs com JETTA_FILTERS_LIVE=YES: chamada autenticada ao servidor piloto existente e comparação com serviço/SQL atual. Deve detectar API em memória desatualizada.
# Testing Plan
API real, SQL real e navegador headless autenticado no mesmo endpoint, sem mocks de API. Somente sessão temporária (expira em cinco minutos) e limpeza por hash exclusivo.
# Implementation Plan
1. Rodar teste red. 2. Confirmar hipótese comparando serviço novo e API ativa. 3. Recarregar somente o processo piloto identificado usando rotina oficial e backup. 4. Reexecutar teste green e regressão focal. Se causa divergir, revisar hipótese.

# Causa confirmada
Processo 9324, pilot-local/start.mjs, estava ativo desde 11:00:23 UTC. Backend de filtros alterado às 11:18 UTC. Arquivos estáticos atualizavam o frontend, mas os módulos ESM do backend continuavam antigos em memória. Não houve defeito nos predicados novos: serviço atual no SQL real retornava zero para número inexistente, API antiga retornava três.
# Correção
Sinal oficial secrets/pilot-local/encerrar.sinal encerrou somente o piloto identificado; rotina executou backup e preservou dados. Reinício oficial pilot-local/start.mjs com janela oculta, sem abrir novo browser do usuário, processo 1688 na mesma porta 3211. Backup de abertura verificado em restart-filters.log. Nenhum código de produção precisou mudar; incluído teste regressivo no ambiente real.
# Evidências
- JETTA_FILTERS_LIVE=YES node integration/contracts-filters-live.mjs: RED (número inexistente esperado 0, API retornou 3) antes do reinício; GREEN após (0).
- Mesmo teste GREEN para sete filtros isolados e duas combinações comparadas ao serviço atual em SQL Server real, sem mocks de API.
- Navegador headless com sessão temporária própria no portal real: Aplicar por número, Enter/vazio, Limpar e caso do print Testador dois + LIBERADA. Captura artifacts/contracts-filters-live/screenshot-case.png inspecionada: zero linhas e mensagem de nenhum resultado, filtros preservados.
- node --test tests/pc04.test.mjs: 71/71 passaram; artifacts/contracts-filters-live/regression.log.
- Sessões temporárias criadas com expiração de cinco minutos e apagadas em finally por hash exclusivo, com releitura COUNT=0. Não foram alteradas contratações, cadastros, valores ou sessões do usuário.
# Estado final
Corrigido e validado no piloto ativo, não apenas em fixture. Aplicar novamente os filtros na janela existente usa a API atualizada.
