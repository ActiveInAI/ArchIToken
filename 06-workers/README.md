# ArchIToken Production Workers

This package defines worker-side adapter contracts for CAD, BIM, Office, PDF, image, video, voice, point-cloud, panorama, GIS and AI generation jobs.

Workers receive a typed job payload, read/write through S3-compatible object storage, subscribe to NATS/Temporal queues, emit OpenTelemetry traces, and return outputs for the Rust API to persist and audit. Workers must not bypass `RuntimeContext`, RBAC, tenant/project isolation, object bindings, or audit policy.

Install for local contract testing:

```bash
python3 -m pip install -e ./06-workers
python3 -m pytest 06-workers/tests
```

Install production adapters:

```bash
python3 -m pip install -e './06-workers[production]'
```
