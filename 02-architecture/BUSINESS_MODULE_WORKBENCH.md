# ArchIToken · 业务模块工作台开发契约

**文档编号**: ARCHITOKEN-BUSINESS-MODULE-WORKBENCH-V2  
**所属架构**: 11 modules registry · Module Schema driven UI  
**状态**: active frontend workbench  
**适用范围**: `/app/modules` 与 `/app/modules/[moduleId]`

---

## 1. 目标

业务模块工作台从“展示卡片”升级为真正可进入、可点击、可操作的业务平台入口。

工作台必须做到:

1. `/app/modules` 是 11 个系统模块的总入口。
2. 每个模块都有独立详情路由 `/app/modules/[moduleId]`。
3. 每个模块详情包含概览、子域能力、输入、输出、交付物、流程状态、AI 门禁链、任务、审批、风险、上下游关系、文件类型和可视化区域。
4. 未接真实后端 API 时,前端必须使用 typed fixtures 和 mock action handlers,按钮点击必须改变 UI 状态并写入本地审计面板。
5. active 项目名使用 `ArchIToken`; 历史名只可在 lineage / formerly 语境保留。

---

## 2. Active Module IDs

| order | id | 中文名 | 入口 |
|---:|---|---|---|
| 1 | `marketing_service` | 市场客服 | `/app/modules/marketing_service` |
| 2 | `concept_design` | 方案设计 | `/app/modules/concept_design` |
| 3 | `standard_library` | 标准族库 | `/app/modules/standard_library` |
| 4 | `detailed_design` | 深化设计 | `/app/modules/detailed_design` |
| 5 | `quantity_costing` | 计量造价 | `/app/modules/quantity_costing` |
| 6 | `material_logistics` | 材料物流 | `/app/modules/material_logistics` |
| 7 | `production_manufacturing` | 生产制造 | `/app/modules/production_manufacturing` |
| 8 | `construction_supervision` | 施工监理 | `/app/modules/construction_supervision` |
| 9 | `digital_twin` | 数字孪生 | `/app/modules/digital_twin` |
| 10 | `digital_archive` | 数字档案 | `/app/modules/digital_archive` |
| 11 | `settings_center` | 设置中心 | `/app/modules/settings_center` |

`manufacturing` 与 `fabrication` 只作为 legacy alias,前端归一化到 `production_manufacturing`。

---

## 3. 前端实现映射

| 文件 | 职责 |
|---|---|
| `03-frontend/lib/module-registry.ts` | Module Schema fixture,定义 `ModuleSpec`、`SubdomainSpec`、`ArtifactSpec`、`WorkflowStep`、`AgentGate`、`ModuleAction` 并导出 11 模块 registry |
| `03-frontend/lib/module-actions.ts` | mock action handlers: `generateArtifact`、`evaluateArtifact`、`runRuleCheck`、`validateSchema`、`approveArtifact`、`archiveArtifact` |
| `03-frontend/lib/business-workflow.ts` | 前端 runtime state 与 action 应用辅助函数 |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | 总平台壳: 左侧模块导航、顶部搜索、主详情、右侧审计面板 |
| `03-frontend/components/ModuleDetailWorkbench.tsx` | 单模块详情页主体 |
| `03-frontend/components/AgentGateTimeline.tsx` | Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver |
| `03-frontend/components/ArtifactBoard.tsx` | 交付物列表和可点击操作按钮 |
| `03-frontend/components/ModuleRelationshipMap.tsx` | 上下游模块关系 |
| `03-frontend/app/app/modules/page.tsx` | 平台总入口 |
| `03-frontend/app/app/modules/[moduleId]/page.tsx` | 动态模块详情路由 |
| `03-frontend/components/BusinessModuleWorkbench.tsx` | 保留兼容入口,转接到新 workbench |

---

## 4. 必备字段

每个 `ModuleSpec` 必须包含:

- `id`
- `order`
- `zhName`
- `enName`
- `track`
- `status`
- `summary`
- `objective`
- `subdomains`
- `inputs`
- `outputs`
- `artifacts`
- `workflowStates`
- `agentGates`
- `tasks`
- `approvals`
- `risks`
- `fileTypes`
- `visualization`
- `standards`
- `dataObjects`
- `routeHref`
- `schemaRef`

---

## 5. 操作按钮语义

| 按钮 | mock handler | 状态变化 |
|---|---|---|
| 生成 | `generateArtifact` | `draft` → `generated` |
| 评估 | `evaluateArtifact` | artifact → `evaluated` |
| 校核 | `runRuleCheck` | artifact → `rule_checked` |
| Schema | `validateSchema` | artifact → `schema_validated` |
| 审批 | `approveArtifact` | artifact → `approved` |
| 归档 | `archiveArtifact` | artifact → `archived` |

每次 action 必须返回:

- 更新后的 artifact
- action message
- audit event

当前 audit event 写入右侧本地审计面板。后续接入后端时,该事件应映射到 Audit Log / Workflow Event / AsyncAPI event。

---

## 6. 模块扩展重点

### 6.1 `standard_library`

必须覆盖标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库。

### 6.2 `material_logistics`

必须覆盖材料库存、供应商、价格、询价/比价、采购计划、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收、批次追踪。

### 6.3 `production_manufacturing`

必须覆盖生产计划、工序路线、下料优化、CNC/数控文件、焊接、喷涂/防腐/防火、质检、工厂排产、MES/ERP 对接、构件编码、包装发运、返工处理。

### 6.4 `construction_supervision`

必须覆盖施工方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机、建筑机器人、IoT、影像对比、整改闭环、竣工资料。

### 6.5 `digital_twin`

必须覆盖 WebGPU 优先渲染状态、Three.js fallback 状态、IFC/GLB/点云/360/三维扫描/倾斜摄影占位数据、构件树、进度对比、质量/安全/成本叠加图层。

---

## 7. 后端对接边界

当前工作台不直接调用真实后端 API。为了后续对接预留:

- `ModuleSpec.schemaRef` 对应未来 Module Schema。
- `routeHref` 与 `/v1/modules/{module_id}` 可一一映射。
- `ModuleAction` 可映射到 WorkflowRouter command。
- `ArtifactSpec.status` 可映射到 artifact lifecycle enum 或状态表。
- audit event 可映射到 AsyncAPI 事件。

---

## 8. 验收

本工作台前端验收至少包括:

1. 11 个 active module id 完整且顺序正确。
2. 不出现 active `manufacturing` / `fabrication` 模块 ID。
3. 每个模块详情路由可访问。
4. 每个模块有子域、交付物、流程状态、AI 门禁、任务、审批、风险、文件类型和可视化配置。
5. 交付物操作按钮点击后会改变 UI 状态。
6. `npm run lint` / `npm run typecheck` / `npm test -- --run` / `npm run build` 或对应 `bun run` 命令通过。
