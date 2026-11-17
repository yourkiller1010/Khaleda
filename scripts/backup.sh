#!/usr/bin/env sh
set -eu
umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR=${BACKUP_DIR:-./backups}
RETENTION_DAYS=${RETENTION_DAYS:-14}
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DESTINATION="$BACKUP_DIR/killbyte-$TIMESTAMP.dump"
TEMPORARY="$DESTINATION.tmp"
trap 'rm -f "$TEMPORARY"' EXIT INT TERM

pg_dump --format=custom --no-owner --no-acl --file="$TEMPORARY" "$DATABASE_URL"
mv "$TEMPORARY" "$DESTINATION"
sha256sum "$DESTINATION" > "$DESTINATION.sha256"
find "$BACKUP_DIR" -type f -name 'killbyte-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'killbyte-*.dump.sha256' -mtime "+$RETENTION_DAYS" -delete
printf 'Backup created: %s\n' "$DESTINATION"
