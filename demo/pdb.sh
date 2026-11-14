#!/usr/bin/env bash
# TODO(hw-28): remove after homework
set -euo pipefail

NAMESPACE="${NAMESPACE:-marketplace}"
DEPLOYMENT="${DEPLOYMENT:-marketplace-api}"
PDB="${PDB:-marketplace-api}"

WORK="$(mktemp -d)"
PROXY_PID=""
cleanup() {
  [ -n "$PROXY_PID" ] && kill "$PROXY_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

kube() {
  kubectl -n "$NAMESPACE" "$@"
}

pdb_field() {
  kube get pdb "$PDB" -o jsonpath="{.status.$1}"
}

settled() {
  local replicas
  replicas="$(kube get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}')"
  [ "$(kube get pods -l app="$DEPLOYMENT" --no-headers | wc -l)" = "$replicas" ] \
    && [ "$(kube get deploy "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}')" = "$replicas" ] \
    && [ "$(pdb_field disruptionsAllowed)" -ge 1 ]
}

wait_settled() {
  local deadline=$((SECONDS + 180))
  until settled; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "# deployment did not settle in 180 s" >&2; exit 1; }
    sleep 0.2
  done
}

evict() {
  local pod="$1"
  printf '{"apiVersion":"policy/v1","kind":"Eviction","metadata":{"name":"%s","namespace":"%s"}}' "$pod" "$NAMESPACE" >"$WORK/eviction.json"
  curl -s -o "$WORK/$pod.json" -w '%{http_code}' -H 'content-type: application/json' \
    --data @"$WORK/eviction.json" "$API/api/v1/namespaces/$NAMESPACE/pods/$pod/eviction"
}

kube get pdb "$PDB" >/dev/null 2>&1 || { echo "# PodDisruptionBudget $PDB not found: run npm run up" >&2; exit 1; }
wait_settled

kubectl proxy --port=0 >"$WORK/proxy.log" 2>&1 &
PROXY_PID=$!
until grep -q 'Starting to serve' "$WORK/proxy.log"; do sleep 0.1; done
API="http://$(grep -oE '127\.0\.0\.1:[0-9]+' "$WORK/proxy.log")"

healthy="$(pdb_field currentHealthy)"
min_available="$(pdb_field desiredHealthy)"
allowed="$(pdb_field disruptionsAllowed)"
mapfile -t pods < <(kube get pods -l app="$DEPLOYMENT" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')

started=$EPOCHREALTIME
evict_1="$(evict "${pods[0]}")"
evict_2="$(evict "${pods[1]}")"
reason_2="$(node -e 'const r = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); console.log(r.message ?? r.status ?? "-")' "$WORK/${pods[1]}.json" 2>/dev/null || echo -)"
allowed_after="$(pdb_field disruptionsAllowed)"

wait_settled
recovered=$EPOCHREALTIME

echo "# pdb=$PDB maxUnavailable=$(kube get pdb "$PDB" -o jsonpath='{.spec.maxUnavailable}') pods=${#pods[@]} disruptionsAllowed=$allowed"
echo "healthy=$healthy"
echo "minAvailable=$min_available"
echo "evict-1=$evict_1"
echo "evict-2=$evict_2"
echo "# evict-1 pod=${pods[0]}, evict-2 pod=${pods[1]}: $reason_2"
echo "# disruptionsAllowed right after evict-1: $allowed_after"
echo "# back to $(pdb_field currentHealthy) healthy pods and disruptionsAllowed=$(pdb_field disruptionsAllowed) after $(LC_ALL=C awk -v a="$started" -v b="$recovered" 'BEGIN { printf "%.1f", b - a }') s"

broken=()
[ "$evict_1" = 201 ] || broken+=("evict-1=$evict_1")
[ "$evict_2" = 429 ] || broken+=("evict-2=$evict_2")

if [ "${#broken[@]}" -gt 0 ]; then
  echo "# invariant broken: ${broken[*]}"
  exit 1
fi
