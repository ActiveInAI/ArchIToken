#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/architoken-uv-cache}"

trap 'printf "smoke-production-readiness-all failed at line %s\n" "${LINENO}" >&2' ERR

python3 tools/production_readiness_contract.py
python3 -m unittest \
  tools/test_production_readiness_contract.py \
  tools/test_phase8_load_evidence.py \
  tools/test_phase8_runtime_cluster_validation.py \
  tools/test_phase8_merge_load_evidence.py \
  tools/test_phase8_prometheus_snapshot.py

(
  cd 03-frontend
  bun run typecheck
  bun run lint
  bun run test
  bun run test:e2e
  bun run build
)

(
  cd 04-backend
  cargo test --workspace
  cargo clippy --workspace --all-targets -- -D warnings
)

04-backend/scripts/smoke-database-agent-go.sh

(
  cd 04-backend/agent-orchestrator
  if command -v uv >/dev/null 2>&1; then
    uv run --extra dev pytest --cov=architoken_agent --cov-report=xml
  else
    PYTHONPATH=src python3 -m pytest
  fi
)

(
  cd 06-workers
  if command -v uv >/dev/null 2>&1; then
    uv run --extra test --extra bim pytest tests
  elif python3 -c 'import pytest, ifcopenshell, rhino3dm' >/dev/null 2>&1; then
    python3 -m pytest
  else
    printf 'workers full test gate requires uv or Python deps: pytest, ifcopenshell, rhino3dm\n' >&2
    exit 1
  fi
)

ARCHITOKEN_P0_INCLUDE_WORKERS=0 ARCHITOKEN_P0_DIFF_CHECK=0 04-backend/scripts/smoke-p0-production-gates.sh
04-backend/scripts/smoke-phase8-production-readiness.sh
git diff --check

printf 'ArchIToken repository production readiness gate passed\n'
