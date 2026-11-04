#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/jetta-chapa
mountpoint -q "$root/data"
test "$(findmnt -n -o SOURCE "$root/data")" = /dev/mapper/jetta-chapa-data
chmod 400 /etc/jetta-chapa/volume.key
chmod 700 "$root/unlock-storage.sh"
chown 1000:1000 "$root/data/runtime/runtime.json"
chown 10001:0 "$root/data/mssql-sa-password" "$root/data/mssql/certs/sql-server.crt" "$root/data/mssql/certs/sql-server.key"
chmod 400 "$root/data/runtime/runtime.json" "$root/data/mssql-sa-password" "$root/data/mssql/certs/sql-server.key"
cat > "$root/data/mssql/mssql.conf" <<'EOF'
[network]
tlscert = /var/opt/mssql/certs/sql-server.crt
tlskey = /var/opt/mssql/certs/sql-server.key
tlsprotocols = 1.2
forceencryption = 1
[memory]
memorylimitmb = 1536
EOF
chown 10001:0 "$root/data/mssql/mssql.conf"
chmod 600 "$root/data/mssql/mssql.conf"
install -d -m 700 "$root/release"
tar -xzf "$root/release.tar.gz" -C "$root/release"
cd "$root"
docker compose up -d db
docker build --tag jetta-chapa:verified --file release/production/Dockerfile release
