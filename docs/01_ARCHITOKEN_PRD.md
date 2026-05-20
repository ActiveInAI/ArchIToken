# ArchIToken Product Requirements Document

**Status**: active PRD baseline
**Product**: ArchIToken
**Scope**: AEC full-lifecycle operational platform, 14 modules, module workbench, file system, AI gates and digital twin

---

## 1. Product Background

ArchIToken is an AI-native AEC Harness platform for heavy-steel structure projects and adjacent BIM/digital-twin workflows. The product is designed to make engineering work executable, traceable and governable across customer intake, design, costing, supply chain, production_manufacturing, construction, digital twin and archive.

The platform is not a static dashboard. It must behave as a business operating system:

- Every business module is entered by active `module_id`.
- Every file, artifact, approval, transaction and AI action leaves evidence.
- Generator and Evaluator are separate.
- Digital twin prioritizes WebGPU and keeps Three.js as fallback.
- Data access goes through StorageRouter capabilities, not direct product coupling.
- Local private deployment with Docker and Kubernetes is a first-class requirement.

---

## 2. User Roles

| Role | Primary Needs |
|---|---|
| Owner / client | Requirement confirmation, quote review, design approval, archive handover |
| Project manager | Full lifecycle progress, risks, approvals, cost, construction evidence |
| Architect / concept designer | Requirement intake, option generation, presentation package |
| BIM engineer | IFC/GLB model, component tree, clash, attributes, model-to-file consistency |
| Cost engineer | MTO, BOQ, price library, change impact and cost approval |
| Procurement manager | Supplier, RFQ, price comparison, purchase plan, batch trace |
| Production planner | Work orders, routing, CNC files, QC, MES/ERP and shipping |
| Construction supervisor | Method, progress, quality, safety, logs, AR/360/scanning evidence and rectification |
| Digital twin engineer | WebGPU scene, point cloud, 3DGS, overlays, IoT, snapshot and model package export |
| Document controller | Archive package, version chain, signature and retention |
| Platform administrator | Tenant, RBAC, model routing, storage adapter, audit policy |
| AI engineer | Agent gates, router, prompt, schema validation, trace and evaluation |

---

## 3. Core Business Goals

| Goal | Requirement |
|---|---|
| Full lifecycle execution | 14 modules form a single chain from lead to archive |
| Operational UI | `/app/modules` and `/app/modules/[moduleId]` must support real interactions, not display-only cards |
| File governance | Module files support open, preview, properties, audit, share and lifecycle links |
| State governance | Each module has transaction state machine and approval flow |
| AI governance | Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver |
| BIM integrity | Geometry, attributes, version, schema and file evidence must remain linked |
| Digital twin | WebGPU-first twin canvas with Three.js fallback, reality capture layers and unified platform Shell |
| Private deployment | Docker, Kubernetes and offline/local private installation are product requirements |
| Design system | Default `huly_light`, with `huly_dark`, `huly_system`, `huly_spacious` and `huly_compact` as platform-level switchable appearance options |

---

## 4. Module Requirements

| `module_id` | Subdomains | Inputs | Outputs | Artifacts | File Types | Approval Points |
|---|---|---|---|---|---|---|
| `marketing_service` | 客户线索, 咨询记录, 需求采集, 报价草案, 跟进任务, 客户画像 | Customer messages, site photos, budget, schedule, consent | `concept_design` | Lead Token, requirement brief, quote draft | `.pdf`, `.docx`, `.jpg`, `.mp3`, `.json` | Customer consent, quote draft approval |
| `concept_design` | 场地条件, 方案草图, 风格选型, 指标分析, 初步模型 | `marketing_service`, `standard_library` | `detailed_design`, `quantity_costing` | Concept Token, scheme pack, preliminary GLB/IFC | `.png`, `.mp4`, `.ifc`, `.glb`, `.pdf`, `.json` | Scheme review, client confirmation |
| `standard_library` | 标准规范, 族库构件, 样板文件, 材质库, 图纸, 模型, 做法库, 规则库, 版本库 | Standards, enterprise rules, model families, materials | All modules | Code Clause Token, family pack, rule pack | `.ifc`, `.glb`, `.rfa`, `.dwg`, `.dxf`, `.pdf`, `.json`, `.xlsx` | Standard version release, rule pack approval |
| `detailed_design` | IFC 模型, DWG 图纸, 节点深化, 结构连接, 管线协调, 碰撞检查 | `concept_design`, `standard_library` | `quantity_costing`, `production_manufacturing`, `construction_management`, `digital_twin` | Design Token, IFC4.3 model, BCF package | `.ifc`, `.ids`, `.bcf`, `.dwg`, `.dxf`, `.pdf`, `.step`, `.glb` | Model release, drawing review, BCF closure |
| `quantity_costing` | 工程量, BOQ, 清单, 成本测算, 价格库, 变更估算 | `concept_design`, `detailed_design`, `standard_library` | `material_logistics`, `production_manufacturing` | BOQ Token, cost baseline, variation report | `.ifc`, `.xlsx`, `.csv`, `.pdf`, `.json` | Cost baseline approval, BOQ approval |
| `material_logistics` | 库存, 供应商, 价格, 询价/比价, 采购计划, 下料单, 加工 BOM, 包装, 装车, 物流, 到货, 现场堆放, 签收, 批次追踪 | `quantity_costing`, `production_manufacturing` | `construction_management`, `digital_twin` | Material Token, purchase plan, logistics pack | `.xlsx`, `.csv`, `.pdf`, `.jpg`, `.json`, `.qr` | Supplier selection, purchase approval, receiving sign-off |
| `production_manufacturing` | 生产计划, 工序路线, 下料优化, CNC/数控文件, 焊接, 喷涂/防腐/防火, 质检, 工厂排产, MES/ERP, 构件编码, 包装发运, 返工 | `detailed_design`, `quantity_costing`, `standard_library`, `material_logistics` | `construction_management`, `digital_twin` | Production Token, CNC package, factory QC pack | `.ifc`, `.nc`, `.dxf`, `.step`, `.xlsx`, `.pdf`, `.json` | Work order release, CNC release, factory QC approval, shipment release |
| `construction_management` | 施工方案, 进度, 质量, 安全, 日志, AR, 360, 三维扫描, 倾斜摄影, 无人机, 建筑机器人, IoT, 影像对比, 整改闭环, 竣工资料 | `detailed_design`, `production_manufacturing`, `material_logistics`, `standard_library` | `digital_twin`, `digital_archive` | Evidence Token, site log, rectification package | `.pdf`, `.jpg`, `.mp4`, `.e57`, `.las`, `.ply`, `.bcf`, `.ifc`, `.json` | Method approval, hidden work acceptance, safety approval, rectification closure |
| `digital_twin` | WebGPU 状态, Three.js fallback, IFC/GLB/点云/360/扫描/倾斜摄影, 构件树, 图层管理, 进度对比, 质量/安全/成本叠加, 视角切换, IoT | `construction_management`, `detailed_design`, `material_logistics`, `production_manufacturing` | `digital_archive`, `settings_center` | Twin Token, 3DGS/point-cloud layer, overlay package | `.ifc`, `.glb`, `.gltf`, `.spz`, `.ply`, `.e57`, `.las`, `.mp4`, `.jpg`, `.json` | Twin snapshot approval, model package release |
| `digital_archive` | 项目档案, 图纸档案, 模型档案, 审批记录, 施工日志, 质量安全记录, 竣工资料, 版本链 | `construction_management`, `digital_twin`, `standard_library` | Long-term archive | Archive Token, handover package, retention index | `.pdf`, `.pdfa`, `.ifc`, `.glb`, `.zip`, `.xlsx`, `.mp4`, `.json` | Archive completeness, signature check, handover approval |
| `settings_center` | 租户设置, 模块开关, 用户角色, 权限策略, 模型路由, 存储适配器, 审计策略 | `standard_library`, platform policies | All modules | Governance Token, route table, settings snapshot | `.yaml`, `.json`, `.md`, `.csv` | Governance release, RBAC policy approval, storage adapter approval |

---

## 5. File And Folder System Requirements

Every module must expose a module-scoped file explorer. It must support folders and files, and preserve state during the current session when backed by the session adapter.

Required node fields:

```text
id, name, type, moduleId, parentId, size, mimeType, status,
version, owner, updatedAt, tags, permissions, auditTrail
```

Left-click behavior:

| Target | Required Behavior |
|---|---|
| Folder | Open folder and display children |
| File | Open preview drawer or details panel |

Double-click behavior:

| Target | Required Behavior |
|---|---|
| Folder | Enter folder |
| File | Full-view mode |

Right-click operations:

| Operation | Required Behavior |
|---|---|
| 打开 | Folder enters directory; file opens preview |
| 新建 | Creates file or folder |
| 查看 | Opens preview |
| 上传 | Creates uploaded file node |
| 下载 | Creates download task and audit event |
| 移动 | Opens target selector and updates `parentId` |
| 复制 | Writes clipboard state |
| 粘贴 | Creates copy in current folder |
| 分享 | Opens share dialog and creates share link |
| 删除 | Soft deletes node and keeps audit evidence |
| 属性 | Opens properties panel |
| 重命名 | Updates name and audit trail |

---

## 6. Lifecycle Transaction Requirements

Each module must have one or more `ModuleTransaction` records:

```text
id, moduleId, type, status, currentState, actor, createdAt, updatedAt,
relatedFileIds, relatedArtifactIds, approvals, auditTrail
```

Required states:

```text
draft, submitted, generating, evaluating, rule_checking,
schema_validating, pending_approval, approved, archived,
rejected, blocked
```

Required events:

```text
create, submit, generate, evaluate, rule_check, validate_schema,
request_approval, approve, reject, archive, reopen, block, resolve_blocker
```

All state transitions must be performed through `ModuleBackendAdapter` and the OpenAPI lifecycle endpoints; production persistence is backed by PostgreSQL `TransactionStore` tables with the same state machine.

---

## 7. Approval Flow Requirements

Approval panel must show:

- Current transaction.
- Current approver.
- Approval state.
- Approval comment.
- Approve action.
- Reject action.
- Return-to-edit action.
- Transaction audit trail.

Approval must be connected to files and artifacts where relevant, not just free text.

---

## 8. AI Assistant And AI Home Requirements

`ArchIToken AI` is a global assistant and must:

- Default to folded/docked mode to avoid blocking core operations.
- Expand into profile and chat area.
- Show AI name, certified level, role, work samples, capability tags and module-context suggestions.
- Include quick actions for generate, check, approval suggestion, risk review and customer contact.
- Write current module audit events on quick actions.
- Support a profile-style AI home with recent works, capabilities and follow/favorite/copy-link interactions.

---

## 9. Digital Twin Requirements

The `digital_twin` module is a WebGPU-first twin canvas embedded in the same ArchIToken platform Shell as every other module. It is not a generic card page and it is not a separate dark-shell product.

Global UI requirements:

- Shell, module rail, toolbar, file dock, drawers, context menu, lifecycle, approval and AI assistant follow the active global theme.
- Default theme is `huly_light`.
- `huly_dark` and `huly_system` can be selected from the platform toolbar and persisted through `architoken_theme`; `huly_spacious` and `huly_compact` manage global font sizing.
- When `huly_light` is active, digital twin metrics, tree, monitor, gates, dock, buttons, labels, borders, text and background must remain in the unified Huly workbench surface. Only the central model canvas may use a professional high-contrast visualization background.

Required capability:

- WebGPU-first rendering status.
- Three.js fallback status.
- IFC/GLB semantic model.
- Point cloud for geometric measurement.
- 3DGS/SPZ as image-based reality layer.
- 360 panorama and site video.
- 3D scanning and oblique photography.
- Component tree.
- Layer manager.
- Progress comparison.
- Quality/safety/cost overlays.
- View controls.
- IoT and sensor state.
- Snapshot and model package export.

3DGS must be documented as a reality-capture visual layer. Point cloud remains the measurement/control layer.

---

## 10. Local Private Deployment Requirements

ArchIToken must support:

| Deployment Mode | Requirement |
|---|---|
| Local development | Docker Compose or equivalent local stack |
| Private single-machine install | Docker + local configuration |
| Production | Kubernetes |
| GPU workloads | k8s node selection, NVIDIA runtime/device plugin strategy |
| Offline or weak network | Local image registry, pinned dependencies, local model/provider adapters |
| Observability | OpenTelemetry-compatible logs, traces and metrics |
| Rollback | Versioned config, migration plan and health checks |

---

## 11. Acceptance Criteria

| Area | Acceptance |
|---|---|
| Naming | Active UI/docs use ArchIToken; ArchIToken only historical |
| Module IDs | 14 active IDs match registry; `planning_management`, `finance_hr`, and `ai_center` are active |
| Legacy aliases | `manufacturing` and `fabrication` normalize to `production_manufacturing`; new contracts use only the active ID |
| Routing | `/app/modules/[moduleId]` displays the requested module |
| File system | Left-click and all 12 right-click operations change frontend state |
| Lifecycle | State machine transitions are visible and auditable |
| Approval | Approve/reject/return actions change transaction status |
| AI gates | Six-stage gate chain is visible for each module |
| Digital twin | Unified Shell remains active; `huly_light` keeps the whole twin workbench aligned with the shared Huly surface except the central visualization canvas; WebGPU and Three.js fallback remain available |
| Adapter | Current session adapter exposes a replaceable contract for OpenAPI/DB/Agent |
| Deployment | Docs and future implementation support k8s + Docker + local private deployment |
| Tests | Frontend lint, typecheck, tests and build must pass for frontend PRs |

---

## 12. Non-Goals For Current Session Stage

These are not omitted; they are intentionally behind contracts:

| Area | Current State | Contract |
|---|---|---|
| Real backend | File/transaction workbench uses session adapter | Replace `SessionModuleBackendAdapter` with OpenAPI client |
| Real database | Not mutated by frontend session state | Route through StorageRouter capability stores |
| Real agent execution | Not invoked by UI buttons | Map actions to WorkflowRouter and Agent gates |
| Real WebGPU/3DGS loader | Cockpit and fixtures exist | Add runtime detection, loaders and fallback tests |

---

## 13. 2026-04-28 Local Upload And Preview Requirements

本轮验收更新: 上传必须真实落入本地开发存储。当前前端支持选择或拖拽本地文件,保存到 `03-frontend/.architoken/uploads/`,在 `index.json` 生成元数据,无需刷新即可进入当前模块文件列表,并绑定生命周期、审批和审计。

| File family | Required behavior |
|---|---|
| Image | Inline image preview and metadata |
| Video | HTML video playback |
| Audio | HTML audio playback |
| PDF | Inline iframe/object preview |
| Text / Markdown / JSON / CSV / YAML / XML | Text preview, with JSON/CSV classified for future parser upgrade |
| Office | File information card plus download/share/archive flow |
| IFC / GLB / GLTF / DWG / DXF / STEP / E57 / LAS / PLY / SPZ | Engineering object card with import status, model-library action, parse-task action, rule-check action, archive action |
| Archive | Archive package card and archive flow |
| Unknown | Generic file object with download/share/archive flow |

Digital twin upload acceptance is stricter: IFC, GLB, point cloud, 360, 3D scan, oblique photography, and WebGPU snapshot files must appear in the digital twin data-source dock and create an import transaction.
