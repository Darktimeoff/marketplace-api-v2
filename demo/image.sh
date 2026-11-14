#!/usr/bin/env bash
# TODO(hw-28): remove after homework
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-marketplace-api:hw28}"
DOCKERFILE="${DOCKERFILE:-$ROOT/docker/Dockerfile}"
TOKEN_FILE="${TOKEN_FILE:-$ROOT/.npm_token}"

[ -s "$TOKEN_FILE" ] || { echo "# no token in $TOKEN_FILE: nothing to look for" >&2; exit 1; }
TOKEN="$(cat "$TOKEN_FILE")"
[ "${#TOKEN}" -ge 8 ] || { echo "# token shorter than 8 characters would match by chance" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "# image $IMAGE not found: run npm run image:build" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

count_stages() {
  grep -ciE '^[[:space:]]*FROM[[:space:]]' "$DOCKERFILE" || true
}

shell_inside() {
  local shell
  for shell in sh /bin/sh /bin/bash /busybox/sh; do
    if docker run --rm --network none --entrypoint "$shell" "$IMAGE" -c 'exit 0' >/dev/null 2>&1; then
      echo 1
      return
    fi
  done
  echo 0
}

runtime_uid() {
  local user name container
  user="$(docker image inspect -f '{{.Config.User}}' "$IMAGE")"
  name="${user%%:*}"
  if [ -z "$name" ]; then
    echo 0
  elif [[ "$name" =~ ^[0-9]+$ ]]; then
    echo "$name"
  else
    container="$(docker create "$IMAGE")"
    docker cp "$container:/etc/passwd" - | tar -xO | awk -F: -v n="$name" '$1 == n { print $3 }'
    docker rm "$container" >/dev/null
  fi
}

token_in_history() {
  docker history --no-trunc --format '{{.CreatedBy}}' "$IMAGE" | grep -cF -- "$TOKEN" || true
}

token_in_config() {
  docker image inspect "$IMAGE" | grep -cF -- "$TOKEN" || true
}

layer_stream() {
  local magic
  magic="$(head -c 4 "$1" | od -An -tx1 | tr -d ' \n')"
  case "$magic" in
    1f8b*) gzip -dc "$1" ;;
    28b52ffd) zstd -dc "$1" ;;
    *) cat "$1" ;;
  esac
}

token_in_layers() {
  local found=0 layer
  docker save "$IMAGE" -o "$WORK/image.tar"
  mkdir "$WORK/image"
  tar -xf "$WORK/image.tar" -C "$WORK/image"
  while IFS= read -r layer; do
    if layer_stream "$WORK/image/$layer" | grep -aqF -- "$TOKEN"; then
      found=$((found + 1))
    fi
  done < <(node -e 'for (const m of require(process.argv[1])) for (const l of m.Layers) console.log(l)' "$WORK/image/manifest.json")
  echo "$found"
}

stages="$(count_stages)"
shell="$(shell_inside)"
uid="$(runtime_uid)"
history="$(token_in_history)"
config="$(token_in_config)"
layers="$(token_in_layers)"

echo "# image=$IMAGE dockerfile=${DOCKERFILE#"$ROOT/"}"
echo "stages=$stages"
echo "shell-inside=$shell"
echo "runtime-uid=$uid"
echo "token-in-history=$history"
echo "token-in-config=$config"
echo "token-in-layers=$layers"

broken=()
[ "$stages" -ge 2 ] || broken+=("stages=$stages")
[ "$shell" -eq 0 ] || broken+=("shell-inside=$shell")
[ -n "$uid" ] && [ "$uid" -ne 0 ] || broken+=("runtime-uid=${uid:-empty}")
[ "$history" -eq 0 ] || broken+=("token-in-history=$history")
[ "$config" -eq 0 ] || broken+=("token-in-config=$config")
[ "$layers" -eq 0 ] || broken+=("token-in-layers=$layers")

if [ "${#broken[@]}" -gt 0 ]; then
  echo "# invariant broken: ${broken[*]}"
  exit 1
fi
