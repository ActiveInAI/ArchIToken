# InsomeOS K8s Manifests · Stage 2C

Status: 2026-04-22 · postgres operational

## postgres.yaml

PostgreSQL 16.13 + pgvector 0.8.2 on ARM64, deployed as StatefulSet
in the insomeos namespace, complying with Pod Security Standard restricted.

Image source: goodrain.me/pandora/pgvector:pg16 (pushed to rbd-hub)
Credentials: admin / admin1234 (rbd-hub-pull Secret)

## Apply

    kubectl apply -f postgres.yaml

## Bootstrap

Schema and seed SQL are in ../../04-backend/migrations/
Apply with: kubectl cp + kubectl exec -- psql -f

## valkey.yaml

Valkey 8-alpine (Redis-compatible) on ARM64, StatefulSet in insomeos namespace,
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
