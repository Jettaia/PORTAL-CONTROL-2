# Evidência local

- Red: `node --test tests/diarias-list.test.mjs integration/diarias-ui.test.mjs` falhou por ausência do menu Diárias e do indicador de entrada consumida.
- Green: os mesmos 2 testes passaram. O fluxo inclui consulta paginada, seleção, revisão de ambos/só saída, MFA, falha parcial, cópia, troca de data/depósito, busca, acesso financeiro negado e navegação durante resposta pendente. Layout mobile verificado também por ausência de sobreposição dos filtros.
- Regressão adjacente: PC04, período, PC05, cópia de token, modelo A, navegação e novos testes: 148 testes aprovados, zero falhas/skips.
- SQL real: `PC05_SQL_TESTS=YES` com instância local de runtime, `node --test integration/pc05.integration.mjs`: aprovado, sem skip. Banco sintético aleatório criado e removido pelo teste. Além dos casos PC05, validou listagem por data/depósito com entrada consumida e a tela Diárias inteira: sessão autenticada → seleção → emissão real → código de quatro dígitos → persistência no SQL → fechamento apaga código. Emissão não registrou entrada antecipadamente.
- A primeira repetição após corrigir o singular da mensagem falhou porque o teste ainda esperava “1 tokens gerados”; expectativa atualizada para “1 token gerado”, repetição passou.
- Sintaxe: `node scripts/check-all.mjs`: 807 arquivos, zero falhas. `npm` não está no PATH desta sessão; executado diretamente o script do task runner.
- `git diff --check`: aprovado.
- Portal local reiniciado pelo sinal oficial de encerramento e `pilot-local/start.mjs`; backup verificado na parada/abertura. HTTP 200 em `/`, `/diarias.js`, `/diarias.css`; menu Diárias presente no HTML servido em 127.0.0.1:3211.
- Nenhuma emissão em contratação operacional do banco persistente foi usada como teste. Nenhum push/deploy.

Capturas locais (ignoradas pelo Git): `artifacts/diarias/tela-desktop.png`, `tela-mobile.png`, `lote-desktop.png`, `sql-real-lote.png`.

Protótipo de origem: branch local `codex/prototype-diarias-c`, variante C aprovada com as cinco remoções anotadas pelo usuário. Arquivos descartáveis removidos do checkout após captura; implementação em `public/diarias.js` e `public/diarias.css`.
