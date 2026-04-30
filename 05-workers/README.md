# ArchIToken Phase 7 Workers

This package defines worker-side contracts for conversion jobs. It does not run a real database, object store, model provider, or proprietary converter.

Workers receive a typed job payload, produce deterministic manifests, and return outputs for the Rust API to persist and audit. Workers must not bypass `RuntimeContext`, RBAC, tenant/project isolation, object bindings, or audit policy.

Install for local contract testing:

```bash
python3 -m pip install -e ./05-workers
python3 -m pytest 05-workers/tests
```
