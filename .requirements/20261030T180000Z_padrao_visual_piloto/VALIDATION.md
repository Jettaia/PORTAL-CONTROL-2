# Validação visual

Direção aprovada: manter azul e laranja. Camada compartilhada em `public/pilot-tokens.css` e `public/pilot-design.css`; integração no HTML existente; tela independente de tablet alinhada aos mesmos tokens. Nenhuma regra de negócio ou contrato HTTP alterado.

## Evidência principal

- Vermelho: `node integration/pilot-design.visual.mjs`, rodada `2026-10-30T17-07-41-107Z`: botão financeiro abaixo de 44px.
- Verde final: mesmo comando, rodada `2026-10-30T17-10-52-516Z`.
- Capturas e hashes: `artifacts/pilot-design/2026-10-30T17-10-52-516Z/evidence.json`.
- HTML, CSS e JS reais do piloto com respostas HTTP sintéticas. Não envolve banco SQL nem certifica persistência ou autenticação real.
- 12 telas: início, depósitos, prestadores, usuários, perfis/permissões, tipos de atividade, tablets, contratações, financeiro, extrato, limites e diagnóstico.
- 1440×1000, 1024×1000 e 390×1000; tema claro; nomes longos de prestador e depósito; duas contratações com situações distintas.
- Detalhe de contratação nos três tamanhos; financeiro vazio/erro e menu móvel; tablet 768/390; login 1440/390.
- Verificados: largura do documento, alcance da última coluna por rolagem, cabeçalhos, botões principais, teclado numérico/apagar, ausência de erros JS e de escritas HTTP.
- Inspeção das capturas de financeiro, contratações, depósitos, prestadores, usuários, perfis, tablets, login e extrato. Rodadas iniciais motivaram colunas mais largas para nomes longos e espaçamento dos formulários de permissões.

## Regressões adjacentes

- `node scripts/check-all.mjs`: PASS, 692 arquivos JavaScript verificados, nenhuma falha de sintaxe.
- `integration/fin01.visual.mjs`: PASS (ADMIN/FINANCEIRO/GESTOR, filtros, paginação, detalhe, cores semânticas, logout, desktop/tablet/mobile).
- `integration/retired-navigation.visual.mjs`: PASS (perfis e módulos retirados, fallback seguro, menu móvel).
- `integration/deposits-inline.visual.mjs`: incompatível com o estado anterior desta tarefa: usa `/api/b24c/depositos` e procura código `D1`; a tela corrente usa `/api/b24a/depositos` e colunas do novo cadastro. Timeout ao procurar Editar. Não alterado neste trabalho.
- `integration/tablets.visual.mjs`: incompatível com a navegação anterior desta tarefa: procura botão Dashboard já retirado. Timeout nesse passo. Não alterado neste trabalho.

## Detector Impeccable

Uma execução realizada nos arquivos visuais alterados. Identificou texto de ambiente de 10px, corrigido para 11px. Demais alertas referem-se a regras legadas sobrepostas e à faixa laranja inferior do cabeçalho do tablet, preservada como parte da identidade existente. As superfícies reais foram inspecionadas: cartões não possuem halo; os blocos sem bordas laterais usam separação vertical; a tabela tem células com recuo próprio. O detector não substitui a inspeção das capturas.

## Limites

Não houve deploy, reinício de serviço, migração ou alteração de dados. Os arquivos visuais e funcionais que já estavam modificados no checkout foram preservados. `npm` não está no PATH desta sessão; a verificação de sintaxe foi chamada diretamente com `node scripts/check-all.mjs`.
