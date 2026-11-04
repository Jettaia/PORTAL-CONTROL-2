# Publicação do Portal Control em /chapa

## As Is
- Projeto atual é um piloto local Windows, SQL Server Express e ODBC Driver 18 com Trusted_Connection.
- Acesso SSH à VPS confirmado em 04/11/2026. VPS Ubuntu, aplicações em Docker e borda Caddy compartilhada.
- Domínio HTTPS retorna 200 com verificação TLS válida; /chapa retorna 404.
- /api/* já pertence ao Move. Não pode ser redirecionado para o Portal Control.
- Consulta somente leitura ao banco local confirmou exatamente um ADMIN ativo, administrador-raiz, com salt/hash de senha no formato válido. Nenhum segredo foi exibido ou exportado.
- Sessão atual usa cookie sem Secure, Path=/api; validação de Origin e URLs absolutas são locais.
- Não há SQL Server identificado no inventário remoto de serviços/contêineres.
- lsblk não mostrou camada de criptografia do disco no sistema convidado. Criptografia do provedor não foi verificada; não afirmar que inexiste.
- Nenhuma configuração ou dado de produção foi alterado nesta avaliação.

## To Be
Portal disponível em https://app.jettatransportes.com.br/chapa, com banco independente sem dados operacionais, mantendo a identidade e a senha atual do único ADMIN local. Dados, credenciais e backups protegidos, sem conflito com sistemas existentes.

## Requirements
1. Criar um banco novo isolado; não limpar, restaurar por cima nem alterar o banco local ou bancos existentes da VPS.
2. Transferir somente nome, e-mail, identidade administrativa e credencial hash/salt do ADMIN ativo. Recriar vínculos de administrador e catálogos essenciais de permissões. Não copiar usuários adicionais, depósitos, prestadores, serviços operacionais, contratações, pagamentos, anexos, sessões, convites, tokens ou pedidos de acesso.
3. Adaptar todas as páginas, APIs, navegação e cookies ao prefixo /chapa. Preservar as APIs e rotas existentes do domínio.
4. Implementar modo de produção separado do piloto local: origem HTTPS fixa validada, cookie Secure/HttpOnly/SameSite e escopo /chapa; limites por cliente com proxy explicitamente confiável.
5. Banco com conta exclusiva restrita, sem sysadmin/db_owner/DDL e sem porta pública. Não contornar gates de identidade existentes.
6. SQL com criptografia e validação de certificado; dados persistentes e backups com criptografia em repouso comprovada. Chaves fora do Git e dos logs, plano de recuperação e teste de restauração.
7. Homologar ambiente isolado antes de publicar, com login real, permissões, recusa anônima, isolamento de rotas e disponibilidade dos sistemas existentes; rollback independente do novo serviço.

## Acceptance Criteria
1. Banco local intacto; destino identificado como novo e vazio antes de aplicar schema; contagens finais de tabelas operacionais iguais a zero.
2. Exatamente um ADMIN ativo com vínculo raiz e credencial equivalente à origem. Login com senha atual validado de forma privada; tokens e sessões antigos recusados. Sem hashes ou senha em relatórios.
3. Navegação e requisições do portal permanecem em /chapa; nenhum recurso intercepta /api/* do Move.
4. Escritas com origem indevida recusadas; cookies protegidos, sessão/logout e limites verificados via HTTP real.
5. Conta runtime sem privilégios administrativos, banco sem exposição pública e testes negativos de autorização aprovados.
6. Evidência de TLS do navegador e banco, armazenamento/backup criptografados e restauração verificável; entrega privada das instruções de guarda das chaves.
7. Suíte relevante aprovada, smoke de homologação aprovado, serviço público autenticado validado e sistemas existentes saudáveis após reload mínimo do Caddy.

## Principal Regression Test
Criar teste de integração HTTP real em /chapa e teste de navegador para login/navegação sob prefixo. Antes da adaptação, deve falhar porque URLs/cookies/origem usam a raiz ou localhost; depois, deve passar com produção configurada e continuar recusando origem/cookie inválidos. Adicionar ensaio SQL descartável para provar banco sem registros operacionais e ADMIN preservado, sem expor credenciais.

## Testing Plan
- Baseline sintaxe: scripts/check-all.mjs, 719 arquivos, zero falhas.
- Baseline testes: scripts/test-all.mjs, 410 testes, 409 aprovados, 1 timeout na prévia (#pc01Form oculto). Reexecução isolada de integration/preview-ui.test.mjs passou (1/1). Ainda não declarar suíte integral aprovada nem causa corrigida.
- Guardas de identidade/piloto: tests/sql-runtime.test.mjs, tests/runtime-identity-proof.test.mjs e pilot-local/unit.test.mjs, 4/4 aprovados.
- Após adaptação: red/green do contrato HTTP, banco isolado e navegador; repetir suíte completa e gates aplicáveis.
- Smoke público somente após homologação e validação de recuperação.

## Implementation Plan
1. Confirmar direção de implantação e separar modo de produção do piloto Windows, preservando seus guardas.
2. Escrever regressões HTTP/SQL/navegador antes das alterações; reproduzir falhas de prefixo e configuração.
3. Preparar SQL Server isolado com edição permitida em produção. Express é candidata para evitar licença paga, condicionado a compatibilidade e limites; não usar Developer em produção.
4. Preparar armazenamento criptografado, chaves e backup/restauração antes de dados reais. Nunca converter o disco raiz compartilhado para criptografia durante esta entrega.
5. Aplicar schema completo em banco novo, seed de permissões e importar somente ADMIN/credencial em transação com checagem de destino.
6. Adaptar HTTP/SQL, executar testes e homologar em rede isolada.
7. Publicar versão verificada, adicionar somente /chapa no Caddy e validar configuração antes de reload. Confirmar TLS, login, banco vazio, isolamento e saúde dos demais serviços.
8. Registrar evidências e rollback; só declarar publicado após validação pública real.

## UNDERSTANDING LOCK
- resumo do problema: piloto local Windows não é diretamente publicável na VPS Ubuntu compartilhada.
- objetivo: publicar em /chapa com segurança, dados criptografados e acesso administrativo preservado.
- escopo: banco novo vazio de dados operacionais, ADMIN atual, runtime de produção isolado, adaptação de rotas e segurança, homologação e publicação.
- fora de escopo: limpar banco local, importar operação anterior, migrar banco para PostgreSQL, alterar demais aplicações da VPS.
- premissas assumidas: SQL Server isolado; Express preferencial se compatível; sem compra de licença ou nova infraestrutura paga.
- regras fechadas: manter e-mail/senha atuais por hash/salt, não copiar sessões/tokens; catálogos técnicos de autorização são necessários e não são dados operacionais.
- decisoes ja tomadas: usuário definiu banco vazio e manutenção do ADMIN; domínio/prefixo definidos pelo usuário.
- duvidas ainda abertas: escolha técnica de armazenamento criptografado e comprovação de compatibilidade de SQL/ODBC no ambiente final serão resolvidas antes da homologação; implantação bloqueada se não houver prova.
- criterios de aceitacao preliminares: HTTPS e login reais, único ADMIN, tabelas operacionais vazias, dados/backups criptografados, conta restrita, zero interferência nas rotas existentes e rollback testado.

## Limite de execução
A skill workflow-discovery-gate exige confirmação explícita do entendimento antes da implementação. Nenhum rollout foi iniciado. Este arquivo é um plano para revisão; não é evidência de produção aprovada.

## Fontes consultadas
- https://learn.microsoft.com/sql/linux/sql-server-linux-docker-container-deployment?view=sql-server-ver17
- https://learn.microsoft.com/sql/sql-server/editions-and-components-of-sql-server-latest

## Confirmação e execução
Usuário confirmou o plano e solicitou smart-orchestrator e jetta-qa. Gate de entendimento liberado. Revisões independentes do runtime e da infraestrutura aprovadas após corrigir inspeção de DMV e limites de backups. Execução direta com ownership separado, sem controlador V2.

## Evidência antes de publicar
- Regressão FULL: 414/414 testes, sintaxe aprovada e 7/7 verificações de piloto/conexão.
- SQL descartável: bootstrap38/admin/credencial/zerooperação/recusa de sobrescrita, 1/1 PASS; banco sintético removido.
- Retenção de backups: 2/2 PASS.
- VPS: SQL TLS com CA verificada e conta restrita aprovados; volume LUKS2 ativo.
- Homologação HTTP real: anônimo401, origem indevida403, login/cookie seguro, consultas ADMIN, escrita inválida400, logout/revogação e429 por limite: PASS. Credencial original restaurada e sessões de teste removidas.
- Backup real cifrado na VPS, baixado e decifrado offhost, restaurado em banco novo, CHECKDB e ADMIN/contagens: PASS; banco de ensaio removido.
- Disponibilidade pública e resultado final foram verificados abaixo.

## Resultado final — 04/11/2026
Publicado em https://app.jettatransportes.com.br/chapa/ . Código de runtime e publicação em b3ed274 (main enviada ao origin); imagem de produção jetta-chapa:b3ed274, recibo de fontes/hashes privado na VPS.

Verificação pública PASS: página200/TLS válido, anônimo401, ADMIN autenticado por sessão QA nova nas consultas, origem indevida403, logout200 e sessão revogada401, raiz existente200. Credencial original (hash/salt) igual à origem; banco com um ADMIN e tabelas operacionais vazias; sessão QA removida. Senha humana não foi conhecida nem lida. Navegador Edge headless real: login visível, HTTPS validado, zero erros JS e zero falhas de assets.

Serviços/storage/timer ativos, SQL saudável e portas da API/SQL sem publicação no host. Backup diário habilitado para02:30 America/Sao_Paulo com até120segundos de distribuição; execução manual do serviço terminou Result=success. Backup inicial cifrado e chaves de recuperação estão na pasta privada local; chave privada de backups não foi enviada à VPS. Recuperação real e ciclo de bloquear/desbloquear o volume foram provados antes da publicação.

O Caddy existente usa admin off e v2.11.2. Após validar a configuração, o reload foi aplicado por SIGUSR1, com confirmação de sucesso nos logs. Backups da configuração original foram preservados. O teste do reconhecimento exato do domínio teve RED/GREEN e2/2PASS; evita confundir o host com referências em outros proxies. Revisões independentes aprovaram runtime, infraestrutura e correções finais.

Limites documentados em production/README.md: desbloqueio automático mantém chave do volume no host; não protege contra root/comprometimento integral da VPS. Cópias diárias ficam na mesma VPS; foi baixada a cópia inicial cifrada. A senha original foi preservada por igualdade exata de credencial; login com senha sintética foi provado antes da publicação, enquanto a consulta autenticada final usa sessão QA nova posteriormente eliminada. Não declarar login com senha humana que não foi fornecida.
