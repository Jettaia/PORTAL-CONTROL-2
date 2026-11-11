# Protótipo descartável — usuários

Pergunta: qual estrutura organiza contas, funções, depósitos e solicitações de acesso com pouco texto e a identidade azul/laranja do portal?

Executar: `npm run prototype:usuarios` ou `node scripts/prototype-usuarios.mjs`.

- http://localhost:4321/?variant=A — tabela de contas e popup central para criar/editar.
- http://localhost:4321/?variant=B — cards de usuários e edição em modal.
- http://localhost:4321/?variant=C — lista e editor com abas Conta/Acessos; novos usuários em modal.

Barra inferior e setas do teclado alternam as opções. Busca nome/e-mail, filtros situação/função, seleção múltipla de funções e depósitos com CC, criação e edição em memória. Solicitações abre a fila demonstrativa de análise, aprovação e recusa. Alterar senha e excluir conta são simulações; a própria conta do exemplo não pode ser excluída.

Todos os dados são sintéticos. Senhas digitadas não entram nos registros, no estado exibido ou em qualquer arquivo; as ações de senha apenas registram o ID de destino. Recarregar restaura os exemplos. O bloco recolhido “Estado da prévia” exibe os dados e ações relevantes.

O host reutiliza HTML/estilos do portal, remove scripts de produção e bloqueia APIs. Sem credenciais reais, SQL, envio de e-mail ou alterações de permissões reais. NODE_ENV=production bloqueia o host; o portal normal não carrega estes fontes. O comportamento definitivo deverá preservar autorização, revogação de sessão e regras existentes.

Escolha: opção A com criação/edição em popup central da B. Anotação de busca corrigida: o input recriado durante o filtro agora restaura o cursor e a seleção, preservando a ordem de digitação e a edição no meio do texto. Refinamento aplicado à prévia; cadastro real ainda não alterado. Alterações locais anteriores preservadas.

Aplicação local em 11/11/2026: desenho reimplementado em pc01.js/pc01.css, reaproveitando os formulários e contratos reais. A busca da aplicação filtra apenas a tabela e não recria o input. Criação/edição, solicitações e senha em popups; exclusão com confirmação e proteção da própria conta. Evidências em `.requirements/20261111T134428Z_user_table_modals/REQUIREMENTS.md`. O portal não carrega os arquivos de protótipo.
