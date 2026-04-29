# ArchIToken Master Dossier

**Status**: active source-of-truth dossier  
**Root**: `/home/insome/dev/insomeos`  
**Branch**: `sync/architoken-integrate-20260427-093621`  
**Lineage**: ArchIToken, formerly InsomeOS  

---

## 1. Project Positioning

ArchIToken is an AEC Harness platform for heavy-steel, BIM, digital twin, construction supervision, production manufacturing and engineering AI workflows.

The project principle is:

```text
Agent = Model + Harness
```

ArchIToken lives in the Harness layer. Models, renderers, databases, inference engines and tools are replaceable through Registry and Router contracts. The product goal is to turn full lifecycle engineering work into auditable, schema-bound and reviewable business transactions.

ArchIToken is the renamed and continuing identity of InsomeOS. InsomeOS may appear only in formerly, lineage or historical migration context. New product UI, documents, contracts and module IDs use ArchIToken.

---

## 2. Current Source Of Truth

Repository Markdown, Schema files and code contracts are the only engineering source of truth. Chat logs, screenshots and verbal decisions are inputs only.

Current truth hierarchy:

| Priority | Source | Role |
|---:|---|---|
| 1 | `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md` | Truth index and override rules |
| 2 | `02-architecture/CONSTITUTION.md` | 21 binding engineering articles |
| 3 | `02-architecture/ARCHITOKEN-CONSTITUTION-ADDENDUM.md` | ArchIToken rename, Router, Schema, WebGPU, data and deployment principles |
| 4 | `02-architecture/BUSINESS_MODULE_WORKBENCH.md` | 11-module operational workbench contract |
| 5 | `docs/ARCHITOKEN_FULL_LOCAL_AUDIT.md` | Local audit, defect matrix and migration risk |
| 6 | `docs/ARCHITOKEN_PLATFORM_FUNCTIONAL_MAP.md` | Platform function map and frontend adapter boundaries |
| 7 | `docs/ARCHITOKEN_MODULE_WORKBENCH_REVIEW.md` | Review record for current frontend workbench implementation |

This dossier is the docs entry point. Detailed follow-up documents:

- [01_ARCHITOKEN_PRD.md](./01_ARCHITOKEN_PRD.md)
- [02_ARCHITOKEN_DEVELOPMENT_TASKBOOK.md](./02_ARCHITOKEN_DEVELOPMENT_TASKBOOK.md)
- [03_ARCHITOKEN_TECH_STACK.md](./03_ARCHITOKEN_TECH_STACK.md)
- [04_ARCHITOKEN_PANORAMA.md](./04_ARCHITOKEN_PANORAMA.md)

---

## 3. Binding Principles

| Principle | Contract |
|---|---|
| Active project name | `ArchIToken` |
| Historical name | `InsomeOS` only as formerly / lineage |
| Module extensibility | Registry replaces Enum |
| Active module key | `module_id` replaces `BusinessPhase`, `phase`, `9-phase` |
| Manufacturing module | `production_manufacturing` is active |
| Legacy aliases | `manufacturing` and `fabrication` are aliases only |
| AI gate | Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver |
| Rendering | WebGPU first, Three.js fallback |
| Design system | Global theme registry; default `wechat_light`; `industrial_dark` and `cockpit_blue` are switchable platform themes |
| Data | StorageRouter capability composition, not database product belief |
| Deployment | k8s + Docker + local private deployment |
| Language policy | Technology serves business goals; Rust/Cxx first for core, other languages allowed where justified |

---

## 4. 11 Module Overview

| Order | Active `module_id` | Chinese Name | Business Scope |
|---:|---|---|---|
| 1 | `marketing_service` | 市场客服 | Leads, consultation, requirement intake, quote draft, customer profile |
| 2 | `concept_design` | 方案设计 | Site condition, concept options, visual package, feasibility and preliminary model |
| 3 | `standard_library` | 标准族库 | Standards, families, templates, materials, drawings, models, methods, rules, versions |
| 4 | `detailed_design` | 深化设计 | IFC, DWG, node detailing, structural connection, coordination, clash and BCF |
| 5 | `quantity_costing` | 计量造价 | MTO, BOQ, cost baseline, price library, variation impact |
| 6 | `material_logistics` | 材料物流 | Inventory, suppliers, RFQ, purchase plan, cutting list, packing, loading, delivery, receiving, batch trace |
| 7 | `production_manufacturing` | 生产制造 | Production plan, routing, cutting optimization, CNC, welding, coating, QC, MES/ERP, shipping, rework |
| 8 | `construction_supervision` | 施工监理 | Method, progress, quality, safety, log, AR, 360, scanning, drone, robot, IoT, rectification, completion |
| 9 | `digital_twin` | 数字孪生 | WebGPU twin, Three.js fallback, IFC/GLB, point cloud, 3DGS, 360, IoT, progress, quality/safety/cost overlays |
| 10 | `digital_archive` | 数字档案 | Contracts, drawings, models, approval records, logs, quality/safety, completion docs, version chain |
| 11 | `settings_center` | 设置中心 | Tenant, module flags, roles, policies, model routing, storage adapters, audit policy |

Lifecycle chain:

```text
marketing_service
  -> concept_design
  -> detailed_design
  -> quantity_costing
  -> material_logistics
  -> production_manufacturing
  -> construction_supervision
  -> digital_twin
  -> digital_archive
```

`standard_library` supplies rules and engineering knowledge to all modules. `settings_center` supplies governance, Router, SLA, Schema and audit policy.

---

## 5. Operational Workbench Baseline

The frontend platform at `/app/modules` and `/app/modules/[moduleId]` is no longer a static presentation page. Current contract:

- Full-width operational shell with left module navigation, top status bar, central business work area and collapsible right inspector.
- Module route is driven by URL `moduleId`.
- Each module has feature panels, artifacts, tasks, approvals, risks, relationships, file types and visualization metadata.
- Digital twin shares the same platform Shell, navigation, toolbar, file dock, drawers, lifecycle, approval and AI assistant as every other module. Under `wechat_light`, its main panels, metrics, tree, monitor, gates, dock, labels and buttons must also be white-green; only the central model canvas may keep a professional high-contrast visualization background.
- `ArchIToken AI` is global, collapsible, dockable and writes module-context audit events.

Current mock implementation boundaries:

| Area | Current Contract | Future Replacement |
|---|---|---|
| Module registry | `03-frontend/lib/module-registry.ts` | Module Schema generated client |
| File system | `03-frontend/lib/module-file-system.ts` | OpenAPI file service + ObjectStore |
| Lifecycle | `03-frontend/lib/module-lifecycle.ts` | WorkflowRouter + TransactionStore |
| Backend adapter | `MockModuleBackendAdapter` | Real `ModuleBackendAdapter` OpenAPI client |
| Business ops | `module-operations.ts` | WorkflowRouter commands |
| Artifact ops | `module-actions.ts` | Artifact lifecycle API |

---

## 6. File System Contract

Each module owns a mock file tree with folders and files. Each node must carry:

```text
id, name, type, moduleId, parentId, size, mimeType, status,
version, owner, updatedAt, tags, permissions, auditTrail
```

Mouse contract:

| Gesture | Behavior |
|---|---|
| Left-click folder | Open folder and display children |
| Left-click file | Open preview drawer |
| Double-click folder | Enter folder |
| Double-click file | Open full view |
| Right-click file/folder | Show contextual operation menu |

Right-click operations:

| Operation | State Change |
|---|---|
| 打开 | Folder enters directory; file opens preview |
| 新建 | Creates folder or file under selected/current folder |
| 查看 | Opens preview drawer |
| 上传 | Creates mock uploaded file |
| 下载 | Creates download job and audit event |
| 移动 | Updates `parentId` |
| 复制 | Writes clipboard state |
| 粘贴 | Creates copy in target folder |
| 分享 | Generates mock share link |
| 删除 | Marks node `soft_deleted` |
| 属性 | Opens properties panel |
| 重命名 | Updates `name`, version and audit trail |

---

## 7. Lifecycle, Approval And State Machine

Every module has at least one default `ModuleTransaction`.

State set:

```text
draft, submitted, generating, evaluating, rule_checking,
schema_validating, pending_approval, approved, archived,
rejected, blocked
```

Event set:

```text
create, submit, generate, evaluate, rule_check, validate_schema,
request_approval, approve, reject, archive, reopen, block, resolve_blocker
```

Approval panel requirements:

- Current approver.
- Approval status.
- Approval comment.
- Approve, reject and return-to-edit actions.
- All actions write transaction audit trail and module audit stream.

---

## 8. AI Engineering Chain

ArchIToken must separate generation from evaluation:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

| Gate | Responsibility |
|---|---|
| Planner | Decompose tasks, choose inputs and tools, form execution path |
| Generator | Generate design, model, BOQ, report, workflow item or archive package |
| Evaluator | Independently assess output quality |
| RuleChecker | Run deterministic engineering, legal, safety and enterprise rules |
| SchemaValidator | Validate JSON Schema, IFC Schema, Module Schema, OpenAPI and AsyncAPI contracts |
| Approver | Human or automated release gate |

---

## 9. StorageRouter Capability Layers

ArchIToken does not bind product architecture to Supabase, PostgreSQL, Zedis, Redis or Valkey. These can be adapters, not faith objects.

| Capability | Purpose |
|---|---|
| `TransactionStore` | Business transaction, lifecycle state, approval and audit consistency |
| `ObjectStore` | PDF, DWG, IFC, GLB, SPZ, E57, images, video and archive packages |
| `VectorStore` | Standards, cases, drawing fragments, RAG and hybrid search |
| `TimeSeriesStore` | IoT, sensor, construction progress and machine telemetry |
| `GraphStore` | Component relationship, workflow dependency, supply chain and knowledge graph |
| `EventStore` | Async events, audit stream, workflow event sourcing |
| `CacheStore` | Session, queue, hot state, lock and short-lived task state |
| `AnalyticsStore` | Cost, progress, risk, productivity and BI queries |

---

## 10. WebGPU And Digital Twin

Digital twin rendering priority:

```text
WebGPU -> WASM preprocessing -> Three.js fallback -> degraded read-only viewer
```

Digital twin data sources:

- IFC/IFC4.3 semantic model.
- GLB/glTF web model.
- Point cloud for measured geometry and residual checks.
- 3DGS/SPZ for image-based reality layer.
- 360 panorama and site video.
- 3D scan/E57/LAS/PLY.
- Oblique photography and drone capture.
- IoT and SCADA-style telemetry.
- Progress, quality, safety and cost overlays.

---

## 11. P0/P1/P2 Defect Summary

From local audit:

| Priority | Defect | Impact |
|---|---|---|
| P0 | Active contracts still expose `BusinessPhase`, `phase`, `9-phase` in backend/OpenAPI/Python paths | Blocks Registry-first module architecture |
| P0 | ArchIToken/InsomeOS naming remains mixed across code, CI, agent and deployment | Creates product identity and package boundary drift |
| P0 | `manufacturing` / `fabrication` still appear in active contexts | Breaks `production_manufacturing` contract |
| P0 | Storage implementation names leak above StorageRouter layer | Couples business logic to database products |
| P1 | Frontend workbench uses mock adapter only | Functional UI exists, but real OpenAPI/DB/Agent contracts are not wired |
| P1 | WebGPU/3DGS runtime is not yet production-grade | Digital twin is architecturally aligned but rendering pipeline remains incomplete |
| P1 | Agent prompts and Python package still use old naming and phase-era contracts | AI execution chain is not fully module_id based |
| P2 | Historical docs still contain InsomeOS-era language | Requires archive markers and migration notes |
| P2 | Generated frontend build metadata appears in audit | Needs repo hygiene decision |

---

## 12. Recommended Repair Order

1. Freeze these five docs as docs entry point and keep them linked from README.
2. Migrate API and backend contracts from `BusinessPhase` / `phase` to `module_id`.
3. Add real Module Registry / Module Schema OpenAPI endpoints.
4. Implement real `ModuleBackendAdapter` OpenAPI client while preserving current mock adapter as test fixture.
5. Introduce StorageRouter capability interfaces before changing database products.
6. Migrate Python agent package and prompts from `insomeos_agent` and phase-era terms to ArchIToken module registry.
7. Add WebGPU capability detection, 3DGS loader contract and fallback tests for digital twin.
8. Clean naming drift in CI/release/deployment after product contracts are stable.
9. Add contract tests for file system, lifecycle state machine, approval and audit event sourcing.

---

## 13. Dossier Links

| Document | Purpose |
|---|---|
| [01_ARCHITOKEN_PRD.md](./01_ARCHITOKEN_PRD.md) | Product requirements and acceptance criteria |
| [02_ARCHITOKEN_DEVELOPMENT_TASKBOOK.md](./02_ARCHITOKEN_DEVELOPMENT_TASKBOOK.md) | Engineering taskbook and sprint breakdown |
| [03_ARCHITOKEN_TECH_STACK.md](./03_ARCHITOKEN_TECH_STACK.md) | Stack, constraints, adapters and selection principles |
| [04_ARCHITOKEN_PANORAMA.md](./04_ARCHITOKEN_PANORAMA.md) | Mermaid architecture, module, state, AI, storage and deployment diagrams |

---

## 2026-04-28 Local File Runtime Addendum

Upload is no longer only a mock label in the active frontend workbench. Local files now go through Next.js local file runtime, are stored under `03-frontend/.architoken/uploads/`, receive metadata in `index.json`, and enter module file nodes, lifecycle transactions, approval status, and audit events through `ModuleBackendAdapter.uploadLocalFile`.

### Local File Runtime Boundary

- Current runtime: Next.js API routes under `03-frontend/app/api/local-files/**`.
- Current storage: `03-frontend/.architoken/uploads/`.
- Current metadata: `03-frontend/.architoken/uploads/index.json`.
- Current viewer: `UniversalFileViewer` for image, video, audio, PDF, text, JSON, CSV, Office, engineering/BIM/CAD/point-cloud/3DGS, archive, and generic files.
- Production target: Rust API + `ObjectStore` + `TransactionStore` + `StorageRouter`; the frontend adapter contract remains stable.

### Layout Decision

- All modules use the same theme-aware platform Shell, file-management interaction model, lifecycle/approval drawers and AI assistant; the default visual language is the `wechat_light` white-green business theme.
- `digital_twin` is embedded in the unified ArchIToken Shell and consumes `--arch-twin-*` tokens. `wechat_light` makes the whole twin workbench white-green except for the central visualization canvas; `industrial_dark` and `cockpit_blue` can intentionally restore industrial/cockpit visuals as global themes.
