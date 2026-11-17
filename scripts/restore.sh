#!/usr/bin/env sh
set -eu
umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: RESTORE_CONFIRM=RESTORE ./scripts/restore.sh /path/to/killbyte-backup.dump}"
[ "${RESTORE_CONFIRM:-}" = "RESTORE" ] || { printf 'Set RESTORE_CONFIRM=RESTORE to acknowledge destructive restoration.\n' >&2; exit 2; }
[ -f "$1" ] || { printf 'Backup file not found: %s\n' "$1" >&2; exit 2; }
if [ -f "$1.sha256" ]; then sha256sum -c "$1.sha256"; fi

printf 'Restoring %s into the configured database. Existing objects may be replaced.\n' "$1"
pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --dbname="$DATABASE_URL" "$1"
printf 'Restore completed. Run prisma migrate deploy before starting application services.\n'
