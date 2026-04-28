# ArchIToken · 模块工作台审阅记录

**状态**: implemented frontend review  
**范围**: `/app/modules`, `/app/modules/[moduleId]`, frontend fixtures and mock handlers  

---

## 1. 审阅结论

本轮把 ArchIToken 前端模块入口从展示型页面升级为可操作工作台:

- 11 个模块全部进入 active registry。
- 每个模块有独立详情路由。
- `production_manufacturing` 是 active 模块 ID。
- `manufacturing` 与 `fabrication` 只作为 legacy alias 归一化入口。
- 每个模块包含概览、子域能力、输入、输出、交付物、流程状态、AI 门禁、任务、审批、风险、上下游关系、文件类型和可视化区域。
- 交付物按钮通过 mock action handlers 改变 UI 状态。

---

## 2. 关键修正

| 问题 | 处理 |
|---|---|
| `/app/modules` 只像展示页 | 改为 `ModuleWorkbenchShell`,包含导航、搜索、详情和审计面板 |
| 模块只能看卡片 | 新增 `/app/modules/[moduleId]` 动态详情路由 |
| 旧 `manufacturing` active ID | 改为 `production_manufacturing`,保留 alias |
| 操作按钮无响应风险 | 新增 `module-actions.ts`,所有按钮有状态变化 |
| AI 门禁链不完整 | 新增 `AgentGateTimeline` 展示六段门禁 |
| 标准族库、材料物流、生产制造、施工监理、数字孪生深度不足 | 在 `module-registry.ts` 中扩展子域、文件类型、数据对象和可视化层 |

---

## 3. 未接后端边界

当前实现是前端 typed fixtures + mock action handlers。

未做:

- 未修改 `.github/workflows/**`
- 未修改 `04-backend/**`
- 未修改 `05-infra/**`
- 未修改数据库 migration
- 未修改 Docker/K8s
- 未修改 Python Agent
- 未修改 Rust backend
- 未继续追 License / Python / Security CI

后续接入真实后端时,应把 mock action 映射到:

- WorkflowRouter command
- Module Schema validation
- Artifact lifecycle table
- Audit Log
- AsyncAPI event

---

## 4. 验收点

| 验收项 | 状态 |
|---|---|
| 11 个模块均可点击进入 | 已实现 |
| 每个模块有详情页 | 已实现 |
| 生产制造 active ID 为 `production_manufacturing` | 已实现 |
| legacy alias 兼容 `manufacturing` / `fabrication` | 已实现 |
| 按钮具备 mock 状态变化 | 已实现 |
| AI 门禁链完整 | 已实现 |
| standard_library 全量子域 | 已实现 |
| material_logistics 全量子域 | 已实现 |
| production_manufacturing 全量子域 | 已实现 |
| construction_supervision 全量子域 | 已实现 |
| digital_twin WebGPU / fallback / 多源数据 / 图层 | 已实现 |

---

## 5. 后续建议

1. 增加 `/v1/modules` OpenAPI 合同,但本轮不修改后端。
2. 将 `module-registry.ts` 替换为后端 Module Schema 生成类型。
3. 将 `module-actions.ts` 的 mock handlers 替换为 WorkflowRouter client。
4. 为数字孪生接入真实 WebGPU capability detection 和 3DGS loader。
5. 将审计面板接入后端 append-only audit log。
