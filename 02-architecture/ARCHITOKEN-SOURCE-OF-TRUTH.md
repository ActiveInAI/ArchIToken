# ArchIToken · 工程唯一真源索引

**文档编号**: ARCHITOKEN-SOURCE-OF-TRUTH-V1  
**状态**: Active  
**适用项目**: ArchIToken, formerly InsomeOS  

---

## 1. 原则

ArchIToken 的工程治理以 GitHub 仓库文档为唯一真源。聊天上下文、临时讨论、图片、口头说明都只能作为输入,不能替代仓库文档。

任何架构、模块、技术选型、部署、Schema、Agent、Router、数据库、前端原则,最终都必须落到仓库 Markdown、Schema、代码或 CI 规则中。

---

## 2. 当前唯一真源文档

| 优先级 | 文档 | 作用 |
|---:|---|---|
| 1 | `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md` | 本索引,定义真源体系 |
| 2 | `02-architecture/ARCHITOKEN-CONSTITUTION-ADDENDUM.md` | ArchIToken 改名、宪法增强、模块扩展、Router、Schema、部署、数据库原则 |
| 3 | `02-architecture/CONSTITUTION.md` | 原 InsomeOS 宪法 19 条,待合并 ArchIToken 附录 |
| 4 | `02-architecture/MODULES.md` | 11 模块规范,待按 ArchIToken 扩展升级 |
| 5 | `02-architecture/MODULE-REGISTRY.md` | Module Registry 机制,待扩展到 Agent/Tool/Model/Renderer/Geometry/Rule Registry |
| 6 | `02-architecture/ARCHITECTURE.md` | 全栈架构规范,待升级 Router、Schema、WebGPU、数据、部署部分 |
| 7 | `01-product/PRD.md` | 产品需求,待同步 ArchIToken 名称和模块能力边界 |
| 8 | `README.md` | 仓库入口,待从 InsomeOS 迁移为 ArchIToken |

---

## 3. 当前已确认原则

### 3.1 命名

ArchIToken 是 InsomeOS 改名后的同一项目。

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

Next.js 16.2.4 + React 19.2.5 + TypeScript 6.0.3 + WASM + WebGPU + Three.js r184 并不冲突。

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

标准族库包括:

- 标准规范
- 族库构件
- 样板文件
- 材质库
- 图纸
- 模型
- 做法库
- 规则库
- 版本库

### 4.2 材料物流

材料物流包括:

- 材料库存
- 价格
- 供应商
- 采购
- 下料单
- 加工 BOM
- 包装
- 装车
- 物流
- 到货
- 现场堆放
- 签收
- 批次追踪

### 4.3 生产制造

`manufacturing` 应升级为 `production_manufacturing`,中文名为“生产制造”。

包括:

- 生产计划
- 工序路线
- 下料优化
- CNC / 数控文件
- 焊接
- 喷涂 / 防腐 / 防火
- 质检
- 工厂排产
- MES / ERP 对接
- 构件编码
- 包装发运

### 4.4 施工监理

施工监理包括:

- 方案
- 进度
- 质量
- 安全
- 日志
- AR
- 360 全景
- 三维扫描
- 倾斜摄影
- 无人机巡检
- 建筑机器人
- IoT
- 影像对比
- 整改闭环
- 竣工资料

---

## 5. 新对话记忆处理

当前会话中长期记忆工具不可用时,以本文件和相关仓库文档为准。

新开对话时,可要求助手读取本文件并更新长期记忆。建议记忆文本:

```text
ArchIToken 是 InsomeOS 改名后的同一项目。项目以 GitHub 仓库文档为唯一真源。核心原则是高性能、高效率、强扩展、易维护、高度灵活; 技术服务目标,不做语言或框架信仰。Rust/Cxx 主干优先,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等都可按场景使用。采用 Registry 替代 Enum; Generator 与 Evaluator 分离并增强为 Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver; 内部统一 Router,OpenRouter 只是外部适配器之一; Schema 体系为 OpenAPI+AsyncAPI+JSON Schema+IFC Schema+Module Schema; 前端 Next.js+React+TypeScript 为工程基座,WebGPU+WASM 为核心,Three.js 为兼容层; 数据覆盖结构化、非结构化、向量、时序、图关系、对象存储、缓存状态、审计; 部署 k8s+Docker+本地私有化。
```

---

## 6. 修改规则

修改 ArchIToken 核心原则时,必须同步检查:

1. 本文件
2. `ARCHITOKEN-CONSTITUTION-ADDENDUM.md`
3. `CONSTITUTION.md`
4. `MODULES.md`
5. `MODULE-REGISTRY.md`
6. `ARCHITECTURE.md`
7. `PRD.md`
8. README

任何冲突以本文件和 ArchIToken 附录为优先临时准则,直到旧文档完成迁移。
