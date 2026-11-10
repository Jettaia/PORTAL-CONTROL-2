# Ampliação local de permissões do COORDENADOR

## As Is
Coordenador opera depósitos autorizados, consulta tipos, não altera cadastro/centro de custo nem senha de terceiros e não decide a própria solicitação de horário. ADMIN mantém administração global. Há suporte a funções combinadas.

## To Be
Coordenador cria depósitos (acesso concedido somente ao criador e ADMIN), edita os depósitos autorizados e cria/edita tipos compartilhados. Pode redefinir senhas de GESTOR/FINANCEIRO somente quando todos os depósitos do alvo estão no escopo do coordenador e há ao menos um vínculo. Pode aprovar/recusar próprios horários dentro do escopo. Não administra contas/funções/concessões nem redefine ADMIN/COORDENADOR. Sem produção/push/deploy.

## Requirements
1. Criar/editar depósitos e CC mantendo escopo, concorrência, auditoria e validação. Novo depósito fica vinculado ao criador e administradores; outros coordenadores e gestores não herdam acesso.
2. Criar/editar tipos de atividade no catálogo compartilhado, sem conceder essas ações ao gestor/financeiro.
3. Redefinir senha somente de usuários ativos GESTOR/FINANCEIRO com ao menos um depósito e todos os vínculos no escopo. Bloquear contas ADMIN/COORDENADOR, raízes e combinações com privilégios superiores, usuários sem escopo ou com vínculo externo. Expor lista filtrada no servidor e revalidar no reset dentro da transação.
4. Manter proteção da senha, confirmação, auditoria, revogação de sessões/convites e senha própria. Não editar funções, dados ou vínculos do alvo.
5. Aprovar/recusar próprios horários e de terceiros no escopo, mantendo bloqueios pós-liberação, pendência e auditoria; gestor continua sem decidir.
6. Adaptar interface existente, sem acesso ao formulário administrativo de contas, e preservar funções combinadas.

## Acceptance Criteria
1. POST cria depósito e GET/PUT do criador funciona; outros coordenadores não veem/alteram; terceiros existentes continuam bloqueados; original desatualizado retorna 409.
2. Coordenador cria e edita tipo; gestor/financeiro recebem 403.
3. Lista e POST de senha permitem gestor e financeiro locais; sessão anterior é invalidada e login com nova senha funciona. Alvos fora do escopo, mistos, sem depósitos, ADMIN e outro coordenador retornam 403 e não mudam banco.
4. Senha antiga não autentica depois do reset; auditoria e credenciais preservam identidades, sem mudanças em perfis/depósitos.
5. Própria solicitação pode ser recusada (horários preservados) e aprovada (horários gravados). Nenhuma decisão atravessa depósito ou reabre contratação liberada.
6. UI mostra formulário de depósitos/tipos e redefine senhas elegíveis; autoaprovação visível. Painel de administração de contas continua exclusivo do ADMIN.

## Principal Regression Test
integration/coordinator.integration.mjs — HTTP autenticado, SQL descartável local, sem mocks de autorização. Atualizar expectativas e observar RED (cadastro de depósito e reset ainda recusados; autoaprovação retorna 403), implementar e obter GREEN. Flags COORDINATOR_SQL_TESTS=YES e COORDINATOR_SQL_SERVER=localhost\SQLEXPRESS.

## Testing Plan
Seguir C:/Users/Jetta/.codex/skills/_shared/tdd-decente.md. Mesmo fluxo real para escopo, cadastro, senha/login, auditoria e decisões. UI headless para cadastro e redefinição, validação de erros e troca de usuário. Suites adjacentes PC01/PC02/PC04, senhas, regressão padrão com concorrência limitada. Não criar dados de teste no piloto persistente.

## Implementation Plan
1. Atualizar regressão HTTP/SQL antes do código, executar RED.
2. Ampliar cadastro na rota e serviço mantendo verificação persistida, escopo e vínculo do criador; testar.
3. Adicionar lista de alvos e autorização de reset compartilhada, interface de senha de terceiros, e testar reset/login/negações.
4. Liberar decisão própria na API/UI e testar recusa/aprovação.
5. Rodar regressões e UI, reiniciar somente runtime local e confirmar HTTP. Não há nova tabela ou migration.

## Confirmações e limites
Usuário confirmou explicitamente senhas somente de depósitos autorizados. Usuários com depósitos externos continuam ADMIN para evitar acesso indireto fora do escopo; novos depósitos são atribuídos ao coordenador criador. Tipos são compartilhados, conforme modelo atual. Serena e Lad não disponíveis. Nenhuma dependência/API externa nova.
