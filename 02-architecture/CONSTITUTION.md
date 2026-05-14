# ArchIToken · 宪法 21 条

**性质**: 强约束。违反 = CI 拒绝合并。非软规范。  
**哲学**: Harness Engineering — 约束优于指导,边界优于自由,系统目标高于技术信仰。  
**唯一真源索引**: [`ARCHITOKEN-SOURCE-OF-TRUTH.md`](./ARCHITOKEN-SOURCE-OF-TRUTH.md)  

---

## 0. 命名

当前项目名只使用 `ArchIToken`。

---

## 第 1 条 · Agent = Model + Harness

ArchIToken 的全部价值在 Harness 层。模型是可替换组件,永远不依赖某个具体模型的能力假设。

**CI 执行**: 模型调用必须经过内部统一 Router / ModelRouter / InferenceRouter 抽象。直连外部模型 API 的业务代码 PR 自动拒绝。

---

## 第 2 条 · 模型决定下限,Harness 决定上限

任何优化先问 Harness、Router、Schema、Registry、RuleChecker 能不能做,再考虑换模型。

**CI 执行**: 架构评审清单必须要求说明“为什么这是 Harness 问题或模型问题”。

---

## 第 3 条 · 技术服务目标,不做语言或框架信仰

ArchIToken 不局限于某一种语言、框架、数据库、Agent 框架或推理引擎。

Rust / Cxx 是核心主干优先项,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等都可按场景使用。

判断标准只有一个: 是否服务于以下目标:

- 高性能
- 高效率
- 强扩展
- 易维护
- 高度灵活
- 工程可控
- 长期可演进

禁止把“某语言不能用”作为默认原则。真正禁止的是低性能、低效率、难扩展、难维护、不可审计、不可回滚、不可长期演进的实现。

**CI 执行**: 新增语言、框架或运行时必须在 PR 中说明边界、收益、替代方案和维护成本。

---

## 第 4 条 · 100% Apache / MIT / BSD 优先,许可证进入 CI

进入 ArchIToken 分发边界的依赖优先使用 Apache-2.0 / MIT / BSD / ISC / MPL-2.0 等宽松许可。

禁止 AGPL / GPL / LGPL / SSPL / BUSL / Commons Clause 进入分发边界。

GPL 类工具可作为独立外部服务通过 HTTP / CLI / IPC 调用,但不得静态链接、源码合并或作为内嵌库分发。

**CI 执行**: `cargo-deny check` + npm license checker + Python license checker + SBOM 扫描。

---

## 第 5 条 · 版本补丁级钉住

所有生产依赖必须补丁级钉住,禁止 `latest`、随意 `^`、随意 `~`。

**CI 执行**: lockfile 全部提交,构建使用 frozen lockfile。

---

## 第 6 条 · Registry 替代 Enum

所有可扩展对象必须采用 Registry 机制,而不是 enum 固化边界。

适用对象包括:

- 业务模块
- Agent
- Tool
- Model
- Router
- Schema
- Geometry Kernel
- Renderer
- Workflow
- Rule

禁止用 Rust enum、Python Enum、PostgreSQL ENUM 固化业务模块集合。

**CI 执行**: 禁止用业务 enum 表达模块扩展点。模块必须走 `ModuleRegistry` / `modules` 表 / Module Schema。

---

## 第 7 条 · 多 Schema 协同真源

ArchIToken 的接口与数据合同不只依赖 OpenAPI,必须升级为:

```text
OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema
```

| Schema | 作用 |
|---|---|
| OpenAPI | REST / HTTP API 合同、SDK 生成、接口文档 |
| AsyncAPI | 事件流、消息队列、异步任务、实时通知合同 |
| JSON Schema | Agent 输入输出、配置、结构化结果校验 |
| IFC Schema | BIM / AEC 模型语义、构件、属性、关系校验 |
| Module Schema | 模块注册、模块输入输出、能力、SLA、权限、UI 元数据 |

**CI 执行**: Schema 变更必须有 diff 检查、生成物检查、兼容性检查。

---

## 第 8 条 · 层间依赖单向

架构层级必须单向依赖。底层不得反向依赖上层。

**CI 执行**: cargo workspace 拓扑检查、前端 boundaries lint、Python import linter。

---

## 第 9 条 · 内部统一 Router,OpenRouter 只是外部适配器

ArchIToken 必须有内部统一 Router 架构。

OpenRouter 可以作为外部模型聚合适配器之一,但不能替代内部 ModelRouter / InferenceRouter。

内部 Router 至少包括:

- ModelRouter
- InferenceRouter
- ToolRouter
- WorkflowRouter
- GeometryRouter
- RenderRouter
- StorageRouter

**CI 执行**: 业务模块不得直接绑定某个模型供应商、推理引擎、渲染后端或工具实现。必须通过 Router / Registry。

---

## 第 10 条 · 推理引擎统一协议

所有推理引擎必须通过统一协议接入。优先兼容 OpenAI ChatCompletion 形态,但内部不得把 OpenAI 供应商等同于协议本身。

本地与私有推理必须是一等公民,包括 Ollama、vLLM、SGLang、TensorRT-LLM、LMDeploy、llama.cpp 等。

**CI 执行**: 所有新推理后端必须通过 compat suite 与 fallback 测试。

---

## 第 11 条 · 生成 SLA 强制

生成类调用必须有 SLA 预算,按能力类型和模块登记,不得硬编码到 enum。

SLA 预算以 `module_id` / `capability_id` 为 key,由 `settings_center` 或配置中心统一管理。

**CI 执行**: `RollbackGuard` / timeout guard / fallback guard 必须覆盖生成链路。每个启用模块必须存在 SLA 配置。

---

## 第 12 条 · AI 不自评: Generator 与 Evaluator 分离

Generator 不能评价自己的输出。

Evaluator 必须是独立 Agent、独立提示词、独立上下文,推荐使用独立模型。

ArchIToken 增强后的工程门禁链为:

```text
Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
```

工程关键输出必须经过 Evaluator + RuleChecker + SchemaValidator,包括 BIM / IFC、施工图、BOQ、报价、结构计算书、生产制造文件、下料单、施工方案、质量安全报告、数字档案包等。

**CI 执行**: prompt tree 完整性扫描、角色模型差异检查、Schema 校验测试、规则校核测试。

---

## 第 13 条 · LLM 白名单与模型注册表

所有模型必须进入 Model Registry,记录供应商、上下文长度、能力、成本、许可、部署方式、适用模块、禁用条件。

模型列表可演进,但不得散落在业务代码中。

**CI 执行**: 未注册模型不得被调用。

---

## 第 14 条 · AI 缺陷防御必须系统化

幻觉、偏见、越权、隐私泄露、提示注入、工具滥用、Schema 逃逸、规范误用都必须有独立防御机制。

**CI 执行**: security-suite、prompt-injection suite、tool sandbox tests、privacy tests 定期运行。

---

## 第 15 条 · 前端工程基座与 WebGPU 优先不冲突

ArchIToken 可以使用 Next.js 16.2.4 + React 19.2.5 + TypeScript 6.0.3 + WASM + WebGPU + Three.js r184。

原则是:

```text
Next.js + React + TypeScript = 应用工程基座
WebGPU + WASM = 高性能计算与渲染核心
Three.js = 兼容层 / 生态层 / 快速验证层
```

禁止把 Three.js 当作唯一渲染路线,也禁止为了“纯 WebGPU”放弃成熟工程框架。

**CI 执行**: BIM / 数字孪生核心渲染路线必须说明 WebGPU 优先策略与 fallback。

---

## 第 16 条 · 数据库是能力组合,不是单一产品信仰

ArchIToken 数据体系必须覆盖:

- 结构化数据
- 非结构化数据
- 向量数据
- 时序数据
- 图关系数据
- 文件与对象存储
- 缓存与任务状态
- 审计与版本历史
- 多租户权限隔离

Zedis 是核心缓存、状态与任务队列优先项,但系统仍需要 PostgreSQL / 对象存储 / 向量检索 / 时序能力 / 审计日志等组合能力。

**CI 执行**: 数据模型变更必须说明数据类型、存储层、索引策略、备份策略、迁移策略。

---

## 第 17 条 · 多租户强制隔离

甲方、设计、施工、监理、供应商、工厂、运维等数据必须逻辑隔离,关键场景支持物理隔离。

**CI 执行**: PostgreSQL RLS / tenant_id / audit log / permission tests 必须覆盖租户域。

---

## 第 18 条 · 部署基线: k8s + Docker + 本地私有化

ArchIToken 必须支持 Kubernetes 正式部署、Docker 标准化交付、Docker Compose 本地开发、本地私有化部署、GPU 节点调度、离线或弱网环境部署。

K3s 可作为极端资源受限环境可选适配,但不是正式部署基线。

**CI 执行**: 镜像构建、Helm/Kustomize、k8s manifest、健康检查、可观测、回滚测试必须通过。

---

## 第 19 条 · 文档即环境,仓库文档是唯一真源

ArchIToken 的工程治理以 GitHub 仓库文档为唯一真源。聊天上下文、临时讨论、图片、口头说明只能作为输入,不能替代仓库文档。

核心原则入口为:

- `ARCHITOKEN-SOURCE-OF-TRUTH.md`
- `CONSTITUTION.md`
- `MODULES.md`
- `MODULE-REGISTRY.md`
- `ARCHITECTURE.md`
- `PRD.md`

**CI 执行**: 关键文档大小、链接、术语一致性、Schema 引用必须 lint。

---

## 第 20 条 · 模块必须全面定义输入、输出、规则、Schema 与审计

每个模块必须定义:

- 输入
- 输出
- 子域能力
- 数据表
- 文件类型
- Agent 角色
- 工具调用
- 规则约束
- Schema
- SLA
- 权限
- 审计
- 可视化
- 与上下游模块关系

标准族库必须包括标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库。

材料物流必须包括材料库存、价格、供应商、采购、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收、批次追踪。

生产制造模块 id 为 `production_manufacturing`,中文名为“生产制造”。

施工监理必须包括方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机巡检、建筑机器人、IoT、整改闭环、竣工资料等。

**CI 执行**: Module Schema 校验必须阻止缺字段模块进入主干。

---

## 第 21 条 · AIA 是骑手不是执行者

AIA 定方向、定边界、定验收; 系统自己找路。

ArchIToken 的目标是让一个人也能驾驭工业级 AI + AEC 系统,而不是让一个人陷入无穷执行细节。

**CI 执行**: 设计评审必须回答: 这个改动是否减少 AIA 的人工执行负担,是否增强系统自运行能力。

---

## 修正程序

宪法修正需:

1. 在 `02-architecture/` 或 `docs/amendments/` 提交 RFC Markdown。
2. 明确影响范围: 代码、Schema、CI、部署、文档、迁移。
3. 更新 `ARCHITOKEN-SOURCE-OF-TRUTH.md`。
4. 同步更新相关 CI 规则。
5. 记录在 `CONSTITUTION_HISTORY.md` 或 CHANGELOG。

---

**版本**: ArchIToken Constitution · 21 条 · v2.1 · 由 ArchIToken v2.0 宪法演进而来。
