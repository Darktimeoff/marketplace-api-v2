#!/usr/bin/env bash
# TODO(hw-28): remove after homework
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT="$(mktemp -d)"
trap 'rm -rf "$CONTEXT"; docker image rm -f marketplace-leaky:arg marketplace-leaky:copy-rm >/dev/null 2>&1' EXIT

cp "$ROOT/.npm_token" "$CONTEXT/.npm_token"

DOCKER_BUILDKIT=1 docker build -q -f "$ROOT/demo/leaky/arg.Dockerfile" --build-arg NPM_TOKEN="$(cat "$ROOT/.npm_token")" -t marketplace-leaky:arg "$CONTEXT" >/dev/null
DOCKER_BUILDKIT=1 docker build -q -f "$ROOT/demo/leaky/copy-rm.Dockerfile" -t marketplace-leaky:copy-rm "$CONTEXT" >/dev/null

for variant in arg copy-rm; do
  echo "## $variant"
  IMAGE="marketplace-leaky:$variant" DOCKERFILE="$ROOT/demo/leaky/$variant.Dockerfile" bash "$ROOT/demo/image.sh"
  echo "# exit=$?"
done
