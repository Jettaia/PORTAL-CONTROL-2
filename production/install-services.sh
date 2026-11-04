#!/usr/bin/env bash
set -euo pipefail
root=/opt/jetta-chapa
for unit in jetta-chapa-storage.service jetta-chapa.service jetta-chapa-backup.service jetta-chapa-backup.timer; do
 install -m 644 "$root/$unit" "/etc/systemd/system/$unit"
done
chmod 700 "$root/unlock-storage.sh" "$root/backup.sh"
chmod 600 "$root/prune-backups.py"
systemd-analyze verify "$root/jetta-chapa-storage.service" "$root/jetta-chapa.service" "$root/jetta-chapa-backup.service" "$root/jetta-chapa-backup.timer"
systemctl daemon-reload
systemctl enable jetta-chapa-storage.service jetta-chapa.service
systemctl start jetta-chapa.service
systemctl is-active jetta-chapa-storage.service jetta-chapa.service
