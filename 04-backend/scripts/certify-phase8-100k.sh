#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

PROFILE="${1:-${ARCHITOKEN_LOAD_PROFILE:-smoke}}"
API_BASE_URL="${ARCHITOKEN_API_BASE_URL:-http://localhost:8080}"
WS_BASE_URL="${ARCHITOKEN_WS_BASE_URL:-ws://localhost:8082}"
EVIDENCE_FILE="${ARCHITOKEN_LOAD_EVIDENCE:-}"

case "${PROFILE}" in
  syntax)
    bash -n 04-backend/scripts/certify-phase8-100k.sh
    bash -n 04-backend/scripts/validate-phase8-load-evidence.sh
    bash -n 04-backend/scripts/smoke-phase8-realtime-readiness.sh
    python3 -m unittest tools/test_phase8_load_evidence.py
    python3 -m unittest tools/test_validate_phase8_k8s.py
    printf 'verdict=syntax_ok\n'
    exit 0
    ;;
  smoke)
    04-backend/scripts/smoke-phase8-production-readiness.sh
    if command -v k6 >/dev/null 2>&1; then
      ARCHITOKEN_LOAD_PROFILE=smoke k6 run tools/k6/phase8_100k_ramp.js
    else
      printf 'k6 not found; smoke mode accepts missing k6 after production-readiness checks\n'
    fi
    printf 'verdict=smoke_ok profile=smoke\n'
    exit 0
    ;;
  1k|10k|25k|50k)
    if ! command -v k6 >/dev/null 2>&1; then
      printf 'verdict=blocked reason=k6_required profile=%s\n' "${PROFILE}" >&2
      exit 2
    fi
    ARCHITOKEN_LOAD_PROFILE="${PROFILE}" \
    ARCHITOKEN_API_BASE_URL="${API_BASE_URL}" \
    ARCHITOKEN_WS_BASE_URL="${WS_BASE_URL}" \
    k6 run tools/k6/phase8_100k_ramp.js
    printf 'verdict=load_profile_completed profile=%s\n' "${PROFILE}"
    ;;
  100k)
    if [[ "${ARCHITOKEN_CERTIFICATION_EXECUTION:-external}" != "external" ]]; then
      if [[ "${ARCHITOKEN_ALLOW_LOCAL_100K:-0}" != "1" ]]; then
        printf 'verdict=blocked reason=local_100k_disabled set ARCHITOKEN_ALLOW_LOCAL_100K=1 only for dedicated external load workers\n' >&2
        exit 2
      fi
      if ! command -v k6 >/dev/null 2>&1; then
        printf 'verdict=blocked reason=k6_required profile=100k\n' >&2
        exit 2
      fi
      ARCHITOKEN_LOAD_PROFILE=100k \
      ARCHITOKEN_API_BASE_URL="${API_BASE_URL}" \
      ARCHITOKEN_WS_BASE_URL="${WS_BASE_URL}" \
      k6 run tools/k6/phase8_100k_ramp.js
    fi
    if [[ -z "${EVIDENCE_FILE}" ]]; then
      printf 'verdict=blocked reason=100k_certification_requires_ARCHITOKEN_LOAD_EVIDENCE\n' >&2
      exit 2
    fi
    ARCHITOKEN_TARGET_CONCURRENCY=100000 \
      04-backend/scripts/validate-phase8-load-evidence.sh "${EVIDENCE_FILE}"
    printf 'verdict=certified evidence=%s\n' "${EVIDENCE_FILE}"
    ;;
  evidence)
    if [[ -z "${EVIDENCE_FILE}" ]]; then
      printf 'verdict=blocked reason=evidence_mode_requires_ARCHITOKEN_LOAD_EVIDENCE\n' >&2
      exit 2
    fi
    04-backend/scripts/validate-phase8-load-evidence.sh "${EVIDENCE_FILE}"
    ;;
  *)
    printf 'usage: %s [syntax|smoke|1k|10k|25k|50k|100k|evidence]\n' "$0" >&2
    exit 2
    ;;
esac
