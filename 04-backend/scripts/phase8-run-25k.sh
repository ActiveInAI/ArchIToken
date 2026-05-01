#!/usr/bin/env bash
set -euo pipefail

PROFILE="25k"
TARGET_VU="25000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

if ! command -v k6 >/dev/null 2>&1; then
  printf 'verdict=blocked reason=k6_required profile=%s\n' "${PROFILE}" >&2
  exit 2
fi

RUN_ID="${ARCHITOKEN_LOAD_RUN_ID:-phase8-$(date -u +%Y%m%dT%H%M%SZ)}"
OUT_DIR="${ARCHITOKEN_EVIDENCE_DIR:-/tmp/architoken-phase8-evidence/${RUN_ID}}"
mkdir -p "${OUT_DIR}"
SUMMARY="${OUT_DIR}/${PROFILE}-k6-summary.json"
META="${OUT_DIR}/${PROFILE}-stage-meta.json"
START_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

ARCHITOKEN_LOAD_PROFILE="${PROFILE}" k6 run --summary-export "${SUMMARY}" tools/k6/phase8_100k_ramp.js

END_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAGE="${PROFILE}" START_TIME="${START_TIME}" END_TIME="${END_TIME}" TARGET_VU="${TARGET_VU}" \
  python3 - <<'PY' > "${META}"
import json
import os

print(json.dumps({
    "stage": os.environ["STAGE"],
    "start_time": os.environ["START_TIME"],
    "end_time": os.environ["END_TIME"],
    "vu": int(os.environ["TARGET_VU"]),
}, indent=2, sort_keys=True))
PY

printf 'verdict=stage_completed profile=%s summary=%s metadata=%s\n' "${PROFILE}" "${SUMMARY}" "${META}"
