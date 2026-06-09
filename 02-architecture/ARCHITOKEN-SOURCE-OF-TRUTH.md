# ArchIToken · 工程唯一真源索引

**文档编号**: ARCHITOKEN-SOURCE-OF-TRUTH-V1
**状态**: Active
**适用项目**: ArchIToken
**历史仓库 / 代码库名**: ArchIToken

---

## 1. 原则

ArchIToken 的工程治理以 GitHub 仓库文档为唯一真源。聊天上下文、临时讨论、图片、口头说明都只能作为输入,不能替代仓库文档。迁移期内,仓库路径、包名、API 名和历史 Markdown 中的 `ArchIToken` 按历史兼容标识处理;新用户界面、对外文档和发行物默认使用 `ArchIToken`。

任何架构、模块、技术选型、部署、Schema、Agent、Router、数据库、前端原则,最终都必须落到仓库 Markdown、Schema、代码或 CI 规则中。

---

## 2. 当前唯一真源文档

| 优先级 | 文档                                                          | 作用                                                               |
| -----: | ------------------------------------------------------------- | ------------------------------------------------------------------ |
|      1 | `02-architecture/ARCHITOKEN-SOURCE-OF-TRUTH.md`               | 本索引,定义真源体系                                                |
|      2 | `02-architecture/CONSTITUTION.md`                             | 22 条工程宪法                                                      |
|      3 | `02-architecture/POSITIONING_AND_COMPETITIVE_STRATEGY.md`     | 项目定位、竞品边界、对标与超越策略                                 |
|      4 | `02-architecture/PROFESSIONAL_STANDARDS_COMPLIANCE.md`        | 跨行业专业资格、监管体系、术语、规则、标准规范与技术规程合规基线   |
|      5 | `AGENTS.md`                                                   | ChatGPT / Codex 当前开发指令入口                                   |
|      6 | `02-architecture/MODULES.md`                                  | 16 模块规范,与当前 Rust / 前端 registry 同步                       |
|      7 | `02-architecture/MODULE-REGISTRY.md`                          | Module Registry 机制                                               |
|      8 | `02-architecture/ARCHITECTURE.md`                             | 全栈架构规范                                                       |
|      9 | `02-architecture/ARCHITOKEN_DATABASE_MANAGER.md`               | Apache-2.0 Rust/Go 开源数据库管理器架构基线                        |
|     10 | `docs/OPENBIM_STANDARD_BASELINE.md`                           | openBIM 标准体系基线: IFC / IDM / bSDD / BCF / IDS / Validate      |
|     11 | `02-architecture/HEAVY_STEEL_HOTEL_ZAOFANG_MODULE_PROGRAM.md` | 100间精品酒店重钢深化图纸与造房网60天推广执行模块程序              |
|     12 | `docs/BLENDER_PLUGIN_SYSTEM_INTEGRATION.md`                   | Blender Runtime、插件/扩展、Bonsai/IFC、场景派生和 worker 审计边界 |
|     13 | `01-product/PRD.md`                                           | 产品需求与模块能力边界                                             |
|     14 | `README.md`                                                   | 仓库入口与快速启动                                                 |

---

## 3. 当前已确认原则

### 3.1 命名

当前对外产品名使用 `ArchIToken`。

`ArchIToken` 是历史项目名、仓库名、路径名、包名/API 兼容标识和迁移期技术别名。新 UI、产品文案、发行物、桌面入口和新增文档默认使用 `ArchIToken`;只有历史路径、兼容合同、迁移说明或引用既有文件名时才使用 `ArchIToken`。

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

ArchIToken 是 AEC AI-Native 平台、Harness Engineering 系统、OpenBIM CDE Workflow OS、Speckle CDE 互操作运行时、IFCDB-Agent 数据库/Agent 路由和后端原生文件运行时。开放格式必须走原生/open runtime 路径; 私有或复杂格式必须通过后端 worker、授权适配器或企业服务进入,不得用前端派生文件替代真实格式支持。glTF/GLB 可以作为 OpenUSD/USDZ/3D Tiles 不可用时的 Web 运行时、交付兜底,也可以作为 SKP 等私有格式在真实转换命令/授权适配器失败后的最后补充兜底;但原始源文件、openBIM 语义、属性 Schema、单位/坐标和审计链仍是真源。

竞品对标的正确边界见 [`POSITIONING_AND_COMPETITIVE_STRATEGY.md`](./POSITIONING_AND_COMPETITIVE_STRATEGY.md)。任何“全面替代/全面超越 Autodesk、Trimble、Siemens、广联达、北京构力、斯维尔、中望”等表述必须有真实项目、互操作、性能、合规和审计证据。

### 3.2.2 专业与标准合规

ArchIToken 的整个平台、每个模块、每个名词、每个业务逻辑和每个 AI 输出,必须符合对应专业资格、监管体系、执业责任和授权边界。基础覆盖 IPMP / IPMA、注册建筑师、注册结构工程师、注册建造师、注册造价工程师、注册监理工程师,并扩展到生产制造、运输物流、海关贸易、税务、金融、财务会计、人力资源、组织治理、AI、数据安全、网络安全和软件工程。

详细基线见 [`PROFESSIONAL_STANDARDS_COMPLIANCE.md`](./PROFESSIONAL_STANDARDS_COMPLIANCE.md)。来源缺失时,系统只能输出“经验建议”,不得输出“合规/不合规/可施工/可报审/可验收/可申报/可清关/可入账/可支付/可发布”。

### 3.2.3 openBIM 标准体系

ArchIToken 的 CAD/BIM/CIM/GIS 工程数据底座必须基于 buildingSMART openBIM 标准体系。IFC、IDM、bSDD、BCF、IDS、buildingSMART Validate 及相关 API 合同是语义、交付、校验和协同真源。私有格式和厂商运行时只能作为适配器,不得替代 openBIM 作为平台真源。

详细基线见 [`docs/OPENBIM_STANDARD_BASELINE.md`](../docs/OPENBIM_STANDARD_BASELINE.md)。

### 3.2.4 PanCode 代码编程文件运行时

代码、配置、标记语言、脚本和纯文本文件的在线编辑固定为 PanCode 路线。CDE 源文件始终是 source of record;内嵌浏览器编辑器固定为 `monaco-editor@0.55.1` 和 VS Code 默认深色主题;完整 IDE 会话固定为 `code-server@4.121.0` 隔离 sidecar;代码语法树、搜索和诊断固定为 `tree-sitter v0.26.9` source-build/worker 路线。保存回写必须经 ArchIToken `/api/local-files/{fileId}` 或 `/api/local-files/{fileId}/code-session/commit` 更新版本、checksum 和审计证据。

PanCode 与 Office/PDF 路线隔离:Office 继续走 Collabora WOPI 主路线,PDF 工具继续走 Stirling-PDF/PaddleOCR/PDF adapter 路线。HTML 默认可视化预览并保留源码切换;其它登记代码/配置/文本文件默认进入编辑模式。

### 3.2.5 原生显示与派生显示边界

ArchIToken 的文件查看、模型查看、图纸查看、文档查看、媒体播放、归档浏览和代码编辑必须以原生显示为目标。原生显示必须绑定 CDE source of record,直接读取源格式结构、实体、页面、对象、图层、属性、材质、颜色、字体、坐标、单位、选择对象和保存/版本边界。

转格式派生显示只能作为兼容、缩略图、索引、审计、导出、批处理或明确标注的失败降级路线。任何 PDF/图片/HTML/Markdown/GLB/IFC/Collada/文本/截图等派生产物都不得被宣传、命名或标记为源格式原生显示。缺少原生 runtime、sidecar、worker、授权适配器或浏览器内核时,UI 必须显示 `native_unavailable`、`adapter_required`、`blocked` 或 `failed`,不得静默改用派生文件冒充原生打开。

Office/ODF 原生在线显示与编辑主路线是 Collabora Online WOPI 隔离服务;LibreOffice CLI 只能作为后端导出/批处理 worker。OFD 原生显示必须按 GB/T 33190-2016 开放版式文档源包、页面、资源、签章和固定版式对象读取;OFD 转 PDF、转图片、OCR 或文本抽取只能作为派生、索引、证据或降级。

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
Three.js = WebGPU 承载层 / 生态层 / 受审计失败恢复层
```

浏览器客户端、设计师工作站、演示环境和私有化部署基线必须启用 WebGPU 与 WebGL 硬件加速。WebGPU 是默认交互式渲染/计算路线; WebGL 只能作为 WebGPU 不可用、第三方遗留组件、缩略图或失败恢复时的受审计硬件加速 fallback。任何 profile、启动参数、容器策略、远程桌面策略或安全基线不得默认禁用 WebGPU、WebGL、硬件加速或 GPU 进程;确因目标环境不可用时必须记录 failed/unsupported evidence 并在 UI 中明示降级原因。

NVIDIA 目标硬件必须采用 NVIDIA 认证 / 支持的软件栈,包括 NGC CUDA / CUDA Deep Learning 基础镜像、NVIDIA Container Toolkit、GPU Operator / device plugin、DCGM 观测、CUDA / OptiX / TensorRT / Triton 等按能力注册的运行时。NVIDIA 路线不得用 Mesa、CPU-only、WebGL-only、空 Canvas、截图或前端派生文件冒充 GPU 渲染成功。缺少驱动、设备节点、容器运行时、WebGPU adapter 或 CUDA/OptiX smoke 时,必须记录 failed/unsupported evidence,再进入明确的审计 fallback。

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

NVIDIA GPU 节点必须通过 NVIDIA Container Toolkit / GPU Operator / device plugin 暴露真实 GPU 资源,worker 镜像优先从 NVIDIA NGC CUDA / CUDA Deep Learning 签名镜像构建并锁定 tag 或 digest。`latest`、未验证 CUDA 运行时、CPU 兼容绕过和静默降级都不是生产基线。

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
ArchIToken 以 GitHub 仓库文档为唯一真源。固定定位是 AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS; 开放格式必须走原生/open runtime 路径,私有或复杂格式必须通过后端 worker、授权适配器或企业服务进入,不得用前端派生文件替代真实格式支持。整个平台、每个模块、每个名词、每个业务逻辑和每个 AI 输出必须符合对应专业资格、监管体系、国家/行业/地方/国外标准规范、技术规程、项目合同和组织制度; 范围覆盖 AEC、生产、运输、海关、税务、金融、财务、人力、组织、AI、数据、网络安全和软件工程; 来源缺失时只能输出经验建议。核心原则是高性能、高效率、强扩展、易维护、高度灵活; 技术服务目标,不做语言或框架信仰。Rust/Cxx 主干优先,但 Python、Go、C++、Perl、Shell、CUDA、WASM、TypeScript 等都可按场景使用。NVIDIA 目标硬件必须走 NVIDIA NGC CUDA / Container Toolkit / GPU Operator / DCGM / CUDA / OptiX / TensorRT / Triton 等认证或支持软件栈,优先真实 GPU 渲染和真实 smoke evidence,不得用 CPU/WebGL/Mesa/截图兼容绕过冒充完成。浏览器和工作站必须启用 WebGPU/WebGL 硬件加速,WebGPU 优先,WebGL 只作受审计失败恢复。采用 Registry 替代 Enum; Generator 与 Evaluator 分离并增强为 Planner→Generator→Evaluator→RuleChecker→SchemaValidator→Approver; 内部统一 Router,OpenRouter 只是外部适配器之一; Schema 体系为 OpenAPI+AsyncAPI+JSON Schema+IFC Schema+Module Schema; 前端 Next.js+React+TypeScript 为工程基座,WebGPU+WASM 为核心,Three.js 为 WebGPU 承载层和受审计失败恢复层; 数据覆盖结构化、非结构化、向量、时序、图关系、对象存储、缓存状态、审计; 部署 k8s+Docker+本地私有化。
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
