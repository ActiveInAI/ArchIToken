# Phase 7 Temporal Boundary

Temporal coordinates long-running conversion jobs, AI runtime executions, and worker retries. The public API remains Rust/Axum; workers and workflows must not bypass asset registry, tenant/project isolation, RBAC, or audit requirements.

Default local endpoint:

```text
TEMPORAL_ADDRESS=localhost:7233
```

Temporal payloads should carry the Phase 6 `RuntimeContext` fields needed to reconstruct audit and isolation decisions.
