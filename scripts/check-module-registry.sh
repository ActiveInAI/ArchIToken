#!/usr/bin/env bash
# Module Registry guard (issue #2: replace BusinessPhase / 9-phase with Module
# Registry). The constitution requires Registry over Enum: business routing uses
# module_id (TEXT) + the modules table / Module Registry, never a hardcoded
# BusinessPhase enum or a fixed 9-phase business structure. This guard blocks
# reintroduction of the retired structures.
#
# Not flagged (excluded):
#   - the migration tracker, which records the retired structures by name;
#   - this script;
#   - local clone filesystem paths (dev/insomeos).
# Note: deployment / data-plane phases (phase_0, phase7, BOM 九阶段派生链) are a
# different, legitimate concept and are intentionally NOT matched here.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

allow_re='^(docs/ARCHITOKEN-MIGRATION-TRACKER\.md|scripts/check-module-registry\.sh):'

hits="$(
  git -c core.quotePath=false grep -nE \
    "BusinessPhase|business_phase|9-phase|nine-phase|9_phase" 2>/dev/null \
    | grep -vE "dev/insomeos" \
    | grep -vE "${allow_re}" \
    || true
)"

if [[ -n "${hits}" ]]; then
  {
    echo "Module Registry guard FAILED: legacy BusinessPhase / 9-phase usage found."
    echo "Business routing must use module_id + the Module Registry (modules table),"
    echo "not a hardcoded enum. See 02-architecture/MODULE-REGISTRY.md."
    echo
    echo "${hits}"
  } >&2
  exit 1
fi

echo "Module Registry guard passed: no legacy BusinessPhase / 9-phase usage."
