# ArchIToken · 平台功能全景图

**状态**: frontend operational map  
**范围**: 11 modules workbench, typed fixtures, mock actions  

---

## 1. 平台入口

`/app/modules` 是 ArchIToken 当前前端平台入口。它提供:

- 左侧 11 模块导航
- 顶部搜索
- 主模块详情区
- 右侧模块摘要与本地审计面板
- 每个模块独立详情路由 `/app/modules/[moduleId]`

当前未接真实后端 API,但所有交付物操作都由 typed mock action handler 驱动,点击后会改变 artifact 状态并写入审计面板。

---

## 2. 11 模块业务链

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

standard_library supplies rules, families, templates, materials, drawings and models.
settings_center supplies tenant, RBAC, router, SLA, schema and audit policy.
```

---

## 3. 模块清单

| order | id | 业务能力 |
|---:|---|---|
| 1 | `marketing_service` | 客户线索、需求访谈、立项资料 |
| 2 | `concept_design` | 多方案生成、效果表达、可建造性初筛 |
| 3 | `standard_library` | 标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库 |
| 4 | `detailed_design` | IFC/MBD、施工图、节点详图、碰撞审查、属性完整性 |
| 5 | `quantity_costing` | MTO、BOQ、BOM、价格快照、变更影响 |
| 6 | `material_logistics` | 库存、供应商、价格、询比价、采购、下料、包装、装车、物流、到货、堆放、签收、批次追踪 |
| 7 | `production_manufacturing` | 生产计划、工序路线、下料优化、CNC、焊接、涂装、质检、排产、MES/ERP、构件编码、发运、返工 |
| 8 | `construction_supervision` | 施工方案、进度、质量、安全、日志、AR、360、扫描、倾斜摄影、无人机、机器人、IoT、影像对比、整改、竣工 |
| 9 | `digital_twin` | WebGPU 优先、Three.js fallback、IFC/GLB/点云/360/扫描/倾斜摄影、构件树、进度、质量/安全/成本图层 |
| 10 | `digital_archive` | 合同、图纸、模型、检测、签章、长期留存、企业文宣 |
| 11 | `settings_center` | 租户、RBAC、模型路由、SLA、Schema、规则版本、审计 |

---

## 4. AI 生成链

所有模块共享同一工程门禁链:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

含义:

- `Planner`: 拆解任务、选择输入、建立执行路径。
- `Generator`: 生成方案、模型、清单、报告或业务单据。
- `Evaluator`: 独立评估输出质量,不得自评。
- `RuleChecker`: 按规范、企业规则、工程约束做确定性校核。
- `SchemaValidator`: 校验 JSON Schema、IFC Schema 和 Module Schema。
- `Approver`: 执行人工或自动最终门禁。

---

## 5. 交付物操作

| action | UI 按钮 | 当前 mock 状态 |
|---|---|---|
| `generate` | 生成 | artifact -> `generated` |
| `evaluate` | 评估 | artifact -> `evaluated` |
| `rule_check` | 校核 | artifact -> `rule_checked` |
| `schema_validate` | Schema | artifact -> `schema_validated` |
| `approve` | 审批 | artifact -> `approved` |
| `archive` | 归档 | artifact -> `archived` |

这些 action 后续应映射到 WorkflowRouter command、Audit Log 和 AsyncAPI event。

---

## 6. 前端文件映射

| 文件 | 作用 |
|---|---|
| `03-frontend/lib/module-registry.ts` | 11 模块 typed registry 与 Module Schema fixture |
| `03-frontend/lib/module-actions.ts` | mock action handlers |
| `03-frontend/lib/business-workflow.ts` | runtime state helper |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | 平台总壳 |
| `03-frontend/components/ModuleDetailWorkbench.tsx` | 单模块详情 |
| `03-frontend/components/ArtifactBoard.tsx` | 交付物操作 |
| `03-frontend/components/AgentGateTimeline.tsx` | AI 门禁链 |
| `03-frontend/components/ModuleRelationshipMap.tsx` | 上下游关系 |
| `03-frontend/app/app/modules/page.tsx` | 总入口 |
| `03-frontend/app/app/modules/[moduleId]/page.tsx` | 动态详情路由 |

---

## 7. 后续对接点

前端已为以下后端接口预留边界:

- `GET /v1/modules`
- `GET /v1/modules/{module_id}`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:generate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:evaluate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:rule-check`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:schema-validate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:approve`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:archive`

当前不修改 OpenAPI、后端、数据库或 CI。
