#!/usr/bin/env bash
# Heavy-steel BOM database bridge gate with synthetic sources.
#
# Closes the CI blind spot where the bridge gate depended on developer-local
# workbooks under ~/下载: generates clearly-labelled synthetic source files,
# reconciles them through the real worker parser (14 lines / 470 quantity,
# matching the bridge migration), replays ALL migrations on a scratch
# database, then runs the full bridge smoke against it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_DATABASE_URL="${ARCHITOKEN_DATABASE__URL:-${DATABASE_URL:-postgres://architoken:architoken_dev_only@127.0.0.1:5433/architoken}}"
SCRATCH_DB="${ARCHITOKEN_BOM_SYNTH_DB:-architoken_bom_bridge_synthetic}"
FIXTURE_DIR="${ARCHITOKEN_BOM_SYNTH_FIXTURE_DIR:-${REPO_ROOT}/.runtime/synthetic-bom}"

trap 'printf "smoke-bom-db-bridge-synthetic failed at line %s\n" "${LINENO}" >&2' ERR

for cmd in psql python3; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
        printf '%s is required for the synthetic BOM bridge gate\n' "${cmd}" >&2
        exit 1
    fi
done

cd "${REPO_ROOT}"

# Derive a scratch database URL by swapping the database name.
SCRATCH_DATABASE_URL="$(python3 - "${BASE_DATABASE_URL}" "${SCRATCH_DB}" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
url, db = sys.argv[1], sys.argv[2]
parts = urlsplit(url)
print(urlunsplit((parts.scheme, parts.netloc, f"/{db}", parts.query, parts.fragment)))
PY
)"

printf '=== [1/4] Recreating scratch database %s ===\n' "${SCRATCH_DB}"
psql "${BASE_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB}"
psql "${BASE_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${SCRATCH_DB}"

printf '=== [2/4] Replaying all migrations in order ===\n'
for migration in 04-backend/migrations/*.sql; do
    printf 'applying %s\n' "${migration}"
    psql "${SCRATCH_DATABASE_URL}" -v ON_ERROR_STOP=1 -q -f "${migration}"
done

printf '=== [3/4] Generating synthetic sources and reconciling via worker parser ===\n'
python3 04-backend/scripts/generate-synthetic-bom-fixtures.py "${FIXTURE_DIR}"
BOM_FIXTURE="${FIXTURE_DIR}/synthetic_构件物料清单.xlsx"
DRAWING_FIXTURE="${FIXTURE_DIR}/synthetic_深化图纸目录.docx"

PYTHONPATH="${REPO_ROOT}/06-workers" python3 - "${BOM_FIXTURE}" <<'PY'
import sys
from pathlib import Path
from architoken_workers.component_bom_worker import parse_bom_workbook

bom = parse_bom_workbook(Path(sys.argv[1]))
summary = bom["summary"]
# Reconcile against the values baked into
# 20260609000001_component_bom_database_bridge.sql (14 lines, quantity 470).
if summary["lineCount"] != 14:
    raise SystemExit(f"synthetic BOM parse mismatch: lineCount={summary['lineCount']}, expected 14")
if summary["totalQuantity"] != 470:
    raise SystemExit(f"synthetic BOM parse mismatch: totalQuantity={summary['totalQuantity']}, expected 470")
if any(line["reviewState"] != "professional_review_required" for line in bom["lines"]):
    raise SystemExit("synthetic BOM parse mismatch: every line must stay professional_review_required")
print(f"worker parse reconciliation OK: {summary['lineCount']} lines, quantity {summary['totalQuantity']:.0f}")
PY

printf '=== [4/4] Running heavy-steel database bridge smoke against scratch DB ===\n'
DATABASE_URL="${SCRATCH_DATABASE_URL}" \
ARCHITOKEN_DATABASE__URL="${SCRATCH_DATABASE_URL}" \
ARCHITOKEN_BOM_SOURCE_WORKBOOK="${BOM_FIXTURE}" \
ARCHITOKEN_BOM_SOURCE_DRAWING_CATALOG="${DRAWING_FIXTURE}" \
    04-backend/scripts/smoke-heavy-steel-database-bridge.sh

printf 'synthetic BOM database bridge gate passed (db=%s)\n' "${SCRATCH_DB}"
