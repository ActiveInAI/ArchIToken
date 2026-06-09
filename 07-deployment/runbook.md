# ArchIToken · Deployment Runbook

**Audience**: operators deploying ArchIToken on DGX Spark or cloud K8s.
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
kubectl -n architoken create secret generic architoken-secrets \
  --from-literal=ARCHITOKEN_DATABASE__URL='postgres://architoken:<pw>@supabase-db.architoken:5432/architoken' \
  --from-literal=ARCHITOKEN_CACHE__URL='redis://valkey.architoken:6379/0' \
  --from-literal=ARCHITOKEN_AUTH__JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=ARCHITOKEN_AUTH__JWT_ISSUER='https://auth.architoken.io'

kubectl apply -f 05-infra/k8s/01-config.yaml
```

### 1.2 Deploy data layer

```bash
# Option A: Supabase via Helm
helm repo add supabase https://supabase-community.github.io/supabase-kubernetes
helm upgrade --install supabase supabase/supabase \
  --namespace architoken --version 1.26.04 \
  --values 05-infra/helm/supabase-values.yaml

# Option B: Multigres operator (future)

# Valkey (replaces Redis — SSPL avoided per §3)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade --install valkey bitnami/valkey \
  --namespace architoken --version 3.1.1 \
  --set image.tag=9.0.3 \
  --set architecture=standalone

# Wait until ready
kubectl -n architoken wait --for=condition=ready pod \
  -l app.kubernetes.io/name=supabase --timeout=10m
kubectl -n architoken wait --for=condition=ready pod \
  -l app.kubernetes.io/name=valkey --timeout=5m
```

### 1.3 Apply database migrations

```bash
# Port-forward
kubectl -n architoken port-forward svc/supabase-db 5432:5432 &

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
  kubectl -n architoken wait --for=condition=ready pod -l app=$e --timeout=10m
done
```

### 1.5 Deploy application tier

```bash
kubectl apply -f 05-infra/k8s/10-gateway.yaml
kubectl apply -f 05-infra/k8s/20-agent.yaml
kubectl apply -f 05-infra/k8s/30-frontend.yaml
kubectl apply -f 05-infra/k8s/90-ingress.yaml

kubectl -n architoken rollout status deploy/gateway   --timeout=5m
kubectl -n architoken rollout status deploy/agent     --timeout=5m
kubectl -n architoken rollout status deploy/frontend  --timeout=5m
```

### 1.6 Smoke test

```bash
curl -fsSL https://api.architoken.io/healthz   # => ok
curl -fsSL https://agent.architoken.io/healthz # => {"status":"ok","version":"2.0.0"}
curl -fsSL https://architoken.io/              # HTML landing page

# Module registry smoke check
curl -fsSL https://api.architoken.io/v1/modules | jq
```

---

## 2. Rolling upgrade (vX.Y → vX.Y+1)

### 2.1 Pre-flight

```bash
# Check constitution compliance on the new image
skopeo inspect docker://ghcr.io/activeinai/architoken-gateway:NEW | jq '.Labels'
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
kubectl -n architoken set image deploy/gateway \
  gateway=ghcr.io/activeinai/architoken-gateway:NEW
kubectl -n architoken rollout status deploy/gateway --timeout=10m

# Agent
kubectl -n architoken set image deploy/agent \
  agent=ghcr.io/activeinai/architoken-agent:NEW
kubectl -n architoken rollout status deploy/agent --timeout=10m

# Frontend (rollout after backend is on new version)
kubectl -n architoken set image deploy/frontend \
  frontend=ghcr.io/activeinai/architoken-frontend:NEW
kubectl -n architoken rollout status deploy/frontend --timeout=10m
```

### 2.4 Rollback (Constitution §15 · < 30 s)

```bash
# Per deployment
kubectl -n architoken rollout undo deploy/gateway
kubectl -n architoken rollout undo deploy/agent
kubectl -n architoken rollout undo deploy/frontend

# Roll back the DB (only if migration is backward-incompatible — should be rare)
psql $POSTGRES_URL -f 04-backend/migrations/NEW.down.sql
```

---

## 3. Observability

### 3.1 Dashboards

- Grafana: `https://grafana.architoken.io` — preloaded dashboards:
  - **ArchIToken · Harness SLA** (§8 budgets vs actual)
  - **ArchIToken · 6 Engines** (per-engine latency, error rate, rollback events)
  - **ArchIToken · Agent Invocations** (14 modules; verdict distribution)
  - **ArchIToken · Tenant usage** (top-10 by request count and token spend)

### 3.2 Key alerts (AlertManager rules)

```yaml
- alert: SlaViolationSustained
  expr: rate(architoken_sla_violation_total[5m]) > 0.01
  for: 5m
  severity: page
  summary: "> 1% of requests are exceeding SLA budget (§8)"

- alert: RollbackGuardTriggered
  expr: increase(architoken_rollback_total[10m]) > 3
  for: 1m
  severity: page
  summary: "RollbackGuard fired 3+ times in 10 min — investigate upstream engine"

- alert: TenantIsolationViolation
  expr: increase(architoken_tenant_isolation_error_total[1h]) > 0
  for: 0m
  severity: page
  summary: "§16 violation detected — immediate investigation required"
```

---

## 4. Backup & DR

### 4.1 PostgreSQL

```bash
# Daily logical dump (held 30 d)
kubectl -n architoken exec -it supabase-db-0 -- \
  pg_dump -Fc architoken > "backup-$(date +%F).dump"

# WAL-G for PITR
# (See 07-deployment/walg-values.yaml; 24h recovery point objective)
```

Production readiness is blocked unless a restore drill has been recorded and
verified:

```bash
DATABASE_URL=postgres://architoken:***@127.0.0.1:5432/architoken \
  04-backend/scripts/smoke-backup-restore-drill.sh
```

The drill creates a PostgreSQL custom-format dump, restores it into a temporary
database, verifies tenant/project/audit/backup tables, records `backup_runs`,
`restore_drills` and `restore_verification_items`, then drops the temporary
database.

### 4.2 Object storage

Model artifacts + uploaded IFC files stored in S3-compatible backend. Versioning enabled, 90-day retention.

### 4.3 Operations Audit Archive

All production administrative access must go through JumpServer or an equivalent
bastion with MFA, session recording, command audit and immutable archive
evidence.

```bash
DATABASE_URL=postgres://architoken:***@127.0.0.1:5432/architoken \
  04-backend/scripts/smoke-operations-audit-log-archive.sh
```

The gate records a bastion instance, managed asset, session recording hash,
command audit events and a log archive batch. `operations_audit_log_archive_readiness`
must return `passed` before L3/L4 release.

### 4.4 Release Gate

```bash
DATABASE_URL=postgres://architoken:***@127.0.0.1:5432/architoken \
  04-backend/scripts/smoke-p0-production-gates.sh
```

The gate verifies global module operation runtime evidence, CDE file operation
runtime evidence, operations audit/log archive readiness and PostgreSQL
backup/restore DR. When the local heavy-steel BOM workbook and drawing catalog
are available, it also verifies the BOM database bridge. CI runs the same P0
database gates against a clean
`pgvector/pgvector:pg16` PostgreSQL service and skips only the external
workbook/catalog gate. Tag-based release image publishing also depends on this
P0 gate and runs the worker contract subset before Docker images are pushed.
The main CI blocks on frontend Playwright e2e and worker contract tests.

### 4.5 RTO / RPO

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single pod failure | < 1 min (K8s auto-heal) | 0 |
| Single node failure | < 5 min (HPA + reschedule) | 0 |
| DB crash | < 15 min (WAL-G restore) | ≤ 5 min |
| Full AZ outage | < 60 min (warm standby) | ≤ 5 min |

---

## 5. Incident response (on-call)

### 5.1 Triage order

1. Check Grafana **ArchIToken · Harness SLA**
2. `kubectl -n architoken get pods` — any `CrashLoopBackOff` or `ImagePullBackOff`?
3. `kubectl -n architoken logs -l app=gateway --tail=200`
4. Identify: is it hardware, software, or upstream LLM?

### 5.2 Common runbooks

**Symptom**: 504 rate spiking

→ Likely engine SLA violation. Check RollbackGuard metrics. If stuck on one engine, force-quarantine:

```bash
kubectl -n architoken exec deploy/gateway -- \
  curl -X POST localhost:8080/admin/engines/vllm/quarantine
```

**Symptom**: 403 Tenant isolation errors

→ **STOP. Constitution §16 violation.** Page AIA. Do NOT attempt to "fix forward." Roll back to last known good image.

**Symptom**: ComfyUI service gone

→ Expected during maintenance. `production_manufacturing` / `concept` phase image generation will degrade gracefully. Users see a notice, not an error.

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

- Paging: `pagerduty.com/architoken` (on-call rotation)
- Slack: `#architoken-ops`
- Email: `ActiveInAI@outlook.com`

---

**Runbook version**: 2.0.1 · **Last reviewed**: 2026-06-09
