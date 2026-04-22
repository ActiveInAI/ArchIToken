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
