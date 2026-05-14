# Phase 7 AI Runtime Execution

Phase 7 AI runtime execution is approval gated. The public Rust/Axum API creates `ai_command_draft` records with a query plan, action plan, draft viewer commands, context metadata, trace events, and audit events.

AI is not allowed to mutate assets directly. Any planned action marked `mutatesAssets: true` is rejected before state is written. Approved AI work is queued for controlled runtime execution and must still pass RuntimeContext, RBAC, tenant/project isolation, and audit boundaries.

## Endpoints

- `POST /v1/runtime/executions`: creates an AI draft execution.
- `GET /v1/runtime/executions`: lists visible runtime executions for the caller tenant/project.
- `GET /v1/runtime/executions/{execution_id}`: reads one scoped execution.
- `GET /v1/runtime/executions/{execution_id}/trace`: returns the trace view.
- `POST /v1/runtime/executions/{execution_id}/approve`: approves or rejects a pending draft.

## Boundary

Runtime execution uses the approval-gated service adapter; production profile requires PostgreSQL/SeaORM-backed execution records.
