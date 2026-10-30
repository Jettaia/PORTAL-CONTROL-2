# FIN-01

## As Is
PC08 lista baixas legadas por depósito e permite agrupamento/data efetiva. O checkout contém trabalho anterior que deve ser preservado.

## To Be
Consulta financeira única derivada da liberação vigente, global para ADMIN/FINANCEIRO e restrita aos depósitos vigentes do GESTOR. Fonte e aceite: `.scratch/financeiro/issues/01-fila-e-permissoes.md` e `docs/FINANCEIRO-SPEC.md`, autorizados nesta conversa.

## Requirements
1. Listar/detalhar uma vez cada contratação liberada, com valor, atividade, datas e responsável; sem materializar lançamentos duplicados.
2. Validar identidade e escopo no servidor, sem ampliar operações de contratações.
3. Combinar situação, depósito, prestador, período da data do serviço e número; ordenar liberação ASC/ID ASC com paginação integral.
4. Exibir tela única de leitura, sem gravações financeiras legadas durante a transição. Emissão/baixa/limpeza são FIN-02/03/04.

## Acceptance Criteria
1. HTTP e SQL real: liberação via PC04 aparece uma vez; abertas/canceladas ou liberação retirada ficam ausentes.
2. ADMIN/FINANCEIRO sem vínculo veem ambos depósitos; GESTOR só seu depósito, inclusive por ID/filtro; inativo/anônimo recusados.
3. Filtros conjuntos e mais de 100 resultados com empate de datas não omitem/duplicam registros. Situações futuras não usam marcadores legados como quitação nova.
4. UI exibe colunas/detalhe e período explícito, sem abas ou ações de escrita. Rotas legadas de gravação recusadas quando FIN01 ativo.

## Principal Regression Test
`$env:FIN01_SQL_TESTS='YES'; node --test integration/fin01.integration.mjs`: HTTP com sessões reais e SQL descartável. RED esperado: rota financeira nova inexistente. GREEN: autorização, fila, filtros, persistência e transições observáveis corretas.

## Testing Plan
SQL local em banco aleatório JETTA_CONTROL_B3_TEST_*; nenhuma escrita no piloto instalado. UI headless com scripts reais para filtro, paginação, detalhe e limpeza no logout; capturas 1440/768/390. Regressões de PC04/08 e runtime. Revisão independente por risco de acesso/finanças.

## Implementation Plan
1. Criar teste HTTP/SQL e provar RED.
2. Consulta/detalhe/catalogo FIN01 e bloqueio transitório de gravações antigas; executar GREEN.
3. Integrar UI/navegação e flag do piloto, testar interações/visual.
4. Revisar independentemente, corrigir e registrar resultados no ticket.

## Referências técnicas
Paginação por chave composta preserva a precisão de datetime2; cursor usa Buffer base64url nativo. Documentação consultada: https://nodejs.org/api/buffer.html e https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql . Serena/LAD indisponíveis no inventário desta sessão.

## Resultado
FIN-01 implementado e validado no checkout. RED HTTP 404 e RED UI por página ausente; GREEN SQL real e UI. Regressão adicional RED/GREEN do bypass de caixa no bloqueio legado. 108 testes adjacentes e sintaxe de 670 arquivos aprovados. Revisão independente `fin01_review` (GPT-6.1 Sol medium) aprovou após correção do P1. Evidências, fingerprint, personas e limites completos no registro do ticket canônico; FIN-02/03/04 e reinício do piloto instalado não executados.
