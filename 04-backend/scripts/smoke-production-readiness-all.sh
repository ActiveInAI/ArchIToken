#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

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
  bun run build
)

(
  cd 04-backend
  cargo test --workspace
  cargo clippy --workspace --all-targets -- -D warnings
)

(
  cd 04-backend/agent-orchestrator
  PYTHONPATH=src python3 -m pytest
)

(
  cd 06-workers
  python3 -m pytest
)

04-backend/scripts/smoke-phase8-production-readiness.sh
git diff --check

printf 'ArchIToken repository production readiness gate passed\n'
