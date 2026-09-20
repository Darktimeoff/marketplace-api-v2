#!/usr/bin/env bash
# @pact-foundation/pact-cli's `pact-broker` binary auto-binds a `--broker-token`
# (bearer auth) flag to the *same* PACT_BROKER_TOKEN env var name we use for
# Basic Auth (see --broker-password below) — if both are present it sends
# conflicting auth headers and the OSS Pact Broker (Basic Auth only) rejects
# the request with 400. Unset it after capturing the value so only
# --broker-password is set.
set -euo pipefail

TOKEN="${PACT_BROKER_TOKEN:-}"
unset PACT_BROKER_TOKEN

pact-broker publish pacts \
  --consumer-app-version="$(git rev-parse HEAD)" \
  --broker-base-url="${PACT_BROKER_URL:-http://127.0.0.1:9292}" \
  --broker-username=ci \
  --broker-password="$TOKEN"
