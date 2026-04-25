# ArchIToken · 迁移缺陷追踪表

**状态**: Active  
**适用仓库**: `ActiveInAI/ArchIToken`  
**目的**: 把 InsomeOS → ArchIToken 改名与架构升级过程中的缺陷集中追踪,避免文档、代码、数据库、前端、CI 脱节。

---

## 1. 当前结论

GitHub 仓库名已经完成迁移:

```text
ActiveInAI/insomeos → ActiveInAI/ArchIToken
```

但仓库内容仍有大量 InsomeOS / insomeos / 9-phase / BusinessPhase / manufacturing 残留。

当前最大风险不是方向错误,而是:

```text
ArchIToken 宪法与部分代码现实尚未对齐。
```

---

## 2. P0 缺陷

### P0-1 · 命名空间残留

现象:

- `insomeos_agent` Python 包名仍存在
- `@insomeos/frontend` 仍存在
- `insomeos_token` 仍存在
- 多处文档仍写 InsomeOS
- Docker / CI / k8s / package / test 文件可能仍引用旧名

目标:

- 项目主名称统一为 `ArchIToken`
- 代码包名统一为 `architoken_*`
- npm scope 迁移为 `@architoken/*`
- 仅在 lineage / history 处保留 InsomeOS

建议步骤:

1. 全仓搜索 `InsomeOS`, `insomeos`, `@insomeos`, `insomeos_`
2. 分类为历史保留、文档替换、代码替换、配置替换
3. 先改文档与 package metadata
4. 再改代码 import path
5. 最后改 Docker / k8s / CI / tests

---

### P0-2 · BusinessPhase / 9-phase 残留

现象:

- Python Agent 仍有 `BusinessPhase` Enum
- `phases.py` / `phase_graph.py` 仍存在
- PostgreSQL migration 仍有 `business_phase` ENUM
- 前端仍有 `BusinessPhase` union type
- OpenAPI 仍可能暴露 phase 字段

目标:

- 全部迁移为 `module_id: TEXT`
- 业务扩展使用 `modules` 表 + Module Registry + Module Schema
- 前端从 `/v1/modules` 或 Module Schema 动态渲染

建议步骤:

1. Python: `BusinessPhase` → `ModuleId = str`
2. Python: `phases.py` → `modules.py`
3. Python: `phase_graph.py` → `module_graph.py`
4. DB: `business_phase` enum → `modules` 表 + `module_id TEXT FK`
5. Frontend: `BusinessPhase` → generated `ModuleSpec`
6. OpenAPI: `phase` → `module_id`

---

### P0-3 · `manufacturing` 未升级为 `production_manufacturing`

现象:

- README / 宪法要求 `production_manufacturing`
- Rust registry 仍可能注册 `manufacturing`
- 旧 prompt / DB / API 可能仍有 `fabrication` / `manufacturing`

目标:

```text
old: fabrication / manufacturing
new: production_manufacturing
zh: 生产制造
```

建议:

- 保留 alias 映射,避免历史数据断裂
- 新模块 ID 使用 `production_manufacturing`
- 旧 `manufacturing` / `fabrication` 只作为迁移兼容 alias

---

## 3. P1 缺陷

### P1-1 · 多 Schema 体系尚未落地

目标体系:

```text
OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema
```

待补:

- `schemas/module.schema.json`
- `schemas/agent-output.schema.json`
- `schemas/asyncapi.yaml`
- `schemas/ifc-validation.md`
- CI schema validation workflow

---

### P1-2 · Router 体系尚未落地

目标内部 Router:

- ModelRouter
- InferenceRouter
- ToolRouter
- WorkflowRouter
- GeometryRouter
- RenderRouter
- StorageRouter

OpenRouter 只能作为外部模型适配器,不能替代内部架构。

建议新增:

```text
04-backend/harness-core/src/router/
├── mod.rs
├── model.rs
├── inference.rs
├── tool.rs
├── workflow.rs
├── geometry.rs
├── render.rs
└── storage.rs
```

---

### P1-3 · AI 工程门禁不完整

当前应升级为:

```text
Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
```

待补:

- `RuleChecker`
- `SchemaValidator`
- `Approver`
- 审批状态与 trace
- 规则校核结果结构
- Schema 校验结果结构

---

### P1-4 · 前端 WebGPU 优先未工程化

当前前端可使用 Next.js + React + TypeScript + WASM + Three.js,但还需要体现 WebGPU 优先。

待补:

- WebGPU capability detection
- Three.js fallback policy
- WASM geometry worker
- BIM large model streaming plan
- GPU memory budget
- RenderRouter 接入

---

## 4. P2 缺陷

### P2-1 · 数据能力还不完整

目标覆盖:

- 结构化
- 非结构化
- 向量
- 时序
- 图关系
- 对象存储
- 缓存与任务状态
- 审计与版本历史
- 多租户权限隔离

待补:

- Zedis 状态 / 队列设计
- 对象存储元数据版本链
- 时序数据模型
- 图关系模型
- Event sourcing / append-only 审计策略

---

### P2-2 · CI / 工具链缺口

待补:

- Playwright config
- Justfile
- `scripts/check-versions.py`
- versions-check workflow
- schema validation workflow
- terminology lint: 禁止非历史语境下新增 InsomeOS / BusinessPhase / 9-phase

---

## 5. 执行顺序

建议按以下顺序修复:

```text
1. 建立 Issues 与迁移文档
2. 修正文档入口和 clone URL
3. 命名空间迁移: InsomeOS → ArchIToken
4. BusinessPhase → Module Registry
5. manufacturing → production_manufacturing
6. Schema 体系落地
7. Router 体系落地
8. AI 门禁链落地
9. 前端 WebGPU 优先落地
10. 数据能力与 CI 补齐
```

---

## 6. 不应立即做的事

当前不建议在没有本地测试环境的情况下直接大规模重命名源码目录,尤其是:

- Python package path
- Rust crate name
- Docker image name
- k8s service name
- OpenAPI 字段
- DB migration 历史文件

这些应通过分支 + PR + CI 完成。

---

## 7. 成功标准

当以下命令搜索结果只剩历史说明时,命名迁移完成:

```bash
git grep -n "InsomeOS\|insomeos\|BusinessPhase\|business_phase\|9-phase\|9 phases"
```

当以下模块 ID 成为唯一生产制造 ID 时,模块迁移完成:

```text
production_manufacturing
```

当前端、后端、数据库、OpenAPI、Prompt、测试均使用 `module_id` / Module Schema 时,Registry 迁移完成。
