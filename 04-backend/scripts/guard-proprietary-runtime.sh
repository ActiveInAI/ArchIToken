#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

runtime_pattern='RealBIMWeb[.]wasm|assets[.]bin|assets1[.]bin|BlackHole3D|BlackHole SDK|OptRapid3dLoader|proprietary DWG SDK|glendale[.]top'

runtime_hits="$(
  rg -n "${runtime_pattern}" \
    04-backend 03-frontend 03-frontend-vite 06-workers config infra tools \
    --glob '!04-backend/scripts/guard-proprietary-runtime.sh' \
    --glob '!04-backend/scripts/smoke-phase8-production-readiness.sh' \
    || true
)"

if [[ -n "${runtime_hits}" ]]; then
  printf 'proprietary runtime guard failed; prohibited core/runtime references found:\n%s\n' "${runtime_hits}" >&2
  exit 1
fi

doc_hits="$(rg -l "${runtime_pattern}" docs || true)"
if [[ -n "${doc_hits}" ]]; then
  while IFS= read -r doc; do
    [[ -z "${doc}" ]] && continue
    if ! rg -qi 'legal|boundary|prohibit|forbid|do not|must not|禁止|不得' "${doc}"; then
      printf 'proprietary documentation mention lacks explicit legal/boundary wording: %s\n' "${doc}" >&2
      exit 1
    fi
  done <<< "${doc_hits}"
fi

printf 'proprietary runtime guard passed\n'
