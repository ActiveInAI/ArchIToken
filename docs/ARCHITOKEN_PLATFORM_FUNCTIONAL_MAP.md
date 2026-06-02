# ArchIToken · 平台功能全景图

**状态**: frontend operational map · 14 modules · session adapter · file operations · lifecycle state machine

## 1. 平台入口

`/app/modules` 是 ArchIToken 当前前端平台入口。它提供:

- 左侧 14 模块紧凑 rail,默认 `72px`,可展开到 `220px`。
- 顶部工具栏、搜索、上传、新建、视图切换和主题切换。
- 主模块详情区。
- 右侧详情、审批、生命周期、AI 建议和本地审计抽屉,默认收起。
- 右下角全局浮动 `ArchIToken AI`。
- 每个模块独立详情路由 `/app/modules/[moduleId]`。
- 每个模块独立 session 文件树、右键菜单、预览抽屉、属性面板。
- 生命周期事务、审批流、状态机与审计事件。

当前文件、事务、审批和交付物操作通过 typed session adapter 驱动,点击后必须改变状态并写入审计面板。生产路径必须替换为 OpenAPI HTTP adapter,不得把前端会话态当作后端事实。

## 2. 14 模块业务链

```text
marketing_service
  -> planning_management
  -> concept_design
  -> standard_library
  -> detailed_design
  -> quantity_costing
  -> material_logistics
  -> production_manufacturing
  -> construction_management
  -> digital_twin
  -> digital_archive
  -> finance_hr
  -> ai_center
  -> settings_center
```

| order | id | 业务能力 |
|---:|---|---|
| 1 | `marketing_service` | 客户线索、需求访谈、报价草案、跟进任务 |
| 2 | `planning_management` | 项目策划、WBS、里程碑、资源计划、风险台账 |
| 3 | `concept_design` | 多方案生成、效果表达、可建造性初筛 |
| 4 | `standard_library` | 标准规范、族库构件、样板文件、材质库、规则库 |
| 5 | `detailed_design` | IFC/MBD、施工图、节点详图、碰撞审查、属性完整性 |
| 6 | `quantity_costing` | MTO、BOQ、BOM、价格快照、变更影响 |
| 7 | `material_logistics` | 库存、供应商、采购、下料、包装、物流、签收、批次追踪 |
| 8 | `production_manufacturing` | 生产计划、工序路线、CNC、焊接、涂装、质检、排产、发运 |
| 9 | `construction_management` | 施工方案、进度、质量、安全、日志、AR、360、扫描、整改、竣工 |
| 10 | `digital_twin` | WebGPU、IFC/GLB、点云、3DGS、构件树、图层、IoT、运维状态 |
| 11 | `digital_archive` | 合同、图纸、模型、检测、签章、长期留存、版本链 |
| 12 | `finance_hr` | 合同台账、付款发票、成本台账、人员班组、考勤绩效 |
| 13 | `ai_center` | 模型供应商、AI API 网关、接口管理、数据库管理、可视化面板、RAG、MCP、Agent 编排、审计、成本策略 |
| 14 | `settings_center` | 租户、RBAC、模型路由、SLA、Schema、规则版本、审计 |

## 3. 交付物与文件操作

所有模块共享工程门禁链:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

| action | UI 按钮 | 当前会话状态 |
|---|---|---|
| `generate` | 生成 | artifact -> `generated` |
| `evaluate` | 评估 | artifact -> `evaluated` |
| `rule_check` | 校核 | artifact -> `rule_checked` |
| `schema_validate` | Schema | artifact -> `schema_validated` |
| `approve` | 审批 | artifact -> `approved` |
| `archive` | 归档 | artifact -> `archived` |

每个模块都有自己的 session 文件树。节点字段覆盖 `id`、`name`、`type`、`moduleId`、`parentId`、`size`、`mimeType`、`status`、`version`、`owner`、`updatedAt`、`tags`、`permissions` 和 `auditTrail`。

右键菜单完整覆盖: 打开、新建、查看、上传、下载、移动、复制、粘贴、分享、删除、属性、重命名。所有状态迁移由 `ModuleBackendAdapter` 统一执行,便于替换为真实 OpenAPI client。

## 4. 前端文件映射

| 文件 | 作用 |
|---|---|
| `03-frontend/lib/module-registry.ts` | 14 模块 typed registry 与 Module Schema fixture |
| `03-frontend/lib/module-actions.ts` | session action handlers |
| `03-frontend/lib/module-file-system.ts` | 14 模块 session 文件树与文件节点合同 |
| `03-frontend/lib/module-lifecycle.ts` | 生命周期事务、审批和状态机合同 |
| `03-frontend/lib/module-backend-adapter.ts` | `ModuleBackendAdapter` 与 `SessionModuleBackendAdapter` |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | 平台总壳 |
| `03-frontend/components/ModuleFileExplorer.tsx` | 文件树、文件列表、右键菜单、预览、属性和文件任务 |
| `03-frontend/components/FloatingAIAssistant.tsx` | 全局 AI 助手 / AI 主页 |
| `03-frontend/tests/e2e/landing.spec.ts` | Playwright 入口和 14 模块 E2E |

## 5. 后续对接点

前端已为以下后端接口预留边界:

- `GET /v1/modules`
- `GET /v1/modules/{module_id}`
- `GET /v1/modules/{module_id}/files`
- `POST /v1/modules/{module_id}/files`
- `POST /v1/files/{file_id}/move`
- `POST /v1/files/{file_id}/share`
- `POST /v1/generation/jobs`
- `POST /v1/generation/jobs/{job_id}/plan`
- `POST /v1/generation/jobs/{job_id}/run`
- `POST /v1/generation/jobs/{job_id}/review`
- `POST /v1/generation/jobs/{job_id}/approve`

当前后端 gateway 已提供这些合同中的核心路由；生产上线前必须把前端工作台从 session adapter 切到 HTTP adapter,并接入数据库、对象存储、队列、模型 provider 和 telemetry。
