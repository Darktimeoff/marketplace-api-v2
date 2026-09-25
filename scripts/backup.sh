#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DBHOST="${DBHOST:-localhost}"
DBPORT="${DBPORT:-5500}"
DBNAME="${DBNAME:-api}"
DBUSER="${DBUSER:-root}"

if [ -z "${PGPASSWORD:-}" ]; then
  if [ -f "$ROOT/secrets/db_password.txt" ]; then
    PGPASSWORD="$(cat "$ROOT/secrets/db_password.txt")"
  else
    echo "PGPASSWORD не задано і немає $ROOT/secrets/db_password.txt" >&2
    exit 1
  fi
fi
export PGPASSWORD

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"

CHECK_TABLE="${CHECK_TABLE:-ProductOffer}"
CHECK_COLUMN="${CHECK_COLUMN:-price}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP_FILE="$BACKUP_DIR/${DBNAME}-${STAMP}.dump"
CHECK_FILE="$DUMP_FILE.check"

pg_dump -Fc -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -d "$DBNAME" -f "$DUMP_FILE"

psql -h "$DBHOST" -p "$DBPORT" -U "$DBUSER" -d "$DBNAME" -Atc \
  "SELECT count(*), coalesce(sum(\"$CHECK_COLUMN\"), 0) FROM \"$CHECK_TABLE\"" \
  > "$CHECK_FILE"

echo "Backup: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo "Check baseline ($CHECK_TABLE): $(cat "$CHECK_FILE")"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  aws s3 cp "$DUMP_FILE" "s3://${BACKUP_S3_BUCKET}/$(basename "$DUMP_FILE")"
  aws s3 cp "$CHECK_FILE" "s3://${BACKUP_S3_BUCKET}/$(basename "$CHECK_FILE")"
  echo "Uploaded to s3://${BACKUP_S3_BUCKET}/$(basename "$DUMP_FILE")"
fi
