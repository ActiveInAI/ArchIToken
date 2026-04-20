# InsomeOS · Deployment Runbook

**Audience**: operators deploying InsomeOS on DGX Spark or cloud K8s.
**Scope**: v2.0 production deployments.

---

## 0. Prerequisites

### 0.1 Hardware (recommended)

| Role | Spec | Qty |
|------|------|-----|
| GPU node | NVIDIA DGX Spark (GB10) or H200 class | ≥ 2 |
| CPU node | 16 vCPU / 64 GB RAM | ≥ 3 |
| Storage | NVMe, 1 TB+ (db + object store) | ≥ 1 |
| Network | 25 GbE between GPU nodes; 1 GbE edge | — |

### 0.2 Software on every node

- Ubuntu 24.04.2 LTS (kernel 6.8+)
- containerd **v2.2.3**
- Cilium CNI **v1.19.3**
- Kubernetes **v1.35.4**
- NVIDIA Container Toolkit (GPU nodes only)
- Rainbond **v6.7.1-release** (optional — China one-click)

### 0.3 Cluster prerequisites

```bash
# Verify Kubernetes version
kubectl version --short
# Expected: Client and server on v1.35.4

# Verify GPU operator
kubectl get pods -n gpu-operator
# Expected: nvidia-* all Running

# Verify Cilium
cilium status
# Expected: all green
```

---

## 1. First-time installation

### 1.1 Create namespace and secrets

```bash
kubectl apply -f 05-infra/k8s/00-namespace.yaml

# REPLACE with real values (use sealed-secrets or ExternalSecrets in prod)
kubectl -n insomeos create secret generic insomeos-secrets \
  --from-literal=INSOMEOS_DATABASE__URL='postgres://insomeos:<pw>@supabase-db.insomeos:5432/insomeos' \
  --from-literal=INSOMEOS_CACHE__URL='redis://valkey.insomeos:6379/0' \
  --from-literal=INSOMEOS_AUTH__JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=INSOMEOS_AUTH__JWT_ISSUER='https://auth.insomeos.io'

kubectl apply -f 05-infra/k8s/01-config.yaml
```

### 1.2 Deploy data layer

```bash
# Option A: Supabase via Helm
helm repo add supabase https://supabase-community.github.io/supabase-kubernetes
helm upgrade --install supabase supabase/supabase \
  --namespace insomeos --version 1.26.04 \
  --values 05-infra/helm/supabase-values.yaml

# Option B: Multigres operator (future)

# Valkey (replaces Redis — SSPL avoided per §3)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade --install valkey bitnami/valkey \
  --namespace insomeos --version 3.1.1 \
  --set image.tag=9.0.3 \
  --set architecture=standalone

# Wait until ready
kubectl -n insomeos wait --for=condition=ready pod \
  -l app.kubernetes.io/name=supabase --timeout=10m
kubectl -n insomeos wait --for=condition=ready pod \
  -l app.kubernetes.io/name=valkey --timeout=5m
```

### 1.3 Apply database migrations

```bash
# Port-forward
kubectl -n insomeos port-forward svc/supabase-db 5432:5432 &

# Apply
psql $POSTGRES_URL -f 04-backend/migrations/20260419000001_initial_schema.sql
psql $POSTGRES_URL -f 04-backend/migrations/20260419000002_rls_policies.sql

# Verify RLS
psql $POSTGRES_URL -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public';"
# Every app table MUST show rowsecurity=t
```

### 1.4 Deploy inference engines (GPU nodes)

```bash
# vLLM (default)
kubectl apply -f 05-infra/k8s/40-vllm.yaml

# TensorRT-LLM (DGX Spark peak)
kubectl apply -f 05-infra/k8s/41-trtllm.yaml

# SGLang (complex agents)
kubectl apply -f 05-infra/k8s/42-sglang.yaml

# LMDeploy (China path — Qwen/GLM)
kubectl apply -f 05-infra/k8s/43-lmdeploy.yaml

# Ollama (dev only, optional in prod)
# llama.cpp (CPU fallback, always deployed)
kubectl apply -f 05-infra/k8s/45-llamacpp.yaml

# Verify all engines healthy
for e in vllm trtllm sglang lmdeploy llamacpp; do
  kubectl -n insomeos wait --for=condition=ready pod -l app=$e --timeout=10m
done
```

### 1.5 Deploy application tier

```bash
kubectl apply -f 05-infra/k8s/10-gateway.yaml
kubectl apply -f 05-infra/k8s/20-agent.yaml
kubectl apply -f 05-infra/k8s/30-frontend.yaml
kubectl apply -f 05-infra/k8s/90-ingress.yaml

kubectl -n insomeos rollout status deploy/gateway   --timeout=5m
kubectl -n insomeos rollout status deploy/agent     --timeout=5m
kubectl -n insomeos rollout status deploy/frontend  --timeout=5m
```

### 1.6 Smoke test

```bash
curl -fsSL https://api.insomeos.io/healthz   # => ok
curl -fsSL https://agent.insomeos.io/healthz # => {"status":"ok","version":"2.0.0"}
curl -fsSL https://insomeos.io/              # HTML landing page

# Model whitelist (§10)
curl -fsSL https://api.insomeos.io/v1/phases | jq
```

---

## 2. Rolling upgrade (vX.Y → vX.Y+1)

### 2.1 Pre-flight

```bash
# Check constitution compliance on the new image
skopeo inspect docker://ghcr.io/activeinai/insomeos-gateway:NEW | jq '.Labels'
# Verify Labels["org.opencontainers.image.licenses"] == "Apache-2.0 OR MIT"

# Run smoke tests against staging
./scripts/smoke-test.sh staging
```

### 2.2 Database migration (if required)

Check `04-backend/migrations/` for new `.sql` files.

```bash
# Dry-run with transaction
psql $POSTGRES_URL --single-transaction --set ON_ERROR_STOP=on \
  -v ROLLBACK_ONLY=1 -f 04-backend/migrations/NEW.sql

# Apply
psql $POSTGRES_URL --single-transaction --set ON_ERROR_STOP=on \
  -f 04-backend/migrations/NEW.sql
```

### 2.3 Rolling update

```bash
# Gateway
kubectl -n insomeos set image deploy/gateway \
  gateway=ghcr.io/activeinai/insomeos-gateway:NEW
kubectl -n insomeos rollout status deploy/gateway --timeout=10m

# Agent
kubectl -n insomeos set image deploy/agent \
  agent=ghcr.io/activeinai/insomeos-agent:NEW
kubectl -n insomeos rollout status deploy/agent --timeout=10m

# Frontend (rollout after backend is on new version)
kubectl -n insomeos set image deploy/frontend \
  frontend=ghcr.io/activeinai/insomeos-frontend:NEW
kubectl -n insomeos rollout status deploy/frontend --timeout=10m
```

### 2.4 Rollback (Constitution §15 · < 30 s)

```bash
# Per deployment
kubectl -n insomeos rollout undo deploy/gateway
kubectl -n insomeos rollout undo deploy/agent
kubectl -n insomeos rollout undo deploy/frontend

# Roll back the DB (only if migration is backward-incompatible — should be rare)
psql $POSTGRES_URL -f 04-backend/migrations/NEW.down.sql
```

---

## 3. Observability

### 3.1 Dashboards

- Grafana: `https://grafana.insomeos.io` — preloaded dashboards:
  - **InsomeOS · Harness SLA** (§8 budgets vs actual)
  - **InsomeOS · 6 Engines** (per-engine latency, error rate, rollback events)
  - **InsomeOS · Agent Invocations** (9 phases; verdict distribution)
  - **InsomeOS · Tenant usage** (top-10 by request count and token spend)

### 3.2 Key alerts (AlertManager rules)

```yaml
- alert: SlaViolationSustained
  expr: rate(insomeos_sla_violation_total[5m]) > 0.01
  for: 5m
  severity: page
  summary: "> 1% of requests are exceeding SLA budget (§8)"

- alert: RollbackGuardTriggered
  expr: increase(insomeos_rollback_total[10m]) > 3
  for: 1m
  severity: page
  summary: "RollbackGuard fired 3+ times in 10 min — investigate upstream engine"

- alert: TenantIsolationViolation
  expr: increase(insomeos_tenant_isolation_error_total[1h]) > 0
  for: 0m
  severity: page
  summary: "§16 violation detected — immediate investigation required"
```

---

## 4. Backup & DR

### 4.1 PostgreSQL

```bash
# Daily logical dump (held 30 d)
kubectl -n insomeos exec -it supabase-db-0 -- \
  pg_dump -Fc insomeos > "backup-$(date +%F).dump"

# WAL-G for PITR
# (See 07-deployment/walg-values.yaml; 24h recovery point objective)
```

### 4.2 Object storage

Model artifacts + uploaded IFC files stored in S3-compatible backend. Versioning enabled, 90-day retention.

### 4.3 RTO / RPO

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single pod failure | < 1 min (K8s auto-heal) | 0 |
| Single node failure | < 5 min (HPA + reschedule) | 0 |
| DB crash | < 15 min (WAL-G restore) | ≤ 5 min |
| Full AZ outage | < 60 min (warm standby) | ≤ 5 min |

---

## 5. Incident response (on-call)

### 5.1 Triage order

1. Check Grafana **InsomeOS · Harness SLA**
2. `kubectl -n insomeos get pods` — any `CrashLoopBackOff` or `ImagePullBackOff`?
3. `kubectl -n insomeos logs -l app=gateway --tail=200`
4. Identify: is it hardware, software, or upstream LLM?

### 5.2 Common runbooks

**Symptom**: 504 rate spiking

→ Likely engine SLA violation. Check RollbackGuard metrics. If stuck on one engine, force-quarantine:

```bash
kubectl -n insomeos exec deploy/gateway -- \
  curl -X POST localhost:8080/admin/engines/vllm/quarantine
```

**Symptom**: 403 Tenant isolation errors

→ **STOP. Constitution §16 violation.** Page AIA. Do NOT attempt to "fix forward." Roll back to last known good image.

**Symptom**: ComfyUI service gone

→ Expected during maintenance. `fabrication` / `concept` phase image generation will degrade gracefully. Users see a notice, not an error.

---

## 6. Decommissioning a node

```bash
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
# Wait until pods rescheduled
kubectl delete node <node>
```

---

## 7. Contact

- Paging: `pagerduty.com/insomeos` (on-call rotation)
- Slack: `#insomeos-ops`
- Email: `ActiveInAI@outlook.com`

---

**Runbook version**: 2.0.0 · **Last reviewed**: 2026-04-19
