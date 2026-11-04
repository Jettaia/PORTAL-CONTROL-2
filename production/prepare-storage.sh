#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/jetta-chapa
image=$root/encrypted-data.luks
key=/etc/jetta-chapa/volume.key
if test -e "$image"; then echo 'Existing Chapa storage: refusing initialization'; exit 1; fi
test -s "$key"
install -d -m 700 "$root" "$root/data" "$root/backups"
fallocate -l 24G "$image"
chmod 600 "$image"
cryptsetup luksFormat --type luks2 --cipher aes-xts-plain64 --key-size 512 --pbkdf argon2id --pbkdf-memory 65536 --batch-mode --key-file "$key" "$image"
cryptsetup open --key-file "$key" "$image" jetta-chapa-data
mkfs.ext4 -q -m 0 -L JETTA_CHAPA /dev/mapper/jetta-chapa-data
mount -o nodev,nosuid,noexec /dev/mapper/jetta-chapa-data "$root/data"
install -d -m 700 -o 10001 -g 0 "$root/data/mssql" "$root/data/mssql/certs" "$root/data/mssql/backups"
install -d -m 700 -o 1000 -g 1000 "$root/data/runtime"
install -d -m 700 "$root/data/bootstrap"
cryptsetup status jetta-chapa-data
findmnt -n -o SOURCE,FSTYPE,OPTIONS "$root/data"
