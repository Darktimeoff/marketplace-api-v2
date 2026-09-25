#!/usr/bin/env bash
# See scripts/pact-publish.sh for why PACT_BROKER_TOKEN must be unset before
# invoking the pact-broker CLI.
set -euo pipefail

TOKEN="${PACT_BROKER_TOKEN:-}"
unset PACT_BROKER_TOKEN

SHA="$(git rev-parse HEAD)"

pact-broker can-i-deploy \
  --pacticipant marketplace-web --version="$SHA" \
  --pacticipant marketplace-api --version="$SHA" \
  --broker-base-url="${PACT_BROKER_URL:-http://127.0.0.1:9292}" \
  --broker-username=ci \
  --broker-password="$TOKEN"
