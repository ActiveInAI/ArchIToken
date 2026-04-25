# ArchIToken · 宪法增强与模块扩展附录

**文档编号**: ARCHITOKEN-CONSTITUTION-ADDENDUM-V1  
**状态**: Draft → Architecture Baseline  
**适用项目**: ArchIToken, formerly InsomeOS  
**性质**: 架构原则、模块边界、Schema、Router、部署与工程哲学的统一修正

---

## 0. 命名关系

ArchIToken 是 InsomeOS 改名后的项目名称。二者本质上是同一个项目,不是两个并行项目。

后续文档中:

- 历史文档可保留 `InsomeOS` 名称,用于追溯 lineage。
- 新文档、新代码、新产品界面、新部署命名应逐步迁移到 `ArchIToken`。
- `insomeos` 仓库可在迁移期继续存在,但项目主名称为 `ArchIToken`。

---

## 1. 第一原则: 技术服务目标,不做语言或框架信仰

ArchIToken 的目标是构建面向 AEC / BIM / 重钢结构 / 工业工程的 AI 原生全流程自动化平台。

项目必须坚持:

- 高性能
- 高效率
- 强扩展
- 易维护
- 高度灵活
- 工程可控
- 长期可演进

因此,ArchIToken 不局限于某一种语言、框架、数据库、Agent 框架或推理引擎。

Rust / Cxx 是核心主干优先项,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等均可按场景使用。判断标准只有一个: 是否能更好地服务系统目标。

### 1.1 语言使用边界

| 场景 | 优先选择 | 说明 |
|---|---|---|
| 核心后端 / Harness Core | Rust / Cxx | 高并发、低延迟、强类型、可维护 |
| 几何内核 / CAD / BIM 热路径 | Rust / C++ / Cxx / WASM | 性能与生态共同决定 |
| AI 模型生态适配 | Python 可用 | 用于调用生态成熟的模型、推理、训练、转换工具 |
| 基础设施工具 | Go / Shell / Perl 可用 | 用于 CLI、运维脚本、文本处理、胶水工具 |
| GPU / 高性能计算 | CUDA / C++ / Rust FFI | 以性能和稳定性为准 |
| 前端与交互 | TypeScript + WASM + WebGPU | Web 端工程化与高性能渲染 |

禁止把“某语言不能用”作为默认原则。真正禁止的是: 低性能、低效率、难扩展、难维护、不可审计、不可回滚、不可长期演进的实现。

---

## 2. Registry 替代 Enum

ArchIToken 必须继承并强化 InsomeOS 的 Module Registry 原则。

所有可扩展对象都应采用 Registry 机制,而不是 enum 固化:

- 业务模块 Registry
- Agent Registry
- Tool Registry
- Model Registry
- Router Registry
- Schema Registry
- Geometry Kernel Registry
- Renderer Registry
- Workflow Registry
- Rule Registry

### 2.1 强制原则

- 新增模块应是“注册”,不是“全局修改代码”。
- 数据库不得使用 PostgreSQL ENUM 表达业务模块集合。
- Rust 不应使用 `enum BusinessPhase` 固化业务流程。
- Python 不应使用 `Enum` 固化模块列表。
- 前端不得硬编码模块列表;应从 `/v1/modules` 或 Module Schema 动态获取。

### 2.2 推荐实现

```text
Rust:      trait Module + ModuleRegistry
Python:    dataclass ModuleSpec + MODULE_REGISTRY,仅作为适配层
SQL:       modules table + module_id TEXT FK
Frontend:  Module Schema driven UI
```

---

## 3. Generator 与 Evaluator 分离,并增强为多门禁体系

ArchIToken 必须继承“AI 不自评”原则,并增强为完整的工程交付门禁。

### 3.1 基本原则

- Generator 不能评价自己的输出。
- Evaluator 必须是独立 Agent、独立提示词、独立上下文,推荐使用独立模型。
- 工程关键输出不得只依赖 LLM 自然语言判断。

### 3.2 增强后的角色链

```text
Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver
```

| 角色 | 职责 |
|---|---|
| Planner | 拆解任务、确定路径、选择工具 |
| Generator | 生成方案、图纸、模型、清单、报告 |
| Evaluator | 独立审查生成结果,指出问题 |
| RuleChecker | 依据规范库、工程规则、企业标准做确定性校核 |
| SchemaValidator | 校验 JSON Schema / IFC Schema / Module Schema / OpenAPI contract |
| Approver | 自动或人工最终门禁,决定是否进入交付物 |

### 3.3 工程输出强约束

以下输出必须经过 Evaluator + RuleChecker + SchemaValidator:

- BIM / IFC 模型
- 施工图 / 深化图
- 工程量清单 BOQ
- 报价 / 成本分析
- 结构计算书
- 生产制造文件
- 下料单
- 施工方案
- 质量 / 安全 / 监理报告
- 数字档案归档包

---

## 4. 统一 Router 原则: OpenRouter 是外部适配器,不是内部架构本体

ArchIToken 必须有内部统一 Router。这里的 Router 不是特指 OpenRouter。

### 4.1 概念区分

| 名称 | 定位 |
|---|---|
| OpenRouter | 外部模型聚合服务 / 外部模型网关之一 |
| InferenceRouter | 内部推理路由抽象,管理本地与远程推理引擎 |
| ModelRouter | 模型选择、模型白名单、成本、SLA、fallback、灰度 |
| ToolRouter | 工具调用、沙箱、权限、审计 |
| WorkflowRouter | 模块、Agent、任务图、DAG 编排 |
| RenderRouter | WebGPU / Three.js / 离线渲染 / 服务端渲染选择 |
| GeometryRouter | CAD / BIM / 几何内核选择与任务分发 |

### 4.2 决策

ArchIToken 应采用内部统一 Router 架构。

OpenRouter 可以作为 `ModelProvider` / `ExternalProviderAdapter` 之一接入,但不能替代项目内部的 ModelRouter / InferenceRouter。

原因:

- ArchIToken 需要本地私有化部署。
- ArchIToken 需要支持 Ollama、vLLM、SGLang、TensorRT-LLM、LMDeploy、llama.cpp 等本地或私有推理后端。
- ArchIToken 需要工程级审计、权限、SLA、fallback、成本控制、租户隔离。
- 外部 OpenRouter 无法覆盖几何、渲染、工具、工作流、规范审查等内部路由。

### 4.3 推荐抽象

```text
ArchITokenRouter
├── ModelRouter
│   ├── LocalInferenceAdapter
│   ├── OpenAICompatibleAdapter
│   ├── OpenRouterAdapter
│   ├── OllamaAdapter
│   ├── vLLMAdapter
│   ├── SGLangAdapter
│   ├── TensorRTLLMAdapter
│   └── LMDeployAdapter
├── ToolRouter
├── WorkflowRouter
├── GeometryRouter
├── RenderRouter
└── StorageRouter
```

---

## 5. Schema 体系升级

ArchIToken 的“单一真源”不应只停留在 OpenAPI。

必须升级为多 Schema 协同:

```text
OpenAPI + AsyncAPI + JSON Schema + IFC Schema + Module Schema
```

| Schema | 作用 |
|---|---|
| OpenAPI | REST / HTTP API 合同,SDK 生成,接口文档 |
| AsyncAPI | 事件流、消息队列、异步任务、实时通知合同 |
| JSON Schema | Agent 输入输出、配置、结构化结果校验 |
| IFC Schema | BIM / AEC 模型语义、构件、属性、关系校验 |
| Module Schema | 模块注册、模块输入输出、模块能力、SLA、权限、UI 元数据 |

### 5.1 强制原则

- 前端类型不得手写重复定义,应从 Schema 生成。
- Agent 输出必须结构化,且必须被 JSON Schema 校验。
- BIM 输出必须经过 IFC Schema / buildingSMART 相关校验链。
- 模块定义必须由 Module Schema 驱动,而不是散落在代码里。
- 异步事件必须使用 AsyncAPI 描述,避免消息系统失控。

---

## 6. 前端原则: Next.js + React + TypeScript + WASM 与 WebGPU 不冲突

ArchIToken 可以使用:

- Next.js 16.2.4
- React 19.2.5
- TypeScript 6.0.3
- WASM
- WebGPU
- Three.js r184

这些并不冲突。

### 6.1 正确分工

| 技术 | 定位 |
|---|---|
| Next.js | 应用框架、路由、SSR/RSC、权限页面、业务工作台 |
| React | UI 组件体系、交互状态、设计系统 |
| TypeScript | 类型系统、前端工程化、SDK 类型安全 |
| WASM | 前端本地高性能计算、解析、几何预处理 |
| WebGPU | 高性能渲染、BIM/数字孪生/大模型可视化核心路径 |
| Three.js | 生态兼容层、快速开发层、WebGPU Renderer 可用时作为桥接 |

### 6.2 决策

“WebGPU 优先”不等于不用 Next.js、React、TypeScript 或 Three.js。

ArchIToken 的前端原则是:

```text
Next.js + React + TypeScript 作为应用工程基座
WebGPU + WASM 作为高性能计算与渲染核心
Three.js 作为兼容层、生态层、快速验证层
```

### 6.3 禁止项

- 禁止把 Three.js 当作唯一渲染路线。
- 禁止用 Canvas 2D 或普通 DOM 承载大型 BIM / 数字孪生核心渲染。
- 禁止为了追求“纯 WebGPU”而放弃成熟工程框架。

---

## 7. 数据库与存储体系

ArchIToken 的数据体系必须覆盖:

- 结构化数据
- 非结构化数据
- 向量数据
- 时序数据
- 图关系数据
- 文件与对象存储
- 缓存与任务状态
- 审计与版本历史
- 多租户权限隔离
- 长期扩展维护

### 7.1 推荐数据分层

| 数据类型 | 典型内容 | 推荐能力 |
|---|---|---|
| 结构化数据 | 项目、用户、合同、BOQ、订单、权限 | PostgreSQL / RLS / 事务 / 审计 |
| 非结构化数据 | PDF、DWG、DXF、IFC、glb、图片、视频、报告 | 对象存储 / 版本管理 / 元数据索引 |
| 向量数据 | 规范、案例、图纸片段、知识库 Embedding | pgvector / 专用向量库 / Hybrid Search |
| 时序数据 | IoT、施工进度、设备状态、传感器 | TimescaleDB / 时序引擎 |
| 缓存与状态 | 会话、队列、热点索引、任务状态 | Zedis 优先,必要时兼容 Valkey/Redis 协议生态 |
| 图关系 | 构件关系、工序依赖、知识图谱、供应链 | 图数据库或关系表 + 图查询层 |
| 审计历史 | 操作日志、模型版本、审批记录 | append-only log / event sourcing |

### 7.2 原则

数据库不是单一产品选择,而是数据能力组合。

Zedis 是核心缓存、状态与任务队列优先项,但 ArchIToken 仍需要结构化、非结构化、向量、时序、审计、对象存储等组合能力。

---

## 8. 部署原则: k8s + Docker + 本地私有化部署

ArchIToken 必须支持:

- Kubernetes 正式部署
- Docker 镜像标准化交付
- Docker Compose 本地开发
- 本地私有化部署
- GPU 节点调度
- 离线或弱网环境部署
- 多租户隔离
- 可观测、可回滚、可备份、可迁移

### 8.1 分层

| 场景 | 基线 |
|---|---|
| 本地开发 | Docker Compose / devcontainer |
| 单机私有化 | Docker + systemd / lightweight local stack |
| 正式生产 | Kubernetes / k8s |
| GPU 集群 | k8s + NVIDIA device plugin / GPU Operator |
| 交付 | Helm / Kustomize / GitOps |
| 可观测 | Prometheus / Grafana / OpenTelemetry / Loki |

K3s 可作为极端资源受限环境的可选适配,但不是 ArchIToken 的正式部署基线。

---

## 9. 模块体系增强

ArchIToken 继承 11 模块并列架构,但每个模块需要全面拓展。

### 9.1 `standard_library` 标准族库

标准族库不只是构件库,而是 ArchIToken 的工程知识底座。

必须包括:

- 标准规范: 国家规范、行业规范、地方标准、企业标准、国际规范
- 族库构件: 重钢构件、节点、连接件、围护、门窗、楼梯、栏杆、机电构件
- 样板文件: 项目模板、户型模板、施工图模板、报价模板、BIM 模板
- 材质库: 钢材、板材、保温、防火、防腐、涂料、装饰材料
- 图纸库: CAD、PDF、施工图、节点详图、标准图集
- 模型库: IFC、glTF、glb、参数化构件、数字孪生模型
- 做法库: 墙体、楼板、屋面、基础、防水、防火、保温、装配做法
- 规则库: 结构规则、造价规则、施工规则、验收规则、安全规则
- 版本库: 规范版本、构件版本、企业做法版本

### 9.2 `material_logistics` 材料物流

材料物流必须覆盖从设计清单到现场签收的闭环。

必须包括:

- 材料库存
- 供应商管理
- 材料价格
- 价格快照
- 询价 / 比价 / 报价
- 采购计划
- 下料单
- 加工 BOM
- 包装清单
- 装车计划
- 物流路线
- 到货计划
- 现场堆放
- 入库 / 出库 / 签收
- 损耗与补料
- 批次追踪
- 二维码 / RFID / 构件身份码

### 9.3 `manufacturing` 改名为 `production_manufacturing`

原 `manufacturing` 应升级并改名为 `production_manufacturing`。

中文名: 生产制造。

必须包括:

- 生产计划
- 工序路线
- 加工 BOM
- 下料优化
- CNC / 数控文件
- 焊接工艺
- 喷涂 / 防腐 / 防火
- 质检记录
- 工厂排产
- MES / ERP 对接
- 构件编码
- 包装发运
- 返工处理
- 生产进度回传

迁移建议:

```text
old: manufacturing
new: production_manufacturing
```

数据库与 API 迁移时保留 alias,避免历史数据断裂。

### 9.4 `construction_supervision` 施工监理

施工监理不是单纯日志或验收,应覆盖现场工程执行全域。

必须包括:

- 施工方案
- 施工组织设计
- 专项施工方案
- 进度计划
- 甘特图 / 4D 模拟
- 班组管理
- 机械设备管理
- 质量检查
- 安全检查
- 隐蔽工程验收
- 工序报验
- 监理日志
- 施工日志
- 整改通知
- 旁站记录
- 材料进场验收
- AR 辅助安装
- 360 全景影像
- 三维扫描
- 倾斜摄影
- 无人机巡检
- 建筑机器人
- 现场 IoT
- 进度影像对比
- 质量缺陷识别
- 安全风险识别
- 竣工验收资料

### 9.5 每个模块都必须拓展

所有模块都必须按以下维度补齐:

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

---

## 10. 关于 `§` 符号

`§` 是 section sign,中文可称“章节符号”或“条款符号”。它常用于法律、规范、标准、宪法类文档中表示条款编号,例如 `§3` 表示第 3 条。

ArchIToken 不必须使用 `§`。

可以选择以下任一风格:

```text
§1 · Registry 替代 Enum
第 1 条 · Registry 替代 Enum
Article 1 · Registry over Enum
1. Registry over Enum
```

如果考虑中文团队可读性,推荐使用:

```text
第 1 条 · Registry 替代 Enum
```

保留 `§` 仅作为英文/技术文档中的简洁写法。

---

## 11. 必须同步修改的现有文档

后续应逐步修改:

- `README.md`: InsomeOS → ArchIToken,并保留 lineage 注释
- `01-product/PRD.md`: 11 模块全面拓展
- `02-architecture/CONSTITUTION.md`: 写入本附录的核心原则
- `02-architecture/MODULES.md`: 更新标准族库、材料物流、生产制造、施工监理
- `02-architecture/MODULE-REGISTRY.md`: 增强 registry 到 Agent/Tool/Model/Renderer/Geometry
- `02-architecture/ARCHITECTURE.md`: 更新 Router、Schema、前端、数据、部署
- `04-backend/openapi.yaml`: 增加 Module Schema 与异步事件引用
- `04-backend/migrations`: `manufacturing` → `production_manufacturing` 迁移 alias

---

## 12. 结论

ArchIToken 是 InsomeOS 的新名称与演进方向。

它必须从“11 模块 AEC Harness”升级为:

```text
AI + BIM + AEC + 工业工程 + WebGPU + Registry + Router + Schema + k8s 私有化部署
```

的高性能、高效率、强扩展、易维护工程系统。

任何语言、框架、工具、模型、数据库都不是目的。它们都是为 ArchIToken 系统目标服务的组件。
