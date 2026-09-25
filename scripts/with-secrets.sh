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

if [ -f "$ROOT/.env" ]; then
  while IFS='=' read -r key value; do
    case "$key" in ''|\#*) continue ;; esac
    [ -n "${!key-}" ] || export "$key=$value"
  done < "$ROOT/.env"
fi

CLIENT_SECRET_FILE="$ROOT/secrets/infisical_client_secret.txt"

if [ ! -f "$CLIENT_SECRET_FILE" ]; then
  echo "Не найден $CLIENT_SECRET_FILE — секрет клиента хранилища лежит вне git." >&2
  echo "Либо создай его из secrets/infisical_client_secret.txt.example, либо запусти с SKIP_VAULT=1," >&2
  echo "предварительно выставив DB-переменные вручную (см. README, раздел Grading)." >&2
  exit 1
fi

# Тот же клиент universal-auth (CLIENT_ID + secret-файл), которым в приложении
# пользуется SecretManagerService — отдельного service-токена для CLI не заводим.
DOMAIN="${INFISICAL_DOMAIN:-$INFISICAL_SITE_URL/api}"

TOKEN="$(infisical login --method universal-auth \
  --client-id "$INFISICAL_CLIENT_ID" \
  --client-secret "$(cat "$CLIENT_SECRET_FILE")" \
  --domain "$DOMAIN" \
  --plain)"

exec infisical run \
  --domain "$DOMAIN" \
  --token "$TOKEN" \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$ENV_SLUG" \
  --path "${INFISICAL_SECRET_PATH:-/}" \
  -- "$@"
