#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK="${PULUMI_STACK:-dev}"
COMMAND="${1:?usage: vault-trust.sh preview|up|destroy [pulumi flags...]}"; shift

command -v pulumi >/dev/null 2>&1 || { echo "pulumi CLI not found: see README, section Kubernetes" >&2; exit 1; }

export PULUMI_BACKEND_URL="${PULUMI_BACKEND_URL:-file://$ROOT/infra/.pulumi-state}"
export PULUMI_SKIP_UPDATE_CHECK=1
export PULUMI_DIY_BACKEND_NO_LEGACY_WARNING=1

if [[ "$PULUMI_BACKEND_URL" == file://* ]]; then
  mkdir -p "${PULUMI_BACKEND_URL#file://}"
fi

[ -n "${PULUMI_CONFIG_PASSPHRASE:-}" ] || { echo "Missing from the vault: PULUMI_CONFIG_PASSPHRASE" >&2; exit 1; }

cd "$ROOT/infra/vault-trust"
[ -d sdks/infisical/bin ] && [ -d node_modules ] || pulumi install

pulumi stack select --create "$STACK" --non-interactive >/dev/null

case "$COMMAND" in
  preview) exec pulumi preview --non-interactive --refresh --diff "$@" ;;
  up) exec pulumi up --non-interactive --yes --skip-preview --refresh "$@" ;;
  destroy) exec pulumi destroy --non-interactive --yes --refresh "$@" ;;
  *) echo "unknown command: $COMMAND" >&2; exit 2 ;;
esac
