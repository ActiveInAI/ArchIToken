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
  kubectl kustomize infra/k8s/phase8 >/tmp/phase8-kustomize.yaml
elif command -v kustomize >/dev/null 2>&1; then
  kustomize build infra/k8s/phase8 >/tmp/phase8-kustomize.yaml
else
  printf 'kubectl or kustomize is required to validate infra/k8s/phase8\n' >&2
  exit 1
fi

bash -n 04-backend/scripts/smoke-phase8-scale.sh
bash -n 04-backend/scripts/load-phase8-100k.sh
bash -n 04-backend/scripts/guard-proprietary-runtime.sh
04-backend/scripts/guard-proprietary-runtime.sh

git diff --check

printf 'phase8 production-readiness smoke passed\n'
