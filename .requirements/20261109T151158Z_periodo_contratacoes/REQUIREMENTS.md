# As Is
Filtro Data do serviço em Contratações consulta somente um dia. Exportações reutilizam filtros PC04.
# To Be
Período inclusivo De/Até no mesmo cabeçalho, consulta e exportações coerentes.
# Requirements
1. Dois campos de data inicial/final substituem o único campo da UI. Intervalo inclui ambas datas; só início significa a partir, só fim significa até, vazio sem filtro.
2. Backend aceita inicio/fim, valida datas reais e ordem, mantém escopo/ordenação/paginação. Aceitar dataServico legada para compatibilidade de clientes existentes.
3. Excel/PDF usam mesmo período em todas páginas e metadados legíveis. Limpar filtros limpa os dois campos. Rascunhos não são exportados.
4. Só local: sem migração, commit, push ou deploy.
# Acceptance Criteria
Dias nas duas bordas incluídos, fora excluídos. Datas iguais, uma borda e vazio aceitos. Inversão/data impossível rejeitadas antesSQL sem perder rascunho daUI. Outros filtros/paginação/exports preservados.
# Principal Regression Test
Testes serviço tests/pc04-period.test.mjs + UI real integration/pc04-export-ui.test.mjs; RED sem inicio/fim e campos ausentes, GREEN após. SQL real integration/pc04-export.integration.mjs confirma bordas e todaspáginas.
# Testing Plan
TDD serviço/UI, SQL descartável, regressões PC04/exports e inventário geral serial; inspeção focal do cabeçalho e restart local.
# Implementation Plan
Testes RED; predicados inicio/fim/ordem/labels; inputs De/Até no cabeçalho preservando8colunas; GREEN/SQL/regressão e reabrir portal.
# Notas
Serena/Lad indisponíveis. Sem novas APIs/pacotes. Valor por extenso permanece fora do escopo.

# Resultado e evidências
Implementado nos filtros de listagem e exportação PC04: inicio/fim inclusivos e opcionais, validação de datas/ordem, metadados de período e inputs De/Até no mesmo cabeçalho. dataServico legada preservada somente na API para compatibilidade. Permissões, paginação e oito colunas mantidas. Documentação atualizada. Sem migração, commit, push ou deploy.
- RED real: serviço recusava inicio/fim como CAMPOS_INVALIDOS; UI não encontrava novos inputs. GREEN após implementação.
- node --test tests/pc04-period.test.mjs integration/pc04-export-ui.test.mjs tests/pc04.test.mjs:80/80. Serviço cobre duas bordas, somente início/fim, igualdade e vazio; inválidos semSQL; UI usa filtros em export/paginação, rejeita inversão mantendo campos, limpa ambas datas, inclui controle de rascunho e sessão.
- PC04_EXPORT_SQL_TESTS=YES node --test integration/pc04-export.integration.mjs:1/1,17.4s, semskip. Fixture205depA/207global em três dias: período08a10=205,08a09=203,09a09=202,inicio10=2,fim08=1,inicio11=0. Listagem limita200 comcursor; export inclui205; personas/isolamento/snapshotsemwrites e limpeza DB aprovados.
- pypdf leu PDF real com205registros e metadados Serviço desde08/11/2026/até10/11/2026. Geradores de artefatos reutilizados sem alteração de formato.
- QA visual do cabeçalho encontrou labels De/Até com regra global sobreposta; teste de corRED detectou e ajuste de especificidade passouGREEN. Inputs legíveis emdesktop, mantida rolagem horizontal da tabela nomobile.
- node --check src/pc04.js e public/pc04.js; git diff --check com core.whitespace=cr-at-eol aprovados.
- Primeira regressão serial geral:455/456; falha de navegação prévia aguardandoformPC01oculto. Repetição isolada preview-ui passou1/1, lote comUIperiodo/serviço/prévia4/4. Sem alteração de código alheio para mascarar falha; nova execução integral de confirmação em andamento.
- Portal reiniciado com backupverificado pelo iniciadoroficial; root200, listagemsem sessão401. Somente local em http://127.0.0.1:3211/.
- Confirmação final: inventário geral serial PASS456/456, zero falha/skip/TODO/cancelado, 58.3s, log artifacts/pc04-export/periodo-regression-confirmacao.txt. Nenhuma pendência da alteração.
