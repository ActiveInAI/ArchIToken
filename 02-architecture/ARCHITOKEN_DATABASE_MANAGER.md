# ArchIToken Database Manager

**Status**: active architecture baseline
**License boundary**: Apache-2.0 core only
**Primary implementation languages**: Rust and Go
**Product role**: unified open-source database manager for ArchIToken data-plane and external database operations

---

## 1. Decision

ArchIToken will develop a clean-room, Apache-2.0 database manager instead of
forking or embedding an existing GPL / AGPL / SSPL / BUSL database GUI.

The product name for the capability is **ArchIToken Database Manager**. It is a
first-class database management product and a reusable platform capability, not
a large card inside Settings Center.

The implementation route is:

| Layer | Language | Responsibility |
| --- | --- | --- |
| Core manager | Rust | API server, capability registry, query/session policy, schema inventory, audit, RBAC hooks and StorageRouter integration |
| Connector agent | Go | Lightweight database-side agent, network/tunnel adapter, driver probe, health check, CLI and sidecar runtime |
| Embedded workbench | Existing ArchIToken shell | Settings Center links to the manager and shows runtime status, but does not replace the manager |

The current Next.js Settings Center database panel remains a control-plane entry
and runtime snapshot view. It must not become the complete database manager.

---

## 2. Why Not Just Use One Existing Project

Existing open-source database tools are useful, but none cleanly covers the full
ArchIToken requirement set under the desired license and runtime boundary:

| Project class | Value | Gap for ArchIToken |
| --- | --- | --- |
| CloudBeaver / DBeaver family | Strong SQL browser and query UI | Java runtime, SQL-centric, does not cover object/event/vector stores as ArchIToken data-plane capabilities |
| DbGate family | Broad database coverage | License signals vary by edition/source; useful as clean-room reference or optional sidecar, not core code |
| Bytebase | Strong database DevSecOps workflow | Change governance platform, not a full multi-store runtime manager; enterprise/license gates must be respected |
| Native service UIs | Strong for Qdrant, NATS, SeaweedFS and similar | Fragmented by store; no unified ArchIToken tenant, audit, approval or StorageRouter context |

Therefore the route is **build our own Apache-2.0 manager**, while using mature
projects as reference or optional isolated sidecars where appropriate.

---

## 3. Product Scope

ArchIToken Database Manager must cover these capabilities:

1. Connection registry and discovery.
2. Database topology and health monitoring.
3. Schema, table, collection, keyspace, bucket, stream and index inventory.
4. SQL query console for relational and SQL-like engines.
5. NoSQL / command console for document, cache and vector engines.
6. Data grid browsing with paging, filters and safe export.
7. Read-only default mode with explicit approval for writes.
8. DDL / migration plan review before execution.
9. Secrets, tenant boundaries, role binding and connection policy.
10. Append-only audit events for every connect, query, export and mutation.
11. Backup, restore and destructive-action gating.
12. OpenAPI / gRPC / event contracts for platform integration.

It must manage database engines and database-like services as registered
capabilities, not as hardcoded products.

---

## 4. Supported Engine Roadmap

| Phase | Engine family | Initial targets | Notes |
| --- | --- | --- | --- |
| P0 | Runtime inventory | ArchIToken data-plane bindings, Docker/k8s service inventory | Already partially visible in Settings Center |
| P1 | Relational / SQL | PostgreSQL, ClickHouse | Rust core path first |
| P2 | Cache | Valkey, Redis-compatible endpoints | Redis proper may have license changes; Valkey is preferred |
| P3 | Document | MongoDB-compatible endpoints | Go agent can probe and route document inventory |
| P4 | Vector | Qdrant | Native Qdrant Web UI remains an optional deep link |
| P5 | Object | SeaweedFS S3 / S3-compatible stores | Object bytes remain StorageRouter/ObjectStore responsibility |
| P6 | Event | NATS JetStream | Monitoring and stream inventory first, destructive stream changes gated |
| P7 | Governance | Migration, review, approval, masking, policy | Bytebase-like workflows implemented clean-room |

Graph database support remains blocked until a reviewed graph sidecar is
configured. Current GraphStore uses PostgreSQL adjacency fallback.

---

## 5. Architecture

```text
ArchIToken shell
  -> Database Manager route / embedded workbench
  -> Rust manager API
       -> capability registry
       -> policy + audit + approval
       -> query/session engine
       -> metadata inventory
       -> StorageRouter/DataRouter integration
       -> Go connector agents
            -> engine probe
            -> network/tunnel boundary
            -> driver-specific inventory
            -> safe command execution
```

### 5.1 Rust Core

Rust owns the platform truth:

- `DatabaseManagerRegistry`
- `DatabaseEngineKind`
- `DatabaseCapability`
- `ConnectionProfile`
- `QuerySession`
- `SchemaInventory`
- `DataMutationPlan`
- `DatabaseAuditEvent`
- `DestructiveOperationGate`

The Rust API must default to read-only operations. Write operations require
policy, audit and approval context before execution.

Initial runnable entry:

| Item | Value |
| --- | --- |
| Crate | `04-backend/database-manager` |
| Binary | `architoken-db-manager` |
| Default bind | `127.0.0.1:8751` |
| Health | `GET /readyz` and `GET /api/database-manager/readyz` |
| Manifest | `GET /api/database-manager/manifest` |
| Engines | `GET /api/database-manager/engines` and `GET /api/database-manager/engines/{engine_id}` |
| Unified inventory | `GET /api/database-manager/inventory` |
| PostgreSQL inventory | `GET /api/database-manager/postgresql/inventory` |
| PostgreSQL CRUD tables | `GET /api/database-manager/postgresql/crud/tables` |
| PostgreSQL CRUD rows | `GET` / `POST` / `PATCH` / `DELETE /api/database-manager/postgresql/crud/rows` |
| ClickHouse inventory | `GET /api/database-manager/clickhouse/inventory` |
| Valkey inventory | `GET /api/database-manager/valkey/inventory` |
| Qdrant inventory | `GET /api/database-manager/qdrant/inventory` |
| NATS JetStream inventory | `GET /api/database-manager/nats-jetstream/inventory` |
| S3-compatible inventory | `GET /api/database-manager/s3/inventory` |

`/api/database-manager/inventory` is the unified read-only inventory endpoint.
It concurrently calls the PostgreSQL, ClickHouse, Valkey, Qdrant, NATS
JetStream and S3-compatible inventory paths and returns per-engine status,
credential-redacted source, summary metrics, optional structured inventory data
and error evidence. A missing engine configuration is reported as
`not_configured`; an unreachable configured engine is reported as `unavailable`.
The endpoint must not fabricate live inventory.

`/api/database-manager/postgresql/inventory` reads
`ARCHITOKEN_DB_MANAGER_POSTGRES_URL` first, then `DATABASE_URL`. The returned
source is credential-redacted. If no connection string is configured, the API
must return an unavailable/not-configured response rather than fabricate
inventory.

`/api/database-manager/postgresql/crud/*` is the first real row-operation path.
It lists tables and columns, pages table rows, and supports row create, update
and delete for PostgreSQL. Schema, table and column identifiers are validated
before SQL is built. Row values are passed as JSON and converted by PostgreSQL
record typing; user values are not string-concatenated into SQL. Update and
delete requests require an explicit key object from the frontend; the embedded
workbench only enables those actions for tables where primary key columns are
known. DDL, truncation, backup/restore and batch destructive actions remain
outside this path and require the later policy/audit/approval workflow.

`/api/database-manager/clickhouse/inventory` reads
`ARCHITOKEN_DB_MANAGER_CLICKHOUSE_URL` first, then `CLICKHOUSE_URL`,
`ARCHITOKEN_TIMESERIES__URL`, `ARCHITOKEN_TIME_SERIES__URL` and
`ARCHITOKEN_ANALYTICS__URL`. Optional `CLICKHOUSE_USER` and
`CLICKHOUSE_PASSWORD` are used for HTTP basic auth. The API queries
`system.tables` only and returns table counts, rows and storage bytes.

`/api/database-manager/valkey/inventory` reads
`ARCHITOKEN_DB_MANAGER_VALKEY_URL`, `ARCHITOKEN_CACHE__URL`, `VALKEY_URL` or
`REDIS_URL`. It uses `INFO keyspace` and `DBSIZE` only; it must not scan keys by
default.

`/api/database-manager/qdrant/inventory` reads
`ARCHITOKEN_DB_MANAGER_QDRANT_URL`, `QDRANT_URL` or `ARCHITOKEN_VECTOR__URL` and
calls Qdrant `/collections`.

`/api/database-manager/nats-jetstream/inventory` reads
`ARCHITOKEN_DB_MANAGER_NATS_MONITOR_URL`, `NATS_MONITOR_URL` or
`ARCHITOKEN_EVENTS__MONITOR_URL` and calls the NATS monitoring `/jsz` endpoint.

`/api/database-manager/s3/inventory` reads
`ARCHITOKEN_DB_MANAGER_S3_ENDPOINT` / `ARCHITOKEN_DB_MANAGER_S3_BUCKET`, then
`S3_ENDPOINT` / `S3_BUCKET`. The initial implementation performs a read-only S3
`ListObjectsV2`-compatible bucket listing and parses `ListBucketResult`; it must
not read object bodies or mutate buckets.

### 5.2 Go Agent

Go owns lightweight operational reach:

- database-side probe agent
- tunnel / network adapter
- health and latency checks
- driver inventory collection
- CLI and sidecar operation
- isolated engine-specific connectors where Rust driver coverage is weak

The Go agent is not allowed to bypass Rust policy. It receives signed commands
from the Rust manager and returns structured evidence.

Initial runnable entry:

| Item | Value |
| --- | --- |
| Module | `04-backend/database-agent-go` |
| Command | `go run ./cmd/architoken-db-agent` for manifest output |
| Sidecar mode | `go run ./cmd/architoken-db-agent serve` |
| Default bind | `127.0.0.1:8752` |
| Health | `GET /readyz` |
| Manifest | `GET /manifest` |
| Probe | `GET /probe` |
| Smoke gate | `04-backend/scripts/smoke-database-agent-go.sh` |

Go expansion rule:

- keep Go in database/runtime probe, tunnel/network adapter, health collector,
  CLI, operator and isolated connector roles
- do not move policy, approval, schema authority or business Router decisions
  out of the Rust manager
- every new Go module must document owner, command/API contract, integration
  boundary, license state and CI/smoke evidence
- Go output is structured evidence for the manager; it is not an independent
  source of compliance, approval or mutation authority

### 5.3 Embedded Workbench

The current embedded workbench entry is:

| Item | Value |
| --- | --- |
| Route | `/app/database-manager` |
| Next.js proxy | `GET /api/database-manager/inventory` |
| Primary upstream | Rust manager `GET /api/database-manager/inventory` |
| Fallback context | Existing `GET /api/database-runtime` runtime snapshot |

Local runtime integration:

| Item | Value |
| --- | --- |
| Native launcher | `scripts/architoken-local.sh up` / `scripts/architoken-local.sh core` |
| Native log target | `scripts/architoken-local.sh logs db-manager` |
| Native status target | `scripts/architoken-local.sh status` |
| Docker service | `database-manager` in `05-infra/docker/docker-compose.yml` |
| Frontend upstream env | `ARCHITOKEN_DB_MANAGER_BASE_URL` |

The embedded page is a dense management surface with a unified Rust inventory
table, database object table and selected-object details. It is allowed to show
read-only runtime evidence, links and copy actions. It is not allowed to execute
DDL, write queries, destructive actions, backup/restore or migration approval
until the Rust policy/audit/approval path exists.

---

## 6. License Policy

The database manager core is Apache-2.0 only.

Allowed in core after license review:

- Apache-2.0
- MIT
- BSD
- ISC
- PostgreSQL License
- MPL-2.0 where static/distribution obligations are acceptable

Disallowed in distributed core:

- GPL
- AGPL
- LGPL without explicit legal and linking review
- SSPL
- BUSL
- Commons Clause
- Proprietary EULA code

Disallowed projects may still be used as external sidecars, reference systems or
clean-room UX/API references when their license permits that boundary.

The root repository is currently dual Apache-2.0 / MIT. This database manager
subproject is intentionally **Apache-2.0 only** unless the owner explicitly
changes that subproject license later.

---

## 7. Non-goals

ArchIToken Database Manager does not:

- embed CloudBeaver, DbGate, Bytebase, pgAdmin or other database GUI source code;
- clone proprietary database products;
- replace database engines;
- expose destructive actions without backup, approval and audit;
- bypass ArchIToken IAM, tenant, StorageRouter or audit boundaries;
- treat SQL query success as professional, compliance or production approval.

---

## 8. First Implementation Milestones

| Milestone | Deliverable |
| --- | --- |
| M1 | Rust crate with engine registry, capability model, license boundary and operation policy types |
| M2 | Go connector agent with manifest, health probe and structured evidence contract |
| M3 | PostgreSQL inventory: schemas, tables, columns, indexes and table size |
| M4 | ClickHouse inventory: databases, tables, row counts and storage sizes |
| M5 | Read-only query console with pagination and audit |
| M6 | Valkey/Redis keyspace inventory and safe browsing |
| M7 | Qdrant collection inventory and vector metadata browsing |
| M8 | SeaweedFS/S3 bucket/object inventory |
| M9 | NATS JetStream stream/consumer/message inventory |
| M10 | Migration/change plan review with approval and rollback evidence |

---

## 9. ArchIToken Integration Rule

`settings_center` remains the platform entry for database operations. It must
show manager status, runtime health, active providers and audit evidence, then
route users into ArchIToken Database Manager for actual database work.

Business modules must keep calling StorageRouter/DataRouter capabilities. They
must not call database products directly because a database manager is available.
