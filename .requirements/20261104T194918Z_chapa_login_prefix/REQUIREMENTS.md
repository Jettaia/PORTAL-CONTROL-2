# Corrigir login do Portal Control publicado em /chapa

## As Is
Browser público reproduziu: ao clicar Entrar, aparece Login necessario, só há GET /chapa/api/mfa/status401 e nenhum POST de login. O wrapper verifica prefixo de API reescrito no build, mas a exceção regex ainda contém /api/ sem /chapa. Credencial não é alcançada. Não há vault Obsidian ativo nesta máquina; registro local canônico nesta pasta.

## To Be
O formulário envia o login diretamente sob /chapa/api/auth/login, conservando proteção de operações que exigem MFA e comportamento local sem prefixo. Preservar senha, usuários e banco.

## Requirements
1. Calcular a exceção de autenticação a partir do caminho relativo ao mesmo prefixo utilizado para classificar APIs.
2. Login/logout/MFA/ativação mantêm exceções existentes; demais escritas continuam protegidas.
3. Publicar correção mínima e validar pelo navegador público sem solicitar ou alterar senha do ADMIN.

## Acceptance Criteria
1. Clique real em Entrar alcança POST /chapa/api/auth/login e não consulta MFA previamente; resposta do servidor é exibida.
2. Regressões locais de MFA/STEPUP/cancelamento e sem MFA aprovadas; recursos e pedidos continuam no prefixo.
3. Fonte revisada, commit/push, build, troca somente API e confirmação HTTP/navegador em produção; banco e credenciais inalterados.

## Principal Regression Test
integration/chapa-production-browser.test.mjs: formulário real com senha sintética acima do limite deve alcançar validação400 do servidor, sem conexão SQL. Antes falha exibindo Login necessario e sem POST; depois mostra Dados invalidos e registra POST400. A mesma prova automatizada no domínio público valida o asset efetivamente publicado. Valores sintéticos não atingem SQL nem contador de credencial.

## Testing Plan
RED/GREEN no frontend real contra servidor HTTP de produção isolado; regressões mfa-enrollment-ui/no-mfa-ui e produção; suíte compartilhada completa após a mudança; navegador público antes/depois. Não usar evidência antiga como prova da correção. Nenhum hash ou senha em logs.

## Implementation Plan
1. Acrescentar cenário ao teste de browser existente e observar RED.
2. Normalizar caminho pelo prefixo antes das exceções de MFA; observar GREEN e regressões adjacentes.
3. Revisão independente, commit/push e imagem versionada, backup, atualização apenas da API com rollback por imagem anterior.
4. Repetir navegador público e registrar resultados. Sem reset/migration de banco ou senha.

## Evidência local
- Repro público antes: mensagem Login necessario; GET /chapa/api/mfa/status401; nenhum POST de login.
- RED do browser isolado: esperava Dados invalidos do servidor, recebeu Login necessario antes do POST.
- GREEN focal:10/10; inclui browser real, MFA/STEPUP/cancelamento, piloto sem MFA e contratos de produção.
- Regressão de escrita protegida no mesmo browser: pedido PC01 não é enviado antes da verificação401 de sessão/MFA.
- Revisão independente: PASS, sem achados materiais; preservadas exceções e proteção das demais escritas.
- Suíte compartilhada:414/414 aprovados; sintaxe e7/7 verificações de piloto/conexão também aprovadas.
