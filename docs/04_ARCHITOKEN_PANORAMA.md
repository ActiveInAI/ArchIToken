# ArchIToken Panorama

**Status**: active architecture panorama
**Project**: ArchIToken
**Scope**: business modules, file system, lifecycle, AI chain, StorageRouter, digital twin, deployment and governance

---

## 1. Overall Architecture

```mermaid
flowchart TB
  User["Users: owner, designer, BIM, cost, factory, site, admin"]
  UI["Next.js 16.2.6 + React 19.2.5 Workbench"]
  ModuleRegistry["Module Registry + Module Schema"]
  Adapter["ModuleBackendAdapter"]
  API["OpenAPI REST Contract"]
  Events["AsyncAPI Event Contract"]
  Workflow["WorkflowRouter"]
  AI["AI Gate Chain"]
  Storage["StorageRouter"]
  Render["RenderRouter"]
  Geometry["GeometryRouter"]
  Audit["Append-only Audit"]

  User --> UI
  UI --> ModuleRegistry
  UI --> Adapter
  Adapter --> API
  API --> Workflow
  Workflow --> AI
  Workflow --> Storage
  Workflow --> Events
  Events --> Audit
  Storage --> Audit
  UI --> Render
  Render --> Geometry
  Geometry --> Storage
```

---

## 2. 11 Module Business Map

```mermaid
flowchart LR
  M1["marketing_service<br/>市场客服"]
  M2["concept_design<br/>方案设计"]
  M3["standard_library<br/>标准族库"]
  M4["detailed_design<br/>深化设计"]
  M5["quantity_costing<br/>计量造价"]
  M6["material_logistics<br/>材料物流"]
  M7["production_manufacturing<br/>生产制造"]
  M8["construction_management<br/>施工管理"]
  M9["digital_twin<br/>数字孪生"]
  M10["digital_archive<br/>数字档案"]
  M11["settings_center<br/>设置中心"]

  M1 --> M2
  M2 --> M4
  M4 --> M5
  M5 --> M6
  M5 --> M7
  M6 --> M8
  M7 --> M8
  M8 --> M9
  M9 --> M10

  M3 -. standards, rules, families .-> M2
  M3 -. standards, rules, families .-> M4
  M3 -. standards, rules, families .-> M5
  M3 -. standards, rules, families .-> M8
  M11 -. governance, router, SLA .-> M1
  M11 -. governance, router, SLA .-> M9
```

`production_manufacturing` is the active production module ID.

---

## 3. File System Map

```mermaid
flowchart TB
  Module["Module root folder"]
  Tree["Folder / file tree"]
  List["File list"]
  Preview["Preview drawer"]
  Properties["Properties panel"]
  Dialog["Operation dialog"]
  Adapter["ModuleBackendAdapter"]
  Audit["Audit event"]
  Transaction["ModuleTransaction touch"]

  Module --> Tree
  Tree --> List
  List -->|"left-click folder"| Tree
  List -->|"left-click file"| Preview
  List -->|"right-click"| Dialog
  Dialog -->|"open new view upload download move copy paste share delete properties rename"| Adapter
  Adapter --> Tree
  Adapter --> Properties
  Adapter --> Audit
  Adapter --> Transaction
```

Right-click operations:

```mermaid
flowchart LR
  Context["Context menu"]
  Open["打开"]
  New["新建"]
  View["查看"]
  Upload["上传"]
  Download["下载"]
  Move["移动"]
  Copy["复制"]
  Paste["粘贴"]
  Share["分享"]
  Delete["删除"]
  Props["属性"]
  Rename["重命名"]

  Context --> Open
  Context --> New
  Context --> View
  Context --> Upload
  Context --> Download
  Context --> Move
  Context --> Copy
  Context --> Paste
  Context --> Share
  Context --> Delete
  Context --> Props
  Context --> Rename
```

---

## 4. Lifecycle State Machine

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> submitted: submit
  draft --> generating: generate
  draft --> blocked: block

  submitted --> generating: generate
  submitted --> evaluating: evaluate
  submitted --> pending_approval: request_approval
  submitted --> rejected: reject
  submitted --> blocked: block

  generating --> evaluating: evaluate
  generating --> rule_checking: rule_check
  generating --> blocked: block

  evaluating --> rule_checking: rule_check
  evaluating --> schema_validating: validate_schema
  evaluating --> pending_approval: request_approval
  evaluating --> blocked: block

  rule_checking --> schema_validating: validate_schema
  rule_checking --> pending_approval: request_approval
  rule_checking --> blocked: block

  schema_validating --> pending_approval: request_approval
  schema_validating --> approved: approve
  schema_validating --> rejected: reject
  schema_validating --> blocked: block

  pending_approval --> approved: approve
  pending_approval --> rejected: reject
  pending_approval --> draft: reopen
  pending_approval --> blocked: block

  approved --> archived: archive
  approved --> draft: reopen
  approved --> blocked: block

  archived --> draft: reopen
  rejected --> draft: reopen
  rejected --> submitted: submit
  blocked --> submitted: resolve_blocker
  blocked --> draft: reopen
```

---

## 5. AI Engineering Chain

```mermaid
flowchart LR
  Planner["Planner<br/>task decomposition"]
  Generator["Generator<br/>produce artifact"]
  Evaluator["Evaluator<br/>independent review"]
  RuleChecker["RuleChecker<br/>deterministic rules"]
  SchemaValidator["SchemaValidator<br/>JSON IFC Module API schema"]
  Approver["Approver<br/>human or auto gate"]
  Artifact["Approved / archived artifact"]

  Planner --> Generator
  Generator --> Evaluator
  Evaluator --> RuleChecker
  RuleChecker --> SchemaValidator
  SchemaValidator --> Approver
  Approver --> Artifact
```

Generator must not evaluate itself.

---

## 6. StorageRouter Map

```mermaid
flowchart TB
  StorageRouter["StorageRouter"]
  TransactionStore["TransactionStore<br/>state, approval, rollback"]
  ObjectStore["ObjectStore<br/>IFC, GLB, PDF, SPZ, E57, video"]
  VectorStore["VectorStore<br/>standards, RAG, hybrid search"]
  TimeSeriesStore["TimeSeriesStore<br/>IoT and telemetry"]
  GraphStore["GraphStore<br/>components, workflow, supply chain"]
  EventStore["EventStore<br/>AsyncAPI and audit stream"]
  CacheStore["CacheStore<br/>session, queue, locks, task state"]
  AnalyticsStore["AnalyticsStore<br/>cost, progress, risk, BI"]

  StorageRouter --> TransactionStore
  StorageRouter --> ObjectStore
  StorageRouter --> VectorStore
  StorageRouter --> TimeSeriesStore
  StorageRouter --> GraphStore
  StorageRouter --> EventStore
  StorageRouter --> CacheStore
  StorageRouter --> AnalyticsStore
```

Database products are adapters under these capabilities.

---

## 7. Digital Twin Map

```mermaid
flowchart TB
  Twin["digital_twin"]
  Render["RenderRouter"]
  WebGPU["WebGPU primary"]
  Three["Three.js fallback"]
  Wasm["WASM preprocessing"]
  IFC["IFC4.3 semantics"]
  GLB["GLB / glTF web model"]
  PointCloud["Point cloud<br/>measurement and residual"]
  GS["3DGS / SPZ<br/>reality visual layer"]
  Panorama["360 panorama / video"]
  Scan["E57 / LAS / PLY scan"]
  Drone["Oblique photography / drone"]
  IoT["IoT / sensor stream"]
  Overlay["Progress, quality, safety, cost overlays"]
  Snapshot["Twin snapshot and model package"]

  Twin --> Render
  Render --> WebGPU
  Render --> Three
  Render --> Wasm
  Twin --> IFC
  Twin --> GLB
  Twin --> PointCloud
  Twin --> GS
  Twin --> Panorama
  Twin --> Scan
  Twin --> Drone
  Twin --> IoT
  IFC --> Overlay
  IoT --> Overlay
  PointCloud --> Overlay
  GS --> Overlay
  Overlay --> Snapshot
```

Point cloud is for measurement/control. 3DGS is an image-based reality layer.

---

## 8. Deployment Map

```mermaid
flowchart TB
  Dev["Local development"]
  Compose["Docker Compose / local stack"]
  Images["Pinned Docker images"]
  Registry["Private image registry"]
  K8s["Kubernetes production"]
  GPU["GPU nodes"]
  Services["Frontend, API, Agent, Storage adapters"]
  Observability["Logs, metrics, traces"]
  Backup["Backup and rollback"]

  Dev --> Compose
  Compose --> Images
  Images --> Registry
  Registry --> K8s
  K8s --> Services
  K8s --> GPU
  Services --> Observability
  Services --> Backup
```

Kubernetes and Docker are baseline. Local private deployment is a product requirement.

---

## 9. CI And Governance Map

```mermaid
flowchart TB
  PR["Pull Request"]
  Docs["Docs truth check"]
  Term["Terminology lint<br/>ArchIToken, module_id, production_manufacturing"]
  Frontend["Frontend lint typecheck test build"]
  Rust["Rust check clippy test"]
  Python["Python agent tests"]
  Schema["OpenAPI AsyncAPI JSON IFC Module Schema diff"]
  License["License and SBOM"]
  Security["Security and secret scan"]
  Docker["Docker / k8s validation"]
  Review["Architecture review"]
  Merge["Merge gate"]

  PR --> Docs
  PR --> Term
  PR --> Frontend
  PR --> Rust
  PR --> Python
  PR --> Schema
  PR --> License
  PR --> Security
  PR --> Docker
  Docs --> Review
  Term --> Review
  Frontend --> Review
  Rust --> Review
  Python --> Review
  Schema --> Review
  License --> Review
  Security --> Review
  Docker --> Review
  Review --> Merge
```

Strict CI is intentional. Do not remove gates to hide architectural drift.

---

## 10. Contract Summary

| Contract | Active Rule |
|---|---|
| Project name | `ArchIToken` active product, repository and compatibility name |
| Module identity | `module_id`, not `ModuleId` |
| Manufacturing | `production_manufacturing` active |
| Extensibility | Registry, not Enum |
| Data | StorageRouter capabilities |
| AI | Six-gate chain with independent evaluator |
| Rendering | WebGPU first, Three.js fallback |
| Deployment | k8s + Docker + local private |
| Docs | Repository docs are the only truth source |

---

## 11. Local File Runtime 图

```mermaid
flowchart LR
  User["用户本地文件"] --> Uploader["LocalFileUploader"]
  Uploader --> UploadAPI["Next API: /api/local-files/upload"]
  UploadAPI --> Bytes["03-frontend/.architoken/uploads/*"]
  UploadAPI --> Index["index.json metadata"]
  Index --> Adapter["ModuleBackendAdapter.uploadLocalFile"]
  Adapter --> FileNode["ModuleFileNode"]
  Adapter --> Tx["Upload Transaction"]
  Tx --> Schema["schema_validating"]
  Schema --> Approval["pending_approval"]
  Adapter --> Audit["ModuleAuditEvent"]
  FileNode --> Viewer["UniversalFileViewer"]
  Viewer --> ReadAPI["/api/local-files/{fileId}"]
  ReadAPI --> Bytes
```

## 12. 统一主题 Shell 与数字孪生画布边界

```mermaid
flowchart TB
  Shell["ModuleWorkbenchShell"]
  Shell --> Rail["72px compact module rail"]
  Shell --> Toolbar["Toolbar + ThemeSwitcher"]
  Shell --> Drawer["Inspector / audit drawer"]
  Shell --> Theme["ThemeProvider<br/>wechat_light default<br/>huly_light / huly_dark / huly_system optional"]
  Shell --> Shared["Shared file system<br/>lifecycle<br/>approval<br/>AI assistant"]
  Shell --> Normal["Normal modules"]
  Shell --> Twin["digital_twin"]
  Normal --> Explorer["File/object list"]
  Normal --> Business["Business objects + operations"]
  Shared --> Lifecycle["Lifecycle / approval drawer"]
  Twin --> Canvas["WebGPU / HMI canvas<br/>only central canvas may stay high contrast"]
  Shared --> Dock["Theme-aware twin data-source dock"]
  Dock --> Sources["IFC / GLB / point cloud / 360 / scan / oblique / WebGPU snapshot"]
```
