#!/usr/bin/env bash
# Terminology guard (issue #1: InsomeOS -> ArchIToken namespace migration).
#
# The project is ArchIToken; the code/package namespace is architoken. This guard
# fails on any NEW, non-historical "InsomeOS"/"insomeos" usage so the rename does
# not regress.
#
# Intentionally NOT flagged (excluded):
#   - Local clone filesystem paths: this checkout lives under ~/dev/insomeos, so
#     absolute paths containing "dev/insomeos" are not branding/namespace.
#   - Recorded history: lineage / migration tracker / historical database design
#     docs (which name the retired "insomeos-valkey" container) — see allow_re.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

allow_re='^(05-infra/docker/compose\.data\.yml|docs/ARCHITOKEN_CURRENT_DATABASE_DESIGN_2026-06-08\.html|docs/ARCHITOKEN_DATABASE_RUNTIME_TOPOLOGY\.md|docs/Insome.*\.html|docs/ARCHITOKEN-MIGRATION-TRACKER\.md|scripts/check-terminology\.sh):'

hits="$(
  git -c core.quotePath=false grep -nIi "insomeos" 2>/dev/null \
    | grep -vE "dev/insomeos" \
    | grep -vE "${allow_re}" \
    || true
)"

if [[ -n "${hits}" ]]; then
  {
    echo "Terminology guard FAILED: non-historical InsomeOS/insomeos usage found."
    echo "Use 'ArchIToken' (project) / 'architoken' (code & package namespace)."
    echo "If a hit is a recorded lineage/migration reference, add its file to allow_re."
    echo
    echo "${hits}"
  } >&2
  exit 1
fi

echo "Terminology guard passed: no non-historical InsomeOS/insomeos usage."
