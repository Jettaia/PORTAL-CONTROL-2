# As Is
Tabela mostra Depósito sem seu Centro de Custo. Cadastro.Deposito já possui CentroCusto.
# To Be
Coluna Centro de Custo imediatamente após Depósito, obtida do cadastro vinculado e com filtro no padrão existente.
# Requirements
1. Exibir CentroCusto do depósito associado, com — quando ausente.
2. Filtrar por trecho sem alterar escopo, paginação ou contratação.
3. Explicar tablet com base no fluxo implementado, sem alterar essa função.
# Acceptance Criteria
API e tabela refletem o CentroCusto do depósito, coluna na ordem pedida, oito filtros, Editar correto e vazio colspan nove.
# Principal Regression Test
node integration/contracts-table.visual.mjs: nova coluna/valor e ordem; node --test tests/pc04.test.mjs: projeção e filtro no SQL; red antes.
# Testing Plan
UI real com fixtures, teste backend focal e verificação autenticada em SQL/piloto real. Reiniciar o piloto oficial para atualizar backend. Sem alteração de dados de negócio.
# Implementation Plan
Testes/red; adicionar projeção e filtro; adicionar coluna e ajustar índices CSS/testes; green, reinício oficial com backup e prova real.

# Resultado e provas
Concluído: coluna Centro de Custo após Depósito, valor direto f.CentroCusto do cadastro vinculado, fallback — e filtro textual centroCusto; vazio dinâmico para nove colunas. Índices CSS de data/valor ajustados. Sem migration ou alteração de dados.
Red: teste tabela detectou ausência da coluna. Green: node integration/contracts-table.visual.mjs e node integration/contracts-filters.visual.mjs passaram, ordem/valor/fallback/filtro/clique Editar e desktop/mobile; captura desktop inspecionada. node --test tests/pc04.test.mjs: 72/72 passaram, incluindo projeção/filtro e rejeição de duplicados. node --check src/pc04.js e public/pc04.js passaram.
Piloto reiniciado pela rotina oficial com backup verificado (restart-centro-custo.log), mesmo endereço/porta, processo 17192. JETTA_FILTERS_LIVE=YES node integration/contracts-filters-live.mjs passou: comparação da API ativa com SQL real para oito filtros; CentroCusto comparado diretamente ao Cadastro.Deposito; cabeçalho/valor no navegador real. Sessão temporária removida e verificada; nenhuma contratação alterada.
Tablet: explicação baseada em src/pc05.js, src/pc05-routes.js e public/tablet-pc05.html/js: pareamento de cinco minutos, sessão de oito horas, token de oito dígitos de uma hora/uso único, entrada antes de saída, grava horário do servidor, escopo dos emissores e revogação. Piloto escuta somente 127.0.0.1, aparelho físico requer acesso de rede ainda não configurado. Nenhuma função do tablet alterada.
