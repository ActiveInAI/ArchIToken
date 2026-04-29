# ArchIToken Development Taskbook

**Status**: active engineering taskbook  
**Branch**: `sync/architoken-integrate-20260427-093621`  
**Policy**: preserve current uncommitted frontend workbench changes; do not lower CI gates  

---

## 1. Branch And PR Background

This branch integrates the ArchIToken rename, frontend module workbench direction and local audit outcomes.

Current context:

- ArchIToken is the active project name; InsomeOS is historical lineage.
- The branch is ahead of remote because a prior frontend workbench commit exists.
- There are uncommitted frontend and docs changes for the operational module workbench.
- Current taskbook must not commit, push, modify CI, modify backend or overwrite frontend work.

---

## 2. Completed Work

| Area | Completed |
|---|---|
| Project identity | README and architecture docs state ArchIToken, formerly InsomeOS |
| Constitution | 21 articles define Harness, Registry, Router, Schema, WebGPU, StorageRouter and deployment principles |
| Local audit | Full local audit and file index created under docs |
| Module workbench | 11 active modules exposed in frontend registry |
| Module route | `/app/modules` and `/app/modules/[moduleId]` operational routing |
| File system mock | Module file tree, preview, properties and 12 right-click operations |
| Lifecycle mock | Module transaction, state machine, approval and audit trail |
| Backend adapter mock | `ModuleBackendAdapter` and `MockModuleBackendAdapter` contract |
| Unified design system | `ThemeProvider`, `theme-registry.ts` and `ThemeSwitcher` provide default `wechat_light` plus `industrial_dark` and `cockpit_blue` |
| Digital twin UI | `digital_twin` uses the shared Shell and `--arch-twin-*` tokens; `wechat_light` white-greens the workbench, while dark/blue cockpit visuals are global theme choices |
| AI assistant | Global foldable/dockable assistant with module-context audit actions |
| Frontend validation | Recent frontend lint, typecheck, tests and build passed |

---

## 3. Unfinished Work

| Area | Gap |
|---|---|
| Backend module contract | OpenAPI still needs `/v1/modules`, file, transaction and approval endpoints |
| Phase migration | `BusinessPhase`, `phase`, `9-phase` remain in backend/OpenAPI/Python contracts |
| Naming migration | InsomeOS/insomeos still appears in active code, CI, packages and deployment |
| Manufacturing migration | `manufacturing` and `fabrication` must become legacy aliases only |
| StorageRouter | Capability interfaces need implementation before product-level storage choices |
| Agent package | `insomeos_agent` needs ArchIToken package migration and compatibility shim |
| Digital twin runtime | WebGPU capability detection, loaders and 3DGS runtime are not complete |
| CI governance | Existing strict checks should remain, but project contracts must be repaired |
| Docs truth | Legacy docs need archive markers or migration updates |

---

## 4. P0/P1/P2 Task Breakdown

### P0

| Task | Owner Area | Acceptance |
|---|---|---|
| Replace `BusinessPhase` with `module_id` contracts | Backend/OpenAPI/Agent | No active API/schema uses phase-era module identity |
| Add Module Registry API contract | Backend/OpenAPI | `/v1/modules` and `/v1/modules/{module_id}` documented and typed |
| Preserve `production_manufacturing` as active ID | Full stack | `manufacturing` and `fabrication` are aliases only |
| Define StorageRouter capability interfaces | Backend architecture | TransactionStore/ObjectStore/VectorStore/etc. are explicit interfaces |
| Protect strict CI gates | CI/CD | No `-D warnings`, license or security gate is removed to hide failures |

### P1

| Task | Owner Area | Acceptance |
|---|---|---|
| Implement real `ModuleBackendAdapter` client | Frontend/Backend | Mock and real adapters share interface |
| Wire file operations to backend contract | Frontend/Backend | 12 operations persist via OpenAPI in non-mock mode |
| Wire lifecycle state machine to WorkflowRouter | Backend/Agent | Transaction transitions are audited and validated |
| Migrate Python agent prompts | Agent | Planner/Generator/Evaluator/RuleChecker/SchemaValidator/Approver use `module_id` |
| Implement WebGPU capability detection | Frontend/Digital Twin | WebGPU and Three.js fallback are tested paths |
| Define 3DGS loader contract | Digital Twin | SPZ/3DGS reality layer is distinct from point-cloud measurement layer |

### P2

| Task | Owner Area | Acceptance |
|---|---|---|
| Mark legacy docs | Docs | Historical InsomeOS docs have lineage notice |
| Clean generated files | Repo hygiene | Generated build metadata is ignored or intentionally tracked |
| Add more E2E tests | Testing | Playwright covers module navigation, file operations and approval |
| Expand design system tokens | Frontend | Workbench and cockpit share consistent visual primitives |

---

## 5. Sprint Plan

| Sprint | Focus | Deliverables |
|---|---|---|
| Sprint 0 | Documentation freeze | This 5-document docs set, README links, no code behavior changes |
| Sprint 1 | Contract repair | Module Registry OpenAPI, phase migration plan, `production_manufacturing` alias rules |
| Sprint 2 | Backend adapter | Real ModuleBackendAdapter, TransactionStore skeleton, audit event endpoint |
| Sprint 3 | Agent migration | ArchIToken agent package, module_id prompts, six-gate workflow contracts |
| Sprint 4 | Digital twin runtime | WebGPU detection, Three.js fallback tests, 3DGS/point-cloud loader contracts |
| Sprint 5 | Deployment hardening | Docker/k8s private deployment, local registry, observability and rollback |

---

## 6. Frontend Tasks

| Task | Acceptance |
|---|---|
| Keep `/app/modules` as full-width operational shell | No narrow display-only layout |
| Keep URL-driven module selection | URL and selected module never diverge |
| Add real adapter mode | Mock and real adapter selectable without changing components |
| Add E2E for file actions | Left-click and 12 right-click operations covered |
| Add E2E for lifecycle | Create, submit, approve, reject, archive covered |
| Add E2E for AI assistant | Fold, dock, chat drawer and context actions covered |
| Harden mobile layout | No unusable horizontal scroll as primary interaction |

---

## 7. Backend Tasks

| Task | Acceptance |
|---|---|
| Add Module Registry domain model | No enum-bound module identity |
| Add OpenAPI module endpoints | SDK can list and fetch modules by `module_id` |
| Add file service endpoints | CRUD-like operations map to file contract and audit |
| Add transaction endpoints | State machine validates events and stores audit |
| Add approval endpoints | Approve/reject/return changes transaction state |
| Add StorageRouter interfaces | Business logic depends on capabilities, not product names |
| Preserve strict Rust linting | Clippy failures are fixed, not hidden |

---

## 8. Database Tasks

| Task | Acceptance |
|---|---|
| Replace enum-style phase tables | `module_id TEXT` and registry tables replace phase enum |
| Add modules table | Stores module metadata, status, schema ref, route, aliases |
| Add files metadata table | Stores file nodes, status, version, owner, permissions |
| Add transaction table | Stores lifecycle state, related files/artifacts, actor |
| Add approval table | Stores approver, decision, comment, timestamp |
| Add append-only audit table | All file and lifecycle events are preserved |
| Add migration compatibility | Historical phase data maps to module IDs |

---

## 9. Agent Tasks

| Task | Acceptance |
|---|---|
| Migrate package naming | `architoken_agent` exists with compatibility shim for old imports |
| Replace phase prompts | Prompt loader uses module registry keys |
| Implement six-gate chain | Planner, Generator, Evaluator, RuleChecker, SchemaValidator, Approver are separate |
| Add structured output | Agent output validated by JSON Schema and Module Schema |
| Add trace hooks | Langfuse/OpenTelemetry-compatible trace IDs are emitted |
| Add tool routing | Tool use goes through ToolRouter and audit policy |

---

## 10. CI/CD Tasks

| Task | Acceptance |
|---|---|
| Keep existing strict gates | No workflow weakening |
| Add terminology lint | Active docs/code reject new phase-era active contracts |
| Add schema diff checks | OpenAPI, AsyncAPI, JSON Schema and Module Schema changes are reviewed |
| Add frontend contract tests | Module registry, adapter, file system and lifecycle tests run in CI |
| Add license and SBOM checks | Apache/MIT/BSD preference enforced |
| Add Docker/k8s build checks | Images, manifests and health checks validated |

---

## 11. Deployment Tasks

| Task | Acceptance |
|---|---|
| Local Docker stack | Frontend, backend, storage adapters and agent can start locally |
| Kubernetes manifests | Core services deploy with health checks and resource limits |
| Private deployment mode | No required external SaaS for core operation |
| GPU node support | Digital twin and local inference can request GPU resources |
| Offline install plan | Pinned images, local registry and model artifact strategy documented |
| Observability | Logs, traces, metrics and audit events are routeable |
| Rollback | Config and database migrations have rollback plan |

---

## 12. Testing Tasks

| Task | Acceptance |
|---|---|
| Unit tests | Registry, adapter, file operations and state machine covered |
| Type tests | Frontend TypeScript and backend Rust types enforce contracts |
| Contract tests | OpenAPI/AsyncAPI/Schema compatibility checks |
| E2E tests | Full module navigation, file workflow, approval and digital twin smoke |
| Security tests | RBAC, tenant isolation and audit tampering checks |
| Performance tests | File list, search, digital twin viewport and adapter calls within SLA |

---

## 13. Codex Task Template

Use this template for future implementation tasks:

```text
You are in /home/insome/dev/insomeos on branch sync/architoken-integrate-20260427-093621.

Scope:
- Modify only: <allowed paths>
- Do not modify: .github/workflows/**, backend/infra/etc. unless explicitly listed
- Do not commit
- Do not push

Read first:
- docs/00_ARCHITOKEN_MASTER_DOSSIER.md
- docs/01_ARCHITOKEN_PRD.md
- docs/02_ARCHITOKEN_DEVELOPMENT_TASKBOOK.md
- docs/03_ARCHITOKEN_TECH_STACK.md
- docs/04_ARCHITOKEN_PANORAMA.md
- specific implementation files

Task:
- <clear objective>

Acceptance:
- <observable state change>
- <tests to run>
- git status -sb
```

---

## 14. Task Acceptance Checklist

Every task must answer:

| Question | Required Answer |
|---|---|
| Does this keep ArchIToken as active name? | Yes |
| Does this avoid active `BusinessPhase` / `phase` / `9-phase`? | Yes or migration path documented |
| Does this keep `production_manufacturing` active? | Yes |
| Does this use Registry over Enum? | Yes |
| Does this avoid direct provider/database faith coupling? | Yes |
| Does this preserve strict CI intent? | Yes |
| Does this update source-of-truth docs if architecture changed? | Yes |
| Does this run relevant tests? | Yes |

---

## 15. 2026-04-28 Local File Runtime Task Template

Scope:

- Modify only `03-frontend/**` and explicitly allowed ArchIToken docs unless a future task expands scope.
- Do not modify CI, backend, infra, Docker/K8s, database migrations, Python Agent, or Rust backend during frontend runtime work.

Required implementation line:

- Preserve compact module rail and drawer-based inspector.
- Preserve unified Shell, file-management layout, drawers, lifecycle, approval and AI assistant across all modules.
- Preserve `wechat_light` as default platform theme, with `industrial_dark` and `cockpit_blue` selectable through `ThemeSwitcher`.
- Preserve professional visualization contrast only inside the `digital_twin` central canvas; the rest of the twin workbench must follow the active global theme.
- Keep local upload through Next.js API routes and `03-frontend/.architoken/uploads/`.
- Keep uploaded files bound to `ModuleBackendAdapter`, lifecycle transactions, approval state, and audit events.

Acceptance:

- `bun run lint`
- `bun run typecheck`
- `bun run test -- --run`
- `bun run build`
- `git status -sb`

Current P0 completion note: the frontend workbench now has a local file runtime. The next backend P0 is replacing the local runtime with Rust API + `ObjectStore` + `TransactionStore` + `StorageRouter` while keeping the adapter contract.
