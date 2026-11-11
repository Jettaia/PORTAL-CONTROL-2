# Protótipo descartável — prestadores

Pergunta: qual estrutura apresenta melhor nome, CPF/CNPJ, telefone, situação e vínculos com depósitos, com visual moderno e pouco texto?

Executar: `npm run prototype:prestadores` ou `node scripts/prototype-prestadores.mjs`.

- http://localhost:4320/?variant=A — tabela compacta e edição lateral.
- http://localhost:4320/?variant=B — cards e edição em modal.
- http://localhost:4320/?variant=C — lista e cadastro lado a lado.

Barra inferior e setas do teclado alternam as opções. Busca por nome/documento, filtros por situação e depósito, criação/edição e vínculos demonstrativos em memória. O bloco recolhido “Estado da prévia” mostra os registros e filtros. Recarregar restaura os exemplos. Todos os nomes/documentos/telefones são demonstrativos; não há consulta ou validação cadastral externa.

O servidor usa o HTML/estilos reais sem executar os scripts de produção nem APIs. O portal normal não carrega o protótipo. NODE_ENV=production bloqueia o host. Não implementa autorização de pessoas reais nem grava SQL. A seleção de depósitos demonstra a composição visual; a implementação definitiva deve preservar regras existentes por perfil.

Escolha: C com cadastro de novo prestador no modal da B. Removida a contagem solta “6 prestadores” acima da lista; contadores dos filtros preservados. Edição de existentes continua ao lado. Cancelar o modal preserva o rascunho do editor lateral. Refinamento disponível na prévia; integração ao cadastro real ainda não realizada. Alterações locais anteriores preservadas.

Refinamento: cada depósito mostra seu centro de custo vinculado no editor lateral, popup, filtro e etiquetas. Catálogo demonstrativo: Guarulhos/CC-001, Campinas/CC-002, Curitiba/CC-003. Os valores de vínculo continuam sendo os depósitos; centro de custo é informação de exibição derivada do catálogo.

Aplicação local solicitada e realizada em 11/11/2026: desenho reimplementado em `public/pc03.js` e `public/pc03.css`. A API PC03 passou a incluir CentroCusto na projeção dos depósitos, preservando o mesmo escopo. Evidências e limites em `.requirements/20261111T132230Z_provider_split/REQUIREMENTS.md`. O portal real não carrega o protótipo nem o seletor.
