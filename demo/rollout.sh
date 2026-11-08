#!/usr/bin/env bash
# TODO(hw-28): remove after homework
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${1:-${PROFILE:-safe}}"
NAMESPACE="${NAMESPACE:-marketplace}"
DEPLOYMENT="${DEPLOYMENT:-marketplace-api}"
BASE_URL="${BASE_URL:-http://localhost:30080}"
MIN_REQUESTS="${LOAD_MIN_REQUESTS:-5000}"

SAFE=(-c drainMs=5000 -c readiness=true -c maxUnavailable=0 -c maxSurge=1)
BROKEN=(-c drainMs=0 -c readiness=false -c maxUnavailable=1 -c maxSurge=0)

case "$PROFILE" in
  safe) SETTINGS=("${SAFE[@]}") ;;
  broken) SETTINGS=("${BROKEN[@]}") ;;
  *) echo "# unknown profile '$PROFILE': safe or broken" >&2; exit 2 ;;
esac

WORK="$(mktemp -d)"
LOAD_PID=""
cleanup() {
  [ -n "$LOAD_PID" ] && kill "$LOAD_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

kube() {
  kubectl -n "$NAMESPACE" "$@"
}

deploy() {
  local log="$WORK/up-$1.log"
  shift
  if ! npm run --silent up -- "$@" >"$log" 2>&1; then
    tail -20 "$log" >&2
    echo "# npm run up failed" >&2
    exit 1
  fi
}

settled() {
  local replicas
  replicas="$(kube get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}')"
  [ "$(kube get rs -l app="$DEPLOYMENT" --no-headers | awk '$2 > 0' | wc -l)" = 1 ] \
    && [ "$(kube get pods -l app="$DEPLOYMENT" --no-headers | wc -l)" = "$replicas" ] \
    && [ "$(kube get deploy "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}')" = "$replicas" ]
}

wait_settled() {
  local deadline=$((SECONDS + 300))
  until settled; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "# rollout did not settle in 300 s" >&2; exit 1; }
    sleep 0.2
  done
}

product_url() {
  local db_user db_name id
  db_user="$(grep -E '^DBUSER=' "$ROOT/.env" | cut -d= -f2-)"
  db_name="$(grep -E '^DBNAME=' "$ROOT/.env" | cut -d= -f2-)"
  id="$(docker compose -f "$ROOT/docker-compose.yml" exec -T db psql -U "$db_user" -d "$db_name" -tAc 'SELECT "publicId" FROM "Product" ORDER BY id LIMIT 1')"
  [ -n "$id" ] || { echo "# no product in the database: run npm run seed" >&2; exit 1; }
  echo "$BASE_URL/product/$id"
}

URL="${LOAD_URL:-$(product_url)}"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ] || { echo "# $URL does not answer 200: run npm run up first" >&2; exit 1; }

echo "# preparing: pods with the $PROFILE settings ${SETTINGS[*]}"
deploy prepare "${SETTINGS[@]}"
wait_settled

REV="$(date +%s)"
LOAD_URL="$URL" LOAD_STOP_FILE="$WORK/stop" LOAD_MIN_REQUESTS="$MIN_REQUESTS" \
  node "$ROOT/demo/rollout/load.mjs" >"$WORK/load.json" &
LOAD_PID=$!
sleep 3

echo "# rolling out rev=$REV under load on $URL"
started=$EPOCHREALTIME
deploy rollout "${SETTINGS[@]}" -c rev="$REV"
wait_settled
finished=$EPOCHREALTIME

sleep 3
touch "$WORK/stop"
wait "$LOAD_PID"
LOAD_PID=""

if [ "$PROFILE" = broken ]; then
  echo "# restoring the safe settings"
  deploy restore "${SAFE[@]}"
  wait_settled
fi

read -r requests ok failed reasons < <(node -e '
const r = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
console.log(r.requests, r.ok, r.failed, Object.entries(r.reasons).map(([k, v]) => `${k.replaceAll(" ", "_")}:${v}`).join(",") || "-");
' "$WORK/load.json")

echo "profile=$PROFILE"
echo "requests=$requests"
echo "ok=$ok"
echo "failed=$failed"
echo "rollout-seconds=$(LC_ALL=C awk -v a="$started" -v b="$finished" 'BEGIN { printf "%.1f", b - a }')"
echo "# failures by reason: $reasons"
echo "# deployment now: $(kube get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}'), image $(kube get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"

broken=()
[ "$requests" -ge "$MIN_REQUESTS" ] || broken+=("requests=$requests < $MIN_REQUESTS")
[ "$PROFILE" != safe ] || [ "$failed" -eq 0 ] || broken+=("failed=$failed in the safe profile")

if [ "${#broken[@]}" -gt 0 ]; then
  echo "# invariant broken: ${broken[*]}"
  exit 1
fi
