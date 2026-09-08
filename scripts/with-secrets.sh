#!/usr/bin/env bash
# Запускает команду с секретами из хранилища ДЗ #11 (Infisical) в окружении.
# Использование: bash scripts/with-secrets.sh <env-slug> <команда...>
#   bash scripts/with-secrets.sh dev npm run migrate
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_SLUG="${1:-dev}"; shift || true
[ "$#" -gt 0 ] || set -- npm run start

# грейдер не має доступу до сховища: значення вже в оточенні
if [ "${SKIP_VAULT:-0}" = "1" ]; then exec "$@"; fi

CREDS="$ROOT/secrets/infisical.env"

if [ ! -f "$CREDS" ]; then
  echo "Не найден $CREDS — файл с креденшелами хранилища лежит вне git." >&2
  echo "Либо создай его из secrets/infisical.env.example, либо запусти с SKIP_VAULT=1," >&2
  echo "предварительно выставив DB_* вручную (см. README, раздел Grading)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$CREDS"
set +a

exec infisical run \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$ENV_SLUG" \
  --path "${INFISICAL_SECRET_PATH:-/}" \
  -- "$@"
