set -euo pipefail
docker exec -i chapa-db bash -c 'export SQLCMDPASSWORD="$(cat /run/secrets/sql-sa-password)" SSL_CERT_FILE=/var/opt/mssql/certs/chapa-ca.crt; exec /opt/mssql-tools18/bin/sqlcmd -S chapa-db -U sa -N -l 10 -b -r 1' <<'SQL'
IF DB_ID(N'JETTA_CHAPA_RESTORE_PROOF_20261104') IS NOT NULL THROW 55999,N'Destino de ensaio já existe; recusa de sobrescrita',1;
RESTORE DATABASE [JETTA_CHAPA_RESTORE_PROOF_20261104] FROM DISK=N'/var/opt/mssql/backups/offhost-decrypted-restore.bak' WITH CHECKSUM,
MOVE N'JETTA_CONTROL_PILOTO_LOCAL' TO N'/var/opt/mssql/data/JETTA_CHAPA_RESTORE_PROOF_20261104.mdf',
MOVE N'JETTA_CONTROL_PILOTO_LOCAL_log' TO N'/var/opt/mssql/data/JETTA_CHAPA_RESTORE_PROOF_20261104.ldf';
DBCC CHECKDB([JETTA_CHAPA_RESTORE_PROOF_20261104]) WITH NO_INFOMSGS,ALL_ERRORMSGS,MAXDOP=1;
GO
SQL
docker run --rm --user 0 --network jetta-chapa-db \
 --mount type=bind,src=/opt/jetta-chapa/data/bootstrap,dst=/run/bootstrap,readonly \
 --mount type=bind,src=/opt/jetta-chapa/release/production,dst=/app/production,readonly \
 jetta-chapa:verified node production/verify-restore.mjs
docker exec -i chapa-db bash -c 'export SQLCMDPASSWORD="$(cat /run/secrets/sql-sa-password)" SSL_CERT_FILE=/var/opt/mssql/certs/chapa-ca.crt; exec /opt/mssql-tools18/bin/sqlcmd -S chapa-db -U sa -N -l 10 -b -r 1' <<'SQL'
ALTER DATABASE [JETTA_CHAPA_RESTORE_PROOF_20261104] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE [JETTA_CHAPA_RESTORE_PROOF_20261104];
GO
SQL
