# ArchIToken Tech Stack

**Status**: active technical stack baseline
**Principle**: high performance, high concurrency, high efficiency, extensibility and maintainability
**Project**: ArchIToken

---

## 1. Selection Principles

ArchIToken does not use technology as belief. Every language, database, model, renderer and framework must serve business goals.

| Principle | Meaning |
|---|---|
| High performance | Hot paths use Rust, Cxx, C++, WASM, WebGPU or GPU where justified |
| High concurrency | Backend services must support async, bounded resources and backpressure |
| High efficiency | Use mature ecosystems when they reduce delivery risk |
| Extensible | Registry replaces Enum; adapters replace direct vendor binding |
| Maintainable | Strong types, schema contracts, tests, CI and docs truth |
| Auditable | File, lifecycle, approval, model and tool actions produce audit evidence |
| Private deployable | k8s + Docker + local private deployment must work without external SaaS as a hard dependency |

---

## 2. Frontend Stack

| Layer | Choice | Role |
|---|---|---|
| App framework | Next.js `16.2.4` | App router, pages, workbench shell, build pipeline |
| UI runtime | React `19.2.5` | Component state, interaction, workbench composition |
| Language | TypeScript | Typed contracts, registry fixtures, adapter interfaces |
| Package/runtime | Bun | Dev server, scripts, tests and package management |
| Rendering core | WebGPU | Primary path for BIM/digital twin high-performance viewport |
| Compatibility renderer | Three.js fallback | Ecosystem layer and lower-capability fallback |
| Compute/parser bridge | WASM | Client-side geometry preprocessing and file parsing where useful |
| UI components | React + Tailwind/CSS + existing dependencies | No unnecessary package growth |
| Testing | Vitest, Playwright, ESLint, TypeScript | Unit, E2E, lint and type safety |

Current frontend packages include `three@0.184.0`, `@react-three/fiber`, `@react-three/drei`, `vitest`, `playwright`, `eslint`, `tailwindcss` and `lucide-react`.

Design-system rule:

| Layer | Contract |
|---|---|
| Theme registry | `03-frontend/lib/theme-registry.ts` defines `wechat_light`, `industrial_dark` and `cockpit_blue` |
| Provider | `ThemeProvider` writes `data-theme` and persists `architoken_theme` in `localStorage` |
| Default theme | `wechat_light` 白绿业务, used by Shell, navigation, toolbar, file system, drawers, approvals, lifecycle and AI assistant |
| Optional themes | `industrial_dark` and `cockpit_blue` are platform-level modes, not module-specific hardcoded shells |
| Digital twin | `--arch-twin-*` tokens theme the whole twin workbench; `wechat_light` is white-green across panels and controls, while only the central canvas may use high-contrast rendering |
| Styling contract | Components consume CSS variables such as `--arch-bg`, `--arch-surface`, `--arch-border`, `--arch-text`, `--arch-primary`, `--arch-drawer-width` |

Rendering rule:

```text
Next.js + React + TypeScript = application workbench
WebGPU + WASM = performance and rendering core
Three.js = fallback, ecosystem and validation layer
```

---

## 3. Backend Stack

| Layer | Choice | Role |
|---|---|---|
| Core services | Rust first | Harness core, Router, state guards, schema gates, high-concurrency APIs |
| FFI bridge | Cxx | Rust/C++ interop for geometry and CAD/BIM hot paths |
| Geometry kernels | Rust/C++/Cxx/WASM | IFC, STEP, DWG/DXF, OCCT/CGAL-style geometry workflows |
| Tooling languages | Python, Go, Perl, Shell | AI ecosystem adapters, CLI tools, infra glue, text processing where useful |
| Performance extensions | CUDA/C++/Rust FFI | GPU acceleration when WebGPU or server GPU is not enough |

Rust/Cxx is the preferred core, but Python/Go/C++/Perl are allowed when the module boundary, maintenance owner and contract are explicit.

---

## 4. AI And Agent Stack

ArchIToken uses a routed AI engineering chain, not model-specific direct calls.

| Component | Role |
|---|---|
| Agent | Task actor bound by Harness, Schema and tools |
| Planner | Breaks task into steps and selects inputs/tools |
| Generator | Produces design, model, BOQ, report, workflow item or archive |
| Evaluator | Independently reviews generated output |
| RuleChecker | Runs deterministic business, safety, engineering and legal rules |
| SchemaValidator | Validates JSON Schema, IFC Schema, Module Schema, OpenAPI and AsyncAPI |
| Approver | Human or automated release gate |
| ModelRouter | Model selection, whitelist, cost, SLA, fallback |
| InferenceRouter | Local and remote inference execution abstraction |
| ToolRouter | Tool permission, sandbox, execution and audit |
| WorkflowRouter | Module transaction orchestration and DAG execution |

Supported adapter direction:

- Local inference: Ollama, vLLM, SGLang, TensorRT-LLM, LMDeploy, llama.cpp.
- External adapters: OpenAI-compatible APIs and OpenRouter as one external provider adapter.
- Observability: Langfuse-compatible traces and OpenTelemetry-style spans.
- Agent frameworks can include LangChain/LangGraph/Hermes-style orchestration when they remain behind Router/Registry boundaries.

---

## 5. StorageRouter And Data Capabilities

ArchIToken databases are capability layers, not product faith. Supabase, PostgreSQL, Zedis, Redis, Valkey or object stores are adapters and implementation options.

| Capability | Required Responsibility |
|---|---|
| `TransactionStore` | Lifecycle transaction, approval, status, consistency and rollback |
| `ObjectStore` | Large files: IFC, GLB, DWG, PDF, SPZ, E57, images, video and archive packages |
| `VectorStore` | Standards, RAG, drawing snippets, semantic search and hybrid retrieval |
| `TimeSeriesStore` | IoT, telemetry, equipment state, sensor and progress time series |
| `GraphStore` | Component graph, knowledge graph, workflow dependency and supply chain relationships |
| `EventStore` | Async events, append-only audit, event sourcing and workflow stream |
| `CacheStore` | Session, queue, hot state, locks, token cache and task state |
| `AnalyticsStore` | Progress, cost, risk, production and BI workloads |

Storage selection must document:

- Data shape.
- Access pattern.
- Consistency requirement.
- Tenant isolation.
- Backup and restore.
- Migration and rollback.
- Adapter boundary.

---

## 6. Schema System

ArchIToken is a multi-schema system.

| Schema | Purpose |
|---|---|
| OpenAPI | REST API contract, SDK generation and UI adapter boundary |
| AsyncAPI | Events, queues, workflow notifications and async jobs |
| JSON Schema | Agent input/output, structured data and config validation |
| IFC Schema | BIM semantics, components, property sets and relationships |
| Module Schema | Module registration, inputs, outputs, UI metadata, SLA, permissions and audit |

Rule:

```text
module_id + Module Registry + Module Schema
```

replace:

```text
ModuleId + phase + module-registry
```

---

## 7. Deployment Stack

| Area | Choice |
|---|---|
| Local development | Docker Compose or equivalent local stack |
| Service packaging | Docker images |
| Production orchestration | Kubernetes |
| Small private installs | Docker + local configuration; K3s only for constrained edge cases |
| GPU | k8s GPU node scheduling, NVIDIA runtime/device plugin strategy |
| Config | Versioned config, secrets adapter and environment profiles |
| Delivery | Helm/Kustomize/GitOps-compatible path |
| Observability | OpenTelemetry, metrics, logs, traces and audit streams |
| Rollback | Health checks, migration rollback and versioned config |

Private deployment is a product feature. Core operation must not require external SaaS.

---

## 8. Security And Audit

| Control | Requirement |
|---|---|
| Tenant isolation | Tenant ID, RBAC/ABAC and optional physical isolation |
| Permission model | Least privilege for users, modules, tools and files |
| Audit | Append-only events for files, transactions, approvals, tools and model calls |
| Secrets | External secrets adapter, rotation and no plaintext secrets in repo |
| Supply chain | License checks, SBOM, pinned dependencies and provenance where possible |
| Model safety | Prompt injection tests, tool sandbox, schema validation and evaluator separation |
| Data privacy | PIPL/GDPR-style consent, retention and export policy where applicable |

---

## 9. CI/CD

CI should be strict and should reveal project drift rather than hide it.

Required gates:

- Rust check, clippy and tests.
- Frontend lint, typecheck, tests and build.
- Python tests and package checks where Python agent is active.
- License and security scans.
- OpenAPI/AsyncAPI/Schema diff checks.
- Docker/k8s build and manifest validation.
- Terminology lint for active `ModuleId`, `phase`, `module-registry`, active `production_manufacturing` and active `production_manufacturing`.

Do not weaken gates to pass temporarily. Fix project contracts.

---

## 10. Disabled Or Cautious Items

| Item | Policy |
|---|---|
| Active `ArchIToken` naming | Disallowed except historical context |
| Active `ModuleId` / `phase` / `module-registry` | Disallowed in new contracts |
| Active `production_manufacturing` / `production_manufacturing` module IDs | Disallowed; use `production_manufacturing` |
| Hardcoded module enum | Disallowed; use Registry |
| Direct external model calls in business code | Disallowed; use ModelRouter/InferenceRouter |
| Direct storage product dependency in business logic | Disallowed; use StorageRouter capabilities |
| Three.js as only renderer | Disallowed for digital twin core; WebGPU is primary |
| GPL/AGPL/SSPL/BUSL in distribution boundary | Disallowed unless isolated as external service and legally reviewed |
| Unpinned production dependencies | Disallowed |
| Alert-only mock buttons | Disallowed for workbench interactions; state must change |

---

## 11. Current Mock Contracts

| File | Contract |
|---|---|
| `03-frontend/lib/module-registry.ts` | 14 modules, active IDs, aliases, artifacts, workflows, standards and data objects |
| `03-frontend/lib/module-file-system.ts` | Typed file/folder nodes, initial module tree, download/share concepts |
| `03-frontend/lib/module-lifecycle.ts` | Transaction states, events, approvals and transitions |
| `03-frontend/lib/module-backend-adapter.ts` | Mock backend adapter and future real adapter interface |
| `03-frontend/lib/module-operations.ts` | Module-specific interactive business operations |
| `03-frontend/components/ModuleFileExplorer.tsx` | File operations UI contract |
| `03-frontend/components/DigitalTwinWorkbench.tsx` | Theme-tokenized twin workbench with WebGPU/HMI canvas semantics |

These are not final backend architecture. They are frontend contracts that must be replaced behind interfaces, not deleted casually.

---

## 12. 2026-04-28 Frontend Runtime Addendum

The active frontend stack now includes a local development file runtime:

| Layer | Current implementation | Production direction |
|---|---|---|
| Upload API | Next.js route handlers | Rust API upload endpoint |
| File bytes | `03-frontend/.architoken/uploads/` | `ObjectStore` capability |
| Metadata | `index.json` | Transaction / metadata store |
| UI binding | `ModuleBackendAdapter.uploadLocalFile` | OpenAPI client implementing the same adapter |
| Preview | `UniversalFileViewer` | Specialized parsers/viewers where available |
| Digital twin import | data-source dock | WebGPU renderer + 3DGS/IFC/point-cloud pipeline |

This local runtime is intentionally not a database product choice. It is a contract proving ground for the future `StorageRouter` capability layer.
