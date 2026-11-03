# Centralizar tabela de Contratações
## As Is
Cabeçalhos e células alinhados à esquerda.
## To Be
Textos dos cabeçalhos, filtros da tabela e linhas centralizados, somente na tabela de Contratações.
## Requirements
1. Aplicar alinhamento central sem mudar dados, filtros, ações ou outras tabelas.
## Acceptance Criteria
Cascata real resolve text-align center em todos os th/td e filtros da tabela; desktop/mobile preservam rolagem e Editar.
## Principal Regression Test
Verificação focal temporária em .scratch/contracts-center.visual.mjs, derivada do runner existente contracts-table.visual.mjs com cascata do piloto e asserção de computed styles. Antes deve encontrar left; depois center.
## Testing Plan
Runner existente com inspeção focal de CSS e capturas1440/390, sem SQL pois mudança somente visual.
## Implementation Plan
Verificar alinhamento antes; acrescentar regra CSS específica; executar prova focal e conferir asset servido no piloto.

## Resultado
Concluído. Mudança de uma regra CSS em public/pc04.css, limitada à tabela e seus filtros. RED confirmou alinhamento anterior; GREEN do runner focal passou com computed styles center, nove colunas, ações/datas/status preservados, desktop1440/mobile390 e zero escritas/erros JS. Captura artifacts/contracts-table/table-1440.png inspecionada. Asset /pc04.css servido pelo piloto idêntico ao arquivo atualizado; sem reinício, SQL ou alteração de dados.
