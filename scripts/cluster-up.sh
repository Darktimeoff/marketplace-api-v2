#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-marketplace}"
IMAGE="${IMAGE:-marketplace-api:hw28}"
COMPOSE_NETWORK="${COMPOSE_NETWORK:-marketplace-api-v2_default}"
NODE="$CLUSTER-control-plane"

docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "image $IMAGE not found: run npm run image:build" >&2; exit 1; }
docker network inspect "$COMPOSE_NETWORK" >/dev/null 2>&1 || { echo "network $COMPOSE_NETWORK not found: start the dependencies with docker compose up first" >&2; exit 1; }

if kind get clusters | grep -qx "$CLUSTER"; then
  echo "cluster $CLUSTER exists"
else
  kind create cluster --config "$ROOT/k8s/kind-config.yaml" --name "$CLUSTER" --wait 120s
fi

if [ "$(docker inspect -f "{{index .NetworkSettings.Networks \"$COMPOSE_NETWORK\"}}" "$NODE")" = "<nil>" ]; then
  docker network connect "$COMPOSE_NETWORK" "$NODE"
fi
echo "node $NODE is on $COMPOSE_NETWORK"

kind load docker-image "$IMAGE" --name "$CLUSTER"
