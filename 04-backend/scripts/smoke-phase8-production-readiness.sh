#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

trap 'printf "smoke-phase8-production-readiness failed at line %s\n" "${LINENO}" >&2' ERR

rm -f 04-backend/openapitools.json

python3 tools/github_tech_radar.py \
  --strict \
  --seed config/tech-radar.seed.yaml \
  --out /tmp/tech-radar-phase8-strict.md

if command -v k6 >/dev/null 2>&1; then
  k6 inspect tools/k6/phase8_100k_smoke.js >/dev/null
  k6 inspect tools/k6/phase8_100k_ramp.js >/dev/null
else
  printf 'k6 not found; skipping k6 JavaScript syntax inspection\n'
fi

docker compose -f docker-compose.phase8-scale.yml config >/dev/null

if command -v kubectl >/dev/null 2>&1; then
  kubectl kustomize 05-infra/phase8/k8s >/tmp/phase8-kustomize.yaml
elif command -v kustomize >/dev/null 2>&1; then
  kustomize build 05-infra/phase8/k8s >/tmp/phase8-kustomize.yaml
else
  printf 'kubectl or kustomize is required to validate 05-infra/phase8/k8s\n' >&2
  exit 1
fi

# Phase 8 clustered-stateful-service guards.
grep -q -- "--cluster_name" /tmp/phase8-kustomize.yaml
grep -q -- "--routes" /tmp/phase8-kustomize.yaml
grep -q -- "nats-headless" /tmp/phase8-kustomize.yaml
grep -q -- "containerPort: 6222" /tmp/phase8-kustomize.yaml
grep -q -- "QDRANT__CLUSTER__ENABLED" /tmp/phase8-kustomize.yaml
grep -q -- "qdrant-headless" /tmp/phase8-kustomize.yaml
grep -q -- "containerPort: 6335" /tmp/phase8-kustomize.yaml
grep -q -- "--bootstrap" /tmp/phase8-kustomize.yaml
python3 tools/validate_phase8_k8s.py --path 05-infra/phase8/k8s >/dev/null

bash -n 04-backend/scripts/smoke-phase8-scale.sh
bash -n 04-backend/scripts/load-phase8-100k.sh
bash -n 04-backend/scripts/smoke-data-services.sh
bash -n 04-backend/scripts/guard-proprietary-runtime.sh
bash -n 04-backend/scripts/certify-phase8-100k.sh
bash -n 04-backend/scripts/validate-phase8-load-evidence.sh
bash -n 04-backend/scripts/smoke-phase8-realtime-readiness.sh
04-backend/scripts/guard-proprietary-runtime.sh
04-backend/scripts/validate-phase8-load-evidence.sh tools/k6/fixtures/phase8_load_evidence_passing.json >/dev/null
if 04-backend/scripts/validate-phase8-load-evidence.sh tools/k6/fixtures/phase8_load_evidence_failing.json >/tmp/phase8-failing-evidence.log 2>&1; then
  printf 'failing load evidence fixture unexpectedly passed\n' >&2
  exit 1
fi

git diff --check

printf 'phase8 production-readiness smoke passed\n'
