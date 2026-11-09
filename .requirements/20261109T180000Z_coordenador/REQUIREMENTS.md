# Acesso COORDENADOR — implementação local

## As Is
PC01 aceita ADMIN, GESTOR e FINANCEIRO, combináveis. ADMIN é raiz global; usuários comuns têm vínculos explícitos com depósitos. CentroCusto pertence ao depósito. PC04 permite operação ao gestor, com responsável próprio na criação, e aprovação de horários apenas ao ADMIN. FIN01/02/03 permitem leitura ao gestor por depósito e escrita/global ao financeiro. SQL legado não é a superfície operacional atual.

## To Be
COORDENADOR supervisiona somente os depósitos atribuídos pelo ADMIN. Pode operar contratações e escolher gestor responsável elegível do depósito, aprovar/recusar horários de outras pessoas, administrar tablets e prestadores com as proteções de cadastro global existentes. Consulta financeiro sem poder emitir recibos ou registrar baixas por ser coordenador. ADMIN continua global e responsável por contas, segurança, depósitos e tipos. Aprovação do usuário nesta conversa autoriza implementação local da proposta anterior; manter múltiplas funções possíveis, sem impor uso combinado.

## Requirements
1. Aceitar COORDENADOR no cadastro, login, contexto autenticado e interface, preservando funções combinadas.
2. Usar UsuarioDeposito e IDs estáveis. Nenhum novo depósito é concedido automaticamente ao coordenador. Alterações revogam sessões e são auditadas como hoje.
3. Permitir leitura/escrita operacional nos depósitos autorizados, seleção de gestor elegível, tablets (inclusive exclusão) e cadastro/vínculos de prestadores. Documento e desativação global de prestador continuam ADMIN.
4. Aprovar/recusar horários nos depósitos autorizados, negando autoaprovação do coordenador. Coordenador solicita horários; somente ADMIN mantém registro direto.
5. Consultar financeiro, recibos, anexos, extratos, totais e exportações com o mesmo escopo. COORDENADOR sozinho não escreve no financeiro. Se combinado com FINANCEIRO, o acesso financeiro do coordenador permanece limitado a seus depósitos; ADMIN continua global.
6. Não permitir administração de usuários, senhas de terceiros, depósitos, tipos, perfis ou diagnóstico ao coordenador.
7. Instalação nova e upgrade local idempotentes, sem alterar usuários, credenciais, dados operacionais ou autorizações existentes. Sem produção/push/deploy.

## Acceptance Criteria
1. ADMIN cria/edita coordenador com vários depósitos; autenticação retorna o perfil e funções corretos. Combinações continuam válidas.
2. Acesso concedido permite consulta; depósito ausente, novo ou revogado não aparece nem permite leitura/escrita direta. Sessão anterior é invalidada após edição.
3. Contratação para gestor autorizado funciona, responsável de outro depósito falha, escopo aplica a tokens/tablets/prestadores. Operação liberada/paga mantém bloqueios atuais.
4. Fila e detalhe retornam aprovação apenas no escopo; decisão grava horários e auditoria. Coordenador não aprova a própria solicitação nem por chamada direta.
5. Consultas e exportações não incluem outros depósitos, anexos externos são negados; emissão/baixa por coordenador sozinho retorna 403. Perfil financeiro existente preservado.
6. APIs administrativas continuam retornando 403 ao coordenador.
7. Upgrade verificado em banco descartável e aplicado apenas ao piloto local com backup verificado e preservação dos dados existentes.

## Principal Regression Test
integration/coordinator.integration.mjs, HTTP autenticado e SQL descartável. Antes: criação do COORDENADOR retorna 400 FUNCOES_INVALIDAS. Depois: cadastro, login, escopo, aprovação, consulta financeira e negativas funcionam ponta a ponta. Comando: $env:COORDINATOR_SQL_TESTS='YES'; $env:COORDINATOR_SQL_SERVER='localhost\SQLEXPRESS'; node --test integration/coordinator.integration.mjs.

## Testing Plan
Seguir C:/Users/Jetta/.codex/skills/_shared/tdd-decente.md. SQL real descartável para cadastro/autorização, contratos, aprovação e financeiro; UI Playwright com interação para seleção, criação e aprovação; regressões unitárias e suites SQL adjacentes. Não criar dados de teste no piloto persistente. Registrar red/green e limitações em VALIDATION.md.

## Implementation Plan
1. Escrever teste HTTP/SQL e observar red real no cadastro.
2. Adicionar catálogo/migração e perfil PC01/contexto; repetir integração.
3. Implementar capacidades operacionais e escopo/aprovação, preservando bloqueios e transações; repetir integração.
4. Adequar interface e mensagens; testar interação e regressões.
5. Aplicar upgrade no piloto local com backup, preservar dados e verificar disponibilidade local.
