#!/usr/bin/env bash
set -euo pipefail
root=/opt/jetta-chapa
if ! cryptsetup status jetta-chapa-data >/dev/null 2>&1; then
 cryptsetup open --key-file /etc/jetta-chapa/volume.key "$root/encrypted-data.luks" jetta-chapa-data
fi
if ! mountpoint -q "$root/data"; then
 mount -o nodev,nosuid,noexec /dev/mapper/jetta-chapa-data "$root/data"
fi
test "$(findmnt -n -o SOURCE "$root/data")" = /dev/mapper/jetta-chapa-data
