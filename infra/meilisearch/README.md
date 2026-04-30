# Phase 7 Meilisearch Boundary

Meilisearch is the lexical search service for asset metadata, document text, conversion manifests, and workbench discovery. It complements PostgreSQL and pgvector; it is not the source of truth for tenant/project authorization.

Every indexed document must include tenant and project identifiers, but query authorization remains enforced by the Rust API through `RuntimeContext` and RBAC.

Default local endpoint:

```text
MEILI_URL=http://localhost:7700
```
