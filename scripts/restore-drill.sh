#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DBNAME="${DBNAME:-api}"
DBUSER="${DBUSER:-root}"
CHECK_TABLE="${CHECK_TABLE:-ProductOffer}"
CHECK_COLUMN="${CHECK_COLUMN:-price}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DRILL_IMAGE="${DRILL_IMAGE:-postgres:18}"

if [ -z "${PGPASSWORD:-}" ]; then
  if [ -f "$ROOT/secrets/db_password.txt" ]; then
    PGPASSWORD="$(cat "$ROOT/secrets/db_password.txt")"
  else
    echo "PGPASSWORD не задано і немає $ROOT/secrets/db_password.txt" >&2
    exit 1
  fi
fi

DUMP_FILE="$(/bin/ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
if [ -z "$DUMP_FILE" ]; then
  echo "У $BACKUP_DIR немає жодного .dump — спершу запусти scripts/backup.sh" >&2
  exit 1
fi

CHECK_FILE="$DUMP_FILE.check"
if [ ! -f "$CHECK_FILE" ]; then
  echo "Немає $CHECK_FILE — цей дамп зроблено не через scripts/backup.sh" >&2
  exit 1
fi

BASELINE="$(tr -d '[:space:]' < "$CHECK_FILE")"
DUMP_SIZE="$(du -h "$DUMP_FILE" | cut -f1)"

DRILL_CONTAINER="restore-drill-$$"
cleanup() { docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Dump: $DUMP_FILE ($DUMP_SIZE)"
echo "Baseline ($CHECK_TABLE): $BASELINE"

docker run -d --name "$DRILL_CONTAINER" \
  -e POSTGRES_DB="$DBNAME" \
  -e POSTGRES_USER="$DBUSER" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" \
  "$DRILL_IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$DRILL_CONTAINER" pg_isready -U "$DBUSER" -d "$DBNAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$DRILL_CONTAINER" pg_isready -U "$DBUSER" -d "$DBNAME" >/dev/null

docker cp "$DUMP_FILE" "$DRILL_CONTAINER:/tmp/restore.dump"

START_MS="$(date +%s%3N)"
docker exec -e PGPASSWORD="$PGPASSWORD" "$DRILL_CONTAINER" \
  pg_restore -U "$DBUSER" -d "$DBNAME" /tmp/restore.dump
END_MS="$(date +%s%3N)"
RESTORE_MS=$((END_MS - START_MS))

RESTORED="$(docker exec -e PGPASSWORD="$PGPASSWORD" "$DRILL_CONTAINER" \
  psql -U "$DBUSER" -d "$DBNAME" -Atc \
  "SELECT count(*), coalesce(sum(\"$CHECK_COLUMN\"), 0) FROM \"$CHECK_TABLE\"" | tr -d '[:space:]')"

echo "Restored ($CHECK_TABLE): $RESTORED"
echo "Restore time: ${RESTORE_MS}ms"

if [ "$BASELINE" = "$RESTORED" ]; then
  echo "MATCH"
  exit 0
else
  echo "MISMATCH: baseline=$BASELINE restored=$RESTORED" >&2
  exit 1
fi
