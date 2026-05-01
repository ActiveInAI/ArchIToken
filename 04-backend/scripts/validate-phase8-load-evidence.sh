#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

EVIDENCE_FILE="${1:-${ARCHITOKEN_LOAD_EVIDENCE:-}}"
TARGET_CONCURRENCY="${ARCHITOKEN_TARGET_CONCURRENCY:-100000}"
GIT_SHA="${ARCHITOKEN_CERT_GIT_SHA:-}"

if [[ -z "${EVIDENCE_FILE}" ]]; then
  printf 'usage: %s <load-evidence.json>\n' "$0" >&2
  printf 'verdict=blocked reason=missing_evidence_file\n' >&2
  exit 2
fi

if [[ ! -f "${EVIDENCE_FILE}" ]]; then
  printf 'verdict=blocked reason=evidence_file_not_found path=%s\n' "${EVIDENCE_FILE}" >&2
  exit 2
fi

args=("${EVIDENCE_FILE}" "--target-concurrency" "${TARGET_CONCURRENCY}")
if [[ -n "${GIT_SHA}" ]]; then
  args+=("--git-sha" "${GIT_SHA}")
fi

python3 tools/phase8_load_evidence.py "${args[@]}"
