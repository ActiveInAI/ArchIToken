# ArchIToken Tech Stack

**Status**: active technical stack baseline
**Principle**: high performance, high concurrency, high efficiency, source-first openness, extensibility and maintainability
**Project**: ArchIToken
**Positioning**: AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS

---

## 1. Selection Principles

ArchIToken does not use technology as belief. Every language, database, model, renderer and framework must serve business goals.

| Principle | Meaning |
|---|---|
| High performance | Hot paths use Rust, Cxx, C++, WASM, WebGPU or GPU where justified |
| High concurrency | Backend services must support async, bounded resources and backpressure |
| High efficiency | Use mature ecosystems when they reduce delivery risk |
| Source-first openness | No default restriction on protocol, vendor, package manager, source build, runtime shape, local model runtime or deployment mode when capability is production-relevant |
| Extensible | Registry replaces Enum; adapters replace direct vendor binding |
| Open CDE / Workflow OS | UI and APIs organize files, lifecycle, approvals, evidence, audit and module transactions before visual decoration |
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
| UI components | Ant Design ecosystem + React + tokenized CSS | `antd`, icons, ProComponents, Charts, Ant Design X and `ConfigProvider` are the global UI baseline |
| Testing | Vitest, Playwright, ESLint, TypeScript | Unit, E2E, lint and type safety |

Current frontend packages include `antd@5.29.3`, `@ant-design/icons`, `@ant-design/pro-components`, `@ant-design/charts`, `@ant-design/x@1.6.1`, `antd-style`, `three@0.182.0`, `@react-three/fiber`, `@react-three/drei`, `vitest`, `playwright`, `eslint` and `tailwindcss`.

Design-system rule:

| Layer | Contract |
|---|---|
| Theme registry | `03-frontend/lib/theme-registry.ts` defines `wechat_light` and `industrial_dark` |
| Ant Design registry | `03-frontend/lib/design-system-registry.ts` defines the selected Ant Design runtime/reference packages and future development rules |
| Provider | `ThemeProvider` writes `data-theme`, persists `architoken_theme` in `localStorage`, and routes Ant Design through `ConfigProvider` + Chinese locale |
| Default theme | `wechat_light` 微信同款, used by Shell, navigation, toolbar, file system, drawers, approvals, lifecycle and AI assistant |
| Optional themes | `industrial_dark` 科幻魔法 is a platform-level mode, not a module-specific hardcoded shell |
| Digital twin | `/app/modules/digital_twin` uses the same CDE file workbench as every module; standalone `/app/digital-twin` is retired so the product has one synchronized module entry |
| Styling contract | Ant Design tokens are the first-class UI contract; `--arch-*` CSS variables remain the bridge for engineering viewers and legacy surfaces |
| Reference doc | `docs/FRONTEND_ANT_DESIGN_STANDARD.md` is the active frontend design-system contract |

Ant Design adoption rule:

- New UI must use Ant Design components, ProComponents, Ant Design Charts, Ant Design X, Ant Design icons, or tokenized Ant Design wrappers before custom controls.
- Ant Design Pro is a reference, not a replacement shell; ArchIToken keeps the Open CDE module workbench and 14-module registry.
- Ant Design 5 is the current production baseline because ProComponents and Ant Design X v1 share that peer contract. Ant Design 6 requires a coordinated package migration and CI validation before activation.
- Custom CSS is allowed for viewer canvases, transparent dock rails, BIM/CAD overlays and low-level responsive constraints, but it must inherit Ant Design/ArchIToken tokens.

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

Rust/Cxx is the preferred core, but Python/Go/C++/Perl are allowed when the module adapter, maintenance owner and contract are explicit.

### 3.1 Backend-Native File Runtime

复杂工程格式必须优先走后端原生/open runtime、授权适配器或外部进程 sidecar,而不是前端截图、空 Canvas、伪重绘或不可追溯派生。

统一优先级:

```text
source bytes / entity graph / vector / B-Rep / properties
-> lightweight native cache manifest
-> glTF / GLB / 3D Tiles / OBJ / IFC derivative
-> explicit failure
```

| Format family | Primary route | Cache / derivative contract |
|---|---|---|
| IFC | IfcOpenShell / ThatOpen fragments worker with source IFC as record | First upload emits property index and lightweight native manifests; GLB/fragments/tiles are cache candidates, not replacement records |
| DWG | ODA / LibreDWG / approved DWG-to-DXF adapter external process | Source DWG remains record; entity/vector route is required; raster or watermark preview is not production success |
| DXF | Native DXF entity parser / CAD vector viewport | Preserve model/layout/layer/entity semantics, line weight, color, text, blocks and dimensions before any PDF/image fallback |
| STEP/STP/IGES/IGS/BREP | OCCT/OCP/FreeCAD-compatible B-Rep worker route | Preserve B-Rep/topology/properties first; tessellated mesh is a lightweight display cache only |
| STL/OBJ/PLY/FBX/DAE/glTF | Mesh/source-native worker / Three.js runtime | Mesh bounds, camera fit, material/color preservation, metadata and source binding |
| PDF/3D PDF/Office/XML/3DXML/code/archive | Format-specific backend parser or source-preserving web viewer | Vector/source view first, stream source bytes with ETag/Range/cache and attach tool-specific manifest |

Streaming rule:

- Source bytes are served through stream APIs with `ETag`, `Last-Modified`, `Range` and cache headers.
- Workers must avoid repeated full-file parsing when a checksum-matched derivative exists.
- Large IFC/CAD/mesh properties must be paginated or indexed; frontends must not load a full IFC property graph into memory for every open.
- Derivative manifests must identify source file id, checksum, generator, command route, output artifacts, cache policy and legal adapter boundary.

Source-build rule:

- If Ubuntu/apt/snap packages are missing, stale or unable to satisfy a production adapter, build from the upstream GitHub source repository.
- Source builds are the preferred route for missing or weak CAD/BIM/PDF/AI adapters, not a last-resort workaround.
- Native/vector routes must be attempted and recorded before lightweight mesh/cache routes; screenshot, raster, or decorative redraw is a failure unless explicitly selected for a thumbnail.
- Source builds must be reproducible: record repository URL, commit/tag, build flags, install prefix and smoke evidence.
- GPL/AGPL/LGPL/SSPL/BUSL/copyleft or proprietary adapter code stays outside the distributed core as an external process, container, CLI, HTTP service or IPC sidecar unless legal review explicitly approves another distribution model.
- User-supplied GitHub links are not optional notes: each link must be recorded in `docs/ADAPTER_SOURCE_MAP.md`, classified, and either selected, isolated, licensed-gated, or explicitly blocked with a reason.
- Current DWG compatible sidecar baseline is LibreDWG built from `https://github.com/LibreDWG/libredwg` with `./autogen.sh`, `./configure --disable-bindings --disable-docs --disable-shared`, `make`, and a sidecar install prefix such as `/tmp/architoken-libredwg`. Runtime discovery checks `ARCHITOKEN_LIBREDWG_BIN`, `LIBREDWG_BIN_DIR`, `/tmp/architoken-libredwg/bin`, system paths and `PATH`.

Current CAD/BIM reference set:

- `https://ezdxf.readthedocs.io/en/stable/addons/odafc.html`
- `https://github.com/LibreDWG/libredwg`
- `https://github.com/oddworldng/dwg_to_dxf`
- `https://github.com/FreeCAD/FreeCAD`
- `https://github.com/FreeCAD/FreeCAD/releases/tag/1.1.1`
- `https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/Draft/importDWG.py`
- `https://github.com/datadrivenconstruction/ddc-dwgconverter`
- `https://github.com/datadrivenconstruction`
- `https://github.com/datadrivenconstruction/cad2data-Revit-IFC-DWG-DGN`
- `https://github.com/datadrivenconstruction/OpenConstructionERP`
- `https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR`
- `https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction`
- `https://github.com/datadrivenconstruction/Project-management-n8n-with-task-management-and-photo-reports`
- `https://github.com/datadrivenconstruction/CAD-BIM-to-Code-Automation-Pipeline-DDC-Workflow-with-LLM-ChatGPT`
- `https://github.com/Autodesk/revit-ifc`
- `https://github.com/pyrevitlabs/pyRevit/releases/tag/v6.4.0.26100%2B0515`
- `https://github.com/bvn-architecture/RevitBatchProcessor`
- `https://github.com/KoStard/ForgeCAD`
- `https://github.com/pascalorg/editor`
- `https://github.com/zalo/CascadeStudio`
- `https://github.com/lemony-ai/cascadeflow`
- `https://github.com/Open-Cascade-SAS/OCCT`
- `https://github.com/Open-Cascade-SAS/OCCT-Components`
- `https://occt3d.com/components/`
- `https://github.com/IfcOpenShell/IfcOpenShell`
- `https://github.com/buildingSMART`
- `https://github.com/hypar-io/Elements`
- `https://github.com/hcengineering/platform`
- `https://github.com/openclaw/openclaw/releases/tag/v2026.5.18`

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

- Local inference: Ollama, LM Studio, Hugging Face local cache / TGI endpoint, local Hugging Face model directories, vLLM, SGLang, TensorRT-LLM, LMDeploy, llama.cpp.
- External adapters: OpenAI-compatible APIs, Hugging Face Inference Endpoints and OpenRouter as provider adapters behind `InferenceRouter`.
- Commercial AI lanes: AI API metering, private model hosting, AEC Agent service packages and non-transferable Token service quota. These are service revenue units, not investment products.
- Observability: Langfuse-compatible traces and OpenTelemetry-style spans.
- Agent frameworks can include LangChain/LangGraph/Hermes/OpenClaw-style orchestration when they remain behind Router/Registry boundaries.
- OpenClaw is an agent runtime candidate, not a permission bypass; every tool call still flows through ToolRouter, approval state, audit, artifact storage and professional RuleChecker.
- AI-generated files must be persisted as module files with source prompt, input data ids, model route, adapter route, schema validation result and approver state before downstream modules consume them.

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
- Adapter contract.

---

## 6. Schema System

ArchIToken is a multi-schema system.

| Schema | Purpose |
|---|---|
| OpenAPI | REST API contract, SDK generation and UI adapter contract |
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
- Terminology lint for active `ModuleId`, `phase`, `module-registry`, active `production_manufacturing`, and legacy `manufacturing` / `fabrication` aliases.

Do not weaken gates to pass temporarily. Fix project contracts.

---

## 10. Disabled Or Cautious Items

| Item | Policy |
|---|---|
| Active `ArchIToken` naming | Disallowed except historical context |
| Active `ModuleId` / `phase` / `module-registry` | Disallowed in new contracts |
| Active `manufacturing` / `fabrication` module IDs | Disallowed; use `production_manufacturing` |
| Hardcoded module enum | Disallowed; use Registry |
| Direct external model calls in business code | Disallowed; use ModelRouter/InferenceRouter |
| Direct storage product dependency in business logic | Disallowed; use StorageRouter capabilities |
| Three.js as only renderer | Disallowed for digital twin core; WebGPU is primary |
| GPL/AGPL/SSPL/BUSL in distributed runtime | Disallowed unless isolated as external service and legally reviewed |
| Unpinned production dependencies | Disallowed |
| Alert-only buttons | Disallowed for workbench interactions; state must change |

---

## 11. Current Session Contracts

| File | Contract |
|---|---|
| `03-frontend/lib/module-registry.ts` | 14 modules, active IDs, aliases, artifacts, workflows, standards and data objects |
| `03-frontend/lib/module-file-system.ts` | Typed file/folder nodes, initial module tree, download/share concepts |
| `03-frontend/lib/module-lifecycle.ts` | Transaction states, events, approvals and transitions |
| `03-frontend/lib/module-backend-adapter.ts` | Session backend adapter and future real adapter interface |
| `03-frontend/lib/module-operations.ts` | Module-specific interactive business operations |
| `03-frontend/components/ModuleFileExplorer.tsx` | File operations UI contract |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | Unified 14-module shell, including `/app/modules/digital_twin` |

These are not final backend architecture. They are frontend contracts that must be replaced behind interfaces.

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
| Digital twin import | unified CDE module files plus standalone cockpit data-source dock | WebGPU renderer + 3DGS/IFC/point-cloud pipeline behind StorageRouter and adapter contracts |

This local runtime is intentionally not a database product choice. It is a contract proving ground for the future `StorageRouter` capability layer.
