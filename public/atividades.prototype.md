# Protótipo descartável — tipos de atividade

Pergunta: qual estrutura deixa o cadastro de tipos de atividade mais moderno e objetivo, preservando azul e laranja do portal?

Iniciar na raiz: `npm run prototype:atividades` (ou `node scripts/prototype-atividades.mjs`).

- http://localhost:4318/?variant=A — tabela essencial; edição em painel lateral.
- http://localhost:4318/?variant=B — catálogo visual; edição em modal.
- http://localhost:4318/?variant=C — lista e formulário lado a lado.

Use a barra inferior ou as setas do teclado para alternar. Busca, situação, criação e edição funcionam em memória; recarregar restaura os exemplos. O bloco “Estado da prévia” exibe os registros e filtros atuais.

O servidor local reaproveita o HTML e os estilos do portal, remove seus scripts e carrega apenas o protótipo. Não executa APIs, autenticação ou gravações reais. O servidor normal não carrega o protótipo nem o seletor. Não publicar estes arquivos como implementação definitiva.

Opção C escolhida pelo usuário. Refinamento solicitado: remover os ícones por atividade e diferenciar os itens com duas cores do padrão existente. A lista usa fundos suaves alternados em azul e laranja, estáveis por registro, e contorno azul para seleção. A avaliação dos ajustes continua na prévia. A implementação com contratos reais e o arquivamento em branch descartável ficam para a promoção do desenho aprovado. Alterações anteriores do workspace foram preservadas.

Aplicação local solicitada em 11/11/2026: desenho reimplementado em `activity-types.js` e `activity-types.css`, usando a API B24A existente. A aplicação real não carrega este protótipo. Evidência e limites registrados em `.requirements/20261111T120000Z_activity_types_layout/REQUIREMENTS.md`. O protótipo segue separado e não foi commitado com as alterações locais preexistentes.
