# ArchIToken K8s Manifests · Stage 2C

Status: 2026-04-22 · postgres operational

## 凭证管理

**本目录的 Secret manifest 只含占位符** · 实际密码由
sealed-secrets 注入(生产)或从 .env 模板生成(本地开发)。

本地开发流程:
1. `cp .env.example .env` · 填入实际密码
2. `kubectl create secret generic postgres-secret \
     --from-env-file=.env -n architoken`
3. `kubectl create secret docker-registry rbd-hub-pull \
     --docker-server=goodrain.me \
     --docker-username="$RAINBOND_USERNAME" \
     --docker-password="$RAINBOND_PASSWORD" \
     -n architoken`

生产部署见 `05-infra/k8s-cluster/sealed-secrets.md` (TODO)。

**历史遗留**: 2026-04-23 前的 git 历史含 Rainbond 默认弱口令
admin/admin1234(goodrain.me 出厂默认·公开值)。该口令已于
2026-04-23 更换·当前任何 git 历史里的旧值失效。Article 2
要求未来永不在 manifest 明文写密码·只用占位符或 sealed-secrets。

## postgres.yaml

PostgreSQL 16.13 + pgvector 0.8.2 on ARM64, deployed as StatefulSet
in the architoken namespace, complying with Pod Security Standard restricted.

Image source: goodrain.me/pandora/pgvector:pg16 (pushed to rbd-hub)

## Apply

    kubectl apply -f postgres.yaml

## Bootstrap

Schema and seed SQL are in ../../04-backend/migrations/
Apply with: kubectl cp + kubectl exec -- psql -f

## valkey.yaml

Valkey 8-alpine (Redis-compatible) on ARM64, StatefulSet in architoken namespace,
Pod Security restricted + readOnlyRootFilesystem.

Image source: goodrain.me/pandora/valkey:8-alpine (pushed to rbd-hub)
Config: maxmemory 512mb, policy allkeys-lru, AOF disabled (dev)

## Known issue · goodrain.me tag required

kubelet resolves `goodrain.me/...` via containerd's content store. If the tag
only exists in containerd under `127.0.0.1:5000/...`, kubelet will attempt a
real network pull and fail (HTTPS EOF because rbd-hub is HTTP behind APISIX).

Fix: after pushing to rbd-hub, also tag the local image with the goodrain.me
repository name, e.g.:

    sudo ctr -n k8s.io image tag \
      127.0.0.1:5000/pandora/X:tag \
      goodrain.me/pandora/X:tag
