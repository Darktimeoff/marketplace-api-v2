#!/usr/bin/env bash
set -uo pipefail

IMAGE="${SCAN_IMAGE:-marketplace-api:hw28}"
SEVERITY="${SCAN_SEVERITY:-CRITICAL,HIGH}"
IGNORE_UNFIXED="${SCAN_IGNORE_UNFIXED:-true}"
TRIVY_VERSION="${TRIVY_VERSION:-0.76.1}"
MAX="${SCAN_MAX:-}"

[[ "$MAX" =~ ^-?[0-9]+$ ]] || { echo "# SCAN_MAX must be an integer, got '${MAX}'" >&2; exit 2; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ARGS=(image --quiet --format json --severity "$SEVERITY" --exit-code 0)
[ "$IGNORE_UNFIXED" = "true" ] && ARGS+=(--ignore-unfixed)

if command -v trivy >/dev/null 2>&1; then
  trivy "${ARGS[@]}" --output "$WORK/report.json" "$IMAGE"
else
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v trivy-cache:/root/.cache/trivy \
    -v "$WORK:/report" \
    "aquasec/trivy:$TRIVY_VERSION" "${ARGS[@]}" --output /report/report.json "$IMAGE"
fi
SCANNER_EXIT=$?

if [ "$SCANNER_EXIT" -ne 0 ] || ! jq -e '.ArtifactName and (.Results | type == "array")' "$WORK/report.json" >/dev/null 2>&1; then
  echo "# no report: scanner exit=$SCANNER_EXIT, nothing to compare with the threshold" >&2
  exit 2
fi

FOUND="$(jq '[.Results[].Vulnerabilities // [] | .[]] | length' "$WORK/report.json")"

echo "image=$IMAGE"
echo "severity=$SEVERITY"
echo "ignore-unfixed=$IGNORE_UNFIXED"
echo "found=$FOUND"
echo "max-allowed=$MAX"
jq -r '[.Results[].Vulnerabilities // [] | .[] | .Severity] | group_by(.) | map("# \(.[0])=\(length)") | .[]' "$WORK/report.json"
jq -r '.Results[] | select((.Vulnerabilities // []) | length > 0) | "# \(.Vulnerabilities | length) in \(.Target)"' "$WORK/report.json"

if [ "$FOUND" -le "$MAX" ]; then
  echo "gate=pass"
  exit 0
fi

echo "gate=fail"
exit 1
