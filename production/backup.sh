#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/jetta-chapa
mountpoint -q "$root/data"
test "$(findmnt -n -o SOURCE "$root/data")" = /dev/mapper/jetta-chapa-data
test "$(df -B1 --output=avail "$root" | tail -1)" -gt 17179869184
test "$(df -B1 --output=avail "$root/data" | tail -1)" -gt 12884901888
exec 9>"$root/backup.lock"
flock -n 9 || exit 0
name="chapa-$(date -u +%Y%m%dT%H%M%SZ).bak"
# sqlcmd consumes every SQL informational result until backup completion.
docker exec -i chapa-db bash -c 'export SQLCMDPASSWORD="$(cat /run/secrets/sql-sa-password)" SSL_CERT_FILE=/var/opt/mssql/certs/chapa-ca.crt; exec /opt/mssql-tools18/bin/sqlcmd -S chapa-db -U sa -N -l 10 -b -r 1' <<SQL
BACKUP DATABASE [JETTA_CONTROL_PILOTO_LOCAL] TO DISK=N'/var/opt/mssql/backups/$name' WITH COPY_ONLY,INIT,CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/backups/$name' WITH CHECKSUM;
GO
SQL
raw="$root/data/mssql/backups/$name"
output="$root/backups/$name.cms"
openssl cms -encrypt -aes-256-gcm -binary -outform DER -in "$raw" -out "$output.tmp" "$root/backup-recipient.crt"
test -s "$output.tmp"
mv "$output.tmp" "$output"
chmod 600 "$output"
rm -- "$raw"
python3 "$root/prune-backups.py"
printf 'BACKUP_ENCRYPTED %s\n' "$output"
