# Portal Control em produção

Destino: https://app.jettatransportes.com.br/chapa/ . Serviço independente em `/opt/jetta-chapa`, sem portas públicas de SQL/API. Caddy existente recebe apenas o prefixo `/chapa`; API usa rede própria, proxy fixo `10.203.88.2/32` e cookies exclusivos Secure/HttpOnly/SameSite.

## Dados e credencial

Instalação nova aplica o manifesto completo de 42 migrações. Importa somente o ADMIN raiz ativo e sua credencial scrypt (hash/salt), recria permissões técnicas e não transporta sessões, tokens ou dados operacionais. O banco local permanece intacto. `export-admin.mjs` escreve apenas em arquivo ignorado; não imprime a credencial. `bootstrap-run.mjs --new-empty-chapa` exige banco inexistente e recusa sobrescrita.

A API usa `JettaChapaRuntime`, sem sysadmin, db_owner, DDL, backup ou administração do servidor. Cada conexão confere identidade, privilégios e marcador da instalação. A credencial `sa` permanece somente no volume administrativo criptografado; não é montada na API.

## Criptografia e limites

- HTTPS do domínio com certificado público validado; SQL com TLS e certificado privado SAN `chapa-db`, CA instalada e `TrustServerCertificate=No`.
- Dados SQL, logs e segredos persistentes ficam em volume LUKS2 AES-XTS-512 próprio de 24 GiB. Não há alteração da criptografia do disco raiz compartilhado.
- Desbloqueio automático usa `/etc/jetta-chapa/volume.key`, acessível somente a root. Isso protege a cópia isolada do volume, mas não protege contra root comprometido ou acesso à imagem completa da VPS com a chave de desbloqueio. Não afirmar proteção absoluta contra comprometimento da VPS.
- Backups SQL COPY_ONLY/CHECKSUM são verificados com sqlcmd e cifrados em CMS AES-256-GCM. A chave privada de recuperação fica somente no computador do operador, em `secrets/chapa-production/backup-recovery-private.pem`; a VPS recebe somente o certificado público destinatário.
- Timer diário às 02:30 de America/Sao_Paulo, até 7 cópias/32 GiB, com pisos de espaço livre. O serviço falha antes de gerar novo backup se a reserva for insuficiente. Consultar `systemctl status jetta-chapa-backup.service` e manter cópia dos backups em outro local: cópias diárias permanecem na mesma VPS. A cópia inicial cifrada foi baixada para o computador.
- Guardar a pasta privada `secrets/chapa-production` em local de recuperação protegido. Ela contém chave do volume, credenciais de administração/instalação, CA privada e chave de recuperação de backups; nunca versionar ou enviar em chat.
- Certificado SQL emitido para 825 dias; renovar com a CA privada antes de expirar. Backup recipient/CA: 10 anos. Manter dependências e pacotes do sistema atualizados.

## Runtime Linux

Microsoft ODBC 18 apresentou travamento/crash com binário Node oficial e OpenSSL estático. A imagem usa o pacote Node >=20 mantido pela segurança Debian 13, ligado ao OpenSSL compartilhado do mesmo sistema. ODBC/TLS, inicialização e operações autenticadas foram provados nessa imagem. Não voltar ao executável Node estático sem repetir essas provas. O SQL Server é Express, não Developer.

A importação de recibos usa PDF.js 6 e exige Node >=22.13. A imagem preserva também o Node 24 oficial em `/usr/local/bin/node-pdf`, selecionado por `RECEIPT_PDF_NODE`: somente a leitura/separação dos PDFs roda nesse processo isolado, com IPC binário, limite de heap e prazo de processamento. A API/ODBC permanece no Node Debian com OpenSSL compartilhado. Não remover essa separação sem provar novamente SQL/TLS, QR, OCR português offline e separação de páginas na imagem Linux.

## Implantação e verificação

1. Conferir `env.txt` privado e identidade SSH fixada por `manage-vps.py`. Não imprimir os valores.
2. Executar testes pertinentes, regressão completa e integração SQL descartável: `node scripts/validate-pilot.mjs`; `CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs`; `python production/test-prune-backups.py`.
3. Empacotar fontes e CA pública: `python production/package-release.py`. O recibo privado registra hashes e revisão Git. Certificados privados, `.env`, backups e dados não entram no arquivo.
4. Preparar volume somente em diretório novo, banco somente inexistente e configurações privadas já revisadas. Não repetir prepare-storage/bootstrap em instalação existente.
5. Construir a imagem com Dockerfile e promover somente depois de homologação, teste de backup/restauração e revisão. Serviços systemd exigem o volume montado antes dos contêineres. O banco precisa estar saudável antes da API.
6. `run-staging.sh` e `verify-staging.mjs` são exclusivos da instalação nova AINDA NÃO PUBLICADA. Usam senha sintética temporária no ADMIN de destino e restauram o hash original em finally, com validação. Não executar esses scripts em produção com usuários ativos.
7. `restore-proof.sh` restaura somente em banco de ensaio nomeado e verifica CHECKDB/ADMIN/contagens; nunca restaura sobre o banco operacional.
8. `publish-route.py` conserva backups da configuração do edge, valida antes de reload (SIGUSR1 quando admin off e caddy run compatível) e repõe a configuração anterior se falhar. O arquivo bind-mounted é escrito preservando seu inode. Não reinicia o Caddy nem os outros sistemas.
9. Validar publicamente HTTPS, assets, recusas anônimas e APIs autenticadas. A senha atual do usuário não foi lida: o login de ensaio usa credencial sintética em ambiente ainda privado; a preservação da senha real é comprovada por igualdade exata de hash/salt.

## Recuperação e rollback

Consultar os arquivos de backup do Caddy em `/opt/jetta-chapa/caddy-before.conf` e `caddy-compose-before.yaml`. Para retirar a publicação, restaurar o conteúdo em seus caminhos originais, validar e recarregar o Caddy, preservando o inode do Caddyfile. Parar somente `jetta-chapa.service`. Preservar volume, chaves, configurações privadas e backups; não executar docker volume prune, reset do piloto ou exclusão de bancos como rollback.

Decifrar um `.bak.cms` com OpenSSL CMS, certificado destinatário e chave privada offhost, em diretório privado. Restaurar primeiro em instância isolada com nome novo, executar CHECKDB e conferir identidade/credencial/contagens antes de decidir corte de dados. O ensaio realizado nesta entrega baixou, decifrou e restaurou o backup real, com CHECKDB e igualdade do ADMIN, e removeu somente o banco de ensaio.
