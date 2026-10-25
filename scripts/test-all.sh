#!/usr/bin/env bash
set -uo pipefail

run_suite() {
  local name="$1"
  shift
  "$@" 2>&1 | sed -u "s/^/[$name] /"
}

run_suite unit npx vitest run &
unit=$!
run_suite integration npx vitest run --config ./vitest.config.integration.ts &
integration=$!
run_suite e2e npx vitest run --config ./vitest.config.e2e.ts &
e2e=$!

status=0
for suite in "unit:$unit" "integration:$integration" "e2e:$e2e"; do
  if ! wait "${suite#*:}"; then
    echo "[${suite%%:*}] failed" >&2
    status=1
  fi
done

exit "$status"
