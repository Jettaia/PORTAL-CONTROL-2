# Protótipo descartável — depósitos

Pergunta: qual estrutura organiza melhor a consulta e o cadastro de depósitos com pouco texto e as cores do portal?

Executar: `npm run prototype:depositos` ou `node scripts/prototype-depositos.mjs`.

- http://localhost:4319/?variant=A — tabela compacta e editor lateral.
- http://localhost:4319/?variant=B — cards com endereço e editor em modal.
- http://localhost:4319/?variant=C — lista e cadastro lado a lado.

Setas na barra inferior ou no teclado alternam as opções. Busca por nome/cidade/UF/CC, situação, criação e edição em memória. Recarregar restaura os exemplos. O bloco recolhido “Estado da prévia” expõe os registros e filtros. Todos os endereços são demonstrativos.

O host local usa o HTML/estilos reais do portal sem executar os scripts de produção ou APIs. Não carrega credenciais e não grava SQL. O portal normal não carrega esses arquivos nem o seletor. NODE_ENV=production bloqueia este host.

Avaliação pendente. Após a escolha, registrar o veredito, reimplementar a decisão no cadastro real e capturar o protótipo em branch descartável, fora de main. Alterações locais anteriores preservadas.

Veredito em 11/11/2026: opção B aprovada pelo usuário, com remoção do breadcrumb “Cadastros / Depósitos”. Reimplementada localmente em B24C, preservando contrato e permissões. Evidência em `.requirements/20261111T123401Z_deposit_cards/REQUIREMENTS.md`. A prévia também omite o texto anotado.
