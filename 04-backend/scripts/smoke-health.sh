#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq is required for ArchIToken smoke scripts. Install jq and retry.\n' >&2
    exit 1
  fi
}

need_jq

health="$(curl -fsS "${BASE_URL}/healthz")"
ready="$(curl -fsS "${BASE_URL}/readyz")"
capabilities="$(curl -fsS "${BASE_URL}/v1/runtime/capabilities")"

test "${health}" = "ok"
test "${ready}" = "ready"
printf '%s\n' "${capabilities}" | jq -e '.localImplementationMode == "in_memory_preview"' >/dev/null
printf 'health smoke passed for %s\n' "${BASE_URL}"
