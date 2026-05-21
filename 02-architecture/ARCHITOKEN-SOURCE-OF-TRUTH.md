# ArchIToken · 工程唯一真源索引

**文档编号**: ARCHITOKEN-SOURCE-OF-TRUTH-V1
**状态**: Active
**适用项目**: ArchIToken

---

## 1. 原则

ArchIToken 的工程治理以 GitHub 仓库文档为唯一真源。聊天上下文、临时讨论、图片、口头说明都只能作为输入,不能替代仓库文档。

任何架构、模块、技术选型、部署、Schema、Agent、Router、数据库、前端原则,最终都必须落到仓库 Markdown、Schema、代码或 CI 规则中。

---

## 2. 当前唯一真源文档

| 优先级 | 文档 | 作用 |
|---:|---|---|
| 1 | `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md` | 本索引,定义真源体系 |
| 2 | `02-architecture/CONSTITUTION.md` | 22 条工程宪法 |
| 3 | `02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md` | 项目定位、竞品边界、对标与超越策略 |
| 4 | `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md` | 跨行业专业资格、监管体系、术语、规则、标准规范与技术规程合规基线 |
| 5 | `AGENTS.md` | ChatGPT / Codex 当前开发指令入口 |
| 6 | `02-architecture/MODULES.md` | 14 模块规范,与当前 Rust / 前端 registry 同步 |
| 7 | `02-architecture/MODULE-REGISTRY.md` | Module Registry 机制 |
| 8 | `02-architecture/ARCHITECTURE.md` | 全栈架构规范 |
| 9 | `docs/OPENBIM_STANDARD_BASELINE.md` | openBIM 标准体系基线: IFC / IDM / bSDD / BCF / IDS / Validate |
| 10 | `02-architecture/HEAVY_STEEL_HOTEL_ZAOFANG_MODULE_PROGRAM.md` | 100间精品酒店重钢深化图纸与造房网60天推广执行模块程序 |
| 11 | `01-product/PRD.md` | 产品需求与模块能力边界 |
| 12 | `README.md` | 仓库入口与快速启动 |

---

## 3. 当前已确认原则

### 3.1 命名

当前项目名只使用 ArchIToken。

### 3.2 技术哲学

ArchIToken 不做语言或框架信仰。Rust / Cxx 是核心主干优先项,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等都可按场景使用。

判断标准:

- 高性能
- 高效率
- 强扩展
- 易维护
- 高度灵活
- 工程可控
- 长期可演进

### 3.2.1 产品定位

ArchIToken 的固定定位是:

```text
ArchIToken = AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS
```

ArchIToken 是 AEC AI-Native 平台、Harness Engineering 系统、OpenBIM CDE Workflow OS、Speckle CDE 互操作运行时、IFCDB-Agent 数据库/Agent 路由和后端原生文件运行时。开放格式必须走原生/open runtime 路径; 私有或复杂格式必须通过后端 worker、授权适配器或企业服务进入,不得用前端派生文件替代真实格式支持。

竞品对标的正确边界见 [`POSITIONING_AND_COMPETITIVE_STRATEGY.md`](./POSITIONING_AND_COMPETITIVE_STRATEGY.md)。任何“全面替代/全面超越 Autodesk、Trimble、Siemens、广联达、北京构力、斯维尔、中望”等表述必须有真实项目、互操作、性能、合规和审计证据。

### 3.2.2 专业与标准合规

ArchIToken 的整个平台、每个模块、每个名词、每个业务逻辑和每个 AI 输出,必须符合对应专业资格、监管体系、执业责任和授权边界。基础覆盖 IPMP / IPMA、注册建筑师、注册结构工程师、注册建造师、注册造价工程师、注册监理工程师,并扩展到生产制造、运输物流、海关贸易、税务、金融、财务会计、人力资源、组织治理、AI、数据安全、网络安全和软件工程。

详细基线见 [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md)。来源缺失时,系统只能输出“经验建议”,不得输出“合规/不合规/可施工/可报审/可验收/可申报/可清关/可入账/可支付/可发布”。

### 3.2.3 openBIM 标准体系

ArchIToken 的 CAD/BIM/CIM/GIS 工程数据底座必须基于 buildingSMART openBIM 标准体系。IFC、IDM、bSDD、BCF、IDS、buildingSMART Validate 及相关 API 合同是语义、交付、校验和协同真源。私有格式和厂商运行时只能作为适配器,不得替代 openBIM 作为平台真源。

详细基线见 [`docs/OPENBIM_STANDARD_BASELINE.md`](../docs/OPENBIM_STANDARD_BASELINE.md)。

### 3.3 Registry

用 Registry 替代 Enum。该原则适用于:

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

### 3.4 AI 交付门禁

Generator 与 Evaluator 必须分离,并增强为:

```text
Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
```

### 3.5 Router

OpenRouter 可作为外部模型聚合适配器之一,但不能替代 ArchIToken 内部统一 Router。

内部必须具备:

- ModelRouter
- InferenceRouter
- ToolRouter
- WorkflowRouter
- GeometryRouter
- RenderRouter
- StorageRouter

### 3.6 Schema

Schema 体系升级为:

```text
OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema
```

### 3.7 前端

Next.js 16.2.6 + React 19.2.5 + TypeScript 6.0.3 + WASM + WebGPU + Three.js r184 并不冲突。

原则:

```text
Next.js + React + TypeScript = 应用工程基座
WebGPU + WASM = 高性能计算与渲染核心
Three.js = 兼容层 / 生态层 / 快速验证层
```

### 3.8 数据

数据库与存储必须覆盖:

- 结构化
- 非结构化
- 向量
- 时序
- 图关系
- 对象存储
- 缓存与任务状态
- 审计与版本历史
- 多租户权限隔离

Zedis 是核心缓存、状态与任务队列优先项,但不是唯一数据系统。

### 3.9 部署

ArchIToken 必须支持:

- Kubernetes 正式部署
- Docker 镜像标准化交付
- Docker Compose 本地开发
- 本地私有化部署
- GPU 节点调度
- 离线或弱网环境部署

K3s 可作为极端资源受限场景的可选适配,但不是正式部署基线。

---

## 4. 模块扩展基线

### 4.1 标准族库

标准族库包括标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库和版本库。

### 4.2 材料物流

材料物流包括材料库存、价格、供应商、采购、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收和批次追踪。

### 4.3 生产制造

`production_manufacturing` 是生产制造模块,包括生产计划、工序路线、下料优化、CNC / 数控文件、焊接、喷涂 / 防腐 / 防火、质检、工厂排产、MES / ERP 对接、构件编码和包装发运。

当前阶段 Paperclip v2026.517.0 完整接管 `production_manufacturing` 模块主工作区,作为 Agent 组织、工厂任务、heartbeat、预算和治理编排的外部进程 / 服务适配器;不得替代 ArchIToken 的模块 ID、CDE 文件、CNC/QC/MES/ERP 真源或专业审批结论。

### 4.4 施工管理

施工管理包括方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机巡检、建筑机器人、IoT、影像对比、整改闭环和竣工资料。

---

## 5. 新对话记忆处理

当前会话中长期记忆工具不可用时,以本文件和相关仓库文档为准。

建议记忆文本:

```text
ArchIToken 以 GitHub 仓库文档为唯一真源。固定定位是 AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS; 开放格式必须走原生/open runtime 路径,私有或复杂格式必须通过后端 worker、授权适配器或企业服务进入,不得用前端派生文件替代真实格式支持。整个平台、每个模块、每个名词、每个业务逻辑和每个 AI 输出必须符合对应专业资格、监管体系、国家/行业/地方/国外标准规范、技术规程、项目合同和组织制度; 范围覆盖 AEC、生产、运输、海关、税务、金融、财务、人力、组织、AI、数据、网络安全和软件工程; 来源缺失时只能输出经验建议。核心原则是高性能、高效率、强扩展、易维护、高度灵活; 技术服务目标,不做语言或框架信仰。Rust/Cxx 主干优先,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等都可按场景使用。采用 Registry 替代 Enum; Generator 与 Evaluator 分离并增强为 Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver; 内部统一 Router,OpenRouter 只是外部适配器之一; Schema 体系为 OpenAPI+AsyncAPI+JSON Schema+IFC Schema+Module Schema; 前端 Next.js+React+TypeScript 为工程基座,WebGPU+WASM 为核心,Three.js 为兼容层; 数据覆盖结构化、非结构化、向量、时序、图关系、对象存储、缓存状态、审计; 部署 k8s+Docker+本地私有化。
当前开发指令入口是 AGENTS.md,用于 ChatGPT / Codex 协作。Claude/Anthropic 只能作为可选模型供应商、历史记录或适配器来源,不得作为当前仓库开发身份真源。
```

---

## 6. 修改规则

修改 ArchIToken 核心原则时,必须同步检查:

1. 本文件
2. `CONSTITUTION.md`
3. `AGENTS.md`
4. `POSITIONING_AND_COMPETITIVE_STRATEGY.md`
5. `PROFESSIONAL_STANDARDS_COMPLIANCE.md`
6. `MODULES.md`
7. `MODULE-REGISTRY.md`
8. `ARCHITECTURE.md`
9. `PRD.md`
10. README
