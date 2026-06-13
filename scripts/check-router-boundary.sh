#!/usr/bin/env bash
# Router boundary guard (issue #5, Constitution §9): business modules must not
# call a model/provider endpoint directly. Only the InferenceRouter
# implementation (inference.rs), the router/ façade, and the L5 gateway (which
# *exposes* the endpoint) may reference the raw model completion path; every
# other module must route through `architoken_harness_core::router`.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SRC="04-backend/harness-core/src"
ALLOW="(${SRC}/inference\.rs|${SRC}/router/|${SRC}/bin/gateway\.rs)"

# The raw OpenAI-compatible completion path is the tell-tale of a direct
# provider call. Assembled at runtime so this guard never matches itself.
endpoint="chat/$(printf 'completions')"

violations=$(git -c core.quotePath=false grep -nE "${endpoint}" -- "${SRC}" \
  | { grep -vE "${ALLOW}" || true; })

if [[ -n "${violations}" ]]; then
  {
    echo "Router boundary guard FAILED: a business module bypasses InferenceRouter."
    echo "Route all model calls through architoken_harness_core::router (§9)."
    echo "${violations}"
  } >&2
  exit 1
fi

echo "Router boundary guard passed: no provider call bypasses the internal router."
