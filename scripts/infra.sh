#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK="${PULUMI_STACK:-dev}"
COMMAND="${1:?usage: infra.sh preview|up|destroy [pulumi flags...]}"; shift

command -v pulumi >/dev/null 2>&1 || { echo "pulumi CLI not found: see README, section Kubernetes" >&2; exit 1; }

export PULUMI_BACKEND_URL="${PULUMI_BACKEND_URL:-file://$ROOT/infra/.pulumi-state}"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/kind-marketplace}"
export PULUMI_SKIP_UPDATE_CHECK=1
export PULUMI_DIY_BACKEND_NO_LEGACY_WARNING=1

if [[ "$PULUMI_BACKEND_URL" == file://* ]]; then
  mkdir -p "${PULUMI_BACKEND_URL#file://}"
fi

cd "$ROOT/infra"
[ -d node_modules ] || npm ci --no-audit --no-fund

if [ "$COMMAND" != "destroy" ]; then
  source "$ROOT/scripts/lib/image.sh"
  IMAGE="${IMAGE:-marketplace-api:hw28}"
  NODE="${KIND_CLUSTER:-marketplace}-control-plane"
  docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "image $IMAGE not found: run npm run image:build" >&2; exit 1; }
  IMAGE_REF="$(image_ref "$IMAGE")"
  export IMAGE_REF
  docker exec "$NODE" crictl inspecti "docker.io/library/$IMAGE_REF" >/dev/null 2>&1 || { echo "image $IMAGE_REF is not in the cluster: run npm run cluster:up" >&2; exit 1; }

  ipv4_subnet() { docker network inspect "$1" --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -m1 -E '^[0-9.]+/[0-9]+$'; }
  DB_CONTAINER="$(docker compose -f "$ROOT/docker-compose.yml" ps -q db 2>/dev/null | head -1)"
  COMPOSE_NETWORK="${COMPOSE_NETWORK:-$(docker inspect -f '{{range $name, $network := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$DB_CONTAINER" 2>/dev/null | head -1)}"
  export DEPENDENCIES_CIDR="${DEPENDENCIES_CIDR:-$(ipv4_subnet "$COMPOSE_NETWORK")}"
  export OBSERVABILITY_CIDR="${OBSERVABILITY_CIDR:-$(ipv4_subnet "${OBSERVABILITY_NETWORK:-marketplace-observability_default}")}"
  export API_SERVER_CIDR="${API_SERVER_CIDR:-$(docker inspect -f '{{(index .NetworkSettings.Networks "kind").IPAddress}}' "$NODE")/32}"
  echo "network policies: dependencies $DEPENDENCIES_CIDR, observability $OBSERVABILITY_CIDR, api server $API_SERVER_CIDR"
fi

[ -n "${PULUMI_CONFIG_PASSPHRASE:-}" ] || { echo "Missing from the vault: PULUMI_CONFIG_PASSPHRASE" >&2; exit 1; }

pulumi stack select --create "$STACK" --non-interactive >/dev/null

case "$COMMAND" in
  preview) exec pulumi preview --non-interactive --refresh --diff "$@" ;;
  up) exec pulumi up --non-interactive --yes --skip-preview --refresh "$@" ;;
  destroy) exec pulumi destroy --non-interactive --yes --refresh "$@" ;;
  *) echo "unknown command: $COMMAND" >&2; exit 2 ;;
esac
