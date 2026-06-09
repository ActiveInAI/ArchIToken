# ArchIToken 全产品应用、BOM、数据库、智能体、工作流与技术架构

版本日期: 2026-06-09  
适用对象: ArchIToken 16 模块产品架构、BOM 数据主线、PostgreSQL/ObjectStore/VectorStore/EventStore、Agent 编排、工作流、技术栈、运行时、部署和实施计划。  
产品定位: AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS。  
核心主线: 客户需求 -> 项目计划 -> 方案设计 -> 标准族库 -> 深化设计 -> 构件物料 BOM -> 计量造价 -> 采购物流 -> 生产制造 -> 施工管理 -> 数字孪生 -> 数字档案 -> 财务 / 人力 / AI / 设置治理。

---

## 0. 全产品架构总览

### 0.1 产品定义

ArchIToken 是工程业务操作系统,不是单个 BIM、CAD、造价、项目管理或 AI 聊天工具。产品核心是把以下对象放到同一个可审计系统里运行:

| 对象 | 系统职责 |
|---|---|
| 客户需求 | 从市场客服、会议纪要、图片、草图、合同和项目文件中结构化提取 |
| 项目计划 | WBS、里程碑、资源、审批计划、责任矩阵、风险和变更 |
| 方案 | 户型、体量、风格、初算、客户确认记录 |
| 标准族库 | 标准条文、SJG157 类目、构件命名、材料等级、型钢规格、节点做法 |
| 图纸 / 模型 / 文档 | DWG/DXF、IFC、STEP、SKP、3DM、Office 文档（Excel/Word/PPT）、PDF、图片、点云和派生模型 |
| 构件物料 BOM | 构件、材料、连接件、紧固件的编码、名称、尺寸、材料、数量和重量 |
| 工程量 / 造价 | BOQ、清单、定额、价格、成本测算、变更影响 |
| 采购 / 物流 | 供应商、采购单、批次、运输、到货、现场签收 |
| 生产制造 | 工单、下料、CNC、焊接、涂装、防腐、防火、质检、包装、发运 |
| 施工管理 | 进度、班组、日志、安全、质量、安装、验收、整改 |
| 数字孪生 | IFC/3D Tiles/OpenUSD/GLB、点云、3DGS、IoT、告警、维保 |
| 数字档案 | 合同、图纸、BOM、BOQ、审批、验收、审计、归档包 |
| 财务 | 预算、合同、付款、发票、凭证、对账、结算、审计证据 |
| 人力 | 组织、岗位、人员、班组、资质、考勤、绩效、培训 |
| AI 治理 | ModelRouter、ToolRouter、Agent、RAG、成本、审计、安全策略 |
| 设置治理 | 租户、账号、角色、权限、审批矩阵、数据字典、系统参数 |

### 0.2 端到端业务闭环

```text
marketing_service
  -> planning_management
  -> concept_design
  -> standard_library
  -> detailed_design
  -> component/material BOM
  -> quantity_costing
  -> material_logistics
  -> production_manufacturing
  -> construction_management
  -> digital_twin
  -> digital_archive
  -> finance_management / human_resources
  -> ai_center / settings_center 全程治理
```

### 0.3 产品层级

| 层级 | 名称 | 作用 |
|---|---|---|
| L7 | Web / Desktop / Mobile 工作台 | 16 模块统一入口、文件、对象、审批、审计、AI 助手 |
| L6 | SDK / API 合同 | OpenAPI、AsyncAPI、TypeScript/Python/Rust/Go SDK |
| L5 | Gateway | 鉴权、租户、限流、审计、REST/SSE/gRPC/MCP |
| L4 | Workflow / Agent | Planner、Generator、Evaluator、RuleChecker、SchemaValidator、Approver |
| L3 | Harness Core | Rust 服务、事务、Router、Registry、Schema、权限、审计 |
| L2 | Data Plane | PostgreSQL、ObjectStore、VectorStore、EventStore、CacheStore、GraphStore、AnalyticsStore |
| L1 | Worker / Runtime | Office 文档、PDF、CAD、BIM、IFC、DWG、图片/视频、AI、GPU、导出 |
| L0 | Infrastructure | Docker、Kubernetes、GPU 节点、NVIDIA/AMD/Intel/Apple 加速、私有化部署 |

### 0.4 全局不变量

| 不变量 | 说明 |
|---|---|
| Registry 替代 Enum | 模块、模型、工具、工作流、文件类型、规则、Schema 都走注册表 |
| CDE 文件是真源 | 浏览器状态、截图、派生文件、AI 输出都不能替代源文件 |
| AI 不直接发布专业判定 | AI 只能生成草稿、校验、建议和报告；专业判定必须走审批 |
| Router 是强边界 | 模型、工具、存储、工作流、几何、渲染都通过内部 Router |
| 版本和审计必备 | 文件、BOM、图纸、模型、审批、Agent 调用、导出都必须有版本和审计 |
| 下游只读发布态 | 造价、采购、生产、施工只能消费 `issued` 或项目批准状态的数据 |
| 私有化可运行 | 核心业务不能依赖外部 SaaS 才能成立 |

### 0.5 会议目标到系统落点

本节把 2026-06 会议确定的 AI 企业运营、4A 架构、BOM 数据底座、Agent 编排、现场数字化和硬件预算转成可执行的系统边界。每一项都必须能落到模块、数据表、工作流、Agent、权限和验收证据。

| 会议目标 / 问题 | ArchIToken 系统决策 | 直接落点 | 验收标准 |
|---|---|---|---|
| AI 运行企业,人辅助 AI | AI 不直接替代责任人。AI 负责采集、抽取、生成、校验、提醒、排程和异常定位；人负责客户/供应商界面、专业判断、审批签发、例外处置和战略决策。 | `ai_center`, `settings_center`, 全模块 `approval_tasks`, `audit_events`, `agent_runs`, `module_transactions` | 任一 AI 输出必须记录输入文件、提示、模型、工具、RAG、规则结果、人工审批和最终交付物。没有审批的 AI 输出不能进入采购、生产、施工和财务。 |
| 三层智能体工程架构 | 不做一个大模型横扫业务。按任务 Agent、流程 Agent、企业 Agent 分层,通过 Harness 和 Workflow 编排。 | Agent Registry、Workflow Template、ModelRouter、ToolRouter、Outbox/EventStore、Worker 队列 | P0 先落 24-32 个 Agent；P1 扩到 80-120 个；成熟生产再到 160-200 个。每个任务都有 `planned/running/evaluated/blocked/approved/failed` 状态和重试记录。 |
| 4A 架构落地 | 业务架构定义对象和责任,数据架构定义事实来源,应用架构定义操作入口,技术架构定义运行边界。四者通过同一组 ID 串联。 | `module_id`, `project_id`, `source_file_id`, `bom_version_id`, `workflow_run_id`, `audit_event_id` | 能从客户需求追溯到项目计划、方案、图纸/模型、构件物料 BOM、采购、生产、施工、档案、财务凭证和责任人。 |
| BOM 是企业数据核心 | BOM 指构件物料清单,不是泛化阶段 BOM 口径。以 `应舍美居_构件物料清单.xlsx` 为当前真实模板,叠加 SJG157 编码表和构件标准化命名规则。 | `component_bom`, `component_bom_versions`, `component_bom_lines`, `bom_line_sources`, `sjg157_categories`, `component_naming_tokens` | 每一行 BOM 必须能追溯到源 Excel、Sheet、行列、SJG157 类目、构件命名 token、材料/规格/数量/重量校验结果。 |
| AI 正向 BIM 与模型派生 | AI 的主线不是聊天生成文档,而是把客服/客户/合同/现场输入转成需求参数,生成 BIM/IFC 模型草稿,再由模型导出施工图、加工图、构件 BOM、BOQ、材料需求和报价草稿。 | `design.model_elements`, `drawing_sheets`, `fabrication_drawings`, `component_bom_lines`, `boq_items`, `quote_lines`, `agent_runs` | 任一报价项、采购件、加工件、工单或验收点必须能回跳到需求、模型构件、图纸页、BOM 行、校验报告、审批记录和 Agent 调用。 |
| 单一事实来源 | PostgreSQL 是结构化业务真源；ObjectStore/CDE 是文件真源；VectorStore 只做检索索引；EventStore 只做事件和回放；缓存不是真源。 | `source_files`, `business_objects`, `object_versions`, `file_versions`, `event_outbox`, `vector_index_jobs` | 同一客户、项目、构件、材料、供应商、手机号、合同号只能有一个权威对象；其它模块引用 ID,不能复制字段形成第二真源。 |
| 权限与变更管理 | 所有关键对象走 RBAC/RLS、审批矩阵、版本差异、变更原因和审计链。 | `settings_center`, `rbac_policies`, `row_level_policies`, `approval_matrices`, `change_records`, `audit_events` | 任一关键字段变更必须有旧值、新值、原因、操作者、审批人、时间、来源模块和回滚路径。 |
| 现场工序数字化 | 现场不是单独 App。施工、生产、物流、档案共用项目、构件、物料、工单、照片和验收证据。 | `production_manufacturing`, `construction_management`, `digital_archive`, 移动端工作台 | 每道工序有工单、构件/材料、负责人、照片/视频、检查项、整改记录、验收状态和归档包。 |
| 混合模型路由 | 简单结构化任务优先本地小模型或国内模型；复杂代码、设计推理、长文规划可走外部高性能模型；所有调用必须经过 ModelRouter。 | `ai_center.model_routes`, `tool_policies`, `agent_tool_calls`, `model_cost_events` | 业务代码不得直接调用外部模型 SDK；每次调用可统计成本、延迟、输入输出、脱敏策略和失败降级。 |
| 40-50 万 CPU 基础包 + BIM GPU 专项另购 | 一期 CPU/存储/网络预算服务于内部试点、CDE/NAS、数据库/CI、Agent 编排、日志审计和备份。BIM 硬件另购 2 张 NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe,单价按用户确认价 ¥68,000/张,显卡小计 ¥136,000。 | `5.25 2026-06 硬件选型、网络、安全与预算` | 六节点 CPU 包仍以 2 x 676X + 4 x 658X、每台至少 64GB ECC RDIMM、不含 HA 为边界；GPU 卡独立列支,上架前必须通过服务器机箱、PCIe、供电、风道、驱动和质保验收。 |

### 0.6 三层 Agent 工程架构

Agent 是受控工程能力,不是聊天窗口。每个 Agent 必须声明输入、工具、规则、输出 Schema、失败边界和审批门槛。

| 层级 | 职责 | 典型 Agent | 输入 | 输出 | 失败边界 |
|---|---|---|---|---|---|
| 个体 Agent | 完成单一任务,不跨越业务责任边界。 | `ExcelBOMImportAgent`, `SJG157ClassifyAgent`, `ComponentNameParseAgent`, `PDFExtractAgent`, `DWGMetaReadAgent`, `CostLineNormalizeAgent`, `PhotoQualityCheckAgent` | 文件、对象版本、规则、字典、用户指令 | 结构化草稿、校验报告、差异清单、待确认项 | 低置信度、缺字段、冲突字段、规则缺失时只能输出待确认项。 |
| 流程 Agent | 串联多个模块的任务,推动状态机流转。 | `RequirementToPlanAgent`, `DesignToBOMAgent`, `BOMToPurchaseAgent`, `BOMToWorkOrderAgent`, `SiteAcceptanceToArchiveAgent`, `ChangeImpactAgent` | 上游已审批对象、项目状态、工作流模板 | 下游草稿、审批任务、变更影响、风险提醒 | 不允许绕过审批生成发布态；下游只能消费 `issued/approved` 数据。 |
| 企业 Agent | 汇总经营级风险、成本、进度、现金流和资源瓶颈。 | `OperationsReviewAgent`, `CostRiskAgent`, `CashflowWatchAgent`, `ScheduleRiskAgent`, `SupplierRiskAgent`, `DataQualityGovernorAgent` | 全模块事件、指标、审批、异常、审计 | 经营日报、风险清单、资源建议、例外升级 | 只能建议和预警,不能直接改合同、付款、采购、人员和生产计划。 |

Agent 标准门禁链固定为:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

| 门禁 | 必做动作 | 不通过处理 |
|---|---|---|
| Planner | 识别任务、来源文件、目标对象、权限和所需工具 | 缺权限或缺来源文件时拒绝执行 |
| Generator | 调用模型、工具、RAG 和解析器生成候选结果 | 输出必须带引用和置信度 |
| Evaluator | 对比需求、历史案例、上下文和质量标准 | 低分结果进入返工或人工确认 |
| RuleChecker | 校验 SJG157、构件命名、材料规格、数量、审批状态和专业规则 | 规则缺失时标为启发式建议 |
| SchemaValidator | 校验 JSON Schema、数据库约束、枚举注册表和跨表引用 | 不写入生产表,只保留草稿和错误 |
| Approver | 人工确认、签发、退回或作废 | 未批准不得进入下游发布态 |

### 0.7 4A 落地蓝图

| 架构域 | ArchIToken 落地 | 主键 / 对象 | 禁止事项 |
|---|---|---|---|
| 业务架构 BA | 16 模块覆盖客户需求、计划、设计、标准库、BOM、造价、采购、生产、施工、孪生、档案、财务、人力、AI 和设置治理。 | `module_id`, `business_object_id`, `project_id`, `workflow_state` | 禁止把模块做成孤立页面、营销页或只读报表。 |
| 数据架构 DA | PostgreSQL 保存业务对象和事务；ObjectStore/CDE 保存源文件和派生文件；VectorStore 保存索引；EventStore 保存事件；AnalyticsStore 保存指标。 | `source_file_id`, `object_version_id`, `bom_line_id`, `event_id`, `audit_event_id` | 禁止用向量库、Excel 副本、浏览器缓存或 Agent 记忆作为权威数据。 |
| 应用架构 AA | 统一 Workbench、模块页面、文件抽屉、对象表格、审批面板、Agent 门禁、操作队列和审计时间线。 | `/app/modules/{module_id}`, `approval_task_id`, `operation_id` | 禁止给数字孪生、BOM、AI 中心单独做割裂入口。 |
| 技术架构 TA | Rust Gateway/Harness Core、Python Agent Orchestrator、Next.js 工作台、Worker 运行时、PostgreSQL、对象存储、Kubernetes/Docker、NAS/服务器。 | `service_id`, `worker_id`, `agent_run_id`, `deployment_id` | 禁止业务逻辑直连外部模型、直写对象存储绕过审计、硬编码模块枚举。 |

### 0.8 六个月实施切片

| 阶段 | 目标 | 交付 | 验收 | 资源边界 |
|---|---|---|---|---|
| 第 0-1 月 | 建立数据真源和权限底座 | 租户/账号/角色/RLS、CDE 文件、源文件登记、BOM 导入最小链路、审计事件 | 上传 Excel 后能生成 BOM 草稿,并追溯 Sheet/行列/操作者/版本 | 用一期 `srv-01` + `srv-02`；BIM GPU 卡按专项采购验收,不得绕过 CDE/审批直接产出生产结论。 |
| 第 1-2 月 | 打通构件物料 BOM 主线 | SJG157 类目、构件命名、BOM 行校验、版本差异、发布审批 | BOM 从草稿到发布态可走审批；下游只能读取发布态 | NAS RAID5 存源文件、快照、归档包和数据库备份。 |
| 第 2-3 月 | 打通项目、方案、造价、采购 | 项目/WBS、方案对象、BOQ、采购需求、变更影响 | 客户需求能生成项目计划和候选方案,发布 BOM 能生成 BOQ/采购草稿 | 复杂模型推理走外部模型或云端排队,本地只做编排和结构化任务。 |
| 第 3-4 月 | Agent 编排进入可控运行 | Agent Registry、ModelRouter、ToolRouter、Workflow Template、成本审计 | 每次 Agent 执行可查输入、工具、模型、输出、规则、审批和费用 | P0 只做 24-32 个关键 Agent；后续 80-120/160-200 是任务目录规模,不是同时满载模型推理规模。 |
| 第 4-5 月 | 生产和现场闭环 | 工单、下料/质检/包装、现场安装、照片证据、整改、验收 | 每个构件从 BOM 到生产到安装到验收有证据链 | 移动端优先做现场确认和拍照留痕,不做孤立 App。 |
| 第 5-6 月 | 经营级 AI 运营 | 经营日报、进度/成本/现金流/供应商风险、异常升级、归档包 | 管理层能看到跨模块瓶颈,并能回跳到原始文件、对象和责任人 | 一期硬件只支撑内部生产力和试点；BIM GPU 只承载受控模型派生/局部推理,高并发公网生产和灾备仍进二期/三期。 |

### 0.9 当前排查结论与整改优先级

| 排查项 | 当前问题 | 必须整改成什么 | 优先级 |
|---|---|---|---|
| 产品边界 | 容易被写成“BOM 文档 + 硬件清单”,不能支撑 AI 运行企业。 | 必须以 16 模块、4A、BOM 真源、Workflow、Agent、审计和权限组成统一产品架构。 | P0 |
| BOM 主线 | BOM 容易泛化成阶段名词。 | 只把构件物料清单作为当前核心 BOM,用 SJG157、构件命名规则、应舍美居样表建立真实字段、校验和下游引用。 | P0 |
| 数据真源 | 文件、数据库、向量、缓存和 Agent 记忆容易混用。 | PostgreSQL 做结构化真源,ObjectStore/CDE 做文件真源,VectorStore 只做索引,EventStore 只做事件。 | P0 |
| Agent 编排 | 单个模型直接写业务结论会造成不可控风险。 | 必须进入 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver。 | P0 |
| 权限与审计 | 只有账号登录不够,不能满足生产责任追溯。 | 对象级权限、RLS、审批矩阵、变更原因、JumpServer 会话、Agent 调用和文件版本全部审计。 | P0 |
| 生产可用 | 只有页面和静态文档不能算生产可用。 | 必须有数据库迁移、API、Worker、前端、测试 fixture、备份恢复、监控告警和演练记录。 | P0 |
| 大厂对标 | 不能口头宣称超越广联达、华东院、Autodesk、Tekla。 | 只能在开放数据闭环、AI 审计、私有化、证据链、重钢场景模板上建立可验证差异化。 | P1 |
| 硬件预算 | 40-50 万 CPU/存储/网络包不能同时覆盖完整 GPU 服务器和高可用机房。 | CPU 基础包与 BIM GPU 专项分账:可选 2 台 676X 保守包或 2 x 676X + 4 x 658X 六节点轻量试点包；另购 2 张 RTX PRO 6000D 84GB 服务器版显卡,显卡小计 ¥136,000；公网生产和 HA 仍单独立项。 | P0 |
| 等保基础 | 缺堡垒机、日志、备份、VLAN、最小权限时不能上线生产数据。 | 一期纳入 JumpServer、VPN/MFA、VLAN、日志审计、ZFS 快照、离线备份、主机加固。 | P0 |
| 实施管理 | 没有 Backlog、验收和责任人会变成空架构。 | 每个模块必须落到页面、表、API、事件、Agent、测试和验收命令。 | P0 |

### 0.10 生产可用等级

| 等级 | 能做什么 | 不能做什么 | 必须具备 |
|---|---|---|---|
| L1 内部原型 | 本地导入样表、查看模块、跑单个 Agent、生成静态报告 | 不能承载真实项目生产数据 | 单机数据库、fixture、手工备份、基础审计 |
| L2 内部生产力 | 30 人团队内部使用,管理 BOM、文件、审批、Agent 草稿和归档 | 不承诺外部客户 SLA,不承载 1 万公网用户 | `srv-01` + `srv-02`,权限、审计、备份、JumpServer、最小监控 |
| L3 商业试点 | 100/1000 用户试点,客户项目可进入受控流程 | 不承诺大规模公网平台运营 | 独立生产环境、灰度、备份恢复演练、日志告警、工单和审批闭环 |
| L4 规模生产 | 1 万用户以上公网访问、跨项目并发、客户 SLA | 不能放办公室单点设备 | 云/IDC K8s、数据库 HA、对象存储多副本、WAF/CDN、灾备、SOC/审计 |

### 0.11 2026-06-09 当前项目进度对齐

本节记录当前仓库已出现的实现事实,用于防止本架构文档停留在规划状态。除非下列文件进入 Git 索引、通过测试并被提交推送,否则只能称为“本地工作区已实现/待合并”,不能称为 GitHub 远端已发布。

| 项 | 当前事实 | 本地证据 | 状态 |
|---|---|---|---|
| 文档正本 | 正本是 Markdown,HTML 是渲染产物。 | `/home/insome/dev/insomeos/docs/ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.md` | 本地未跟踪 |
| 仓库 HTML | 当前同名 HTML 位于仓库 `docs/` 下,由 `tools/render_full_product_architecture_doc.mjs` 生成。 | `/home/insome/dev/insomeos/docs/ARCHITOKEN_BOM_APP_DATABASE_AGENT_TECH_ARCHITECTURE_2026.html` | 本地未跟踪 |
| 桌面副本 | 桌面存在用户给定文件,与仓库 HTML 曾发生内容差异,需要以仓库正本重新同步。 | `/home/insome/Desktop/ARCHITOKEN_BOM_APP_DATABASE_AGENT_TECH_ARCHITECTURE_2026.html` | 本地副本 |
| GitHub 目标路径 | 远端仓库为 `ActiveInAI/ArchIToken`,当前分支为 `codex/open-cde-file-runtime-workbench-20260523`;提交后 HTML 目标 URL 为 `https://github.com/ActiveInAI/ArchIToken/blob/codex/open-cde-file-runtime-workbench-20260523/docs/ARCHITOKEN_BOM_APP_DATABASE_AGENT_TECH_ARCHITECTURE_2026.html`。 | `git remote -v`, `git branch --show-current`, `git status --short` | 远端路径可确定,但文件尚未提交 |
| 16 模块真源 | `personal_center`, `finance_management`, `human_resources` 已作为 active registry 模块对齐;`finance_hr` 仅保留历史 alias。 | `CHANGELOG.md`, `02-architecture/MODULES.md`, `03-frontend/lib/module-registry.ts` | 已对齐 |
| 统一工作台 | 模块统一入口、PanUI、`wechat_light` 默认主题、ModuleBackendAdapter、CDE 文件操作、右侧抽屉和数字孪生统一入口规则已进入前端契约。 | `02-architecture/BUSINESS_MODULE_WORKBENCH.md`, `03-frontend/components/ModuleWorkbenchShell.tsx`, `03-frontend/lib/theme-registry.ts` | 已对齐 |
| 构件物料 BOM 前端 | 已有 `ComponentBomWorkbench`、`component-bom.ts`、Vitest 合同。样表锚点为 SJG157 5678 类目、命名规则 41 条、BOM 14 行、类目引用 135 条、总数量 470、校验警告 19、错误 0。 | `03-frontend/components/ComponentBomWorkbench.tsx`, `03-frontend/lib/component-bom.ts`, `03-frontend/lib/component-bom.test.ts` | 本地已实现,待全量验证 |
| 构件物料 BOM Worker | `component_bom` worker 已能解析三份 XLSX,输出 import manifest、lines、validation report、SJG157 index、naming rules、category references,并保持 `professional_review_required`。 | `06-workers/architoken_workers/component_bom_worker.py`, `06-workers/tests/test_component_bom_worker.py`, `06-workers/architoken_workers/worker_cli.py`, `06-workers/architoken_workers/engine_registry.py` | 本地已实现,源文件存在时可测 |
| BOM 数据库桥 | 已有重钢项目数据库桥、BOM 行、源行证据、下游链接、Graph/Event/Analytics/Audit 连接和状态视图。 | `04-backend/migrations/20260609000001_component_bom_database_bridge.sql`, `04-backend/scripts/smoke-heavy-steel-database-bridge.sh` | 已在本地 PostgreSQL 跑通:198 图纸、8 包、14 BOM 行、84 下游链接、事件/审计/图谱证据完整 |
| BOM 导入合同 | 已补充 import batch、naming rules、source category refs、validation issues 和 `bom_lines` 语义字段,并启用 RLS。 | `04-backend/migrations/20260609000004_component_bom_import_contract.sql` | 本地已实现 |
| 模块操作运行时 | 全局 `module_operation_runs`、状态视图、完整性视图、CDE 文件触发器桥、Database Manager API 和前端客户端已接上。 | `04-backend/migrations/20260609000003_module_operation_runtime.sql`, `04-backend/migrations/20260609000005_module_operation_runtime_integrity.sql`, `04-backend/migrations/20260609000007_module_file_operation_runtime_bridge.sql`, `04-backend/database-manager/src/module_operation_runtime.rs`, `03-frontend/lib/module-operation-runtime-client.ts` | 本地已实现,需 DB manager 运行验证 |
| 原生文件运行时 | `native-open`、`native-open/commit`、RVT/SKP/3DM/IFC 派生入口继续坚持源文件、checksum、ETag、Range、adapter-required 和禁止假成功。 | `03-frontend/app/api/local-files/[fileId]/native-open/route.ts`, `03-frontend/app/api/local-files/[fileId]/3dm-derivative/route.ts`, `03-frontend/app/api/local-files/[fileId]/rvt-derivative/route.ts`, `03-frontend/app/api/local-files/[fileId]/skp-derivative/route.ts`, `docs/RHINO_3DM_IFC_SIDECAR.md`, `docs/SKETCHUP_SKP_SIDECAR.md` | 本地已实现部分入口,外部 adapter 需配置 |
| 运行时能力与 OpenAPI | OpenAPI 已覆盖 generation、artifacts、skills、MCP tools、knowledge-sources、asset/conversion/viewer commands;运行时能力包含 `heavy_steel_component_bom_export`。 | `04-backend/openapi.yaml`, `04-backend/harness-core/src/runtime_capabilities.rs` | 已对齐,需 SDK/contract 验证 |
| buildingSMART/openBIM 门禁 | Gateway 与 IFC manifest 已从 6 项证据升级为 review/claim 两级门禁:IDS、官方 Validate、bSDD、BCF、IDM、审批审计、真实全链样本、OpenCDE/API 合同齐全后才可 `ready_for_openbim_review`;官方 certification/conformance artifact 齐全后才允许 `mayClaimBuildingSmartOpenBim=true`。 | `04-backend/harness-core/src/bin/gateway.rs`, `06-workers/architoken_workers/openbim_worker.py`, `06-workers/architoken_workers/openbim_evidence_worker.py`, `docs/OPENBIM_STANDARD_BASELINE.md` | 本地已实现证据门禁;需真实官方报告和项目样本 |
| AI 正向 BIM 与员工 Agent 集群 | 架构正本已补齐从客服/客户/合同/现场输入到 BIM/IFC 模型草稿、施工/加工图、模型导出 BOM、BOQ/材料/报价、采购/生产/施工/归档的对象链,并定义面向客服、设计、BIM、造价、材料、生产、施工、档案、财务、人力和管理层的岗位 Agent。 | `5.26 AI 生成 BIM、模型派生与员工智能体集群`, `tools/generate_architoken_executive_brief_10p.mjs` | 文档架构已对齐;API、数据库迁移、Worker、前端工作台和合同测试仍需拆 P0 任务实现 |
| 运维审计与日志归档 | JumpServer/堡垒机会话、命令审计、归档批次、归档 item、ready view 和 P0 smoke 已补齐。 | `04-backend/migrations/20260609000005_operations_audit_log_archive.sql`, `04-backend/scripts/smoke-operations-audit-log-archive.sh` | 已在本地 PostgreSQL 跑通,readiness 为 `passed`;下一步接真实 JumpServer/Teleport artifact |
| 备份恢复演练 | 备份策略、备份运行、恢复演练、校验项、ready view 和 PostgreSQL 临时库恢复 smoke 已补齐。 | `04-backend/migrations/20260609000006_backup_restore_dr_contract.sql`, `04-backend/scripts/smoke-backup-restore-drill.sh` | 已在本地 PostgreSQL 完成 `pg_dump`、临时库 `pg_restore`、校验和 evidence 写入;下一步扩展 ObjectStore/config/audit logs |

当前不得对外宣称的事项:

- 不得说该 HTML 已经在 GitHub 远端发布;当前证据只支持“路径已确定,文件本地未跟踪”。
- 不得把构件物料 BOM 标为生产、采购、施工、造价或财务可用;当前状态仍是 `professional_review_required`。
- 不得把 3DM/SKP/RVT 等私有格式说成平台原生全能力已完成;没有授权 sidecar 或真实 artifact 时只能返回 `adapter_required` 或 `blocked/failed`。
- 不得宣称已获得 buildingSMART 官方认证或生产级合规;只有真实 `buildingsmart_certification_report.json` 指向官方 certification/conformance 来源并通过审批审计后,系统才允许 `mayClaimBuildingSmartOpenBim=true`。
- 不得把模块运行时写入标为生产通过;必须先在目标数据库运行 smoke,并保留输出证据。备份恢复与运维归档已有本地 smoke 证据,但接入生产 JumpServer/ObjectStore 前仍只能声明为 P0 gate 已具备。
- 不得用桌面 HTML 副本作为唯一真源;后续必须以仓库 Markdown 正本重新渲染 HTML。
- 不得宣称 AI 生成的 BIM 模型、施工图、加工图、BOM、BOQ、报价、材料需求、采购单、生产工单或验收记录已自动达到可施工、可加工、可采购、可报价、可付款或可归档状态；缺少专业规则、模型校验、图纸/BOM 回跳、价格来源、质检证据和人工审批时只能标记为草稿/待确认/启发式建议。

---

## 1. 16 模块产品应用架构

### 1.1 模块总表

| order | 模块 ID | 中文名 | 核心业务对象 | 关键输出 |
|---:|---|---|---|---|
| 1 | `personal_center` | 个人中心 | 个人资料、待办、通知、最近工作、审批任务 | 个人工作台、待办流 |
| 2 | `marketing_service` | 市场客服 | 线索、客户、需求、会议、报价草案、合同意向 | 需求摘要、报价草案、项目机会 |
| 3 | `planning_management` | 计划管理 | 项目、WBS、里程碑、资源、风险、变更 | 项目基线、审批计划、责任矩阵 |
| 4 | `concept_design` | 方案设计 | 方案、户型、风格、体量、初算、客户确认 | 候选方案、方案比较、客户确认 |
| 5 | `standard_library` | 标准族库 | 标准条文、族库、材料、构件、命名规则、SJG157 | 可复用标准库、规则库、构件模板 |
| 6 | `detailed_design` | 深化设计 | 图纸、IFC、结构计算、节点、构件物料 BOM | 深化包、构件清单、校验报告 |
| 7 | `quantity_costing` | 计量造价 | 工程量、BOQ、价格、成本、变更 | 造价文件、成本测算、变更影响 |
| 8 | `material_logistics` | 材料物流 | 供应商、采购、批次、运输、到货、堆场 | 采购计划、物流计划、签收记录 |
| 9 | `production_manufacturing` | 生产制造 | 工单、下料、CNC、焊接、质检、包装、发运 | 工单、CNC 文件、质检单、发运批次 |
| 10 | `construction_management` | 施工管理 | 进度、班组、日志、安全、质量、安装、验收 | 施工日志、验收报告、整改闭环 |
| 11 | `digital_twin` | 数字孪生 | 模型、点云、3DGS、IoT、告警、维保 | 运维模型、告警、维保计划 |
| 12 | `digital_archive` | 数字档案 | 归档包、档案项、保存期限、审计链 | 竣工档案、证据包、长期追溯 |
| 13 | `finance_management` | 财务管理 | 合同、预算、付款、发票、凭证、对账 | 凭证、结算、审计证据 |
| 14 | `human_resources` | 人力资源 | 员工、班组、岗位、资质、考勤、绩效 | 工时、资质、绩效、结算依据 |
| 15 | `ai_center` | AI中心 | 模型路由、工具、RAG、Agent、成本、审计 | AI 能力注册、运行审计、成本控制 |
| 16 | `settings_center` | 设置中心 | 租户、账号、角色、权限、审批矩阵、系统参数 | 身份权限、审批配置、系统治理 |

### 1.2 模块之间的数据合同

| 上游模块 | 交付物 | 下游模块 | 数据合同 |
|---|---|---|---|
| `marketing_service` | 客户需求、会议纪要、报价草案 | `planning_management`, `concept_design` | `customer_requirement.v1`, `quote_draft.v1` |
| `planning_management` | WBS、里程碑、责任矩阵 | `concept_design`, `detailed_design`, `construction_management` | `project_plan.v1`, `wbs.v1` |
| `concept_design` | 方案、初算、客户确认 | `detailed_design`, `quantity_costing` | `concept_variant.v1`, `concept_acceptance.v1` |
| `standard_library` | 标准、构件、材料、命名规则 | 全模块 | `standard_clause.v1`, `component_template.v1`, `naming_rule.v1` |
| `detailed_design` | 图纸、IFC、BOM、校验报告 | `quantity_costing`, `production_manufacturing`, `construction_management` | `drawing_package.v1`, `ifc_model.v1`, `component_bom.v1` |
| `quantity_costing` | BOQ、成本、变更影响 | `material_logistics`, `finance_management` | `boq.v1`, `cost_breakdown.v1` |
| `material_logistics` | 采购单、到货、批次 | `production_manufacturing`, `construction_management`, `finance_management` | `purchase_order.v1`, `shipment_batch.v1` |
| `production_manufacturing` | 工单、质检、发运 | `construction_management`, `finance_management`, `digital_archive` | `work_order.v1`, `qc_record.v1`, `dispatch_batch.v1` |
| `construction_management` | 日志、安装、验收、整改 | `digital_twin`, `digital_archive`, `finance_management` | `site_installation.v1`, `acceptance_record.v1` |
| `digital_twin` | 运维模型、告警、设备状态 | `digital_archive`, `construction_management` | `twin_model.v1`, `iot_event.v1` |
| `finance_management` | 凭证、付款、对账 | `digital_archive`, `human_resources` | `voucher.v1`, `payment_record.v1` |
| `human_resources` | 班组、工时、资质 | `planning_management`, `construction_management`, `finance_management` | `crew_assignment.v1`, `timesheet.v1` |
| `ai_center` | 模型、工具、Agent 配置 | 全模块 | `agent_profile.v1`, `model_route.v1`, `tool_policy.v1` |
| `settings_center` | 用户、角色、权限、审批矩阵 | 全模块 | `identity.v1`, `rbac_policy.v1`, `approval_matrix.v1` |

### 1.3 每个模块的应用页面

| 模块 | 主页面 | 子页面 |
|---|---|---|
| `personal_center` | `/app/modules/personal_center` | 待办、最近文件、个人审批、安全会话 |
| `marketing_service` | `/app/modules/marketing_service` | 线索、客户、需求采集、报价草案、合同意向 |
| `planning_management` | `/app/modules/planning_management` | WBS、甘特图、资源、风险、变更、审批计划 |
| `concept_design` | `/app/modules/concept_design` | 方案生成、方案对比、风格库、客户确认 |
| `standard_library` | `/app/modules/standard_library` | 标准条文、SJG157、构件命名、材料库、型钢库 |
| `detailed_design` | `/app/modules/detailed_design` | 图纸、IFC、节点、结构计算、构件 BOM、校验 |
| `quantity_costing` | `/app/modules/quantity_costing` | BOQ、价格库、成本、报价、变更影响 |
| `material_logistics` | `/app/modules/material_logistics` | 供应商、采购、运输、到货、堆场 |
| `production_manufacturing` | `/app/modules/production_manufacturing` | 工单、CNC、焊接、质检、包装、发运 |
| `construction_management` | `/app/modules/construction_management` | 进度、班组、日志、安全、质量、验收、整改 |
| `digital_twin` | `/app/modules/digital_twin` | 模型层、点云、IoT、告警、维保 |
| `digital_archive` | `/app/modules/digital_archive` | 项目档案、归档包、审计链、保存期限 |
| `finance_management` | `/app/modules/finance_management` | 预算、合同、付款、发票、凭证、对账 |
| `human_resources` | `/app/modules/human_resources` | 组织、人员、班组、资质、考勤、绩效 |
| `ai_center` | `/app/modules/ai_center` | 模型路由、RAG、Agent、MCP、成本、审计 |
| `settings_center` | `/app/modules/settings_center` | 租户、账号、角色、权限、审批、数据源 |

### 1.4 全局工作台组件

| 组件 | 作用 |
|---|---|
| `ModuleWorkbenchShell` | 统一模块壳、导航、主区、右侧抽屉 |
| `ModuleFileExplorer` | CDE 文件树、目录、上传、重命名、移动、权限 |
| `FilePreviewDrawer` | 文件预览、完整查看、属性和版本 |
| `LifecycleTransactionPanel` | 事务状态机 |
| `ApprovalWorkflowPanel` | 审批人、审批意见、通过/退回 |
| `AgentGateTimeline` | Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver |
| `ArtifactBoard` | 交付物、状态、操作 |
| `ModuleRelationshipMap` | 上下游数据关系 |
| `FloatingAIAssistant` | 受控 AI 助手入口 |

### 1.5 每个模块的落地蓝图

本节把 16 个模块拆到可开发粒度。每个模块都必须落在同一套 Open CDE 工作台、同一套文件版本、同一套事务状态机、同一套审批、同一套审计和同一套 AI 门禁链上。模块之间不是页面跳转关系,而是对象、文件、事件和审批状态的传递关系。

#### 1.5.1 `personal_center` 个人中心

| 项 | 设计 |
|---|---|
| 核心职责 | 汇总个人待办、审批、最近文件、风险提醒、通知、安全会话和个人偏好。它不拥有业务真源,只聚合来自其它模块的工作项。 |
| 核心对象 | `personal_work_items`, `approval_inbox_items`, `user_recent_objects`, `notification_deliveries`, `user_preferences`, `security_sessions` |
| 主页面 | `/app/modules/personal_center` |
| 子页面 | 我的待办、我的审批、最近项目、最近文件、通知中心、账号安全、个人偏好 |
| 输入 | 全模块 `module_transactions`, `approval_tasks`, `audit_events`, `notifications`, `module_files` |
| 输出 | 已处理待办、审批意见、个人偏好、通知已读状态、安全会话审计 |
| 关键表 | `user_profiles`, `user_preferences`, `personal_work_items`, `user_recent_objects`, `approval_inbox_items`, `notification_deliveries`, `security_sessions` |
| 关键工作流 | 工作项生成 -> 用户查看 -> 打开来源模块 -> 处理/评论/转派 -> 回写来源事务 -> 写个人审计 |
| Agent | `PersonalBriefingAgent`, `ApprovalTriageAgent`, `RiskReminderAgent`, `DailyDigestAgent` |
| API | `GET /v1/personal/inbox`, `GET /v1/personal/approvals`, `GET /v1/personal/recent`, `PATCH /v1/personal/preferences`, `POST /v1/personal/security-sessions/revoke` |
| 事件 | `personal.work_item.created`, `personal.notification.read`, `personal.approval.opened`, `personal.session.revoked` |
| 验收 | 任一待办必须能跳回来源模块、来源对象、来源文件、来源审批和来源审计；个人中心不得复制业务数据形成第二真源。 |

#### 1.5.2 `marketing_service` 市场客服

| 项 | 设计 |
|---|---|
| 核心职责 | 把客户、线索、会议、图片、草图、需求、约束和报价意向结构化,形成项目机会和可交给计划/方案模块的需求包。 |
| 核心对象 | `leads`, `customers`, `contacts`, `requirement_documents`, `meeting_records`, `site_photos`, `quote_drafts`, `contract_intents` |
| 主页面 | `/app/modules/marketing_service` |
| 子页面 | 线索池、客户档案、联系人、需求采集、会议纪要、附件证据、报价草案、合同意向 |
| 输入 | 微信/电话/邮件/表单/图片/草图/会议录音/历史项目/标准问卷 |
| 输出 | `customer_requirement.v1`, `quote_draft.v1`, `project_opportunity.v1`, `customer_confirmation.v1` |
| 关键表 | `leads`, `customers`, `contacts`, `requirement_sources`, `requirement_items`, `meeting_records`, `quote_drafts`, `contract_intents` |
| 关键工作流 | 线索录入 -> 客户确认 -> 需求抽取 -> 需求分解 -> 风险提示 -> 报价草案 -> 项目机会审批 -> 移交计划/方案 |
| Agent | `RequirementCaptureAgent`, `MeetingSummaryAgent`, `QuestionnaireAgent`, `QuoteDraftAgent`, `ContractRiskAgent` |
| API | `POST /v1/marketing/leads`, `POST /v1/marketing/requirements/extract`, `POST /v1/marketing/quote-drafts`, `POST /v1/marketing/opportunities/{id}/handoff` |
| 事件 | `marketing.lead.created`, `marketing.requirement.extracted`, `marketing.quote.generated`, `marketing.opportunity.handoff_requested`, `marketing.opportunity.approved` |
| 验收 | 每条需求必须保留来源证据,包括客户原话、文件、图片、会议时间、采集人和确认状态；没有客户确认的需求只能是草稿。 |

#### 1.5.3 `planning_management` 计划管理

| 项 | 设计 |
|---|---|
| 核心职责 | 把项目机会变成可执行项目: WBS、里程碑、责任矩阵、资源、风险、变更、基线和跨模块交付节奏。 |
| 核心对象 | `projects`, `project_plans`, `wbs_items`, `milestones`, `resource_allocations`, `risk_registers`, `change_requests`, `plan_baselines` |
| 主页面 | `/app/modules/planning_management` |
| 子页面 | 项目总览、WBS、甘特图、资源计划、风险台账、变更、里程碑、审批计划 |
| 输入 | `project_opportunity.v1`, `customer_requirement.v1`, 历史项目模板、合同约束、人员/班组资源 |
| 输出 | `project_plan.v1`, `wbs.v1`, `responsibility_matrix.v1`, `risk_register.v1`, `change_request.v1` |
| 关键表 | `projects`, `project_plans`, `wbs_items`, `milestones`, `dependencies`, `resource_allocations`, `risks`, `change_requests`, `plan_baselines` |
| 关键工作流 | 项目创建 -> WBS 拆解 -> 资源排程 -> 风险识别 -> 计划评审 -> 发布基线 -> 下发各模块任务 -> 进度回收 -> 变更评估 |
| Agent | `WbsPlannerAgent`, `ScheduleRiskAgent`, `ResourceAllocatorAgent`, `ChangeImpactAgent`, `ProgressNarrativeAgent` |
| API | `POST /v1/planning/projects`, `POST /v1/planning/projects/{id}/wbs/generate`, `POST /v1/planning/baselines`, `POST /v1/planning/change-requests` |
| 事件 | `planning.project.created`, `planning.wbs.generated`, `planning.baseline.issued`, `planning.change.submitted`, `planning.risk.escalated` |
| 验收 | 已发布基线必须能驱动方案、深化、采购、生产、施工任务；变更必须显示对工期、成本、BOM、采购和施工的影响。 |

#### 1.5.4 `concept_design` 方案设计

| 项 | 设计 |
|---|---|
| 核心职责 | 基于客户需求和计划约束生成多个候选方案,完成方案对比、初算、可视化展示和客户确认。 |
| 核心对象 | `concept_briefs`, `concept_variants`, `floorplan_candidates`, `mass_models`, `style_profiles`, `concept_evaluations`, `client_confirmations` |
| 主页面 | `/app/modules/concept_design` |
| 子页面 | 设计任务书、方案生成、平面/体量、风格库、方案对比、初算、客户确认 |
| 输入 | `customer_requirement.v1`, `project_plan.v1`, 标准族库、历史方案、场地条件、预算边界 |
| 输出 | `concept_variant.v1`, `concept_evaluation_report.v1`, `concept_acceptance.v1`, `concept_package.v1` |
| 关键表 | `concept_briefs`, `concept_variants`, `floorplan_candidates`, `mass_models`, `concept_scores`, `client_confirmation_records`, `presentation_packages` |
| 关键工作流 | 需求读取 -> 生成候选 -> 规则评估 -> 初算 -> 内部评审 -> 客户展示 -> 客户确认 -> 移交深化 |
| Agent | `ConceptGeneratorAgent`, `FloorplanFitAgent`, `ConceptEvaluatorAgent`, `PresentationPackAgent`, `ClientChangeCaptureAgent` |
| API | `POST /v1/concept/briefs`, `POST /v1/concept/variants/generate`, `POST /v1/concept/variants/{id}/evaluate`, `POST /v1/concept/confirmations` |
| 事件 | `concept.variant.generated`, `concept.variant.evaluated`, `concept.package.issued`, `concept.client.confirmed`, `concept.handoff.detailed_design` |
| 验收 | 候选方案必须引用需求条目、约束、评估规则和版本；客户确认后才能进入深化设计。 |

#### 1.5.5 `standard_library` 标准族库

| 项 | 设计 |
|---|---|
| 核心职责 | 管理标准、语义字典、SJG157、构件命名、材料等级、型钢/紧固件规格、节点做法和规则库,为全模块提供受控引用。 |
| 核心对象 | `standards`, `standard_clauses`, `sjg157_categories`, `component_naming_rules`, `material_grades`, `section_profiles`, `connection_details`, `rule_sets` |
| 主页面 | `/app/modules/standard_library` |
| 子页面 | 标准条文、SJG157、构件命名、材料库、型钢库、节点库、规则库、版本发布 |
| 输入 | 标准文件、企业标准、Excel 编码表、构件命名规则、材料/型钢规格表、历史项目沉淀 |
| 输出 | `standard_clause.v1`, `sjg157_category.v1`, `component_template.v1`, `naming_rule.v1`, `rule_set.v1` |
| 关键表 | `standards`, `standard_versions`, `standard_clauses`, `terminology_entries`, `sjg157_categories`, `component_templates`, `material_grades`, `section_profiles`, `rule_sets`, `rule_bindings` |
| 关键工作流 | 来源导入 -> 条目结构化 -> 去重/版本化 -> 专业复核 -> 发布规则集 -> 被设计/BOM/造价/施工引用 |
| Agent | `StandardIngestionAgent`, `ClauseIndexerAgent`, `RuleAuthoringAgent`, `ComponentLibraryAgent`, `TerminologyLinkAgent` |
| API | `POST /v1/standards/import`, `GET /v1/standards/clauses`, `POST /v1/standards/rule-sets`, `POST /v1/standards/rule-sets/{id}/publish` |
| 事件 | `standard.import.completed`, `standard.rule_set.published`, `standard.category.updated`, `standard.library.item.deprecated` |
| 验收 | 被下游引用的标准/规则必须有来源文件、版本、适用范围、状态和复核人；未发布规则不得阻断生产流程。 |

#### 1.5.6 `detailed_design` 深化设计

| 项 | 设计 |
|---|---|
| 核心职责 | 管理 DWG/DXF/IFC/STEP/SKP/3DM、Office 文档、PDF 等工程文件,生成深化图纸、结构计算、节点、碰撞报告和构件物料 BOM。 |
| 核心对象 | `design_packages`, `drawings`, `bim_models`, `structure_calculations`, `node_details`, `clash_reports`, `component_bom_documents`, `design_review_records` |
| 主页面 | `/app/modules/detailed_design` |
| 子页面 | 图纸、模型、结构计算、节点深化、构件物料 BOM、碰撞检查、审图意见、发布包 |
| 输入 | `concept_acceptance.v1`, `project_plan.v1`, 标准族库、客户确认、源工程文件、现场反馈 |
| 输出 | `drawing_package.v1`, `ifc_model.v1`, `component_bom.v1`, `design_check_report.v1`, `design_issue_package.v1` |
| 关键表 | `design_packages`, `drawings`, `drawing_versions`, `bim_models`, `model_elements`, `structure_calculations`, `node_details`, `clash_reports`, `component_bom.*`, `design_reviews` |
| 关键工作流 | 接收方案 -> 建立深化包 -> 上传/解析源文件 -> 生成派生模型 -> 结构/规范/碰撞校验 -> 生成构件物料 BOM -> 专业复核 -> 发布深化包 |
| Agent | `DrawingParseAgent`, `IfcIndexAgent`, `DesignRuleCheckAgent`, `ClashExplainAgent`, `ComponentBomImportAgent`, `DesignReviewAgent` |
| API | `POST /v1/detailed-design/packages`, `POST /v1/detailed-design/files/{id}/parse`, `POST /v1/detailed-design/checks/run`, `POST /v1/component-bom/documents/import` |
| 事件 | `design.file.uploaded`, `design.file.parsed`, `design.check.completed`, `component_bom.version.issued`, `design.package.issued` |
| 验收 | 所有下游只能消费发布态深化包和发布态 BOM；源文件、派生文件、校验报告和签审记录必须完整归档。 |

#### 1.5.7 `quantity_costing` 计量造价

| 项 | 设计 |
|---|---|
| 核心职责 | 从发布态图纸、模型和 BOM 中形成工程量、BOQ、成本测算、报价、变更影响和财务预算依据。 |
| 核心对象 | `boq_documents`, `boq_items`, `quantity_takeoffs`, `price_snapshots`, `cost_breakdowns`, `change_cost_impacts`, `quote_versions` |
| 主页面 | `/app/modules/quantity_costing` |
| 子页面 | 工程量、BOQ、价格库、成本测算、报价、变更影响、审核 |
| 输入 | `component_bom.v1`, `drawing_package.v1`, `ifc_model.v1`, 价格库、合同、采购报价 |
| 输出 | `boq.v1`, `cost_breakdown.v1`, `quote_version.v1`, `change_cost_impact.v1` |
| 关键表 | `boq_documents`, `boq_items`, `quantity_takeoff_runs`, `price_books`, `price_snapshots`, `cost_breakdowns`, `quote_versions`, `change_cost_impacts` |
| 关键工作流 | 读取发布态 BOM/图纸 -> 生成工程量 -> 匹配价格 -> 成本测算 -> 造价复核 -> 报价发布 -> 变更影响追踪 |
| Agent | `BoqExtractAgent`, `CostingAgent`, `PriceCompareAgent`, `ChangeCostImpactAgent`, `QuoteReviewAgent` |
| API | `POST /v1/costing/boq/from-bom`, `POST /v1/costing/price-match`, `POST /v1/costing/quotes`, `POST /v1/costing/change-impact` |
| 事件 | `costing.boq.generated`, `costing.price_snapshot.created`, `costing.quote.submitted`, `costing.quote.approved`, `costing.change_impact.completed` |
| 验收 | 每个造价行必须能追溯到 BOM 行、图纸/模型元素、价格来源和计算公式；报价发布必须走商务/财务审批。 |

#### 1.5.8 `material_logistics` 材料物流

| 项 | 设计 |
|---|---|
| 核心职责 | 把 BOQ/BOM 转成采购计划、供应商询价、采购单、批次、物流、到货、签收、库存和堆场记录。 |
| 核心对象 | `suppliers`, `supplier_quotes`, `purchase_plans`, `purchase_orders`, `shipment_batches`, `receiving_records`, `inventory_batches`, `yard_locations` |
| 主页面 | `/app/modules/material_logistics` |
| 子页面 | 供应商、采购计划、询比价、采购单、物流批次、到货签收、库存、堆场 |
| 输入 | `boq.v1`, `component_bom.v1`, `cost_breakdown.v1`, 供应商报价、生产计划、施工计划 |
| 输出 | `purchase_plan.v1`, `purchase_order.v1`, `shipment_batch.v1`, `receiving_record.v1`, `inventory_batch.v1` |
| 关键表 | `suppliers`, `supplier_contacts`, `supplier_quotes`, `purchase_plans`, `purchase_orders`, `purchase_order_lines`, `shipments`, `receiving_records`, `inventory_batches`, `yard_locations` |
| 关键工作流 | 需求汇总 -> 供应商询价 -> 比价 -> 采购审批 -> 下单 -> 发货跟踪 -> 到货质检 -> 入库/堆场 -> 生产/施工领用 |
| Agent | `ProcurementPlanAgent`, `SupplierCompareAgent`, `PurchaseOrderDraftAgent`, `ShipmentPlanAgent`, `ReceivingCheckAgent` |
| API | `POST /v1/logistics/purchase-plans/from-boq`, `POST /v1/logistics/supplier-quotes`, `POST /v1/logistics/purchase-orders`, `POST /v1/logistics/receipts` |
| 事件 | `logistics.purchase_plan.generated`, `logistics.po.approved`, `logistics.shipment.dispatched`, `logistics.receipt.accepted`, `logistics.inventory.updated` |
| 验收 | 采购数量必须能追溯到 BOM/BOQ；到货签收必须有批次、照片、质检、签收人和时间。 |

#### 1.5.9 `production_manufacturing` 生产制造

| 项 | 设计 |
|---|---|
| 核心职责 | 把发布态 BOM、图纸、采购批次和计划基线转成工单、下料、CNC、焊接、涂装、防腐、防火、质检、包装和发运。 |
| 核心对象 | `work_orders`, `production_batches`, `cutting_lists`, `cnc_files`, `welding_records`, `coating_records`, `qc_records`, `packaging_records`, `dispatch_batches` |
| 主页面 | `/app/modules/production_manufacturing` |
| 子页面 | 工单、批次、下料、CNC、焊接、涂装/防腐/防火、质检、包装、发运 |
| 输入 | `component_bom.v1`, `drawing_package.v1`, `purchase_order.v1`, `inventory_batch.v1`, `project_plan.v1` |
| 输出 | `work_order.v1`, `cutting_list.v1`, `cnc_file.v1`, `qc_record.v1`, `dispatch_batch.v1` |
| 关键表 | `work_orders`, `work_order_lines`, `production_batches`, `cutting_lists`, `cnc_files`, `process_steps`, `welding_records`, `coating_records`, `qc_records`, `packaging_records`, `dispatch_batches` |
| 关键工作流 | 接收发布态 BOM -> 生成生产批次 -> 生成工单 -> 下料/CNC -> 工序流转 -> 质检 -> 包装 -> 发运 -> 回写施工/档案 |
| Agent | `WorkOrderAgent`, `CuttingListAgent`, `CncFileAgent`, `QcAgent`, `DispatchPlanAgent` |
| API | `POST /v1/production/work-orders/from-bom`, `POST /v1/production/cutting-lists`, `POST /v1/production/qc-records`, `POST /v1/production/dispatch-batches` |
| 事件 | `production.work_order.created`, `production.cnc.generated`, `production.qc.passed`, `production.dispatch.ready`, `production.dispatch.sent` |
| 验收 | 每个构件必须能从生产记录追溯到 BOM 行、图号、材料批次、工序、质检和发运批次。 |

#### 1.5.10 `construction_management` 施工管理

| 项 | 设计 |
|---|---|
| 核心职责 | 管理现场进度、班组、施工日志、安全、质量、材料进场、构件安装、验收、整改和竣工资料。 |
| 核心对象 | `site_schedules`, `crew_assignments`, `daily_logs`, `safety_inspections`, `quality_inspections`, `installation_records`, `acceptance_reports`, `rectification_items` |
| 主页面 | `/app/modules/construction_management` |
| 子页面 | 进度、班组、日志、安全、质量、材料进场、安装清单、验收、整改、竣工资料 |
| 输入 | `dispatch_batch.v1`, `shipment_batch.v1`, `project_plan.v1`, `drawing_package.v1`, `component_bom.v1`, 班组/资质 |
| 输出 | `site_daily_log.v1`, `installation_record.v1`, `inspection_record.v1`, `acceptance_record.v1`, `rectification_record.v1` |
| 关键表 | `site_schedules`, `crew_assignments`, `daily_logs`, `safety_inspections`, `quality_inspections`, `installation_records`, `acceptance_reports`, `rectification_items`, `site_photos` |
| 关键工作流 | 接收发运/到货 -> 班组排程 -> 现场安装 -> 拍照/扫码留痕 -> 安全质量检查 -> 验收 -> 整改闭环 -> 归档 |
| Agent | `SiteScheduleAgent`, `DailyLogAgent`, `SafetyCheckAgent`, `InspectionAgent`, `RectificationAgent` |
| API | `POST /v1/construction/daily-logs`, `POST /v1/construction/installations`, `POST /v1/construction/inspections`, `POST /v1/construction/acceptance-reports` |
| 事件 | `construction.daily_log.created`, `construction.installation.recorded`, `construction.inspection.failed`, `construction.rectification.closed`, `construction.acceptance.approved` |
| 验收 | 验收记录必须关联构件、图纸、批次、照片、检查项、责任人和签字；未闭环整改不得进入竣工归档。 |

#### 1.5.11 `digital_twin` 数字孪生

| 项 | 设计 |
|---|---|
| 核心职责 | 在统一模块工作台中管理竣工模型、构件映射、点云/3DGS、IoT、进度回放、告警和维保,不得做成孤立大屏。 |
| 核心对象 | `twin_models`, `twin_elements`, `model_layers`, `point_clouds`, `gaussian_splats`, `iot_devices`, `iot_events`, `alerts`, `maintenance_plans` |
| 主页面 | `/app/modules/digital_twin` |
| 子页面 | 模型层、构件树、点云/3DGS、进度回放、IoT、告警、维保、孪生快照 |
| 输入 | `ifc_model.v1`, `as_built_archive.v1`, `installation_record.v1`, `iot_event.v1`, 设备台账 |
| 输出 | `twin_model.v1`, `twin_snapshot.v1`, `alert.v1`, `maintenance_plan.v1` |
| 关键表 | `twin_models`, `twin_model_versions`, `twin_elements`, `twin_element_links`, `model_layers`, `point_cloud_assets`, `gaussian_splat_assets`, `iot_devices`, `iot_events`, `alerts`, `maintenance_plans` |
| 关键工作流 | 接收竣工模型 -> 生成元素索引 -> 绑定构件/BOM/施工验收 -> 接入 IoT -> 告警/维保 -> 生成孪生快照 -> 归档 |
| Agent | `TwinSyncAgent`, `ElementLinkAgent`, `IotAnomalyAgent`, `MaintenancePlanAgent`, `TwinSnapshotAgent` |
| API | `POST /v1/twin/models/import`, `GET /v1/twin/models/{id}/elements`, `POST /v1/twin/iot/events`, `POST /v1/twin/alerts/{id}/ack` |
| 事件 | `twin.model.imported`, `twin.element.linked`, `twin.iot_event.received`, `twin.alert.created`, `twin.snapshot.created` |
| 验收 | 任一孪生构件必须能追溯到 IFC/模型元素、BOM 行、生产批次、安装记录和验收记录。 |

#### 1.5.12 `digital_archive` 数字档案

| 项 | 设计 |
|---|---|
| 核心职责 | 生成项目、合同、图纸、BOM、BOQ、生产、施工、验收、财务、审计的长期档案包和证据链。 |
| 核心对象 | `archive_packages`, `archive_items`, `retention_policies`, `evidence_chains`, `archive_exports`, `integrity_checks` |
| 主页面 | `/app/modules/digital_archive` |
| 子页面 | 项目档案、归档包、证据链、完整性校验、保存期限、导出 |
| 输入 | 全模块发布态交付物、审批记录、审计事件、源文件、派生文件 |
| 输出 | `archive_package.v1`, `evidence_chain.v1`, `integrity_report.v1`, `handover_archive.v1` |
| 关键表 | `archive_packages`, `archive_items`, `archive_item_links`, `retention_policies`, `evidence_chain_nodes`, `integrity_checks`, `archive_exports` |
| 关键工作流 | 选择项目/阶段 -> 收集发布态交付物 -> 完整性校验 -> 证据链生成 -> 档案审批 -> 导出/封存 |
| Agent | `ArchivePackAgent`, `EvidenceChainAgent`, `IntegrityCheckAgent`, `RetentionPolicyAgent` |
| API | `POST /v1/archive/packages`, `POST /v1/archive/packages/{id}/collect`, `POST /v1/archive/packages/{id}/integrity-check`, `POST /v1/archive/packages/{id}/export` |
| 事件 | `archive.package.created`, `archive.item.collected`, `archive.integrity.checked`, `archive.package.sealed`, `archive.export.completed` |
| 验收 | 归档包必须包含源文件、发布文件、审批、审计、校验报告和 checksum；缺项必须列出责任模块。 |

#### 1.5.13 `finance_management` 财务管理

| 项 | 设计 |
|---|---|
| 核心职责 | 管理预算、合同、付款、发票、凭证、对账、结算和财务审计证据,与造价、采购、生产、施工、人力打通。 |
| 核心对象 | `budgets`, `contracts`, `payment_requests`, `invoices`, `voucher_templates`, `vouchers`, `reconciliation_runs`, `settlement_documents` |
| 主页面 | `/app/modules/finance_management` |
| 子页面 | 预算、合同、付款、发票、凭证、对账、结算、财务审计 |
| 输入 | `quote_version.v1`, `purchase_order.v1`, `receiving_record.v1`, `timesheet.v1`, `acceptance_record.v1`, 发票/银行流水 |
| 输出 | `budget.v1`, `payment_record.v1`, `voucher.v1`, `reconciliation_report.v1`, `settlement_document.v1` |
| 关键表 | `budgets`, `contracts`, `payment_requests`, `invoice_records`, `voucher_templates`, `vouchers`, `reconciliation_runs`, `settlement_documents`, `financial_audit_events` |
| 关键工作流 | 预算形成 -> 合同登记 -> 付款申请 -> 发票匹配 -> 凭证生成 -> 对账 -> 结算 -> 财务归档 |
| Agent | `BudgetAgent`, `InvoiceMatchAgent`, `VoucherAgent`, `ReconciliationAgent`, `SettlementReviewAgent` |
| API | `POST /v1/finance/budgets`, `POST /v1/finance/payment-requests`, `POST /v1/finance/vouchers/generate`, `POST /v1/finance/reconciliation-runs` |
| 事件 | `finance.budget.approved`, `finance.payment.requested`, `finance.invoice.matched`, `finance.voucher.generated`, `finance.reconciliation.completed` |
| 验收 | 财务凭证必须追溯合同、采购/验收/工时/发票/付款来源；AI 只能生成草稿,过账必须人工审批。 |

#### 1.5.14 `human_resources` 人力资源

| 项 | 设计 |
|---|---|
| 核心职责 | 管理组织、岗位、人员、班组、资质、考勤、工时、培训、绩效和施工/生产资源供给。 |
| 核心对象 | `organizations`, `positions`, `employees`, `crews`, `qualifications`, `attendance_records`, `timesheets`, `training_records`, `performance_records` |
| 主页面 | `/app/modules/human_resources` |
| 子页面 | 组织、岗位、人员、班组、资质、考勤、工时、培训、绩效 |
| 输入 | 员工资料、资质证书、项目计划、生产/施工任务、考勤设备或移动端确认 |
| 输出 | `crew_assignment.v1`, `qualification_status.v1`, `timesheet.v1`, `training_record.v1`, `performance_record.v1` |
| 关键表 | `organizations`, `positions`, `employees`, `employee_qualifications`, `crews`, `crew_members`, `attendance_records`, `timesheets`, `training_records`, `performance_records` |
| 关键工作流 | 人员建档 -> 资质登记 -> 班组组建 -> 项目派工 -> 考勤/工时 -> 绩效/结算依据 -> 财务/计划回写 |
| Agent | `CrewAssignmentAgent`, `QualificationCheckAgent`, `TimesheetAgent`, `TrainingReminderAgent`, `PerformanceSummaryAgent` |
| API | `POST /v1/hr/employees`, `POST /v1/hr/crews`, `POST /v1/hr/timesheets`, `POST /v1/hr/qualifications/validate` |
| 事件 | `hr.employee.created`, `hr.qualification.expiring`, `hr.crew.assigned`, `hr.timesheet.submitted`, `hr.performance.generated` |
| 验收 | 派工必须检查资质、岗位和项目权限；工时必须能追溯到项目、任务、班组和审批。 |

#### 1.5.15 `ai_center` AI 中心

| 项 | 设计 |
|---|---|
| 核心职责 | 统一管理模型、推理路由、工具路由、RAG、Agent、知识源、成本、限流、安全策略和 AI 审计。业务模块不得直接调用外部模型。 |
| 核心对象 | `model_providers`, `model_routes`, `tool_registry`, `tool_policies`, `rag_sources`, `agent_profiles`, `agent_runs`, `ai_cost_events`, `eval_runs` |
| 主页面 | `/app/modules/ai_center` |
| 子页面 | 模型路由、工具路由、RAG、Agent、MCP、评测、成本、审计、安全策略 |
| 输入 | 模型配置、供应商密钥、知识源、工具清单、模块策略、审计规则 |
| 输出 | `model_route.v1`, `tool_policy.v1`, `agent_profile.v1`, `rag_index.v1`, `ai_cost_report.v1`, `eval_report.v1` |
| 关键表 | `model_providers`, `model_routes`, `tool_registry`, `tool_policies`, `rag_sources`, `rag_chunks`, `agent_profiles`, `agent_runs`, `agent_tool_calls`, `ai_cost_events`, `eval_runs` |
| 关键工作流 | 注册模型 -> 定义路由 -> 注册工具 -> 配置 Agent -> 绑定模块策略 -> 运行审计 -> 成本/质量评估 -> 策略调整 |
| Agent | `ModelRoutingAgent`, `ToolPolicyAgent`, `RagIndexAgent`, `EvalAgent`, `CostGuardAgent` |
| API | `POST /v1/ai/model-routes`, `POST /v1/ai/tool-policies`, `POST /v1/ai/agent-runs`, `GET /v1/ai/cost-events`, `POST /v1/ai/evals` |
| 事件 | `ai.model_route.updated`, `ai.tool_policy.published`, `ai.agent_run.completed`, `ai.cost.threshold_exceeded`, `ai.eval.completed` |
| 验收 | 每次 AI 调用必须记录模型、输入引用、工具调用、输出引用、成本、策略、审批状态和审计 ID。 |

#### 1.5.16 `settings_center` 设置中心

| 项 | 设计 |
|---|---|
| 核心职责 | 管理租户、组织、账号、角色、权限、审批矩阵、模块注册、数据字典、系统参数、连接器、密钥、运行时配置和数据库巡检。 |
| 核心对象 | `tenants`, `organizations`, `users`, `roles`, `permissions`, `approval_matrices`, `module_registry_entries`, `data_dictionaries`, `system_settings`, `connector_configs`, `secrets` |
| 主页面 | `/app/modules/settings_center` |
| 子页面 | 租户、组织、账号、角色、权限、审批矩阵、模块注册、数据字典、连接器、密钥、数据库运行态 |
| 输入 | 企业组织架构、账号申请、权限申请、审批制度、系统参数、数据库/存储/消息队列连接 |
| 输出 | `identity.v1`, `rbac_policy.v1`, `approval_matrix.v1`, `module_registry.v1`, `system_config.v1`, `runtime_health_report.v1` |
| 关键表 | `tenants`, `organizations`, `users`, `roles`, `permissions`, `role_bindings`, `approval_matrices`, `module_registry_entries`, `data_dictionaries`, `system_settings`, `connector_configs`, `secrets`, `runtime_health_checks` |
| 关键工作流 | 租户初始化 -> 账号开通 -> 角色绑定 -> 审批矩阵配置 -> 模块启用 -> 字典发布 -> 运行时巡检 -> 审计归档 |
| Agent | `PermissionReviewAgent`, `ApprovalMatrixAgent`, `ConfigDriftAgent`, `RuntimeHealthAgent`, `DataDictionaryAgent` |
| API | `POST /v1/settings/users`, `POST /v1/settings/role-bindings`, `POST /v1/settings/approval-matrices`, `POST /v1/settings/runtime-health-checks` |
| 事件 | `settings.user.created`, `settings.permission.changed`, `settings.approval_matrix.published`, `settings.runtime.health_checked`, `settings.config.changed` |
| 验收 | 权限变更、审批矩阵变更、密钥变更和模块启停必须写审计；任何业务模块不得绕过设置中心直接定义权限。 |

### 1.6 模块交付物发布规则

| 状态 | 含义 | 下游可见性 |
|---|---|---|
| `draft` | 人工或 AI 生成草稿 | 仅本模块编辑者可见 |
| `generated` | Agent 已生成交付物 | 不可作为下游依据 |
| `evaluated` | Evaluator 已做质量评估 | 可内部讨论,不可发布 |
| `rule_checked` | 规则引擎已校核 | 有阻断项则不可提交 |
| `schema_validated` | Schema 合同通过 | 可提交审批 |
| `reviewing` | 专业/业务复核中 | 下游只可预览 |
| `approved` | 审批通过 | 可进入发布动作 |
| `issued` | 已发布 | 下游模块可消费 |
| `archived` | 已归档 | 只读,可审计 |
| `blocked` | 阻断 | 必须退回来源模块处理 |

### 1.7 模块间主数据所有权

| 主数据 | Owner | Reader | 修改规则 |
|---|---|---|---|
| 客户、联系人 | `marketing_service` | 计划、财务、档案 | 修改需保留客户证据和历史版本 |
| 项目、WBS、里程碑 | `planning_management` | 全模块 | 基线发布后只能通过变更流程修改 |
| 标准、规则、构件字典 | `standard_library` | 全模块 | 发布版本只读,新版本并行 |
| 图纸、模型、BOM | `detailed_design` | 造价、采购、生产、施工、孪生、档案 | 下游只读 `issued` 版本 |
| BOQ、价格、成本 | `quantity_costing` | 采购、财务、计划 | 报价发布后变更必须有审批 |
| 采购、批次、库存 | `material_logistics` | 生产、施工、财务、档案 | 入库/签收后改动必须有冲销或更正记录 |
| 工单、质检、发运 | `production_manufacturing` | 施工、财务、档案 | 质检和发运记录不可物理删除 |
| 施工、验收、整改 | `construction_management` | 孪生、档案、财务 | 验收签字后只允许补充记录 |
| 孪生模型、设备事件 | `digital_twin` | 施工、档案 | 设备事件不可改写,只能追加 |
| 档案包 | `digital_archive` | 全模块 | 封存后只读 |
| 财务凭证和付款 | `finance_management` | 档案、管理层 | 过账后按财务制度更正 |
| 员工、班组、工时 | `human_resources` | 计划、施工、生产、财务 | 工时审批后只能更正 |
| 模型/工具/Agent 策略 | `ai_center` | 全模块 | 策略发布走审计和回滚 |
| 账号、角色、权限 | `settings_center` | 全模块 | 所有变更写审计 |

---

## 2. 全产品数据架构

### 2.1 数据域

| 数据域 | 核心表 / 存储 | 责任模块 |
|---|---|---|
| 身份权限域 | tenants, users, roles, permissions, role_bindings, approval_matrices | `settings_center` |
| CDE 文件域 | module_files, file_versions, object_store_objects, file_permissions | 全模块 |
| 项目域 | projects, project_plans, wbs_items, milestones, risks, changes | `planning_management` |
| 客户与合同域 | leads, contacts, requirements, quote_drafts, contracts | `marketing_service`, `finance_management` |
| 标准与规则域 | standards, clauses, terminology, rules, sjg157_categories, naming_rules | `standard_library` |
| 设计域 | concept_variants, drawings, bim_models, structure_calcs, clash_reports | `concept_design`, `detailed_design` |
| BOM 域 | bom_documents, bom_versions, bom_lines, validation_results, weight_results | `detailed_design` |
| 造价域 | boq_items, cost_breakdowns, price_snapshots, change_cost_impacts | `quantity_costing` |
| 采购物流域 | suppliers, purchase_orders, shipments, receiving_records, inventory_batches | `material_logistics` |
| 生产域 | work_orders, cnc_files, qc_records, production_batches, dispatch_batches | `production_manufacturing` |
| 施工域 | schedules, crews, daily_logs, inspections, acceptance_reports, rectifications | `construction_management` |
| 孪生域 | twin_models, iot_streams, alerts, maintenance_plans | `digital_twin` |
| 档案域 | archives, archive_items, retention_policies, archive_packages | `digital_archive` |
| 财务域 | budgets, invoices, payments, voucher_templates, vouchers, reconciliation_runs | `finance_management` |
| 人力域 | employees, qualifications, attendance_records, timesheets, training_records | `human_resources` |
| AI 域 | model_routes, tool_policies, rag_sources, agent_runs, ai_cost_events | `ai_center` |
| 审计域 | audit_events, module_transactions, approval_tasks, event_outbox | 全模块 |

### 2.2 数据能力与物理存储

| 能力 | 默认实现 | 扩展实现 | 使用场景 |
|---|---|---|---|
| TransactionStore | PostgreSQL | Supabase Postgres | 业务事务、版本、审批 |
| ObjectStore | S3 兼容对象存储 / SeaweedFS | MinIO 隔离替代、云对象存储 | IFC、DWG、Office 文档、PDF、图片、视频、归档包 |
| VectorStore | PostgreSQL pgvector | Qdrant | 标准检索、图纸片段、RAG |
| EventStore | PostgreSQL outbox | NATS JetStream | 工作流事件、异步任务 |
| CacheStore | Valkey | Redis-compatible adapter | 会话、锁、队列状态 |
| TimeSeriesStore | PostgreSQL 分区表 | ClickHouse | IoT、进度、设备状态 |
| GraphStore | PostgreSQL adjacency | Neo4j/AGE 等隔离适配 | 构件关系、供应链、工作流依赖 |
| AnalyticsStore | PostgreSQL materialized view | ClickHouse | BI、进度、成本、效率 |

### 2.3 全局核心表

```sql
CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    zh_name TEXT NOT NULL,
    en_name TEXT NOT NULL,
    order_num INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE module_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_id TEXT NOT NULL REFERENCES modules(id),
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    state TEXT NOT NULL,
    previous_state TEXT,
    action TEXT NOT NULL,
    actor_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approval_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_id TEXT NOT NULL REFERENCES modules(id),
    transaction_id UUID REFERENCES module_transactions(id),
    object_type TEXT NOT NULL,
    object_id UUID NOT NULL,
    approver_id UUID,
    role_key TEXT NOT NULL,
    state TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module_id TEXT NOT NULL REFERENCES modules(id),
    actor_id UUID,
    event_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    before JSONB,
    after JSONB,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.4 文件真源表

```sql
CREATE TABLE module_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID,
    module_id TEXT NOT NULL REFERENCES modules(id),
    parent_id UUID REFERENCES module_files(id),
    name TEXT NOT NULL,
    file_kind TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    object_key TEXT NOT NULL DEFAULT '',
    sha256 TEXT NOT NULL DEFAULT '',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    current_version INTEGER NOT NULL DEFAULT 1,
    owner_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    file_id UUID NOT NULL REFERENCES module_files(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    object_key TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(file_id, version_no)
);
```

---

## 3. 全产品智能体架构

### 3.1 Agent 分层

| 层级 | Agent 类型 | 职责 |
|---|---|---|
| L1 个体智能体 | 单任务 Agent | 抽取字段、解析文件、生成草稿、匹配类目、计算重量 |
| L2 流程智能体 | 工作流 Agent | 串联导入、校验、审批、导出、下游同步 |
| L3 企业智能体 | 经营协同 Agent | 计划、成本、采购、生产、施工、财务、人力跨模块协同 |

### 3.2 全局 Agent 门禁

```text
User / Event
  -> Planner
  -> ToolRouter
  -> Generator
  -> Evaluator
  -> RuleChecker
  -> SchemaValidator
  -> Approver
  -> Artifact / Transaction / Audit
```

### 3.3 模块 Agent 清单

| 模块 | Agent | 输入 | 输出 |
|---|---|---|---|
| `marketing_service` | `RequirementCaptureAgent` | 聊天、会议、图片、文档 | 需求结构化 JSON |
| `marketing_service` | `QuoteDraftAgent` | 需求、历史价格、方案模板 | 报价草案 |
| `planning_management` | `WbsPlannerAgent` | 需求、合同、资源 | WBS、里程碑 |
| `planning_management` | `RiskChangeAgent` | 计划、变更、现场反馈 | 风险和变更建议 |
| `concept_design` | `ConceptGeneratorAgent` | 需求、风格、面积、约束 | 多方案草稿 |
| `concept_design` | `ConceptEvaluatorAgent` | 方案、规则、客户偏好 | 方案评分 |
| `standard_library` | `StandardIngestionAgent` | 标准文件、规范、企业制度 | 条文索引 |
| `standard_library` | `ComponentLibraryAgent` | SJG157、命名规则、构件库 | 构件模板 |
| `detailed_design` | `DrawingParseAgent` | DWG/DXF/PDF/IFC | 图纸对象索引 |
| `detailed_design` | `ComponentBomImportAgent` | XLSX、图纸、IFC | BOM 行项 |
| `detailed_design` | `DesignRuleCheckAgent` | 图纸、BOM、标准 | 校验报告 |
| `quantity_costing` | `BoqExtractAgent` | IFC、BOM、图纸 | 工程量清单 |
| `quantity_costing` | `CostingAgent` | BOQ、价格库、定额 | 成本测算 |
| `material_logistics` | `ProcurementPlanAgent` | BOM、BOQ、库存、供应商 | 采购计划 |
| `material_logistics` | `ShipmentPlanAgent` | 批次、场地、运输约束 | 物流计划 |
| `production_manufacturing` | `WorkOrderAgent` | issued BOM、图纸、工艺 | 工单 |
| `production_manufacturing` | `QcAgent` | 工单、质检规则、照片 | 质检记录 |
| `construction_management` | `SiteScheduleAgent` | 计划、批次、班组 | 施工排程 |
| `construction_management` | `InspectionAgent` | 现场照片、BOM、规范 | 验收/整改 |
| `digital_twin` | `TwinSyncAgent` | IFC、IoT、施工状态 | 孪生更新 |
| `digital_archive` | `ArchivePackAgent` | 发布交付物、审计 | 归档包 |
| `finance_management` | `VoucherAgent` | 合同、付款、发票、业务单据 | 凭证草稿 |
| `finance_management` | `ReconciliationAgent` | 业务单据、银行/票据 | 对账差异 |
| `human_resources` | `CrewAssignmentAgent` | 计划、资质、班组 | 班组安排 |
| `human_resources` | `TimesheetAgent` | 日志、考勤、工单 | 工时 |
| `ai_center` | `ModelRoutingAgent` | 任务、成本、SLA、权限 | 模型路由策略 |
| `settings_center` | `PermissionReviewAgent` | 用户、岗位、审批矩阵 | 权限建议 |

### 3.4 Agent 输出合同

```json
{
  "agent_run_id": "uuid",
  "module_id": "detailed_design",
  "agent_key": "ComponentBomImportAgent",
  "input_refs": ["file:...", "bom_version:..."],
  "tool_calls": [
    {"tool": "xlsx_read", "status": "succeeded", "artifact": "manifest.json"}
  ],
  "outputs": [
    {"type": "bom_version", "id": "..."},
    {"type": "validation_report", "id": "..."}
  ],
  "ai_state": "professional_review_required",
  "rule_check": "passed_with_warnings",
  "schema_validation": "passed",
  "approval_required": true,
  "audit_event_id": "uuid"
}
```

---

## 4. 全产品工作流架构

### 4.1 项目从线索到归档的状态机

```text
lead
  -> requirement_captured
  -> project_planned
  -> concept_selected
  -> detailed_design_draft
  -> detailed_design_reviewed
  -> bom_issued
  -> cost_approved
  -> procurement_started
  -> manufacturing_started
  -> shipment_started
  -> site_installation
  -> acceptance_review
  -> handover
  -> archived
```

### 4.2 每个模块统一状态

| 状态 | 含义 |
|---|---|
| `draft` | 草稿,可编辑 |
| `generated` | AI 或工具生成 |
| `evaluated` | 已评估 |
| `rule_checked` | 已规则校验 |
| `schema_validated` | 已 Schema 校验 |
| `reviewing` | 人工审核中 |
| `approved` | 已批准 |
| `issued` | 已发布给下游 |
| `archived` | 已归档 |
| `blocked` | 阻断,需修复 |

### 4.3 跨模块工作流

| 工作流 | 起点 | 终点 | 关键门禁 |
|---|---|---|---|
| 客户需求到项目计划 | `marketing_service` | `planning_management` | 需求确认、合同/报价状态 |
| 方案到深化 | `concept_design` | `detailed_design` | 客户确认、方案版本锁定 |
| 深化到 BOM | `detailed_design` | `component_bom` | 图纸/IFC/构件规则校验 |
| BOM 到造价 | `component_bom` | `quantity_costing` | BOM `issued` |
| BOM 到采购 | `component_bom` | `material_logistics` | BOM `issued`,采购预算通过 |
| BOM 到生产 | `component_bom` | `production_manufacturing` | BOM `issued`,图纸/工艺齐套 |
| 生产到施工 | `production_manufacturing` | `construction_management` | 质检通过、发运批次 |
| 施工到孪生 | `construction_management` | `digital_twin` | 安装确认、验收记录 |
| 全过程到档案 | 全模块 | `digital_archive` | 文件、审批、审计完整 |
| 业务到财务 | 计划/造价/采购/生产/施工 | `finance_management` | 合同、发票、付款、验收证据 |
| 业务到人力 | 计划/生产/施工 | `human_resources` | 班组、资质、工时证据 |

### 4.4 审批矩阵

| 交付物 | 编制 | 复核 | 批准 | 下游 |
|---|---|---|---|---|
| 客户需求摘要 | 市场客服 | 项目负责人 | 经营负责人 | 计划/方案 |
| 项目计划 | 项目经理 | 生产/施工/财务负责人 | 总负责人 | 全模块 |
| 方案 | 方案设计师 | 建筑负责人 | 客户/项目负责人 | 深化/造价 |
| 标准库条目 | 标准管理员 | 专业负责人 | 技术负责人 | 全模块 |
| 深化图纸 | 深化设计师 | 结构/建筑负责人 | 技术负责人 | BOM/生产/施工 |
| 构件物料 BOM | 深化设计师 | 结构/生产/造价负责人 | 技术负责人 | 造价/采购/生产/施工 |
| BOQ/造价 | 造价工程师 | 项目/财务负责人 | 经营负责人 | 采购/财务 |
| 采购单 | 采购负责人 | 财务/项目负责人 | 授权审批人 | 物流/财务 |
| 工单/CNC | 生产负责人 | 质检/工艺负责人 | 工厂负责人 | 质检/发运 |
| 施工验收 | 施工负责人 | 监理/质量负责人 | 项目负责人 | 孪生/档案/财务 |
| 凭证/付款 | 财务 | 财务负责人 | 授权审批人 | 档案 |
| 归档包 | 档案管理员 | 项目负责人 | 档案负责人 | 长期存档 |

### 4.5 端到端业务环节拆解

| 环节 | Owner 模块 | 输入 | 核心动作 | 输出 | 数据库写入 | Agent 门禁 | 事件 | 验收 |
|---:|---|---|---|---|---|---|---|---|
| 1 | `marketing_service` | 客户线索、微信/电话/邮件/图片/会议 | 建立客户、联系人和线索 | `lead.v1` | `leads`, `customers`, `contacts` | 可用,不替代人工确认 | `marketing.lead.created` | 线索来源、采集人、时间完整 |
| 2 | `marketing_service` | 客户原话、会议、附件 | 抽取需求条目和约束 | `customer_requirement.v1` | `requirement_sources`, `requirement_items` | Planner -> Generator -> Evaluator -> SchemaValidator | `marketing.requirement.extracted` | 每条需求能追溯来源 |
| 3 | `marketing_service` | 需求、历史报价、价格粗算 | 生成报价草案和风险提示 | `quote_draft.v1` | `quote_drafts`, `quote_risk_items` | RuleChecker 必须引用价格来源 | `marketing.quote.generated` | 草案不能直接变成正式合同 |
| 4 | `planning_management` | 项目机会、需求包、报价草案 | 创建项目和责任矩阵 | `project.v1` | `projects`, `project_members` | 仅做建议 | `planning.project.created` | 项目编号、负责人、范围明确 |
| 5 | `planning_management` | 项目、需求、合同约束 | 拆 WBS、里程碑、资源 | `project_plan.v1` | `wbs_items`, `milestones`, `resource_allocations` | WBSPlannerAgent + Evaluator | `planning.wbs.generated` | WBS 覆盖设计、采购、生产、施工和档案 |
| 6 | `planning_management` | WBS、资源、风险 | 发布项目计划基线 | `plan_baseline.v1` | `plan_baselines`, `module_transactions` | SchemaValidator + Approver | `planning.baseline.issued` | 发布后变更必须走变更单 |
| 7 | `concept_design` | 客户需求、计划基线、标准库 | 生成候选方案 | `concept_variant.v1` | `concept_variants`, `floorplan_candidates` | Generator -> Evaluator | `concept.variant.generated` | 候选方案引用需求条目 |
| 8 | `concept_design` | 候选方案、预算、规则 | 方案比较和初算 | `concept_evaluation_report.v1` | `concept_scores`, `concept_evaluations` | RuleChecker + Evaluator | `concept.variant.evaluated` | 比较项包含成本、可施工性和风险 |
| 9 | `concept_design` | 方案包、客户意见 | 客户确认 | `concept_acceptance.v1` | `client_confirmation_records` | 不允许 AI 代签 | `concept.client.confirmed` | 有客户确认记录才能进入深化 |
| 10 | `standard_library` | 标准文件、SJG157、命名规则 | 导入并发布规则集 | `rule_set.v1` | `standards`, `sjg157_categories`, `rule_sets` | StandardIngestionAgent + RuleAuthoringAgent | `standard.rule_set.published` | 规则有来源、版本、适用范围 |
| 11 | `detailed_design` | 确认方案、标准、源图纸/模型 | 建立深化包和 CDE 文件树 | `design_package.v1` | `design_packages`, `module_files`, `file_versions` | 文件不走大模型真源替代 | `design.package.created` | 源文件 checksum 和版本完整 |
| 12 | `detailed_design` | DWG/DXF/IFC/SKP/3DM/PDF | 解析源文件和生成索引 | `file_parse_manifest.v1` | `model_elements`, `drawing_versions`, `object_store_objects` | ToolRouter -> Parser worker | `design.file.parsed` | 解析失败必须有失败证据 |
| 13 | `detailed_design` | 图纸、模型、标准规则 | 深化校验、碰撞、结构复核记录 | `design_check_report.v1` | `clash_reports`, `design_reviews` | RuleChecker + Approver | `design.check.completed` | 阻断项未关闭不得发布 |
| 14 | `detailed_design` | Excel BOM、图纸、模型、SJG157 | 导入构件物料 BOM | `component_bom_draft.v1` | `component_bom.bom_documents`, `bom_versions`, `bom_lines` | XLSX worker + SchemaValidator | `component_bom.import.completed` | 行项追溯到源 Excel 单元格 |
| 15 | `detailed_design` | BOM 草稿、命名规则、规格库 | BOM 校验、重量计算、签审 | `component_bom.v1` | `line_validation_results`, `weight_calculation_results`, `bom_approval_records` | RuleChecker -> SchemaValidator -> Approver | `component_bom.version.issued` | 只有 `issued` 可被下游消费 |
| 16 | `quantity_costing` | 发布态 BOM、图纸、模型、价格库 | 生成工程量和 BOQ | `boq.v1` | `boq_documents`, `boq_items` | BoqExtractAgent + RuleChecker | `costing.boq.generated` | BOQ 行追溯 BOM 行和价格来源 |
| 17 | `quantity_costing` | BOQ、价格、合同、税费 | 成本测算和报价审批 | `quote_version.v1` | `cost_breakdowns`, `quote_versions` | CostingAgent + Approver | `costing.quote.approved` | 报价发布需商务/财务审批 |
| 18 | `material_logistics` | BOM/BOQ、预算、供应商 | 采购计划、询比价、采购单 | `purchase_order.v1` | `purchase_plans`, `supplier_quotes`, `purchase_orders` | SupplierCompareAgent + Approver | `logistics.po.approved` | 数量、价格、供应商证据完整 |
| 19 | `material_logistics` | 采购单、发货、到货 | 运输批次、签收、入库 | `receiving_record.v1` | `shipments`, `receiving_records`, `inventory_batches` | ReceivingCheckAgent | `logistics.receipt.accepted` | 到货照片、质检、签收人完整 |
| 20 | `production_manufacturing` | 发布态 BOM、图纸、库存、计划 | 生成工单、下料、CNC | `work_order.v1`, `cnc_file.v1` | `work_orders`, `cutting_lists`, `cnc_files` | WorkOrderAgent + CncFileAgent | `production.work_order.created` | 工单引用 BOM 行和图号 |
| 21 | `production_manufacturing` | 工单、材料批次、工序 | 工序执行和质检 | `qc_record.v1` | `process_steps`, `welding_records`, `qc_records` | QcAgent + RuleChecker | `production.qc.passed` | 质检不合格不得发运 |
| 22 | `production_manufacturing` | 质检合格构件 | 包装和发运 | `dispatch_batch.v1` | `packaging_records`, `dispatch_batches` | DispatchPlanAgent | `production.dispatch.sent` | 发运批次关联构件和目的地 |
| 23 | `construction_management` | 发运/到货、施工计划、班组 | 安装、日志、安全质量检查 | `installation_record.v1` | `daily_logs`, `installation_records`, `safety_inspections`, `quality_inspections` | SiteScheduleAgent + InspectionAgent | `construction.installation.recorded` | 照片、扫码、位置、责任人齐全 |
| 24 | `construction_management` | 安装记录、整改、验收标准 | 验收和整改闭环 | `acceptance_record.v1` | `acceptance_reports`, `rectification_items` | RuleChecker + Approver | `construction.acceptance.approved` | 未闭环整改不得归档 |
| 25 | `digital_twin` | IFC/竣工模型、BOM、安装验收、IoT | 建立孪生映射和运维对象 | `twin_model.v1` | `twin_models`, `twin_elements`, `iot_devices` | TwinSyncAgent + SchemaValidator | `twin.model.imported` | 构件能追溯设计/生产/安装 |
| 26 | `finance_management` | 合同、采购、验收、发票、工时 | 付款、凭证、对账、结算 | `voucher.v1`, `settlement_document.v1` | `payment_requests`, `invoices`, `vouchers`, `reconciliation_runs` | VoucherAgent + ReconciliationAgent | `finance.voucher.generated` | 过账必须人工审批 |
| 27 | `human_resources` | 项目计划、班组、资质、考勤 | 派工、工时、绩效 | `timesheet.v1` | `crew_assignments`, `attendance_records`, `timesheets` | QualificationCheckAgent + TimesheetAgent | `hr.timesheet.submitted` | 工时关联任务、班组、审批 |
| 28 | `digital_archive` | 全模块发布态交付物、审计、审批 | 生成归档包和证据链 | `archive_package.v1` | `archive_packages`, `archive_items`, `evidence_chain_nodes` | ArchivePackAgent + IntegrityCheckAgent | `archive.package.sealed` | 缺文件、缺审批、缺审计必须阻断 |
| 29 | `ai_center` | 模型、工具、知识源、策略 | 运行 AI 能力和记录成本 | `agent_run.v1`, `ai_cost_event.v1` | `agent_runs`, `agent_tool_calls`, `ai_cost_events` | 全链路强制 | `ai.agent_run.completed` | 每次调用可追溯 |
| 30 | `settings_center` | 用户、角色、审批制度、运行时 | 权限、审批矩阵、配置、巡检 | `rbac_policy.v1`, `runtime_health_report.v1` | `users`, `role_bindings`, `approval_matrices`, `runtime_health_checks` | PermissionReviewAgent + ConfigDriftAgent | `settings.permission.changed` | 权限和配置变更必须审计 |

### 4.6 跨模块对象主键与引用规则

| 对象 | 全局主键 | 版本键 | 引用方式 |
|---|---|---|---|
| 项目 | `project_id` | `plan_baseline_id` | 所有业务对象必须带 `tenant_id`, `project_id` |
| 文件 | `file_id` | `file_version_id` | 业务对象只引用文件版本,不引用浏览器临时文件 |
| 交付物 | `artifact_id` | `artifact_version_id` | 下游消费 `issued` 版本 |
| BOM | `bom_document_id` | `bom_version_id` | 造价/采购/生产/施工必须记录来源 `bom_line_id` |
| 图纸/模型 | `drawing_id` / `model_id` | `drawing_version_id` / `model_version_id` | 生产和施工引用发布态图纸版本 |
| 审批 | `approval_task_id` | `approval_step_id` | 任一发布动作必须绑定审批记录 |
| 审计 | `audit_event_id` | 不变 | 任一写操作必须生成审计事件 |
| Agent 调用 | `agent_run_id` | `agent_run_step_id` | AI 输出必须绑定输入/工具/输出引用 |

### 4.7 事件命名与幂等规则

| 规则 | 要求 |
|---|---|
| 命名 | `{module}.{object}.{verb}`,例如 `component_bom.version.issued` |
| 幂等键 | `tenant_id + source_object_id + source_version_id + action + payload_hash` |
| Outbox | 业务事务先写 PostgreSQL,同事务写 `event_outbox` |
| 消费 | Worker 消费事件后写 `event_consumptions`,重复事件不重复生成交付物 |
| 失败 | 失败必须写 `dead_letter_events`,保留 payload、错误、重试次数和责任模块 |
| 审计 | 每个事件必须关联 `audit_event_id` |
| 回放 | 归档、报表、孪生和搜索索引必须支持按事件重建派生状态 |

---

## 5. 技术栈总表

### 5.1 前端

| 类别 | 技术 | 用途 |
|---|---|---|
| 框架 | Next.js 16.2.6 | App Router、RSC、工作台 |
| UI | React 19.2.5 | 组件和状态 |
| 语言 | TypeScript 6.0.3 | 类型合同 |
| 包管理 | Bun | dev/test/build |
| 组件 | PanUI、Lucide、React Native target | 表格、表单、审批、AI 面板 |
| 代码编辑 | Monaco 0.55.1 | PanCode 文件编辑 |
| CAD/BIM 视口 | WebGPU、Three.js r184、WASM | 工程视图、模型预览 |
| 图表 | D3、React Flow、Mermaid、bpmn-js | 甘特、成本、流程、拓扑 |
| 测试 | Vitest、Playwright、ESLint、tsc | 单测、E2E、类型 |

### 5.2 后端

| 类别 | 技术 | 用途 |
|---|---|---|
| 核心语言 | Rust | Gateway、Harness Core、Router、事务、Schema |
| HTTP | axum | REST/SSE |
| gRPC | tonic | 服务间调用 |
| ORM | SeaORM / sqlx | 数据访问 |
| API 文档 | utoipa / OpenAPI 3.1 | SDK 和前后端合同 |
| Agent 编排 | Python + LangGraph | Planner/Generator/Evaluator |
| 工具语言 | Python、Go、Shell、C++、Perl | Worker、适配器、运维 |
| 几何/CAD | Rust/C++/WASM/OCCT/CGAL/IfcOpenShell | IFC、STEP、DWG、BIM |
| GPU | CUDA、OptiX、TensorRT、ROCm、oneAPI、Metal、Vulkan、Triton | 推理、渲染、几何、AI worker |

### 5.3 数据与中间件

| 类别 | 技术 | 用途 |
|---|---|---|
| 关系库 | PostgreSQL / Supabase Postgres | 业务真源 |
| 对象存储 | S3 兼容 / SeaweedFS | 大文件、归档包 |
| 缓存 | Valkey | 锁、会话、任务状态 |
| 向量 | pgvector / Qdrant adapter | RAG |
| 事件 | PostgreSQL outbox / NATS JetStream | 异步事件 |
| 分析 | PostgreSQL materialized view / ClickHouse adapter | BI |
| 时序 | PostgreSQL partition / ClickHouse adapter | IoT 和进度 |
| 图关系 | PostgreSQL adjacency / Graph adapter | 构件和依赖关系 |

### 5.4 AI / 推理

| 类别 | 技术 | 用途 |
|---|---|---|
| 推理引擎 | vLLM、SGLang、TensorRT-LLM、LMDeploy、Ollama、llama.cpp | 本地/私有模型运行 |
| 外部适配 | OpenAI-compatible、OpenRouter、HF Endpoint | 外部模型 behind Router |
| RAG | pgvector/Qdrant + 标准库 + CDE 文件索引 | 标准、图纸、项目知识 |
| 观测 | OpenTelemetry、Langfuse-style traces | Agent 和模型审计 |
| 安全 | ToolRouter、SchemaValidator、RuleChecker | 工具权限和输出门禁 |

### 5.5 文件与工程格式运行时

| 格式 | 主路线 | 产物 |
|---|---|---|
| Office 统一编辑（Excel/Word/PPT） | Collabora/OnlyOffice WOPI 负责在线编辑、协同、保存回写 | 原生编辑、版本化保存、CDE 文件权限和审计 |
| Excel 工作簿（XLSX/XLSM/XLS/CSV） | XLSX worker + LibreOffice headless 兼容转换；宏文件只解析结构不执行宏 | BOM、BOQ、报价表、采购清单、成本表、单元格追溯、公式审计 |
| Word 文档（DOCX/DOC/RTF） | DOCX 结构解析 + Mammoth/MarkItDown/Docling；DOC 旧格式先隔离转换 | 合同、会议纪要、技术规格书、审查意见、条款抽取、修订记录 |
| PowerPoint 演示（PPTX/PPT） | PPTX 结构解析 + LibreOffice/Docling 派生；PPT 旧格式先隔离转换 | 方案汇报、客户演示、图文页、备注、图片证据和需求摘要 |
| PDF / PDF/A | Stirling-PDF sidecar + PaddleOCR + Docling/版面解析 | PDF 工具、OCR、版面结构、签章页、归档版 PDF/A、证据包 |
| DWG/DXF | PanCAD / MLightCAD / LibreDWG boundary | 图元、图层、文字、算量 |
| IFC | IfcOpenShell / ThatOpen / Rust parser | 属性、几何、关系、BOM |
| STEP/IGES | OCCT/OCP/FreeCAD worker | B-Rep、网格派生 |
| SKP/3DM/RVT | 授权适配器 / IFC 导出 / sidecar | openBIM 派生 |
| 图片/视频 | GPU worker / OCR / 多模态模型 | 识别、证据、派生 |
| 代码/配置 | PanCode / Monaco / code-server sidecar | 源码编辑、保存回写 |

### 5.6 部署运行时

| 层 | 技术 |
|---|---|
| 本地开发 | Docker Compose、Bun、Rust、Python/uv |
| 生产编排 | Kubernetes、containerd、Cilium |
| GPU | NVIDIA Container Toolkit、GPU Operator、DCGM、NGC CUDA 镜像 |
| 包交付 | Docker images、Helm/Kustomize/GitOps |
| 配置 | 环境变量、Secret adapter、版本化 config |
| 观测 | OpenTelemetry、metrics、logs、traces、audit streams |
| 备份 | PostgreSQL backup、ObjectStore versioning、归档包 |

### 5.7 代码仓库落地目录

| 路径 | 责任 |
|---|---|
| `01-product/` | PRD、产品目标、用户画像、模块能力 |
| `02-architecture/` | 架构真源、宪法、模块注册、专业合规、工作台契约 |
| `03-frontend/` | Next.js/React/TypeScript 前端工作台 |
| `04-backend/` | Rust Gateway、Harness Core、Python Agent Orchestrator、数据库迁移 |
| `05-infra/` | Docker、Kubernetes、Helm/Kustomize、运行时配置 |
| `06-workers/` | CAD/BIM/Office 文档/PDF/AI/图像/视频/导出 Worker |
| `07-deployment/` | 部署 Runbook、私有化部署、备份恢复 |
| `08-sdk/` | OpenAPI 生成 SDK |
| `docs/` | 技术记录、集成方案、设计文档 |

### 5.8 后端服务拆分

| 服务 | 语言 | 运行形态 | 责任 |
|---|---|---|---|
| `architoken-gateway` | Rust | HTTP/gRPC 服务 | 鉴权、模块 API、文件 API、审批、审计 |
| `harness-core` | Rust | library/service | Router、Registry、Schema、事务、数据平面 |
| `agent-orchestrator` | Python | worker/service | LangGraph Agent、Planner/Generator/Evaluator |
| `file-worker` | Rust/Python | queue worker | 文件解析、转换、派生 |
| `component-bom-worker` | Python/Rust | queue worker | XLSX、SJG157、命名规则、BOM、重量 |
| `cad-bim-worker` | Rust/C++/Python | sidecar/worker | DWG/DXF/IFC/STEP/SKP/3DM/RVT 适配 |
| `office-worker` | Collabora/WOPI | sidecar | Office 原生编辑和保存回写 |
| `pdf-worker` | Stirling-PDF/PaddleOCR | sidecar/worker | PDF 操作、OCR、结构化抽取 |
| `ai-inference-router` | Rust/Python | service | 模型路由、推理运行、成本审计 |
| `database-manager` | Rust/Go | service/agent | 数据库连接、巡检、Schema、查询治理 |

### 5.9 前端包与页面拆分

| 包 / 文件 | 内容 |
|---|---|
| `03-frontend/lib/module-registry.ts` | 16 模块注册表、模块元数据、工作流、交付物 |
| `03-frontend/lib/module-backend-adapter.ts` | Gateway-first 后端适配器 |
| `03-frontend/lib/module-file-system.ts` | CDE 文件树和权限 |
| `03-frontend/lib/module-lifecycle.ts` | 生命周期事务和状态机 |
| `03-frontend/lib/module-operations.ts` | 每模块业务操作 |
| `03-frontend/lib/data-plane-api-client.ts` | 数据平面 API 客户端 |
| `03-frontend/lib/component-bom-api-client.ts` | BOM API 客户端 |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | 统一模块壳 |
| `03-frontend/components/ModuleDetailWorkbench.tsx` | 模块详情工作台 |
| `03-frontend/components/component-bom/` | BOM 工作台组件 |
| `03-frontend/app/app/modules/[moduleId]/page.tsx` | 动态模块路由 |

### 5.10 每模块数据库表清单

| 模块 | 主表 |
|---|---|
| `personal_center` | `user_profiles`, `personal_preferences`, `notification_settings`, `recent_work_items`, `personal_approval_tasks`, `security_sessions` |
| `marketing_service` | `leads`, `contacts`, `inquiries`, `customer_requirements`, `quote_drafts`, `contract_intents`, `meeting_records` |
| `planning_management` | `projects`, `project_plans`, `wbs_items`, `milestones`, `resource_plans`, `approval_plans`, `risk_registers`, `change_requests` |
| `concept_design` | `concepts`, `concept_variants`, `style_tags`, `floorplan_candidates`, `concept_evaluations`, `client_confirmations` |
| `standard_library` | `standards`, `standard_clauses`, `terminology_terms`, `rules`, `family_types`, `family_versions`, `material_catalog`, `component_templates` |
| `detailed_design` | `bim_models`, `drawings`, `structure_calcs`, `node_details`, `clash_reports`, `component_bom.*` |
| `quantity_costing` | `boq_items`, `cost_breakdowns`, `price_snapshots`, `quota_rules`, `change_cost_impacts`, `estimate_exports` |
| `material_logistics` | `suppliers`, `purchase_orders`, `purchase_order_lines`, `shipments`, `receiving_records`, `inventory_batches`, `site_storage_plans` |
| `production_manufacturing` | `work_orders`, `work_order_lines`, `cnc_files`, `qc_records`, `production_batches`, `dispatch_batches`, `paperclip_agent_runs` |
| `construction_management` | `schedules`, `crews`, `daily_logs`, `qa_inspections`, `safety_checks`, `acceptance_reports`, `rectification_items` |
| `digital_twin` | `twin_models`, `twin_layers`, `iot_streams`, `iot_points`, `alerts`, `maintenance_plans` |
| `digital_archive` | `archives`, `archive_items`, `archive_packages`, `retention_policies`, `archive_access_logs` |
| `finance_management` | `budgets`, `contracts`, `invoices`, `payments`, `voucher_templates`, `voucher_generation_runs`, `reconciliation_plans`, `reconciliation_runs` |
| `human_resources` | `employees`, `org_units`, `positions`, `qualification_certificates`, `attendance_records`, `timesheets`, `training_records`, `performance_records`, `labor_contracts` |
| `ai_center` | `model_routes`, `interface_contracts`, `rag_sources`, `mcp_tools`, `agent_runs`, `tool_policies`, `ai_cost_events` |
| `settings_center` | `tenants`, `accounts`, `people`, `roles`, `permissions`, `role_bindings`, `approval_matrices`, `system_settings` |

### 5.11 API namespace

| 模块 | API namespace |
|---|---|
| `personal_center` | `/v1/personal/*` |
| `marketing_service` | `/v1/marketing/*` |
| `planning_management` | `/v1/planning/*` |
| `concept_design` | `/v1/concepts/*` |
| `standard_library` | `/v1/standards/*`, `/v1/component-library/*` |
| `detailed_design` | `/v1/design/*`, `/v1/component-bom/*` |
| `quantity_costing` | `/v1/quantity-costing/*` |
| `material_logistics` | `/v1/material-logistics/*` |
| `production_manufacturing` | `/v1/production/*` |
| `construction_management` | `/v1/construction/*` |
| `digital_twin` | `/v1/digital-twin/*` |
| `digital_archive` | `/v1/archive/*` |
| `finance_management` | `/v1/finance/*` |
| `human_resources` | `/v1/hr/*` |
| `ai_center` | `/v1/ai/*`, `/v1/runtime/capabilities`, `/v1/data-plane/*` |
| `settings_center` | `/v1/settings/*`, `/v1/identity/*`, `/v1/permissions/*` |
| 全局文件 | `/v1/module-files/*`, `/api/local-files/*` |
| 全局事务 | `/v1/module-transactions/*`, `/v1/approval-tasks/*`, `/v1/audit-events/*` |

### 5.12 环境变量

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | PostgreSQL 主库 |
| `ARCHITOKEN_CACHE__URL` | Valkey/Redis-compatible 缓存 |
| `S3_ENDPOINT` | 对象存储 endpoint |
| `S3_BUCKET` | 默认 bucket |
| `S3_ACCESS_KEY_ID` | 对象存储账号 |
| `S3_SECRET_ACCESS_KEY` | 对象存储密钥 |
| `ARCHITOKEN_VECTOR__URL` | Qdrant 或外部向量库 |
| `QDRANT_URL` | Qdrant 兼容变量 |
| `ARCHITOKEN_EVENT__URL` | NATS/EventStore |
| `NATS_URL` | NATS JetStream |
| `ARCHITOKEN_TIMESERIES__URL` | 时序库 |
| `CLICKHOUSE_URL` | ClickHouse |
| `STIRLING_PDF_URL` | PDF sidecar |
| `COLLABORA_WOPI_URL` | Collabora WOPI |
| `ARCHITOKEN_MODEL_ROUTER_URL` | 模型路由服务 |
| `ARCHITOKEN_WORKER_QUEUE_URL` | Worker 队列 |
| `ARCHITOKEN_OBJECTSTORE_REGION` | 对象存储区域 |
| `ARCHITOKEN_AUDIT_APPEND_ONLY` | 审计不可变策略 |
| `ARCHITOKEN_TENANT_MODE` | 单租户/多租户 |
| `ARCHITOKEN_GPU_REQUIRED` | GPU 任务强制策略 |

### 5.13 本地开发环境

| 组件 | 要求 |
|---|---|
| OS | Ubuntu 24.04 LTS 或等价 Linux |
| Node/Bun | Bun 作为前端运行和测试入口 |
| Rust | Rust stable, cargo, clippy, rustfmt |
| Python | Python + uv,用于 Agent/Worker |
| Docker | Docker Engine / Compose |
| PostgreSQL | 本地容器或远端开发库 |
| Valkey | 本地容器 |
| ObjectStore | S3 兼容本地服务 |
| GPU | 有 NVIDIA 时启用 NVIDIA Container Toolkit；无 GPU 时记录 fallback |

本地启动顺序:

```text
database + cache + objectstore
  -> backend gateway
  -> worker services
  -> frontend dev server
  -> Playwright smoke
```

### 5.14 生产部署拓扑

```text
Ingress / API Gateway
  -> architoken-gateway
  -> harness-core
  -> PostgreSQL / ObjectStore / Valkey / EventStore / VectorStore
  -> worker queue
  -> file workers / cad-bim workers / pdf-office workers / ai workers
  -> model router
  -> inference runtimes
  -> observability
```

| 节点池 | 服务 |
|---|---|
| `system` | Gateway、frontend、auth、settings |
| `database` | PostgreSQL、Valkey、ObjectStore、EventStore |
| `worker-cpu` | Office 文档解析、PDF、导出、轻量结构化抽取 |
| `worker-gpu` | IFC 几何、AI 推理、图像视频、重型渲染 |
| `cad-bim` | DWG/DXF/IFC/STEP/SKP/3DM/RVT sidecar |
| `observability` | OpenTelemetry、日志、指标、追踪、审计 |

### 5.15 备份与恢复

| 对象 | 策略 |
|---|---|
| PostgreSQL | 每日全量 + WAL 增量 + 版本迁移脚本 |
| ObjectStore | 版本化 bucket + 跨盘/跨节点副本 |
| Valkey | 可重建缓存,只备份关键队列状态 |
| EventStore | append-only,定期快照 |
| VectorStore | 从标准库/CDE 文件可重建,保留索引版本 |
| 归档包 | 不可变对象 + sha256 + 审批记录 |
| 配置 | GitOps + Secret backup |

### 5.16 CI/CD 门禁

| 门禁 | 内容 |
|---|---|
| Rust | `cargo check`, `cargo test`, `clippy`, `fmt` |
| Frontend | `bun run test`, `tsc`, `eslint`, Playwright |
| Python | worker tests, import smoke |
| Database | migration up/down, schema diff |
| API | OpenAPI diff, SDK generation |
| Security | dependency audit, SBOM, license scan |
| AI | prompt/schema validation, tool policy |
| File runtime | Office/PDF/CAD/BIM smoke |
| BOM | 三个 Excel fixture 导入、校验、导出 |

P0 发布聚合门禁:

```bash
04-backend/scripts/smoke-p0-production-gates.sh
```

该脚本会执行全局模块操作运行时 smoke、CDE 文件运行时桥 smoke、运维审计/日志归档 smoke、PostgreSQL 备份恢复临时库演练、关键 worker 合同测试和 P0 文件差异检查。本地存在重钢 BOM/图纸目录源文件时会一并执行 BOM 数据库桥 smoke；GitHub Actions CI 和 tag release 使用 `pgvector/pgvector:pg16` 空库服务执行同一数据库门禁,并跳过仅本地可用的外部源文件。

### 5.17 数据库 Schema 分区

| Schema | Owner 模块 | 主要表 | 迁移文件建议 |
|---|---|---|---|
| `core` | 全局 | `tenants`, `modules`, `module_transactions`, `audit_events`, `event_outbox` | `04-backend/migrations/*_core.sql` |
| `identity` | `settings_center` | `users`, `roles`, `permissions`, `role_bindings`, `approval_matrices` | `*_identity.sql` |
| `cde` | 全模块 | `module_files`, `file_versions`, `file_permissions`, `object_store_objects` | `*_cde_files.sql` |
| `marketing` | `marketing_service` | `leads`, `customers`, `contacts`, `requirements`, `quote_drafts` | `*_marketing.sql` |
| `planning` | `planning_management` | `projects`, `wbs_items`, `milestones`, `risks`, `change_requests` | `*_planning.sql` |
| `concept` | `concept_design` | `concept_briefs`, `concept_variants`, `concept_evaluations`, `client_confirmations` | `*_concept.sql` |
| `standard` | `standard_library` | `standards`, `clauses`, `sjg157_categories`, `rule_sets`, `material_grades` | `*_standard_library.sql` |
| `design` | `detailed_design` | `design_packages`, `drawings`, `bim_models`, `clash_reports`, `design_reviews` | `*_detailed_design.sql` |
| `component_bom` | `detailed_design` | `bom_documents`, `bom_versions`, `bom_lines`, `validation_results` | `*_component_bom.sql` |
| `costing` | `quantity_costing` | `boq_documents`, `boq_items`, `price_snapshots`, `cost_breakdowns` | `*_costing.sql` |
| `logistics` | `material_logistics` | `suppliers`, `purchase_orders`, `shipments`, `receiving_records`, `inventory_batches` | `*_logistics.sql` |
| `production` | `production_manufacturing` | `work_orders`, `cutting_lists`, `cnc_files`, `qc_records`, `dispatch_batches` | `*_production.sql` |
| `construction` | `construction_management` | `daily_logs`, `inspections`, `installation_records`, `acceptance_reports`, `rectification_items` | `*_construction.sql` |
| `twin` | `digital_twin` | `twin_models`, `twin_elements`, `iot_devices`, `iot_events`, `alerts` | `*_digital_twin.sql` |
| `archive` | `digital_archive` | `archive_packages`, `archive_items`, `evidence_chain_nodes`, `integrity_checks` | `*_archive.sql` |
| `finance` | `finance_management` | `budgets`, `contracts`, `invoices`, `payments`, `vouchers`, `reconciliation_runs` | `*_finance.sql` |
| `hr` | `human_resources` | `employees`, `crews`, `qualifications`, `attendance_records`, `timesheets` | `*_hr.sql` |
| `ai` | `ai_center` | `model_routes`, `tool_policies`, `rag_sources`, `agent_runs`, `ai_cost_events` | `*_ai_center.sql` |

### 5.18 统一表字段基线

所有业务主表必须包含以下字段,特殊高频表也不得删除这些字段,只能增加索引或派生表。

```sql
tenant_id        UUID NOT NULL,
project_id       UUID NULL,
id               UUID PRIMARY KEY,
status           TEXT NOT NULL,
version_no       INTEGER NOT NULL DEFAULT 1,
source_file_id   UUID NULL,
source_version_id UUID NULL,
created_by       UUID NOT NULL,
updated_by       UUID NOT NULL,
created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
issued_at        TIMESTAMPTZ NULL,
archived_at      TIMESTAMPTZ NULL,
audit_event_id   UUID NOT NULL,
metadata         JSONB NOT NULL DEFAULT '{}'::jsonb
```

| 字段 | 要求 |
|---|---|
| `tenant_id` | RLS 隔离第一字段 |
| `project_id` | 项目相关对象必须填写；平台对象可为空 |
| `status` | 必须使用统一生命周期状态 |
| `source_file_id` / `source_version_id` | 来自文件的业务对象必须追溯源文件版本 |
| `audit_event_id` | 任一写操作必须写审计 |
| `metadata` | 只放非索引、非查询主路径字段；核心字段必须列化 |

### 5.19 服务单元与端口职责

| 服务 | 默认端口 | 依赖 | 责任 | 不允许做的事 |
|---|---:|---|---|---|
| `frontend-next` | 3000 | Gateway | 模块工作台、CDE UI、审批/审计 UI | 直接写数据库 |
| `architoken-gateway` | 8080 | PostgreSQL, Valkey, ObjectStore, EventStore | REST/SSE/gRPC/MCP、鉴权、审计、模块 API | 直接调用外部模型 |
| `harness-core` | library/internal | PostgreSQL, Registry | Router、Schema、事务、数据平面 | 绕过 Gateway 暴露业务写接口 |
| `agent-orchestrator` | 8090 | Gateway, ModelRouter, EventStore | Planner/Generator/Evaluator 编排 | 直接发布业务结果 |
| `model-router` | 8091 | 推理引擎、外部模型 adapter | 模型选择、成本、限流、审计 | 被业务模块绕过 |
| `tool-router` | 8092 | Worker registry, 权限策略 | 工具授权、参数校验、调用审计 | 执行未注册工具 |
| `file-worker` | queue | ObjectStore, PostgreSQL | 文件解析、缩略图、checksum、manifest | 覆盖源文件 |
| `cad-bim-worker` | queue/sidecar | ObjectStore, GPU/CPU, CAD adapters | DWG/DXF/IFC/STEP/SKP/3DM/RVT 解析和派生 | 用截图冒充解析成功 |
| `component-bom-worker` | queue | PostgreSQL, ObjectStore | SJG157、命名规则、BOM 导入、校验、重量 | 直接批准 BOM |
| `office-worker` | 9980 | Collabora/WOPI, ObjectStore | Office 原生编辑和保存回写 | 绕过 CDE 版本 |
| `pdf-worker` | 8093 | Stirling-PDF, OCR | PDF 处理、OCR、版面抽取 | 修改源 PDF 不留版本 |
| `database-manager` | 8094 | PostgreSQL, Valkey, ObjectStore | 运行态巡检、Schema diff、备份状态 | 暴露无权限 SQL 控制台 |

### 5.20 Worker 队列与事件

| 队列 | 输入事件 | Worker | 输出事件 | 重试 |
|---|---|---|---|---|
| `file.parse` | `cde.file.uploaded` | `file-worker` | `cde.file.parsed` / `cde.file.parse_failed` | 3 次,指数退避 |
| `cad-bim.parse` | `design.file.parse_requested` | `cad-bim-worker` | `design.file.parsed` / `design.file.parse_failed` | 2 次,保留失败证据 |
| `bom.import` | `component_bom.import.requested` | `component-bom-worker` | `component_bom.import.completed` | 3 次,按文件 hash 幂等 |
| `bom.validate` | `component_bom.validation.requested` | `component-bom-worker` | `component_bom.validation.completed` | 3 次 |
| `costing.generate` | `costing.boq.generate_requested` | `costing-worker` | `costing.boq.generated` | 2 次 |
| `production.generate` | `production.work_order.generate_requested` | `production-worker` | `production.work_order.created` | 2 次 |
| `archive.pack` | `archive.package.collect_requested` | `archive-worker` | `archive.package.collected` | 3 次 |
| `ai.agent` | `ai.agent_run.requested` | `agent-orchestrator` | `ai.agent_run.completed` | 按工具策略 |
| `search.index` | `cde.file.parsed` / `standard.rule_set.published` | `index-worker` | `search.index.updated` | 可重建 |
| `twin.sync` | `construction.acceptance.approved` | `twin-worker` | `twin.model.synced` | 2 次 |

### 5.21 API 响应统一结构

```json
{
  "request_id": "uuid",
  "tenant_id": "uuid",
  "module_id": "detailed_design",
  "transaction_id": "uuid",
  "status": "schema_validated",
  "data": {},
  "warnings": [],
  "errors": [],
  "audit_event_id": "uuid",
  "next_actions": [
    {"action": "submit_review", "enabled": true}
  ]
}
```

| 字段 | 要求 |
|---|---|
| `request_id` | 每次请求唯一,贯穿日志和 trace |
| `transaction_id` | 任何业务写操作必须绑定事务 |
| `status` | 返回当前业务状态,不是 HTTP 状态替代品 |
| `warnings` | 可继续但需提示的问题 |
| `errors` | 阻断问题,必须有可修复原因 |
| `audit_event_id` | 写操作必须返回 |
| `next_actions` | 前端按钮状态由后端返回,不得纯前端猜测 |

### 5.22 RLS 与权限策略

| 层 | 策略 |
|---|---|
| 租户隔离 | 所有业务表启用 RLS,`tenant_id = current_setting('app.tenant_id')::uuid` |
| 项目权限 | 项目对象检查 `project_members` 或角色绑定 |
| 模块权限 | 每个 API 检查 `module_id + action` 权限 |
| 文件权限 | `module_files` 和 `file_versions` 走 CDE 权限表 |
| 审批权限 | `approval_tasks.assignee_role` 和 `approval_matrices` 决定 |
| Agent 权限 | Agent 使用服务账号,工具调用仍受 ToolPolicy 限制 |
| 管理权限 | 设置中心权限变更必须双人审批或至少写高危审计 |

### 5.23 本地到生产环境依赖矩阵

| 能力 | 本地开发 | 生产最低 | 生产增强 |
|---|---|---|---|
| PostgreSQL | 单容器 | 主从/备份/WAL | 高可用集群 |
| ObjectStore | S3 兼容单节点 | 版本化 bucket | 跨节点副本 |
| Valkey | 单容器 | 持久化/哨兵或托管 | 集群 |
| EventStore | PostgreSQL outbox | NATS JetStream | 多副本 JetStream |
| VectorStore | pgvector | pgvector 或 Qdrant | Qdrant 集群 |
| CAD/BIM worker | CPU fallback | CPU + 可用 GPU | GPU 节点池 |
| AI 推理 | Ollama/外部 adapter | ModelRouter + 至少 1 个运行时 | vLLM/SGLang/TensorRT-LLM 多路 |
| Office | 可选 | Collabora/WOPI sidecar | 独立 Office 节点 |
| PDF/OCR | 可选 | PDF worker | OCR/GPU 加速 |
| 观测 | 日志 | OpenTelemetry + metrics | trace、审计流、告警 |

### 5.24 最小可运行开发验收

| 步骤 | 验收命令 / 页面 | 通过标准 |
|---|---|---|
| 数据库 | migration up | 所有 schema 建表成功 |
| 后端 | `/readyz`, `/v1/modules` | 返回 16 模块 |
| 前端 | `/app/modules` | 左侧 16 模块可切换 |
| 文件 | 上传一个 XLSX/PDF/IFC | 生成 `module_files` 和 `file_versions` |
| 审批 | 创建一个交付物并提交审批 | `approval_tasks` 生成 |
| Agent | 运行一个受控 Agent | 生成 `agent_runs` 和 `agent_tool_calls` |
| BOM | 导入三个 Excel fixture | SJG157、命名规则、BOM 行项入库 |
| 下游 | 发布 BOM 后生成 BOQ 草稿 | `boq_items.source_bom_line_id` 非空 |
| 审计 | 任意写操作 | `audit_events` 有记录 |
| 归档 | 生成归档包 | 源文件、发布文件、审批、审计完整 |

### 5.25 2026-06 硬件选型、网络、安全与预算

本节覆盖 ArchIToken 一期落地所需的 CPU 服务器、NAS、网络、安全、UPS、备份和 BIM GPU 专项另购。研发、设计人员已经有日常台式机,本轮不采购开发/设计整机；Threadripper 9970X 和 Threadripper PRO 9975WX 只作为后续开发工作站、独立 GPU worker 或本地推理节点的采购口径,不挤占一期 CPU/存储/网络基础包。BIM 硬件另购 2 张 NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe,单价按用户确认价 ¥68,000/张,显卡小计 ¥136,000。

#### 5.25.1 采购边界

| 项目 | 一期是否采购 | 原因 |
|---|---:|---|
| Intel Xeon 676X 服务器 | 是 | 用于 CDE/API/数据库关键节点和 BIM/IFC/STEP/STL/USDZ/OpenUSD 模型派生关键节点。需要 ECC RDIMM、BMC/IPMI、双电源、机架运维。 |
| AMD Threadripper 9970X 工作站 | 否 | 适合个人开发/编译工作站,不适合作为 NAS、数据库或生产服务主机。现有开发电脑已能承担日常开发。 |
| AMD Threadripper PRO 9975WX 工作站/服务器 | 否,二期评估 | 适合设计/BIM/GPU worker,但本轮先不采购新的 Threadripper 整机；BIM GPU 卡先作为服务器版加速卡专项另购。 |
| BIM GPU 加速卡 | 是,专项另购 | 另购 2 张 NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe,单价 ¥68,000/张,显卡小计 ¥136,000。用于 BIM/IFC/STEP/STL/USDZ/OpenUSD 派生、模型导图、构件 BOM、局部视觉/几何推理和渲染加速实验。 |
| GPU worker 服务器整机 | 暂不按完整生产包采购 | 两张 GPU 卡必须落到通过验收的服务器平台；若六节点轻量包的机箱、PCIe 插槽、600W/卡供电、散热风道或驱动不满足要求,必须追加 GPU 服务器/机箱/电源/导风罩预算,不能直接塞入 NAS/普通机箱验收。 |
| NAS/ZFS 存储服务器 | 是 | CDE 文件、BOM 源 Excel、IFC/DWG/PDF、归档包、对象存储、备份快照必须有企业盘和 ZFS。 |
| JumpServer 堡垒机 | 是,但不单买硬件 | 使用开源 JumpServer,部署在 `srv-01` 的 VM/容器中；会话录像、命令审计、文件传输审计落 NAS。 |
| 等保基础安全 | 是 | 防火墙、VPN/MFA、VLAN、日志审计、堡垒机、备份、最小权限、EDR/主机加固必须纳入一期。 |

#### 5.25.2 CPU 与平台分工

| CPU/平台 | 采购角色 | 是否进入一期 | 关键判断 |
|---|---|---:|---|
| Intel Xeon 676X | CDE/API/数据库关键节点、BIM/IFC/STEP/STL/USDZ/OpenUSD 模型派生关键节点 | 是 | Intel 官方规格为 32 P-core / 64 线程、144MB Cache、2.80GHz 基础频率、4.90GHz 最大睿频、275W 基础功耗、330W 最大睿频功耗、8 通道 DDR5/MRDIMM、128 条 PCIe 5.0。适合关键计算和模型派生节点。 |
| Intel Xeon 658X | NAS/CDE 文件、CI/通用 Worker、应用/API/队列、JumpServer/日志/审计节点 | 是 | Intel 官方规格为 24 P-core / 48 线程、144MB Cache、3.00GHz 基础频率、4.90GHz 最大睿频、250W 基础功耗、300W 最大睿频功耗、8 通道 DDR5、ECC、PCIe 5.0、128 lanes。NAS 用 658X 足够。 |
| AMD Threadripper 9970X | 开发编译工作站、个人高性能桌面 | 否 | 不作为生产服务器基线。没有服务器级 BMC/双电源/机架生命周期优势；现有开发桌面够用。 |
| AMD Threadripper PRO 9975WX | 设计/BIM 派生工作站、GPU worker、点云/渲染/局部推理节点 | 二期 | 8 通道 RDIMM/ECC 和 WRX90 适合重型工作站,但一期先把数据、流程、安全、存储跑通。 |

Intel Xeon 676X 官方规格要点:

| 项目 | Intel 官方规格 |
|---|---|
| 产品线 | Intel Xeon 6 processors, formerly Granite Rapids, Workstation |
| 核心/线程 | 32 P-core / 64 threads |
| 频率 | Base 2.80GHz, Max Turbo 4.90GHz, Turbo Boost 2.0 4.70GHz |
| 缓存 | 144MB |
| 功耗 | Processor Base Power 275W, Maximum Turbo Power 330W |
| 内存 | 最大 4TB, DDR5-6400 / MRDIMM-8000, 8 通道, ECC |
| PCIe | PCIe 5.0, 128 lanes |
| 上市时间 | Q1 2026 |
| 采购校验 | CPU SKU、主板 QVL/BIOS、散热器 TDP、内存 QVL、机箱风道必须一起确认。 |

#### 5.25.3 一期采购总表

价格口径: CPU、主板、内存、机械盘、PM9A3、英睿达/美光 T710 Pro 4TB、长城电源、银昕 NAS 机箱使用 2026-06 会议确认单价；交换机、防火墙、UPS、机柜等按采购预算价列出,下单前必须逐项用京东自营或品牌旗舰店复核并截图归档。

| 类别 | 设备/物料 | 数量 | 单价 | 小计 | 用途 |
|---|---|---:|---:|---:|---|
| 计算服务器 | `srv-01-compute-db-ci` | 1 台 | ¥224,550 | ¥224,550 | ArchIToken 数据库、Gateway、CI/K8s、Agent 编排、JumpServer、日志服务。 |
| NAS 服务器 | `srv-02-nas-zfs-backup` | 1 台 | ¥81,000 | ¥81,000 | CDE 文件、对象存储、BOM 源文件、归档包、ZFS 快照、备份库；NAS 使用 Xeon 658X、热插拔 NAS 机箱和 2 个长城服务器电源。 |
| 网络/安全/供电 | 防火墙、10GbE 核心交换、2.5GbE PoE、AP、UPS、机柜和布线 | 1 套 | ¥75,000 | ¥75,000 | 双运营商入口、内网分区、无线、VPN/MFA、等保基础日志和断电保护。 |
| 离线备份盘 | Toshiba MG11 22TB | 2 块 | ¥7,400 | ¥14,800 | 东芝 MG11 企业盘,离线轮换备份,不常挂载,防误删和勒索软件。 |
| 合计 | 一期 CPU/存储/网络基础设施 | - | - | **¥395,350** | 控制在 40-50 万硬件预算内；不含 `srv-02` 未确认的散热/转接件、不含公网专线月租、不含商业软件授权。 |
| BIM GPU 专项另购 | NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe | 2 张 | ¥68,000 | **¥136,000** | 用户确认单价。用于 BIM/IFC/STEP/STL/USDZ/OpenUSD 派生、模型导图、构件 BOM、局部推理和渲染加速；不等于已具备完整 GPU 生产服务器。 |
| 基础包 + BIM GPU 已确认口径 | 以上两项合计 | - | - | **¥531,350** | 若 GPU 需要另配合规服务器机箱、双电源、导风罩、转接线或商业驱动/软件授权,必须单独追加预算。 |

#### 5.25.4 `srv-01-compute-db-ci` 明细

| 部件 | 数量 | 单价 | 小计 | 说明 |
|---|---:|---:|---:|---|
| Intel Xeon 676X | 1 颗 | ¥25,350 | ¥25,350 | 32 P-core / 64 线程、144MB Cache、2.80GHz 基础频率、4.90GHz 最大睿频、4.70GHz Turbo Boost 2.0、275W 基础功耗、330W 最大睿频功耗、8 通道 DDR5-6400/MRDIMM-8000 ECC、最大 4TB 内存、PCIe 5.0 128 lanes、FCLGA4710。 |
| 64GB ECC RDIMM | 8 根 | ¥13,500 | ¥108,000 | 合计 512GB。承载 PostgreSQL、Qdrant/pgvector、CI、Agent worker、容器运行时。 |
| Samsung PM9A3 960GB | 2 块 | ¥4,300 | ¥8,600 | 数据中心 SSD,PCIe 4.0 x4/NVMe,E1.S、U.2、M.2 形态；最高顺序读 6,800MB/s、随机写 200K IOPS。两块做系统盘镜像,下单必须锁定 M.2 或 U.2 形态并核对主板/背板。 |
| 企业级 NVMe 3.84TB | 2 块 | ¥9,800 | ¥19,600 | 数据库热数据、CI cache、向量索引、构建缓存。采购前按京东自营/旗舰店复核型号。 |
| 2U 服务器平台 | 1 套 | ¥58,000 | ¥58,000 | 单路主板、BMC/IPMI、双热插拔电源、散热、导轨、机架安装。 |
| 10GbE 网卡/线缆 | 1 套 | ¥5,000 | ¥5,000 | 至少 2 x 10GbE,连接核心交换和 NAS。 |
| 小计 | - | - | **¥224,550** | 作为一期主计算和管理节点。 |

`srv-01` 运行分配:

| 服务 | 运行方式 | 资源起步 | 存储位置 |
|---|---|---:|---|
| PostgreSQL/Supabase 元数据 | VM 或容器,独立卷 | 8-12 vCPU,64-128GB RAM | 本机 NVMe,每日快照到 NAS |
| Gateway / Harness Core | 容器 | 4-8 vCPU,16-32GB RAM | 本机 NVMe |
| NATS JetStream / Outbox worker | 容器 | 2-4 vCPU,8-16GB RAM | 本机 NVMe + NAS 备份 |
| Valkey / Cache | 容器 | 2-4 vCPU,8-16GB RAM | 本机 NVMe |
| Qdrant 或 pgvector | 容器 | 4-8 vCPU,32-64GB RAM | 本机 NVMe,索引备份到 NAS |
| Agent Orchestrator | 容器 | 8-16 vCPU,64-96GB RAM | 本机 NVMe + NAS artifacts |
| CI / 构建 / 测试 | VM 或容器池 | 8-16 vCPU,64-128GB RAM | 本机 NVMe cache,NAS artifact |
| JumpServer | VM 或容器 | 4 vCPU,16GB RAM | 会话录像和审计日志写 NAS |
| 日志审计 | 容器 | 4-8 vCPU,32GB RAM | 热日志本机,冷日志 NAS |

#### 5.25.5 `srv-02-nas-zfs-backup` 明细

| 部件 | 数量 | 单价 | 小计 | 说明 |
|---|---:|---:|---:|---|
| Intel Xeon 658X | 1 颗 | ¥17,500 | ¥17,500 | 24 P-core / 48 线程、144MB Cache、3.00GHz 基础频率、4.90GHz 最大睿频、250W 基础功耗、300W 最大睿频功耗、8 通道 DDR5、ECC、PCIe 5.0 128 lanes、FCLGA4710。NAS、备份、对象存储和归档用 658X 足够。 |
| 技嘉 MW94-RP0 主板 | 1 张 | ¥8,000 | ¥8,000 | Intel Xeon 600 Workstation、W890、LGA4710-2、8 通道 DDR5 RDIMM/MRDIMM、板载 2 x 10GbE、4 x M.2、2 x SlimSAS 4i 可接 8 x SATA；采购前复核 BIOS、散热器和 CS383 安装兼容。 |
| 64GB ECC RDIMM | 1 根 | ¥13,500 | ¥13,500 | 一期先 64GB 起步。ZFS ARC 会受限；生产数据增长后优先补到 4 根 256GB。 |
| Toshiba MG11 22TB | 4 块 | ¥7,400 | ¥29,600 | 3.5-inch、1GiB Buffer、7200rpm、MTTF/MTBF 2,500,000h(AFR 0.35%)、550TB/年 workload、CMR、氦封、SATA 6Gbps 或 SAS 12Gbps。当前不买 HBA,优先锁 SATA 型号 MG11ACA22TE；若买 SAS 型号 MG11SCA22TE 必须另配 SAS HBA/线缆。 |
| Samsung PM9A3 960GB | 2 块 | ¥4,300 | ¥8,600 | 数据中心 SSD,PCIe 4.0 x4/NVMe,E1.S、U.2、M.2 形态。两块 960GB 做系统盘镜像；若选 U.2 形态需确认 MW94-RP0/CS383 线缆与转接方案,若选 M.2 形态走主板 M.2。 |
| 长城服务器电源 | 2 个 | ¥1,000 | ¥2,000 | NAS 使用 2 个长城服务器电源。下单前必须复核热插拔 NAS 机箱安装位、线材、冗余/并联方式、质保和接口实物。 |
| 银昕 CS383 热插拔 NAS 机箱 | 1 台 | ¥1,800 | ¥1,800 | 8 盘位热插拔 NAS 机箱；8 x 3.5/2.5 英寸 SAS-12G/SATA-6G 热插拔盘托,支持 E-ATX/SSI-EEB,一期先装 4 块 MG11。 |
| 小计 | - | - | **¥81,000** | 按本轮已确认物料计算；散热/转接件若不是现有备件,必须另列实价后才能视为完整可开机整机价。 |

NAS 存储策略:

| 项目 | 配置 |
|---|---|
| 盘位 | 银昕 CS383 8 盘位热插拔 NAS 机箱,一期装 4 块 Toshiba MG11 22TB,预留 4 个盘位。CS383 官网规格为 8 个热插拔 3.5/2.5 英寸 SAS-12G/SATA-6G 盘托,支持 E-ATX/SSI-EEB。 |
| 原始容量 | 4 x 22TB = 88TB。 |
| RAID 方案 | ZFS RAIDZ1,等价 RAID5 单校验。 |
| 可用容量 | 约 66TB,按 1 块盘容量用于校验冗余。 |
| 坏盘容忍 | 任意 1 块硬盘故障仍可恢复；重建期间再坏 1 块会丢池,离线备份不能省。 |
| 数据集 | `cde-files`, `object-store`, `db-backup`, `agent-artifacts`, `audit-log`, `archive-package`, `offline-staging`。 |
| 快照 | 关键数据每小时快照,保留 48 小时；每日快照保留 35 天；每月快照保留 12 个月。 |
| 离线备份 | 2 块 Toshiba MG11 22TB 轮换离线,每周导出归档包、数据库备份、JumpServer 审计、关键对象存储。 |
| 二期扩容 | 优先补内存到 4 x 64GB；按 MW94-RP0 的 SlimSAS/CS383 背板线缆兼容结果决定是否补转接线或 HBA,最后补满剩余 4 盘位。 |

#### 5.25.6 网络、路由、防火墙和无线

中国办公室公网入口只按运营商可交付的 1Gbps/10Gbps 采购,不写 2.5Gbps/5Gbps WAN。2.5GbE 只用于桌面和 Wi-Fi AP 接入；本轮 10GbE 用于防火墙、核心交换、`srv-01` 和 `srv-02`。`srv-02` 使用 MW94-RP0 板载 2 x 10GbE,不另购 10GbE 网卡；硬盘优先走主板 SlimSAS/SATA,不另购 HBA。

| 链路 | 一期配置 | 二期扩展 | 说明 |
|---|---|---|---|
| 公网 WAN | 双运营商千兆: 主线 1Gbps,备线 1Gbps,固定公网 IP | 10Gbps 企业专线或互联网专线 + SD-WAN | 100/1000 用户试点够用；1 万/10 万公网用户必须迁到云或托管机房。 |
| 防火墙到核心交换 | 10GbE | 双防火墙 HA,10GbE 双上联 | 承载 VPN、NAT、ACL、日志外送、东西向策略。 |
| 核心交换到服务器/NAS | `srv-01` 走 10GbE；`srv-02` 走 MW94-RP0 板载 2 x 10GbE,不单买 10GbE 网卡/HBA | 10GbE 双上联；机房阶段再评估 100GbE | 一期不采购 25GbE,避免不必要成本和兼容复杂度。 |
| 办公桌面 | 1GbE/2.5GbE 混用 | 2.5GbE 到重点工位 | 研发/设计已有电脑,只改网络接入。 |
| Wi-Fi AP | Wi-Fi 7 AP,2.5GbE PoE 上联 | 高密区增加 AP | 员工、访客、IoT 分 SSID/VLAN。 |

一期网络/安全/供电预算明细:

| 物料 | 数量 | 单价 | 小计 | 说明 |
|---|---:|---:|---:|---|
| 企业防火墙/路由 | 1 台 | ¥18,000 | ¥18,000 | 支持 1Gbps/10Gbps 入口、VPN/MFA、日志外送、策略路由。 |
| 10GbE 管理型核心交换 | 1 台 | ¥12,000 | ¥12,000 | VLAN、ACL、LACP、SNMP/日志,连接服务器、NAS、防火墙。 |
| 2.5GbE PoE 接入交换 | 1 台 | ¥6,000 | ¥6,000 | 桌面重点位和 Wi-Fi 7 AP 供电。 |
| Wi-Fi 7 AP | 4 台 | ¥1,500 | ¥6,000 | 办公区、会议室、访客区覆盖。 |
| 在线式 UPS | 1 套 | ¥20,000 | ¥20,000 | 6kVA 起步,支持 15-30 分钟和自动关机。 |
| 32U 机柜/PDU/环境监控 | 1 套 | ¥8,000 | ¥8,000 | 机柜、PDU、温湿度、门磁或基础监控。 |
| 光模块/DAC/六类线/理线 | 1 批 | ¥5,000 | ¥5,000 | 服务器、交换、防火墙、AP 接入布线。 |
| 小计 | - | - | **¥75,000** | 一期网络、安全和供电基础。 |

#### 5.25.7 VLAN 与等保基础控制

| VLAN | 用途 | 访问控制 |
|---|---|---|
| `vlan10-mgmt` | BMC/IPMI、防火墙、交换机、NAS 管理口 | 只允许 JumpServer、管理员 VPN 和审计主机访问。 |
| `vlan20-server` | Gateway、数据库、Agent、CI/K8s | 只开放服务端口,东西向访问走防火墙或策略组。 |
| `vlan30-storage` | NAS/ZFS、对象存储、备份链路 | 只允许服务器、备份任务和归档任务访问。 |
| `vlan40-office` | 员工办公终端 | 只访问工作台、VPN、打印等必要服务。 |
| `vlan50-design` | 设计/BIM 终端 | 可访问 CDE、模型文件、BIM worker 队列。 |
| `vlan60-guest` | 访客网络 | 只出互联网,不得访问内网。 |
| `vlan70-iot` | 摄像头、门禁、测试设备 | 只允许到指定日志/管理服务。 |
| `vlan80-security` | 日志、审计、EDR、备份 | 接收日志,不得被业务容器反向写入。 |

等保和安全控制落点:

| 控制项 | 一期做法 | 进入系统的位置 |
|---|---|---|
| 身份鉴别 | VPN + MFA；JumpServer 统一 SSH/RDP/HTTPS 运维入口 | `settings_center`, `audit_events`, JumpServer 审计库 |
| 访问控制 | RBAC/RLS/项目权限/模块权限/工具权限分层 | Gateway、PostgreSQL RLS、ToolPolicy |
| 安全审计 | 登录、文件、审批、Agent、数据库变更、运维命令全写审计 | `audit_events`, JumpServer, NAS 冷归档 |
| 入侵防范 | 防火墙策略、主机加固、EDR、最小端口暴露 | 防火墙、服务器基线、K8s NetworkPolicy |
| 数据备份 | ZFS 快照、数据库每日备份、离线盘轮换 | NAS `db-backup`, `archive-package`, offline staging |
| 防勒索 | NAS 快照只读保留,离线盘不常挂载,办公终端不得直接写归档池 | ZFS dataset 权限和备份流程 |
| 变更管理 | 生产变更必须走审批和审计,不能直接 SSH 改容器 | `approval_tasks`, GitOps/部署记录 |

#### 5.25.8 一台设备能否同时做所有服务

| 场景 | 是否允许 | 说明 |
|---|---:|---|
| 100 用户内测/内部研发 | 可以临时合并 | 一台 Xeon 676X 可同时跑 NAS/ZFS、数据库、CI、JumpServer 和 Agent,但这是单点故障。 |
| 1000 用户商业试点 | 不建议合并 | 至少拆成 `srv-01` 计算/数据库 + `srv-02` NAS/备份；公网入口要双运营商。 |
| 1 万用户公网生产 | 不允许放办公室合并机 | API、对象存储、数据库、队列、CDN/WAF 应进云或托管机房,办公室只做研发、测试、备份和内网 CDE。 |
| 10 万用户平台运营 | 不允许 | 必须多可用区、多副本、云/IDC K8s、托管数据库或自建高可用集群、WAF/CDN、专线和灾备。 |

#### 5.25.9 容量与 ArchIToken 模块映射

| 负载 | 一期承载位置 | 说明 |
|---|---|---|
| 16 模块工作台 | `srv-01` | Next.js/React 前端、Gateway、模块 API、RBAC、审计。 |
| BOM/BOQ/项目/审批数据库 | `srv-01` PostgreSQL | 热数据放 NVMe,每日备份到 `srv-02`。 |
| CDE 文件、IFC、DWG、PDF、Excel、归档包 | `srv-02` NAS/ZFS/ObjectStore | 源文件和版本是真源,不得只放浏览器或单机硬盘。 |
| Agent 编排与岗位任务队列 | `srv-01` + 任务队列 | 一期先承载 24-32 个关键 Agent；P1 扩展 80-120 个 Agent 任务目录；文本/结构化 Agent 不直接占用 BIM GPU。 |
| JumpServer 堡垒机 | `srv-01` VM/容器 | 会话录像和命令审计写 `srv-02`。 |
| 日志审计 | `srv-01` 热日志 + `srv-02` 冷归档 | 生产日志、Agent 调用、运维命令、审批记录必须可追溯。 |
| BIM/CAD 派生 worker | `srv-03`/`srv-04` CPU worker + BIM GPU 专项卡 | CPU worker 负责解析、队列和写回 CDE；2 张 RTX PRO 6000D 84GB 服务器版卡用于受控模型派生、局部推理和渲染加速。正式图纸、BOM、报价仍需规则校验和审批。 |

#### 5.25.10 分阶段扩容

| 阶段 | 触发条件 | 新增硬件 | 预算口径 |
|---|---|---|---|
| 一期 L2 保守包 | 内部研发、100 用户试点、BOM/数据库/Agent/工作流打通 | 1 台 Xeon 676X 计算/数据库服务器 + 1 台 Xeon 658X NAS + 网络安全 + UPS + 离线备份 | ¥395,350 |
| 一期 L2+/L3 六节点试点包 | 30 人内部生产力和 100/1000 用户试点需要拆分 CDE、NAS、Worker、应用、审计故障域 | 2 台 Xeon 676X + 4 台 Xeon 658X CPU 服务器 + 网络安全 + UPS + 离线备份 | CPU 核心物料 ¥333,500；网络/安全/供电/实施另按 5-9 万预留 |
| BIM GPU 专项另购 | BIM/IFC/STEP/STL/USDZ/OpenUSD 派生、模型导图、构件 BOM、局部推理和渲染加速需要本地大显存卡 | NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe x2 | 显卡小计 ¥136,000；不含如需追加的 GPU 合规服务器、导风罩、电源线、驱动/软件授权 |
| 二期 A | 1000 用户商业试点后,模型派生、CI、数据库、Agent 仍互相抢资源 | 追加内存、第二 NAS、更多 Worker 或托管云资源 | 单台按同类 BOM 复算,采购前重新锁价 |
| 二期 B | BIM/CAD 派生、点云、渲染、本地 AI 推理成为稳定负载且 2 张 GPU 卡排队不足 | 独立 GPU worker 服务器、更多 RTX PRO/数据中心 GPU、或 Threadripper PRO 9975WX 工作站 | 按实测负载、GPU 利用率、散热供电和云端替代成本单独立项 |
| 三期 | 1 万/10 万公网用户 | 云/IDC K8s、托管数据库或自建 HA、WAF/CDN、对象存储、多活灾备 | 按生产 SLA 单独立项,不放办公室机房 |

#### 5.25.11 采购复核清单

| 物料 | 当前采用单价 | 价格状态 | 下单前动作 |
|---|---:|---|---|
| Intel Xeon 676X | ¥25,350 | 会议确认京东自营/旗舰店价 | 截图 SKU、店铺、发票类型、质保条款；复核 32 P-core/64 线程、144MB、275W/330W、DDR5/MRDIMM、PCIe 5.0 128 lanes。 |
| Intel Xeon 658X | ¥17,500 | 会议确认价 | 截图 SKU、店铺、发票类型、质保条款；复核 24 P-core/48 线程、144MB、250W/300W、DDR5、ECC、PCIe 5.0 128 lanes。 |
| 64GB ECC RDIMM | ¥13,500 | 会议确认京东自营/旗舰店价 | 确认频率、Rank、兼容主板 QVL、是否服务器 RDIMM。 |
| Toshiba MG11 22TB | ¥7,400 | 会议确认京东自营/旗舰店价 | 优先锁 SATA 型号 MG11ACA22TE；复核 3.5-inch、1GiB Buffer、7200rpm、MTTF/MTBF 2,500,000h(AFR 0.35%)、550TB/年 workload、CMR、氦封、保修和发票。 |
| Samsung PM9A3 960GB | ¥4,300 | 会议更新单价 | 复核 E1.S/U.2/M.2 形态、PCIe 4.0 x4/NVMe、960GB 具体 SKU、服务器主板/背板/线缆兼容,并截图店铺与质保。 |
| 英睿达/美光 T710 Pro 4TB | ¥4,800 | 用户确认单价 | 非数据库真源盘、非关键 Worker、应用缓存、CI/cache、日志缓存可用；若承载数据库热数据、关键审计或 ZFS 元数据,必须重新做企业级 SSD 评审。 |
| NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe | ¥68,000 | 用户确认单价 | 锁定服务器版/84GB/SKU/发票/质保；复核 600W/卡供电、PCIe Gen5 x16、双槽尺寸、服务器风道、驱动、CUDA/容器运行时、与目标服务器平台兼容性。 |
| 技嘉 MW94-RP0 主板 | ¥8,000 | 用户确认单价 | 复核 Xeon 676X BIOS 支持、LGA4710-2、W890、8 通道 RDIMM/MRDIMM、2 x 10GbE、SlimSAS/SATA、M.2、CS383 安装兼容。 |
| NAS 机箱 | ¥1,800 | 用户确认单价 | `srv-02` NAS 保留银昕 CS383 热插拔 NAS 机箱；下单前复核 8 盘位、背板线缆、风扇、硬盘散热、主板尺寸和电源兼容。 |
| BIM 机箱 | ¥2,000 | 用户确认单价 | `srv-03` BIM/IFC/开放格式模型派生节点使用长城黑匣子 15 机箱；必须复核 RTX PRO 6000D 双卡长度、厚度、导风、固定方式和维护空间。 |
| 通用服务器机箱 | ¥1,000 | 用户确认单价 | 除 NAS 机箱和 BIM 机箱外,`srv-01`/`srv-04`/`srv-05`/`srv-06` 可按服务器机箱 ¥1,000 暂列；下单前复核主板、散热器、盘位、导轨和风道。 |
| BIM 电源 | ¥4,000 | 会议确认单价 | `srv-03` BIM 节点使用长城黑匣子 3200W ATX3.1；必须复核双 RTX PRO 6000D 供电线、瞬时功耗、输入电压、CQC/质保和机箱安装兼容。 |
| 通用服务器电源 | ¥1,000 | 用户确认单价 | `srv-01`/`srv-04`/`srv-05`/`srv-06` 各 1 个；NAS 使用 2 个长城服务器电源；均需复核机箱兼容、线材、冗余/并联方式、质保和接口实物。 |
| HBA/网卡/交换机/防火墙/UPS | 预算价 | 待复核 | 必须确认 10GbE、VLAN、LACP、日志外送、VPN/MFA、SNMP/监控。 |

#### 5.25.12 规格来源与验收项

| 硬件 | 参数 | 本方案采用方式 |
|---|---|---|
| Intel Xeon 676X | 32 P-core / 64 线程、144MB Cache、2.80GHz 基础频率、4.90GHz 最大睿频、275W 基础功耗、330W 最大睿频功耗、DDR5-6400/MRDIMM-8000、8 通道内存、最大 4TB、PCIe 5.0、128 lanes、FCLGA4710、Q1 2026 发布。来源: <https://www.intel.com/content/www/us/en/products/sku/244099/intel-xeon-676x-processor-144m-cache-2-80-ghz/specifications.html> | `srv-01` CDE/API/数据库和 `srv-03` BIM/IFC/开放格式模型派生使用 676X；散热和供电按 330W 峰值预留,不按 275W 做极限配置。 |
| Intel Xeon 658X | 24 P-core / 48 线程、144MB Cache、3.00GHz 基础频率、4.90GHz 最大睿频、250W 基础功耗、300W 最大睿频功耗、DDR5-6400、8 通道内存、最大 4TB、ECC、PCIe 5.0、128 lanes、FCLGA4710、Q1 2026 发布。来源: <https://www.intel.com/content/www/us/en/products/sku/244337/intel-xeon-658x-processor-144m-cache-3-00-ghz/specifications.html> | `srv-02` NAS/CDE 文件、`srv-04` CI/通用 Worker、`srv-05` App/API/队列、`srv-06` JumpServer/日志/审计使用 658X。NAS 用 658X 足够。 |
| 技嘉 MW94-RP0 | Intel Xeon 600 Workstation、W890、1 x LGA4710-2、8 通道 DDR5 RDIMM/MRDIMM、8 DIMM、RDIMM 6400MT/s、MRDIMM 8000MT/s、2 x 10GbE Intel X710-AT2、1 x 管理网口、ASPEED AST2600 BMC、2 x MCIO 8i Gen5 x8、1 x SlimSAS 8i Gen4 x8、2 x SlimSAS 4i for 8 x SATA、4 x M.2 2280/22110 Gen5 x4、E-ATX 304.8 x 330.2mm。来源: <https://download.gigabyte.com/FileList/DataSheet/GIGABYTE%20MW94-RP0%20%28Rev.%201.x%29_datasheet.pdf> | `srv-02` 直接用板载 2 x 10GbE 和 2 x SlimSAS 4i 接 8 x SATA,所以一期不买 10GbE 网卡、不买 HBA；PM9A3 若选 M.2 形态则走板载 M.2。 |
| Samsung PM9A3 960GB | 数据中心 SSD、PCIe Gen4/NVMe,E1.S、U.2、M.2 形态；最高顺序读 6,800MB/s、最高随机写 200,000 IOPS。来源: <https://semiconductor.samsung.cn/ssd/datacenter-ssd/pm9a3/> | 两台服务器各 2 块 960GB 做系统盘镜像。下单必须明确 M.2 或 U.2,不再写 U.3；U.2 形态需要线缆/转接方案,M.2 形态走 MW94-RP0 板载 M.2。 |
| NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe | HPE QuickSpecs 列出 NVIDIA RTX PRO 6000D Blackwell Server Edition 84GB PCIe Accelerator for HPE,型号 S6W21C；规格包括 84GB GDDR7、1398GB/s Memory Bandwidth、PCIe Gen5 x16、最高 2 MIG、600W,销售区域标注为 China/Hong Kong/Macau。来源: <https://www.hpe.com/psnow/downloadDoc/NVIDIA%20Accelerators%20for%20HPE%20QuickSpecs-c04123180.pdf?contentDisposition=attachment&deepLink=&form=false&hf=regular&id=c04123180.pdf&isFutureVersion=true&isLinearized=false&originalObjectName=&prelaunchSection=&preview=false&print=&r=&section=&softrollSection=&ver=78> | BIM GPU 专项另购 2 张。验收重点不是只看显存,而是服务器平台是否支持双卡 1200W GPU 峰值供电、持续风道、PCIe 带宽、驱动、容器运行时、温度监控和故障告警。 |
| Toshiba MG11 22TB | 22TB、3.5-inch、1GiB Buffer、7200rpm、MTTF/MTBF 2,500,000h(AFR 0.35%)、最大 730g、CMR、FC-MAMR、氦封、550TB/年 workload、SATA 6Gbps 或 SAS 12Gbps,22TB 标准型号包括 SATA `MG11ACA22TE` 和 SAS `MG11SCA22TE`。来源: <https://toshiba.semicon-storage.com/us/storage/product/data-center-enterprise/cloud-scale-capacity/articles/mg11-series.html> | `srv-02` 一期 4 块,离线备份 2 块。当前不买 HBA,采购优先锁 SATA `MG11ACA22TE`; 若采购为 SAS `MG11SCA22TE`,必须补 SAS HBA 和线缆,不能直接按 SATA 接线验收。 |
| 银昕 CS383 NAS 机箱 | 8 个热插拔盘托,支持 8 x 3.5/2.5 英寸 SAS-12G/SATA-6G 硬盘；支持 E-ATX/SSI-EEB 主板、420mm 水冷排、340mm 扩展卡、8 个 PCI 扩展槽,前置 USB-C/USB 3.0/音频。来源: <https://silverstone.en.taiwantrade.com/product/cs383-2950830.html> | 与 MW94-RP0 的 E-ATX 尺寸匹配,一期装 4 块 MG11,预留 4 盘位；下单验收必须确认背板线缆、风扇、硬盘散热和 CPU 散热器高度。 |
| 长城黑匣子 3200W ATX3.1 电源 | 铂金+CQC-IV、ATX 3.1、输入电压 198-264VAC、14cm 风扇、CQC 认证、I/O 开关、工作海拔 ≤5000m、典型载效率 >94%、全模组、ATX 24PIN 线长 600mm、CPU 线长 650mm/接口 2 个、PCI-E 6+2 线长 600mm/接口 8 个、PCIe 5.1 线长 675mm/接口 4 个、SATA 接口 15 个、L4P 接口 6 个、S4P 无、尺寸 175x150x86mm。 | `srv-03` BIM/IFC/开放格式模型派生节点使用该 3200W 电源承接 2 张 RTX PRO 6000D。它仍是 ATX 单电源,不是服务器双冗余热插拔电源；采购验收必须核对 SKU、线材数量、接口实物、CQC/质保、发票、机箱安装兼容和双卡持续负载温度。 |

#### 5.25.13 十页浓缩版对齐: 六节点 CPU 试点包

十页汇报版采用的“一期 6 台 CPU 服务器”不是高可用生产机房口径,而是 L2+/L3 试点轻量包:2 台 Xeon 676X 用于 CDE/API/数据库和 BIM/IFC/开放格式模型派生关键节点,4 台 Xeon 658X 用于 NAS、通用 Worker、应用队列、堡垒机、日志和审计。每台服务器至少 64GB ECC RDIMM；非数据库真源盘、非关键 Worker 和缓存盘可选英睿达/美光 T710 Pro 4TB。BIM 节点使用长城黑匣子 3200W 电源和长城黑匣子 15 机箱；NAS 使用热插拔 NAS 机箱和 2 个长城服务器电源；其它非 NAS/非 BIM 节点按服务器机箱 ¥1,000、服务器电源 ¥1,000 暂列。CPU 包本身不含 HA；BIM 硬件另购 2 张 RTX PRO 6000D 84GB 服务器版显卡,显卡小计 ¥136,000。

| 节点 | 面向类型 | 工作内容 | 硬件配置 | 核心物料小计 | 边界 |
|---|---|---|---|---:|---|
| `srv-01-cde-api-db` | 核心数据与服务入口节点 | CDE 元数据、API Gateway、PostgreSQL、Outbox、ModelRouter、权限、审计事件 | Xeon 676X x1；MW94-RP0；64GB ECC RDIMM；PM9A3 960GB x2；服务器机箱 ¥1,000；服务器电源 ¥1,000 | ¥57,450 | 数据库热数据仍需备份到 NAS；不是 HA 主从。 |
| `srv-02-nas-cde-backup` | NAS、备份、CDE 文件节点 | CDE 源文件、IFC/STL/STEP/USDZ/OpenUSD、图纸、BOM 派生物、数据库备份、离线归档 | Xeon 658X x1；MW94-RP0；64GB ECC RDIMM；PM9A3 960GB x2；MG11 22TB x4；热插拔 NAS 机箱 ¥1,800；长城服务器电源 x2,小计 ¥2,000 | ¥81,000 | NAS 用 658X 足够；电源需复核机箱兼容和冗余方式；RAIDZ1/RAID5 只容忍单盘故障。 |
| `srv-03-bim-ifc-derivative` | BIM、IFC、开放格式模型派生节点 | 模型生成草稿、IFC/STL/STEP/USDZ/OpenUSD 导出、模型导出图纸、模型导出构件 BOM、Validate 校验 | Xeon 676X x1；MW94-RP0；64GB ECC RDIMM；T710 Pro 4TB x1；长城黑匣子 15 机箱 ¥2,000；长城黑匣子 3200W 电源 ¥4,000 | ¥57,650 | BIM GPU 另购 2 张；只生成草稿和派生物,正式产物写回 CDE/NAS,经审批发布。 |
| `srv-04-ci-general-worker` | CI、通用解析和批处理节点 | Office/PDF/CAD 解析、批量导入、Schema 校验、CI、测试数据库、任务执行 | Xeon 658X x1；MW94-RP0；64GB ECC RDIMM；T710 Pro 4TB x1；服务器机箱 ¥1,000；服务器电源 ¥1,000 | ¥45,800 | Worker 不直接写真源库,结果经 Gateway 入库。 |
| `srv-05-app-api-queue` | 应用、API、任务队列节点 | 模块应用服务、内部 API、任务队列、缓存、Search/Vector 辅助服务、试点入口 | Xeon 658X x1；MW94-RP0；64GB ECC RDIMM；T710 Pro 4TB x1；服务器机箱 ¥1,000；服务器电源 ¥1,000 | ¥45,800 | 与数据库、NAS 分离,但不承诺公网生产 SLA。 |
| `srv-06-jump-log-audit` | 堡垒机、日志、审计和监控节点 | 开源 JumpServer、运维入口、日志、监控、备份校验、只读审计、审计报表 | Xeon 658X x1；MW94-RP0；64GB ECC RDIMM；T710 Pro 4TB x1；服务器机箱 ¥1,000；服务器电源 ¥1,000 | ¥45,800 | 只开堡垒入口和审计出口,不承载业务写流量。 |
| CPU 合计 | 2 x 676X + 4 x 658X | 六节点核心物料 | - | **¥333,500** | 网络、防火墙、UPS、机柜、线材、散热和实施另按 5-9 万预留,合计约 38-42 万。 |
| BIM GPU 专项另购 | RTX PRO 6000D 84GB Server Edition | 2 张 GPU 加速卡 | 2 x ¥68,000 | **¥136,000** | 不含如需追加的 GPU 合规服务器、导风罩、电源线、商业驱动/软件授权；不能替代 OpenBIM 校验和认证证据。 |
| CPU + GPU 已确认口径 | 六节点 CPU 核心物料 + BIM GPU | 已确认硬件物料小计 | - | **¥469,500** | 加上网络/安全/供电/实施 5-9 万后,总预算约 ¥519,500-¥559,500。 |

采购决策按两条线保留:

| 方案 | 适用阶段 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| 两节点保守包 | L2 内部生产力,30 人团队,100 用户内测 | 采购简单,单机内存更充足,预算已按 ¥395,350 复核 | CI、数据库、Agent、CDE 和审计容易抢资源；单点多 | 可作为最小落地包。 |
| 六节点轻量包 | L2+/L3 试点,需要拆分 CDE、Worker、应用、审计故障域 | 故障域更清晰,更贴合十页汇报版和 100/1000 用户试点 | 运维节点更多,报价需重新截图锁价；GPU 上架还需额外验收 | 推荐作为当前汇报和试点目标包。 |
| BIM GPU 专项包 | BIM/IFC/STEP/STL/USDZ/OpenUSD 派生、模型导图、构件 BOM、局部推理和渲染加速 | 2 张 84GB 服务器版 GPU 可先支撑重型派生实验 | 需要确认目标服务器双卡供电、散热、PCIe、驱动和温度监控 | 按用户确认价立即纳入硬件预算,但不替代 OpenBIM 校验/认证证据。 |
| GPU/HA 生产包 | 1 万公网生产、HA、多租户 SLA、大规模本地推理 | 支撑重负载和 SLA | 预算超出 40-50 万 CPU 基础包 | 二期/三期单独立项。 |

### 5.26 AI 生成 BIM、模型派生与员工智能体集群

本节把“AI 生成 BIM 模型、模型导出施工和加工图纸、模型导出 BOM、BOM 驱动算量/材料/客服报价、针对业务和员工打造智能体集群”落成系统边界。核心原则不变:AI 可以生成草稿、候选方案、校验建议和待办,不得直接发布可施工、可加工、可采购、可付款、可归档结论。

#### 5.26.1 正向工程主线

```text
客服/客户文字/会议/合同/照片/现场条件
  -> RequirementParser
  -> requirement_parameter / component_constraint
  -> ModelPlanner
  -> IFC/STL/STEP/USDZ/OpenUSD model draft
  -> IFC + IDS + bSDD/SJG157 + Validate + BCF gate
  -> construction_drawing / fabrication_drawing
  -> component_bom_line
  -> boq_item / material_requisition / quote_line
  -> purchase_request / work_order / site_acceptance / archive_package
```

| 阶段 | 输入 | AI/Worker 动作 | 输出对象 | 发布门禁 |
|---|---|---|---|---|
| 需求抽取 | 客服记录、微信/电话纪要、客户文字、合同、照片、现场条件 | 抽取空间、尺寸、功能、预算、工期、材料倾向、约束和风险 | `demand_item`, `requirement_parameter` | 必须有来源文件、客户/责任人、项目、版本和审计。 |
| 模型规划 | 需求参数、构件库、材料库、连接规则、SJG157/bSDD 映射 | 拆分楼层、空间、构件、连接、材料和阶段 | `model_plan`, `component_constraint` | 冲突项必须生成待确认项或 BCF 议题。 |
| 模型生成 | `model_plan`, 构件约束, 规则库 | 生成 IFC/STL/STEP/USDZ/OpenUSD 模型草稿、构件几何、属性和关系 | `ifc_model`, `model_element`, `property_set`, `format_package` | 不能直接发布；必须经 IFC/IDS/规则/语义校验。 |
| 施工图派生 | 已校验模型、图纸模板、专业规则 | 生成平面、立面、剖面、节点、安装定位、图号和标注草稿 | `construction_drawing`, `drawing_sheet` | 专业负责人复核、图纸版本、模型引用和审批齐全后发布。 |
| 加工图派生 | 已校验模型、构件对象、加工规则 | 生成构件编号、下料尺寸、孔位、连接、焊接/紧固、工艺路线和二维码 | `fabrication_drawing`, `fabrication_part` | 无材料等级、尺寸公差、图纸引用或质检规则时不得下发生产。 |
| BOM 派生 | 模型构件、属性集、SJG157、材料库、图纸索引 | 计算类目、编码、规格、长度、数量、单重、总重、损耗和备注 | `component_bom_line` | 无模型构件、分类、重量、图纸引用或校验结果时阻断发布。 |
| 算量/材料/报价 | 已发布 BOM、图纸、工程量规则、价格库、税费规则 | 生成 BOQ、材料需求、损耗、价格、报价版本和差异 | `boq_item`, `material_requisition`, `quote_line` | 价格来源、规则版本和审批缺失时只能输出待确认草稿。 |
| 采购/生产/施工 | 已发布 BOM/图纸/材料需求/工单 | 生成请购、排产、下料、质检、包装、发运、安装、整改和验收证据 | `purchase_request`, `work_order`, `acceptance_record` | 未审批、未关闭 BCF/质检问题或无归档证据时不得完成闭环。 |

#### 5.26.2 模型导出施工图与加工图

| 图纸类型 | 必须包含 | 来源对象 | 禁止事项 |
|---|---|---|---|
| 施工图 | 平面/立面/剖面、轴网、安装定位、节点详图、材料说明、图号、版本、审签、验收点 | `model_element`, `drawing_sheet`, `project_stage`, `approval_task` | 不能由 AI 文本直接出发布图；不能脱离模型构件和审批签发。 |
| 加工图 | 构件编号、尺寸、孔位、连接方式、材料等级、焊接/紧固要求、工艺路线、二维码、质检项 | `model_element`, `fabrication_part`, `component_bom_line`, `work_order` | 不能用报价清单替代加工图；无公差、材料和质检规则时不得下发生产。 |
| 变更图 | 变更原因、原版本、新版本、影响构件、影响 BOM、影响报价、责任人和审批 | `change_record`, `drawing_revision`, `bom_version`, `quote_version` | 不得覆盖原图；必须保留差异和回滚路径。 |

施工图和加工图是模型派生物,不是新的事实来源。图纸页可以带人工补充标注,但每个构件、尺寸、材料、数量和状态必须能回跳到 `model_element_id`、`bom_line_id` 和审批记录。

#### 5.26.3 BOM 在算量、材料和客服报价中的应用

| 应用环节 | BOM 如何使用 | 输出 | 校验 |
|---|---|---|---|
| 算量/BOQ | 按模型构件、尺寸、数量、重量、损耗和工程量规则生成工程量清单 | `boq_item`, `cost_item` | 必须记录规则版本、单位、价格来源、税费、损耗和差异。 |
| 材料需求 | 按材料等级、规格、长度、库存、供应商、交期和损耗归并 | `material_requisition`, `purchase_request` | 客服报价口径不得直接下单；采购必须基于已发布 BOM/材料需求。 |
| 客服报价 | 从已校验 BOM/BOQ 和价格库生成报价版本,支持客户确认、议价和变更对比 | `quote_version`, `quote_line` | 缺价格来源、成本边界或审批时只能是报价草稿。 |
| 生产加工 | BOM 行拆成加工件、批次、工艺路线、质检项和包装发运对象 | `work_order`, `fabrication_part`, `qc_record` | 加工件必须绑定模型构件、加工图、材料批次和质检记录。 |
| 施工发料 | 按楼层、空间、构件组、安装顺序和现场进度发料 | `site_issue`, `installation_task` | 发料、安装和验收必须回挂模型构件和照片/视频证据。 |
| 财务结算 | 已验收 BOM/BOQ/变更作为结算依据之一 | `settlement_line`, `invoice_support` | 未验收、未审批或证据缺失不得进入付款/入账结论。 |

#### 5.26.4 面向业务和员工的 Agent 集群

Agent 集群按岗位服务员工,不是替代员工责任。每个 Agent 必须继承员工角色、项目权限、工具权限、数据范围和审批矩阵；跨岗位动作必须通过 Workflow、Outbox 和审批任务。

| Agent | 服务员工/岗位 | 输入 | 工具 | 输出 | 禁止事项 |
|---|---|---|---|---|---|
| `CustomerRequirementAgent` | 客服、销售、项目经理 | 客户对话、会议纪要、合同、照片、现场条件 | OCR、会议解析、合同抽取、RAG、需求模板 | 需求项、风险、预算边界、报价草稿 | 不得承诺价格、工期、合规和施工可行性。 |
| `DesignModelAgent` | 方案设计、深化设计、BIM 工程师 | 需求参数、构件库、材料库、连接规则 | GeometryRouter、IFC/OpenUSD exporter、RuleChecker | BIM/IFC 模型草稿、构件对象、属性集 | 不得直接发布模型、图纸或 BOM。 |
| `DrawingBomAgent` | 深化设计、加工技术、BOM 工程师 | 已校验模型、图纸模板、BOM 字段规则 | drawing_export、fabrication_drawing_export、model_export_bom | 施工图草稿、加工图草稿、BOM 草稿 | 不得绕过模型构件写 BOM 或下发图纸。 |
| `CostQuoteAgent` | 造价、客服报价、经营负责人 | BOM、图纸、BOQ 规则、价格库、税费规则 | boq_calc、quote_builder、change_compare | BOQ、报价版本、成本差异、变更影响 | 不得无价格来源出正式报价。 |
| `MaterialProcurementAgent` | 材料、采购、仓库 | 已发布 BOM、库存、供应商、交期、损耗 | material_rollup、supplier_match、purchase_request | 材料需求、请购草稿、到料风险 | 不得直接下单、付款或改供应商主数据。 |
| `ProductionSiteAgent` | 生产计划、质检、施工队长、现场工程师 | 图纸、BOM、工单、质检项、现场照片、员工工时 | work_order_split、qc_check、site_acceptance | 工单、质检、整改、验收、工时草稿 | 不得关闭未复核质量问题。 |
| `ArchiveFinanceAgent` | 档案、财务、人力、管理层 | 已验收对象、审批、审计、合同、发票、工时 | archive_pack、settlement_support、audit_query | 归档包、结算证据、经营日报 | 不得直接入账、付款、调薪或改合同。 |
| `GovernanceAgent` | 管理层、系统管理员 | 全模块事件、审计、规则缺口、异常 | policy_check、risk_report、cost_metering | 风险清单、规则缺口、权限建议 | 不得直接提升权限或删除审计。 |

#### 5.26.5 智能体数量与打造规则

Agent 数量不是越多越好,也不能先拍脑袋定 200 个。ArchIToken 按“业务对象 x 岗位责任 x 工具边界 x 审批风险”拆 Agent。当前建议:

| 阶段 | Agent 数量 | 目标 | 典型覆盖 | 不做什么 |
|---|---:|---|---|---|
| P0 架构落地 / 0-3 个月 | 24-32 个 | 打通一条真实工程链,证明 AI 员工可控 | 客服需求、设计建模、图纸/BOM、算量报价、材料采购、生产施工、档案财务、治理审计 | 不追求全岗位全场景,不做 200 个空壳 Agent。 |
| P1 商业试点 | 80-120 个 | 覆盖 16 模块的岗位 Copilot、校验 Agent 和流程 Agent | 每个模块至少有导入/生成/校验/审批/归档类 Agent | 不把所有 Agent 同时跑成模型推理负载。 |
| P2 成熟生产 | 160-200 个 | 按专业、地区、项目类型、材料品类、审批角色细分 | 专业 Agent、区域 Agent、供应链 Agent、经营 Agent、安全治理 Agent | 不允许脱离权限、规则、审批和审计单独行动。 |

每个正式 Agent 必须满足以下 8 条,否则只能叫脚本、提示词或实验任务:

| 规则 | 必须定义 | 验收 |
|---|---|---|
| 服务岗位 | 服务哪类员工和岗位责任,例如客服、设计、BIM、造价、采购、生产、施工、档案、财务、人力、管理层 | Agent 继承员工角色、项目权限和审批矩阵。 |
| 输入对象 | 读取哪些对象,例如客户文字、合同、IFC、图纸、BOM、价格库、照片、工单 | 输入必须有来源、版本、hash 和访问权限。 |
| 输出对象 | 生成什么草稿或建议,例如需求项、模型草稿、施工图草稿、BOM 草稿、报价草稿、采购建议、验收记录 | 输出必须有 Schema、状态和回跳链。 |
| 工具权限 | 能调用哪些工具,例如 OCR、IFC exporter、drawing_export、model_export_bom、boq_calc、quote_builder | 只能通过 ToolRouter 调工具,不能直接改库或越权读文件。 |
| 模型路由 | 使用哪个模型路由和降级策略 | 统一走 ModelRouter/InferenceRouter,记录模型、成本、延迟和脱敏策略。 |
| 规则校验 | 需要哪些专业规则、SJG157、IDS、Validate、价格规则、审批规则 | 规则缺失时只能输出待确认或启发式建议。 |
| 人工审批 | 哪些输出必须由谁审批 | 未审批不得进入施工、加工、采购、报价、付款或归档 ready。 |
| 审计证据 | 记录输入 hash、输出 hash、工具调用、模型、成本、审批人和时间 | 任一 Agent 输出能回放、追责和复现。 |

AI 员工的系统形态是:

```text
AI 员工 = 岗位身份 + 权限边界 + 工作队列 + 工具集 + 模型路由 + 规则校验 + 审批链 + 审计记录
```

因此 P0 不应先做 200 个 Agent。先把 24-32 个关键 Agent 做成有输入、输出、工具、规则、审批、审计和测试的“可上岗员工”,再按模块和岗位复制扩展。

#### 5.26.6 员工工作台落点

| 工作台区域 | 员工看到什么 | 系统必须记录 |
|---|---|---|
| 个人待办 | 我的需求确认、模型复核、图纸审批、BOM 校验、报价审批、采购确认、验收复核 | `approval_task_id`, `assignee_id`, `due_at`, `decision`, `reason` |
| AI 面板 | 当前对象的 Agent 建议、引用文件、置信度、规则结果、风险和下一步 | `agent_run_id`, `input_hash`, `tool_call_id`, `model_route`, `output_hash` |
| 对象详情 | 需求、模型构件、图纸、BOM、BOQ、报价、工单、验收之间的回跳链 | `business_object_id`, `object_version_id`, `source_model_element_id` |
| 操作队列 | 正在导入、建模、校验、导图、导 BOM、算量、报价和归档的后台任务 | `operation_id`, `worker_id`, `status`, `artifact_uri`, `error_code` |
| 审计时间线 | 谁在何时用哪个 Agent/工具做了什么,是否审批,是否回滚 | `audit_event_id`, `actor_id`, `approval_id`, `before`, `after` |

验收标准:

- 输入一段客服需求后,系统能生成需求参数、模型计划、BIM/IFC 模型草稿、施工/加工图草稿、BOM 草稿、BOQ/报价草稿和待审批任务。
- 任意 BOM 行必须能回跳到模型构件、施工/加工图、分类字典、算量规则、材料需求、报价版本、校验报告、审批记录和 Agent 调用。
- 任意员工 Agent 输出必须带来源、工具、模型路由、输入/输出 hash、规则结果、审批状态和成本审计。
- 缺少专业规则、官方标准、价格来源、模型构件、图纸引用、质检证据或审批时,系统只能输出草稿/待确认/启发式建议,不得标记为施工、加工、采购、报价、付款或归档 ready。

---

## 6. 构件物料 BOM 输入文件与用途

| 文件 | 绝对路径 | 在 ArchIToken 中的作用 |
|---|---|---|
| SJG157 语义字典编码表 | `/home/insome/下载/建筑工程信息模型语义字典编码表_SJG157-2024.xlsx` | 构件、空间、建筑、系统的标准编码来源。BOM 的“类目名称”和“编码”必须从这里受控选择。 |
| 构件标准化命名规则 | `/home/insome/下载/装配式钢结构建筑构件标准化命名规则V1.0.xlsx` | `构件名称` 的命名语法来源,例如 `Beam_Main_H194x150x6.5x9_L3150_V0`。 |
| 应舍美居构件物料清单 | `/home/insome/下载/应舍美居_构件物料清单.xlsx` | 当前 BOM 模板。数据库、前端、Agent 和校验规则必须围绕这个表设计。 |

---

## 7. 构件物料 BOM 源表结构

### 7.1 SJG157 语义字典编码表

Workbook 结构:

| Sheet | 行数 | 列数/字段 | 内容 |
|---|---:|---|---|
| `总览` | 8 | 板块编号、板块名称、表代码、类目数量、对象分类依据、对应 IFC 大类 | SJG157 总览 |
| `A1_建筑` | 608 | 序号、编码、类目名称、层级 | 建筑类目 606 条 |
| `A2_空间` | 1477 | 序号、编码、类目名称、层级 | 空间类目 1475 条 |
| `A3_构件` | 3413 | 序号、编码、类目名称、层级 | 构件类目 3411 条 |
| `A4_系统` | 188 | 序号、编码、类目名称、层级 | 系统类目 186 条 |
| `全部类目索引` | 5680 | 序号、板块、编码、类目名称、层级 | 全部 5678 条索引 |

总览内容:

| 板块编号 | 板块名称 | 表代码 | 类目数量 | 对象分类依据 | 对应 IFC 大类 |
|---|---|---:|---:|---|---|
| A.1 | 建筑 | 10 | 606 | GB/T 51269 表 A.0.1 按功能分建筑物 | IfcBuilding |
| A.2 | 空间 | 12 | 1475 | GB/T 51269 表 A.0.3 按功能分建筑空间 | IfcSpace |
| A.3 | 构件 | 30 | 3411 | GB/T 51269 表 A.0.10 建筑产品 | IfcElement |
| A.4 | 系统 | 16 | 186 | GB/T 51301 附录 A 模型单元系统分类 | IfcSystem |

BOM 需要用的是 A.3 构件类目,但后续也要支持 A.1 建筑、A.2 空间、A.4 系统与构件的关联。

### 7.2 装配式钢结构构件标准化命名规则

Workbook 结构:

| Sheet | 核心内容 |
|---|---|
| `通用命名总则` | 核心公式: `构件类型_等级属性_规格型号_尺寸参数_楼层/位置_版本号` |
| `主体钢构件命名规则` | 梁、柱、檩条等主体钢构件公式 |
| `围护配套构件命名规则` | 檐沟、门窗固定件等 |
| `机电部品构件命名规则` | 给排水、电气、卫浴等 |
| `紧固件构件命名规则` | 预埋螺栓、高强螺栓、自攻螺钉、普通螺丝、普通螺栓 |
| `钢结构连接件命名规则` | 接头、钣金折弯件、角码等 |
| `钢楼梯系统构件命名规则` | 楼梯梁、踏步板、扶手、玻璃栏板、连接件等 |
| `版本号规则说明` | V0/V1/V2/V3 版本含义 |

通用命名规则:

| 字段 | 说明 | 示例 |
|---|---|---|
| 构件类型 | 英文固定缩写或全称 | `Beam`, `Column`, `Purlin`, `Fastener`, `Connect` |
| 等级属性 | 主次、承重、构造、功能属性 | `Main`, `Sub`, `Struct`, `Roof`, `Wall` |
| 规格型号 | 型材标准规格、材质型号、品类编号 | `H194x150x6.5x9`, `S200x200x8x12`, `M20` |
| 尺寸参数 | 长度、高度、宽度、直径等 | `L3150`, `H3600`, `DN50` |
| 楼层/位置 | 安装楼层、方位、区域 | `F1`, `F2`, `FRoof`, `Wall` |
| 版本号 | 标准款或改制款 | `V0`, `V1`, `V2` |

### 7.3 应舍美居构件物料清单

Workbook 结构:

| Sheet | 行数 | 内容 |
|---|---:|---|
| `类目参照` | 136 | 从 SJG157 A.3 构件中抽出的可选类目,用于 BOM 类目名称与编码联动 |
| `物料清单` | 23 | 实际构件物料清单模板,其中第 5 行是字段表头,第 6-19 行是数据,第 21 行合计 |

`物料清单` 第 5 行字段 A-Q:

| Excel 列 | 字段 | 数据库字段 | 说明 |
|---|---|---|---|
| A | 序号 | `line_no` | 行号 |
| B | 类目名称 | `category_name` | 来自 SJG157 类目 |
| C | 编码 | `category_code` | SJG157 编码,应由类目名称自动联动 |
| D | 构件名称 | `component_name` | 按命名规则生成的英文构件名 |
| E | 截面尺寸 | `section_size` | 型钢、板件、螺栓等截面或规格 |
| F | 长度 | `length_mm` | mm |
| G | 位置 | `location_code` | F1/F2/Roof/Wall/全楼等 |
| H | 材料等级 | `material_grade` | Q355D/Q235B/10.9S 等 |
| I | 规格型号 | `spec_model` | 截面 + 长度组合 |
| J | 图号 | `drawing_no` | 图纸编号 |
| K | 层次 | `level_no` | 楼层或层次 |
| L | 单位 | `unit` | PCS/SET 等 |
| M | 单套数量 | `qty_per_set` | 单套数量 |
| N | 总数量 | `total_qty` | 总数量 |
| O | 单套重量(kg) | `unit_set_weight_kg` | 当前模板为空,需计算或录入 |
| P | 总重量(kg) | `total_weight_kg` | 当前模板为空,需计算或录入 |
| Q | 备注 | `remark` | 备注 |

当前清单数据行共 14 行,合计数量为 470。

---

## 8. 当前应舍美居 BOM 数据

| 序号 | 类目名称 | 编码 | 构件名称 | 截面尺寸 | 长度 | 位置 | 材料等级 | 规格型号 | 图号 | 层次 | 单位 | 单套数量 | 总数量 |
|---:|---|---|---|---|---:|---|---|---|---|---:|---|---:|---:|
| 1 | 铜管 | 30-03.70.20 | `Column_Main_H150X150X7X10_L5694_F1立柱_V0` | 150X150X7X10 | 5475 | F1立柱 | Q355D | H150X150X7X10_L5694 | 10118058 | 1 | PCS | 4 | 4 |
| 2 | 焊接H型钢柱 | 30-03.95.03.15 | `Column_Main_H200X200X8X12_L4200_F1_V0` | 200X200X8X12 | 4200 | F1 | Q355D | H200X200X8X12_L4200 | 10118059 | 1 | PCS | 6 | 6 |
| 3 | 焊接H型钢柱 | 30-03.95.03.15 | `Column_Main_H250X250X9X14_L4200_F2_V0` | 250X250X9X14 | 4200 | F2 | Q355D | H250X250X9X14_L4200 | 10118060 | 2 | PCS | 8 | 8 |
| 4 | 目字形钢柱 | 30-03.95.03.40 | `Beam_Main_H194X150X6.5X9_L6200_F1_V0` | 194X150X6.5X9 | 6200 | F1 | Q355D | H194X150X6.5X9_L6200 | 20118061 | 1 | PCS | 12 | 12 |
| 5 | 焊接H型钢梁 | 30-03.95.09.15 | `Beam_Sub_H150X100X5X7_L4500_F1_V0` | 150X100X5X7 | 4500 | F1 | Q355D | H150X100X5X7_L4500 | 20118062 | 1 | PCS | 10 | 10 |
| 6 | 目字形钢柱 | 30-03.95.03.40 | `Beam_Main_H300X150X6.5X9_L7500_F2_V0` | 300X150X6.5X9 | 7500 | F2 | Q355D | H300X150X6.5X9_L7500 | 20118063 | 1 | PCS | 6 | 6 |
| 7 | C型钢檩条 | 30-03.95.33.20.15 | `Purlin_Roof_C180X70X20X2.5_L6000_V0` | C180X70X20X2.5 | 6000 | Roof | Q235B | C180x70x20x2.5_L6000 | 30118064 | 1 | PCS | 30 | 30 |
| 8 | C型钢檩条 | 30-03.95.33.20.15 | `Purlin_Wall_C180X70X20X2.5_L5500_V0` | C180X70X20X2.5 | 5500 | Wall | Q235B | C180x70x20x2.5_L5500 | 30118065 | 1 | PCS | 25 | 25 |
| 9 | 钢拉条 | 30-03.95.33.30 | `Connect_TieRod_D12_L1200_F1_V0` | D12 | 1200 | F1 | Q235B | D12_L1200 | 40118066 | 1 | SET | 48 | 48 |
| 10 | 钢拉条 | 30-03.95.33.30 | `Connect_KneeBrace_L50X50X5_L600_F1_V0` | L50X50X5 | 600 | F1 | Q235B | L50x50x5_L600 | 50118067 | 1 | SET | 32 | 32 |
| 11 | 箱型钢柱 | 30-03.95.03.10 | `Column_Main_S200X200X8X12_H3600_F1_V0` | S200X200X8X12 | 3600 | F1 | Q355D | S200x200x8x12_H3600 | 10118068 | 1 | PCS | 5 | 5 |
| 12 | 螺栓 | 30-03.95.42.20.10 | `Fastener_HighStr_M20_L80_V0` | M20 | 80 | 全楼 | 10.9S | M20_L80 | 60118069 | 1 | SET | 200 | 200 |
| 13 | 钢结构锚栓 | 30-03.95.42.20.20 | `Fastener_Anchor_M24_L400_V0` | M24 | 400 | F0 | Q355D | M24_L400 | 60118070 | 1 | SET | 64 | 64 |
| 14 | 镀锌钢板 | 30-03.40.10.20 | `Plate_Galv_T6_L3000XW1500_F1_V0` | T6 | 3000 | F1 |  | T6_3000x1500 | 70118071 | 1 | PCS | 20 | 20 |

---

## 9. BOM 应用应解决的问题

### 9.1 核心能力

ArchIToken 应做的是“可审计、可校验、可追溯、可版本化”的构件物料 BOM:

| 能力 | Excel 当前状态 | ArchIToken 应实现 |
|---|---|---|
| 类目名称与编码联动 | Excel 下拉 / 公式 | 数据库外键 + API 校验 + 前端选择器 |
| 构件名称规范 | 人工输入 | 命名规则解析器 + 自动提示 + 命名 Agent |
| 截面/长度一致性 | 人工检查 | 自动解析构件名称并对比字段 |
| 重量 | 当前为空 | 型钢库/材料密度/公式计算 + 人工确认 |
| 版本 | 文件层面版本 | BOM 文档版本 + 行项版本 + 变更记录 |
| 审批 | 编制/审核/批准文本 | Module Transaction + Approver + 审计 |
| 来源 | Excel 文件 | 源 Excel + 图纸 + IFC + Agent trace |
| 下游 | 人工复制 | 造价、采购、生产、施工直接引用 issued 版本 |

### 9.2 必须自动抓出的现有数据问题

系统必须按规则输出以下数据质量问题:

| 行号 | 问题 | 规则 |
|---:|---|---|
| 1 | 类目名称是“铜管”,但构件名称是 `Column_Main...`,材料等级是 Q355D,与铜管类目冲突 | `category_name/category_code` 必须与 `component_name` 解析类型一致 |
| 1 | `构件名称` 和 `规格型号` 中为 `L5694`,但 `长度` 字段是 5475 | 名称、规格型号、长度字段必须一致 |
| 4 | 类目名称是“目字形钢柱”,但构件名称是 `Beam_Main...` | `Beam` 不能映射到“钢柱”类目 |
| 6 | 类目名称是“目字形钢柱”,但构件名称是 `Beam_Main...` | 同上 |
| 10 | 类目名称是“钢拉条”,但构件名称是 `Connect_KneeBrace...` | 需要确认 KneeBrace 是否归入拉条、支撑或连接件 |
| 14 | `材料等级` 为空 | 镀锌钢板应有材料/镀锌层或材质依据 |
| 1-14 | 单套重量、总重量为空 | 不能进入采购、生产、造价汇总最终态 |

校验结果不能直接改原表,应生成 `validation_result` 和 `fix_suggestion`,由设计/审核人员确认。

---

## 10. BOM 数据库模型

### 10.1 Schema 分区

建议新增 schema:

```sql
CREATE SCHEMA IF NOT EXISTS component_bom;
```

| 表 | 作用 |
|---|---|
| `component_bom.sjg157_categories` | 导入 SJG157 全部 5678 条类目 |
| `component_bom.naming_rule_sets` | 命名规则版本 |
| `component_bom.naming_rules` | 各 Sheet 中的命名公式、实例、释义 |
| `component_bom.bom_documents` | 一张构件物料清单的单据头 |
| `component_bom.bom_versions` | BOM 版本 |
| `component_bom.bom_lines` | A-Q 行项主表 |
| `component_bom.component_name_tokens` | 从构件名称解析出的 token |
| `component_bom.line_validation_results` | 行级校验结果 |
| `component_bom.weight_calculation_results` | 重量计算结果 |
| `component_bom.change_records` | 变更记录 |
| `component_bom.export_jobs` | 导出 Excel/PDF/归档包任务 |

### 10.2 SJG157 类目表

```sql
CREATE TABLE component_bom.sjg157_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_no      TEXT NOT NULL,
    section_name    TEXT NOT NULL,
    table_code      TEXT NOT NULL,
    category_code   TEXT NOT NULL,
    category_name   TEXT NOT NULL,
    category_name_raw TEXT NOT NULL,
    hierarchy_level TEXT NOT NULL,
    ifc_class       TEXT NOT NULL DEFAULT '',
    source_file_id  UUID,
    source_sheet    TEXT NOT NULL,
    source_row_no   INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_code)
);

CREATE INDEX idx_sjg157_categories_name
    ON component_bom.sjg157_categories USING gin (category_name gin_trgm_ops);
```

导入规则:

1. `A1_建筑` -> `section_no=A.1`, `section_name=建筑`, `ifc_class=IfcBuilding`。
2. `A2_空间` -> `section_no=A.2`, `section_name=空间`, `ifc_class=IfcSpace`。
3. `A3_构件` -> `section_no=A.3`, `section_name=构件`, `ifc_class=IfcElement`。
4. `A4_系统` -> `section_no=A.4`, `section_name=系统`, `ifc_class=IfcSystem`。
5. 类目名称要保留原始缩进 `category_name_raw`,同时保存去掉全角空格的 `category_name`。

### 10.3 命名规则表

```sql
CREATE TABLE component_bom.naming_rule_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_key    TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    version_label   TEXT NOT NULL,
    source_file_id  UUID,
    status          TEXT NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE component_bom.naming_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id     UUID NOT NULL REFERENCES component_bom.naming_rule_sets(id) ON DELETE CASCADE,
    source_sheet    TEXT NOT NULL,
    line_no         INTEGER NOT NULL,
    component_group TEXT NOT NULL,
    component_type_zh TEXT NOT NULL,
    naming_formula  TEXT NOT NULL,
    naming_example  TEXT NOT NULL,
    field_explanation TEXT NOT NULL DEFAULT '',
    remark          TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.4 BOM 单据头

```sql
CREATE TABLE component_bom.bom_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    module_id           TEXT NOT NULL REFERENCES modules(id) DEFAULT 'detailed_design',
    company_name        TEXT NOT NULL,
    document_title      TEXT NOT NULL DEFAULT '物料清单',
    project_name        TEXT NOT NULL DEFAULT '',
    document_no         TEXT NOT NULL DEFAULT '',
    document_date       DATE,
    request_department  TEXT NOT NULL DEFAULT '',
    applicant           TEXT NOT NULL DEFAULT '',
    prepared_by         TEXT NOT NULL DEFAULT '',
    reviewed_by         TEXT NOT NULL DEFAULT '',
    approved_by         TEXT NOT NULL DEFAULT '',
    note                TEXT NOT NULL DEFAULT '',
    source_file_id      UUID,
    status              TEXT NOT NULL DEFAULT 'draft',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.5 BOM 版本

```sql
CREATE TABLE component_bom.bom_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_document_id     UUID NOT NULL REFERENCES component_bom.bom_documents(id) ON DELETE CASCADE,
    version_no          INTEGER NOT NULL CHECK (version_no >= 1),
    version_label       TEXT NOT NULL,
    state               TEXT NOT NULL DEFAULT 'draft'
                        CHECK (state IN ('draft','validated','reviewing','approved','issued','archived','rejected','blocked')),
    source_version_id   UUID REFERENCES component_bom.bom_versions(id) ON DELETE SET NULL,
    change_reason       TEXT NOT NULL DEFAULT '',
    transaction_id      UUID REFERENCES module_transactions(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bom_document_id, version_no)
);
```

### 10.6 BOM 行项主表

这一张表必须严格覆盖 Excel A-Q 字段,再追加规范化字段。

```sql
CREATE TABLE component_bom.bom_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_version_id      UUID NOT NULL REFERENCES component_bom.bom_versions(id) ON DELETE CASCADE,
    line_no             INTEGER NOT NULL,
    category_name       TEXT NOT NULL,
    category_code       TEXT NOT NULL REFERENCES component_bom.sjg157_categories(category_code),
    component_name      TEXT NOT NULL,
    section_size        TEXT NOT NULL DEFAULT '',
    length_mm           NUMERIC(18,3),
    location_code       TEXT NOT NULL DEFAULT '',
    material_grade      TEXT NOT NULL DEFAULT '',
    spec_model          TEXT NOT NULL DEFAULT '',
    drawing_no          TEXT NOT NULL DEFAULT '',
    level_no            TEXT NOT NULL DEFAULT '',
    unit                TEXT NOT NULL DEFAULT '',
    qty_per_set         NUMERIC(18,3) NOT NULL DEFAULT 0,
    total_qty           NUMERIC(18,3) NOT NULL DEFAULT 0,
    unit_set_weight_kg  NUMERIC(18,6),
    total_weight_kg     NUMERIC(18,6),
    remark              TEXT NOT NULL DEFAULT '',
    parsed_component_type TEXT NOT NULL DEFAULT '',
    parsed_role         TEXT NOT NULL DEFAULT '',
    parsed_section      TEXT NOT NULL DEFAULT '',
    parsed_length_mm    NUMERIC(18,3),
    parsed_location     TEXT NOT NULL DEFAULT '',
    parsed_version      TEXT NOT NULL DEFAULT '',
    validation_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (validation_status IN ('pending','passed','warning','blocked')),
    review_required     BOOLEAN NOT NULL DEFAULT TRUE,
    source_sheet        TEXT NOT NULL DEFAULT '物料清单',
    source_row_no       INTEGER NOT NULL,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bom_version_id, line_no)
);
```

索引:

```sql
CREATE INDEX idx_component_bom_lines_version
    ON component_bom.bom_lines(tenant_id, bom_version_id, line_no);

CREATE INDEX idx_component_bom_lines_category
    ON component_bom.bom_lines(tenant_id, category_code, category_name);

CREATE INDEX idx_component_bom_lines_component_name
    ON component_bom.bom_lines USING gin (component_name gin_trgm_ops);

CREATE INDEX idx_component_bom_lines_drawing
    ON component_bom.bom_lines(tenant_id, drawing_no);
```

### 10.7 构件名称 token 表

```sql
CREATE TABLE component_bom.component_name_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_line_id     UUID NOT NULL REFERENCES component_bom.bom_lines(id) ON DELETE CASCADE,
    token_order     INTEGER NOT NULL,
    token_key       TEXT NOT NULL,
    token_value     TEXT NOT NULL,
    token_source    TEXT NOT NULL DEFAULT 'component_name_parser',
    confidence      NUMERIC(8,6) NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

示例:

`Column_Main_H200X200X8X12_L4200_F1_V0`

| token_order | token_key | token_value |
|---:|---|---|
| 1 | component_type | Column |
| 2 | role | Main |
| 3 | section | H200X200X8X12 |
| 4 | length | L4200 |
| 5 | location | F1 |
| 6 | version | V0 |

### 10.8 行级校验结果

```sql
CREATE TABLE component_bom.line_validation_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_line_id     UUID NOT NULL REFERENCES component_bom.bom_lines(id) ON DELETE CASCADE,
    rule_code       TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('info','warning','error','blocked')),
    message         TEXT NOT NULL,
    expected_value  TEXT NOT NULL DEFAULT '',
    actual_value    TEXT NOT NULL DEFAULT '',
    fix_suggestion  TEXT NOT NULL DEFAULT '',
    created_by_agent TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 11. BOM 校验规则

### 11.1 类目与编码联动

| 规则编号 | 规则 |
|---|---|
| `SJG-CODE-001` | `category_code` 必须存在于 `component_bom.sjg157_categories` |
| `SJG-CODE-002` | `category_name` 必须与 `category_code` 对应的 SJG157 名称一致 |
| `SJG-CODE-003` | 构件物料清单默认只允许选择 A.3 构件类目,除非业务明确允许建筑/空间/系统 |

### 11.2 构件名称语法

| 规则编号 | 规则 |
|---|---|
| `NAME-001` | 构件名称只能使用英文、数字、下划线、点和 X/x,不允许混入中文 |
| `NAME-002` | 必须能解析出构件类型和版本号 |
| `NAME-003` | V0/V1/V2/V3 必须符合版本号规则说明 |
| `NAME-004` | `component_type` 必须存在于命名规则表 |

### 11.3 字段一致性

| 规则编号 | 规则 | 示例 |
|---|---|---|
| `FIELD-SECTION-001` | `截面尺寸` 应与构件名称/规格型号中的截面一致 | `H200X200X8X12` |
| `FIELD-LENGTH-001` | `长度` 应与 `Lxxxx` 或 `Hxxxx` 一致 | L4200 -> 长度 4200 |
| `FIELD-LOC-001` | `位置` 应与构件名称中的位置字段一致 | F1/F2/Roof/Wall |
| `FIELD-QTY-001` | 总数量应等于单套数量乘以套数；若无套数字段,默认总数量=单套数量 |
| `FIELD-WEIGHT-001` | 单套重量和总重量为空时不能进入 `issued` |

### 11.4 类目与构件类型一致性

| 构件名称前缀 | 应匹配的类目范围 |
|---|---|
| `Column` | 钢柱、箱型钢柱、焊接 H 型钢柱等柱类 |
| `Beam` | 钢梁、焊接 H 型钢梁、主梁、次梁等梁类 |
| `Purlin` | 檩条 |
| `Fastener` | 螺栓、锚栓、螺钉、紧固件 |
| `Connect` | 连接件、拉条、支撑、节点件,需按规则细分 |
| `Plate` | 钢板、镀锌钢板、板件 |

---

## 12. BOM 前端应用设计

### 12.1 工作台入口

构件物料 BOM 进入统一工作台:

| 模块 | 入口 |
|---|---|
| `standard_library` | SJG157 类目库、命名规则库、构件模板库 |
| `detailed_design` | 构件物料清单主工作区,从图纸/模型/Excel 生成和修正 |
| `quantity_costing` | 读取 issued 构件清单进行工程量和造价 |
| `material_logistics` | 读取 approved/issued 构件清单生成采购、发运和到货 |
| `production_manufacturing` | 读取构件清单生成工单、工序、CNC、质检 |
| `construction_management` | 读取构件清单进行扫码安装、验收和整改 |
| `digital_archive` | 保存最终版 Excel、PDF、审计链和签审记录 |

### 12.2 构件物料清单界面

主界面使用生产表格:

| 区域 | 功能 |
|---|---|
| 顶部单据头 | 公司、项目名称、日期、NO、申请部门、申请人、编制、审核、批准 |
| 主表格 | A-Q 字段完整显示,支持 Excel 式编辑、筛选、排序、冻结列 |
| 类目选择器 | 选择类目名称后自动写入 SJG157 编码 |
| 构件名称解析器 | 实时拆解 `Column_Main_...` token |
| 校验面板 | 显示错误、警告、修复建议 |
| 重量计算面板 | 根据截面、长度、材料密度或型钢库计算重量 |
| 来源面板 | 源 Excel、图纸、IFC、Agent trace、修改人 |
| 版本面板 | V1/V2 差异、审批、发布、归档 |

### 12.3 界面约束

1. 主界面使用构件物料清单表格。
2. 主表格完整显示 Excel A-Q 字段。
3. 行项编辑、校验、审批、导出在同一工作台完成。
4. Agent 生成修复建议,人工确认后写入草稿。
5. 发布前必须完成行级校验、版本审批和审计记录。

---

## 13. BOM 智能体设计

### 13.1 Agent 列表

| Agent | 输入 | 输出 |
|---|---|---|
| `SJG157ImportAgent` | SJG157 xlsx | `sjg157_categories` |
| `NamingRuleImportAgent` | 命名规则 xlsx | `naming_rule_sets`, `naming_rules` |
| `ComponentBomImportAgent` | 应舍美居构件物料清单 xlsx | `bom_documents`, `bom_versions`, `bom_lines` |
| `CategoryCodeLinkAgent` | 类目名称/编码 | 自动联动、错配提示 |
| `ComponentNameParserAgent` | 构件名称 | token 化结果 |
| `ComponentBomValidationAgent` | BOM 行项 | validation results |
| `WeightCalculationAgent` | 截面、长度、材料等级、数量 | 单套重量、总重量建议 |
| `ComponentBomFixSuggestionAgent` | validation results | 修复建议 |
| `ComponentBomReviewAgent` | 整张 BOM | 审核报告、阻断项 |
| `ComponentBomExportAgent` | issued 版本 | Excel/PDF/归档包 |

### 13.2 Agent 输出边界

Agent 只能输出:

| 可输出 | 不可输出 |
|---|---|
| 草稿行项 | 自动审批 |
| 校验错误 | 擅自改源数据 |
| 修复建议 | 标记可生产 |
| 重量计算建议 | 自动付款/采购 |
| 审核报告 | 替代审核人签字 |

### 13.3 Agent 调用链

```text
上传 Excel
  -> ComponentBomImportAgent
  -> ComponentNameParserAgent
  -> CategoryCodeLinkAgent
  -> ComponentBomValidationAgent
  -> WeightCalculationAgent
  -> ComponentBomReviewAgent
  -> 人工审核/批准
  -> issued
  -> ExportAgent
```

---

## 14. BOM 工作流

### 14.1 导入工作流

```text
选择 Excel
  -> ObjectStore 保存源文件
  -> module_files 建档
  -> 读取 workbook/sheet/header
  -> 识别模板版本
  -> 写 bom_documents
  -> 写 bom_versions V1 draft
  -> 写 bom_lines
  -> 写 component_name_tokens
  -> 写 validation_results
  -> 返回导入报告
```

### 14.2 修正与审核

```text
draft
  -> validate
  -> warning / blocked
  -> 人工修正
  -> revalidate
  -> reviewing
  -> approved
  -> issued
```

### 14.3 下游使用

只有 `issued` 的构件物料 BOM 可以进入:

| 下游 | 使用字段 |
|---|---|
| 造价 | 类目、编码、构件名称、截面、长度、数量、重量 |
| 采购 | 材料等级、规格型号、数量、单位、重量 |
| 生产 | 构件名称、截面、长度、图号、位置、数量 |
| 施工 | 构件名称、图号、位置、层次、数量 |
| 档案 | 全字段、审批、导入源、导出文件 |

---

## 15. BOM API 设计

| 方法 | Endpoint | 用途 |
|---|---|---|
| POST | `/v1/component-bom/sjg157/import` | 导入 SJG157 编码表 |
| GET | `/v1/component-bom/sjg157/categories` | 查询类目 |
| POST | `/v1/component-bom/naming-rules/import` | 导入命名规则 |
| GET | `/v1/component-bom/naming-rules` | 查询命名规则 |
| POST | `/v1/component-bom/documents/import` | 导入构件物料清单 Excel |
| GET | `/v1/component-bom/documents` | BOM 单据列表 |
| GET | `/v1/component-bom/documents/{document_id}` | BOM 单据头 |
| GET | `/v1/component-bom/versions/{version_id}/lines` | 行项列表 |
| PATCH | `/v1/component-bom/lines/{line_id}` | 修改草稿行项 |
| POST | `/v1/component-bom/versions/{version_id}/validate` | 校验整张表 |
| GET | `/v1/component-bom/lines/{line_id}/validations` | 行级校验结果 |
| POST | `/v1/component-bom/versions/{version_id}/submit-review` | 提交审核 |
| POST | `/v1/component-bom/versions/{version_id}/approve` | 审核批准 |
| POST | `/v1/component-bom/versions/{version_id}/issue` | 发布 issued 版本 |
| POST | `/v1/component-bom/versions/{version_id}/export.xlsx` | 导出 Excel |

---

## 16. BOM 导入模板映射

### 16.1 应舍美居 BOM Sheet 映射

| Excel 区域 | 数据库 |
|---|---|
| Row 1 `应舍美居（深圳）科技有限公司` | `bom_documents.company_name` |
| Row 2 `物料清单` | `bom_documents.document_title` |
| Row 3 项目名称/日期/NO | `project_name`, `document_date`, `document_no` |
| Row 4 申请部门/申请人 | `request_department`, `applicant` |
| Row 5 A-Q 表头 | 模板字段校验 |
| Row 6-19 | `bom_lines` |
| Row 21 合计 | 导入校验,不作为行项 |
| Row 24 编制/审核/批准/日期 | `prepared_by`, `reviewed_by`, `approved_by` |
| Row 26 注释 | `bom_documents.note` |

### 16.2 类目参照 Sheet 映射

| Excel 字段 | 数据库 |
|---|---|
| 序号 | `source_row_no` |
| 板块 | `section_no/section_name` |
| 层级 | `hierarchy_level` |
| 编码 | `category_code` |
| 类目名称 | `category_name` |

该 Sheet 可以作为项目模板内置候选项,但最终仍应以完整 SJG157 字典表为准。

---

## 17. BOM 代码与文件落地

### 17.1 后端

| 文件 | 内容 |
|---|---|
| `04-backend/migrations/20260608000001_component_bom_schema.sql` | 新建 schema 和表 |
| `04-backend/harness-core/src/component_bom_types.rs` | DTO |
| `04-backend/harness-core/src/component_bom_service.rs` | 业务服务 |
| `04-backend/harness-core/src/component_bom_import.rs` | xlsx 导入任务接口 |
| `04-backend/harness-core/src/component_bom_validation.rs` | 校验规则 |
| `04-backend/harness-core/src/component_bom_export.rs` | 导出 |

### 17.2 前端

| 文件 | 内容 |
|---|---|
| `03-frontend/lib/component-bom-types.ts` | 类型 |
| `03-frontend/lib/component-bom-api-client.ts` | API client |
| `03-frontend/components/ComponentBomWorkbench.tsx` | 主工作台 |
| `03-frontend/components/ComponentBomGrid.tsx` | A-Q 表格 |
| `03-frontend/components/ComponentCategorySelector.tsx` | SJG157 类目选择器 |
| `03-frontend/components/ComponentNameInspector.tsx` | 构件名称解析 |
| `03-frontend/components/ComponentBomValidationPanel.tsx` | 校验结果 |
| `03-frontend/components/ComponentBomVersionPanel.tsx` | 版本和审批 |

### 17.3 Worker / Agent

| 文件 | 内容 |
|---|---|
| `06-workers/architoken_workers/component_bom_xlsx_reader.py` | 读取 xlsx |
| `06-workers/architoken_workers/component_name_parser.py` | 构件名称解析 |
| `06-workers/architoken_workers/component_bom_validator.py` | 校验 |
| `04-backend/agent-orchestrator/prompts/detailed_design/component_bom_importer.md` | 导入 Agent |
| `04-backend/agent-orchestrator/prompts/detailed_design/component_bom_reviewer.md` | 审核 Agent |

---

## 18. BOM 验收标准

| 验收项 | 标准 |
|---|---|
| SJG157 导入 | 5678 条类目可查询,A.3 构件可作为 BOM 下拉 |
| 命名规则导入 | 8 个 sheet 的公式和实例可查询 |
| 应舍美居 BOM 导入 | 14 条数据行、合计 470、A-Q 字段无丢失 |
| 自动联动 | 选择类目名称后编码自动写入 |
| 名称解析 | `Column_Main_H200X200X8X12_L4200_F1_V0` 可拆 token |
| 错误识别 | 能识别行 1 铜管/Column 错配和长度不一致 |
| 审批 | 未 approved 不能 issued |
| 导出 | issued 版本可导出为同模板 Excel |
| 审计 | 导入、修改、校验、审批、导出都有 AuditEvent |

---

## 19. BOM 落地顺序

```text
SJG157 类目字典导入
  -> 构件命名规则导入
  -> 应舍美居构件物料清单导入
  -> 构件名称解析
  -> 类目编码联动
  -> 行级校验
  -> 重量计算
  -> 人工修正
  -> 审批
  -> issued 版本
  -> Excel/PDF/归档包导出
```

---

## 20. BOM 实施蓝图

### 20.1 首期目标

| 目标 | 可交付结果 |
|---|---|
| 标准字典入库 | SJG157 全部类目可查询、可按板块筛选、可按编码和名称检索 |
| 命名规则入库 | 8 个命名规则 Sheet 可查询、可按构件类型匹配公式和示例 |
| 构件物料清单入库 | `应舍美居_构件物料清单.xlsx` 导入后形成单据头、版本、14 条行项、合计校验和源文件证据 |
| 行项校验 | 自动识别类目/编码错配、命名 token 错配、长度错配、材料等级缺失、重量缺失 |
| 工作台编辑 | 在 `detailed_design` 模块内用生产表格编辑 A-Q 字段,右侧显示校验和修复建议 |
| 审批发布 | 设计编制、复核、批准后形成 `issued` 版本,下游模块只读取 `issued` 版本 |
| 导出归档 | 导出同模板 Excel、PDF、校验报告、审计 JSON,进入 `digital_archive` |

### 20.2 落地边界

| 范围 | 本期处理 |
|---|---|
| 文件来源 | XLSX 源文件、SJG157 编码表、构件命名规则表、后续图纸/IFC 关联 |
| 数据真源 | PostgreSQL 结构化表 + ObjectStore 源文件 + AuditEvent |
| AI 边界 | Agent 负责抽取、解析、校验、建议；人工负责确认、审批、发布 |
| 模块入口 | `standard_library` 管标准字典和命名规则；`detailed_design` 管构件物料清单编制；`quantity_costing`、`material_logistics`、`production_manufacturing`、`construction_management`、`digital_archive` 读取已发布版本 |
| 状态门禁 | `draft -> validated -> reviewing -> approved -> issued -> archived` |

### 20.3 业务对象清单

| 对象 | 说明 | 主表 |
|---|---|---|
| 标准类目 | SJG157 建筑、空间、构件、系统类目 | `component_bom.sjg157_categories` |
| 构件命名规则 | 装配式钢结构构件标准化命名公式和示例 | `component_bom.naming_rule_sets`, `component_bom.naming_rules` |
| BOM 单据 | 一张构件物料清单的单据头 | `component_bom.bom_documents` |
| BOM 版本 | 同一单据的草稿、审核、发布版本 | `component_bom.bom_versions` |
| BOM 行项 | Excel A-Q 字段对应的构件明细 | `component_bom.bom_lines` |
| 构件 token | 从 `构件名称` 拆出的结构化 token | `component_bom.component_name_tokens` |
| 校验结果 | 每行每条规则的校验结果 | `component_bom.line_validation_results` |
| 重量结果 | 单套重量、总重量、公式和人工确认状态 | `component_bom.weight_calculation_results` |
| 变更记录 | 行项新增、修改、删除、版本差异 | `component_bom.change_records` |
| 导出任务 | Excel/PDF/归档包导出记录 | `component_bom.export_jobs` |

---

## 21. BOM 模块落位

### 21.1 16 模块中的职责

| 模块 | 对构件物料 BOM 的职责 | 读写权限 |
|---|---|---|
| `standard_library` 标准族库 | 维护 SJG157 类目、构件命名规则、材料等级、型钢规格库、重量公式库 | 读写标准库 |
| `detailed_design` 深化设计 | 编制构件物料清单、关联图纸/IFC、修正校验问题、提交复核 | 读写 BOM 草稿 |
| `quantity_costing` 计量造价 | 读取 `issued` BOM 生成工程量、材料量和成本测算 | 只读已发布 BOM,写造价对象 |
| `material_logistics` 材料物流 | 读取 `issued` BOM 生成采购计划、到货计划、批次追踪 | 只读已发布 BOM,写采购/物流对象 |
| `production_manufacturing` 生产制造 | 读取 `issued` BOM 生成工单、下料单、质检单、包装发运清单 | 只读已发布 BOM,写生产对象 |
| `construction_management` 施工管理 | 读取 `issued` BOM 做现场扫码、安装确认、验收整改 | 只读已发布 BOM,写现场对象 |
| `digital_archive` 数字档案 | 接收最终 Excel、PDF、审计链、审批记录、校验报告 | 归档读写 |
| `ai_center` AI中心 | 管理 BOM Agent、模型路由、工具路由、评估报告 | 管 Agent 配置和运行记录 |
| `settings_center` 设置中心 | 管角色、权限、审批流、数据字典启用状态 | 管系统配置 |

### 21.2 业务状态机

| 状态 | 进入条件 | 允许动作 | 输出 |
|---|---|---|---|
| `draft` | 上传或新建 BOM | 编辑行项、运行解析、运行校验 | 草稿行项 |
| `validated` | 阻断级错误为 0 | 提交复核、导出草稿报告 | 校验报告 |
| `reviewing` | 设计负责人提交复核 | 审核通过、退回修改 | 审核意见 |
| `approved` | 复核人签审通过 | 发布、归档 | 审批记录 |
| `issued` | 批准人发布 | 下游引用、导出正式文件 | 发布版本 |
| `archived` | 项目阶段结束或版本关闭 | 查询、追溯、复制新版本 | 归档包 |

状态迁移写入 `module_transactions`、`approval_tasks`、`audit_events`。`bom_versions.transaction_id` 绑定本次生命周期事务。

### 21.3 数据流

```text
XLSX 源文件
  -> ObjectStore 保存原文件
  -> CDE file record
  -> ImportBatch
  -> 单据头 / 版本 / 行项
  -> 构件名称 token
  -> SJG157 类目联动
  -> 校验结果
  -> 重量结果
  -> 人工修正
  -> 审核批准
  -> issued 版本
  -> 造价 / 采购 / 生产 / 施工 / 档案
```

---

## 22. BOM 数据库落地

### 22.1 源文件与导入批次

```sql
CREATE TABLE component_bom.source_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id       TEXT NOT NULL REFERENCES modules(id),
    file_name       TEXT NOT NULL,
    object_key      TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    byte_size       BIGINT NOT NULL,
    sha256          TEXT NOT NULL,
    source_path     TEXT NOT NULL DEFAULT '',
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sha256)
);

CREATE TABLE component_bom.import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_file_id  UUID NOT NULL REFERENCES component_bom.source_files(id) ON DELETE CASCADE,
    importer        TEXT NOT NULL,
    workbook_kind   TEXT NOT NULL CHECK (workbook_kind IN ('sjg157','naming_rules','component_bom')),
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','completed_with_warnings','failed')),
    row_count       INTEGER NOT NULL DEFAULT 0,
    warning_count   INTEGER NOT NULL DEFAULT 0,
    error_count     INTEGER NOT NULL DEFAULT 0,
    report          JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);
```

导入器必须先写 `source_files` 和 `import_batches`,再写业务表。重复上传同一文件时按 `tenant_id + sha256` 命中已有源文件,导入批次仍要单独记录。

### 22.2 BOM 行项字段补强

`component_bom.bom_lines` 已覆盖 A-Q 字段。生产落地还需要追加以下字段:

```sql
ALTER TABLE component_bom.bom_lines
    ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES component_bom.source_files(id),
    ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES component_bom.import_batches(id),
    ADD COLUMN IF NOT EXISTS source_cell_range TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES component_bom.sjg157_categories(id),
    ADD COLUMN IF NOT EXISTS drawing_file_id UUID,
    ADD COLUMN IF NOT EXISTS model_element_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS procurement_item_id UUID,
    ADD COLUMN IF NOT EXISTS manufacturing_item_id UUID,
    ADD COLUMN IF NOT EXISTS construction_item_id UUID,
    ADD COLUMN IF NOT EXISTS archived_file_id UUID;
```

字段含义:

| 字段 | 含义 |
|---|---|
| `source_file_id` | 导入来源 XLSX |
| `import_batch_id` | 本次导入批次 |
| `source_cell_range` | Excel 源单元格范围,例如 `物料清单!A6:Q6` |
| `category_id` | SJG157 类目外键 |
| `drawing_file_id` | 图纸来源文件 |
| `model_element_id` | IFC/DWG/模型构件 ID |
| `procurement_item_id` | 下游采购行 |
| `manufacturing_item_id` | 下游生产行 |
| `construction_item_id` | 下游施工安装项 |
| `archived_file_id` | 发布后归档文件 |

### 22.3 规格与重量基础库

```sql
CREATE TABLE component_bom.material_grades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_code      TEXT NOT NULL UNIQUE,
    material_family TEXT NOT NULL,
    density_kg_m3   NUMERIC(18,6) NOT NULL,
    standard_ref    TEXT NOT NULL DEFAULT '',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE component_bom.section_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_key     TEXT NOT NULL UNIQUE,
    profile_type    TEXT NOT NULL,
    section_text    TEXT NOT NULL,
    area_mm2        NUMERIC(18,6),
    unit_weight_kg_m NUMERIC(18,6),
    formula_kind    TEXT NOT NULL,
    formula_params  JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_ref      TEXT NOT NULL DEFAULT '',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE
);
```

首批内置:

| 类型 | 识别样式 | 计算基础 |
|---|---|---|
| 焊接 H 型钢 | `H200X200X8X12` | 腹板 + 两块翼缘面积 |
| 箱型钢 | `S200X200X8X12` | 外矩形面积减内矩形面积 |
| C 型钢 | `C180X70X20X2.5` | 展开宽度乘厚度 |
| 角钢 | `L50X50X5` | 两肢面积扣重叠 |
| 圆钢 / 拉条 | `D12` | 圆截面积 |
| 螺栓 | `M20_L80` | 紧固件标准重量表优先,缺表时按规格提示人工确认 |
| 钢板 | `T6_3000x1500` | 厚度 × 长 × 宽 × 密度 |

### 22.4 审批与签审

```sql
CREATE TABLE component_bom.review_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bom_version_id  UUID NOT NULL REFERENCES component_bom.bom_versions(id) ON DELETE CASCADE,
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    role_key        TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('submit','approve','reject','return_for_fix','issue','archive')),
    comment         TEXT NOT NULL DEFAULT '',
    evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

签审角色:

| 角色 | 责任 |
|---|---|
| 编制人 | 录入或导入构件物料清单 |
| 深化设计负责人 | 确认构件分类、命名、图号和位置 |
| 结构复核人 | 复核构件类型、材料等级、截面和数量 |
| 生产负责人 | 确认下料、工艺和工厂可执行性 |
| 造价负责人 | 确认工程量和重量可进入计量 |
| 批准人 | 发布 `issued` 版本 |

---

## 23. BOM 导入器落地

### 23.1 Worker 文件

| 文件 | 职责 |
|---|---|
| `06-workers/architoken_workers/component_bom_xlsx_reader.py` | 读取 XLSX,输出 workbook manifest |
| `06-workers/architoken_workers/sjg157_importer.py` | 导入 SJG157 编码表 |
| `06-workers/architoken_workers/component_naming_rule_importer.py` | 导入命名规则 |
| `06-workers/architoken_workers/component_bom_importer.py` | 导入构件物料清单 |
| `06-workers/architoken_workers/component_name_parser.py` | 拆解构件名称 token |
| `06-workers/architoken_workers/component_bom_validator.py` | 行级校验 |
| `06-workers/architoken_workers/component_weight_calculator.py` | 重量计算 |

### 23.2 Workbook manifest

```json
{
  "workbook_kind": "component_bom",
  "source_file_sha256": "...",
  "sheets": [
    {
      "name": "物料清单",
      "dimension": "A1:Q26",
      "header_row": 5,
      "data_start_row": 6,
      "data_end_row": 19,
      "total_row": 21,
      "columns": [
        {"excel_col": "A", "title": "序号", "field": "line_no"},
        {"excel_col": "B", "title": "类目名称", "field": "category_name"},
        {"excel_col": "C", "title": "编码", "field": "category_code"}
      ]
    }
  ]
}
```

### 23.3 导入步骤

| 步骤 | 处理 |
|---:|---|
| 1 | 计算文件 SHA256,写 `source_files` |
| 2 | 创建 `import_batches` |
| 3 | 识别 workbook 类型 |
| 4 | 校验 Sheet 名称、表头行、字段数量 |
| 5 | 读取单据头: 公司、项目、日期、NO、申请部门、申请人、编制、审核、批准 |
| 6 | 写 `bom_documents` |
| 7 | 写 `bom_versions` 初始版本 |
| 8 | 逐行写 `bom_lines`,记录 `source_cell_range` |
| 9 | 拆解 `component_name` 并写 `component_name_tokens` |
| 10 | 运行 SJG157 联动校验、命名校验、字段一致性校验 |
| 11 | 运行重量计算,缺少基础库时写 warning |
| 12 | 更新 `import_batches.report` |

### 23.4 幂等规则

| 场景 | 处理 |
|---|---|
| 同一文件重复导入同一项目 | 生成新 `import_batch`,若行项内容完全一致,返回已有版本并写审计 |
| 同一 BOM 修改后重新导入 | 新建 `bom_versions.version_no + 1`,用 `change_records` 记录差异 |
| 编码表重复导入 | 按 `category_code` upsert,保留最新源文件和行号 |
| 命名规则重复导入 | 新建 `naming_rule_sets.version_label`,旧规则置为 inactive |

---

## 24. BOM 校验规则落地

### 24.1 规则执行结果

每条规则输出统一结构:

```json
{
  "rule_code": "FIELD-LENGTH-001",
  "severity": "error",
  "line_no": 1,
  "field": "length_mm",
  "expected_value": "5694",
  "actual_value": "5475",
  "message": "长度字段与构件名称中的 L5694 不一致",
  "fix_suggestion": "确认构件实际长度后修正 length_mm 或 component_name/spec_model",
  "requires_human_approval": true
}
```

### 24.2 阻断级规则

| 规则 | 阻断条件 |
|---|---|
| `SJG-CODE-001` | 编码不存在于 SJG157 |
| `SJG-CODE-002` | 类目名称与编码对应名称不一致 |
| `NAME-002` | 构件名称无法解析构件类型或版本号 |
| `FIELD-QTY-001` | 数量为空、非数字或小于等于 0 |
| `REVIEW-001` | 存在阻断级错误时提交审批 |
| `ISSUE-001` | 未完成审批时发布 |

### 24.3 警告级规则

| 规则 | 条件 |
|---|---|
| `FIELD-LENGTH-001` | 名称长度、规格长度、字段长度不一致 |
| `FIELD-SECTION-001` | 名称截面、规格型号、截面尺寸不一致 |
| `FIELD-MATERIAL-001` | 材料等级为空 |
| `FIELD-WEIGHT-001` | 重量为空或计算失败 |
| `CLASS-MATCH-001` | 构件类型与类目名称匹配度低 |
| `DRAWING-001` | 图号为空或未关联 CDE 图纸 |

### 24.4 当前样表应输出的校验结果

| 行号 | 规则 | 严重级别 | 输出 |
|---:|---|---|---|
| 1 | `CLASS-MATCH-001` | error | `铜管 / 30-03.70.20` 与 `Column_Main` 冲突 |
| 1 | `FIELD-LENGTH-001` | warning | `L5694` 与长度字段 `5475` 不一致 |
| 4 | `CLASS-MATCH-001` | error | `目字形钢柱` 与 `Beam_Main` 冲突 |
| 6 | `CLASS-MATCH-001` | error | `目字形钢柱` 与 `Beam_Main` 冲突 |
| 10 | `CLASS-MATCH-002` | warning | `Connect_KneeBrace` 需要确认归类 |
| 14 | `FIELD-MATERIAL-001` | warning | 材料等级为空 |
| 1-14 | `FIELD-WEIGHT-001` | warning | 重量为空 |

---

## 25. BOM 重量计算落地

### 25.1 统一公式

```text
unit_weight_kg = area_mm2 * length_mm / 1_000_000_000 * density_kg_m3
total_weight_kg = unit_weight_kg * total_qty
```

板件:

```text
unit_weight_kg = thickness_mm * width_mm * length_mm / 1_000_000_000 * density_kg_m3
```

圆钢:

```text
area_mm2 = pi * diameter_mm^2 / 4
```

### 25.2 H 型钢解析

`H200X200X8X12`:

| 参数 | 含义 |
|---|---|
| `h=200` | 高度 |
| `b=200` | 翼缘宽 |
| `tw=8` | 腹板厚 |
| `tf=12` | 翼缘厚 |

面积:

```text
area_mm2 = 2 * b * tf + (h - 2 * tf) * tw
```

### 25.3 C 型钢解析

`C180X70X20X2.5`:

```text
area_mm2 = (h + 2 * b + 2 * lip) * t
```

### 25.4 箱型钢解析

`S200X200X8X12` 需要先确认企业命名中 `8X12` 的含义。落地策略:

| 情况 | 处理 |
|---|---|
| 命名规则确认 `S宽X高X壁厚X长度/板厚` | 按规则计算 |
| 命名规则未说明 | 写 warning,要求人工选择箱型钢公式 |

### 25.5 缺基础库处理

| 情况 | 输出 |
|---|---|
| 能解析截面和材料密度 | 自动写 `suggested_unit_weight_kg` |
| 能解析截面但材料密度缺失 | 写 warning,提示补材料等级 |
| 螺栓标准重量表缺失 | 写 warning,要求从紧固件标准库选择 |
| 构件命名与字段冲突 | 暂停重量写入,先修正字段 |

重量计算结果只能写建议值。人工确认后再回写 `bom_lines.unit_set_weight_kg` 和 `bom_lines.total_weight_kg`。

---

## 26. BOM API 落地

### 26.1 核心 REST API

| 方法 | Endpoint | 输入 | 输出 |
|---|---|---|---|
| POST | `/v1/component-bom/source-files` | multipart file | `source_file_id`, `sha256` |
| POST | `/v1/component-bom/sjg157/import` | `source_file_id` | `import_batch_id`, report |
| POST | `/v1/component-bom/naming-rules/import` | `source_file_id` | `rule_set_id`, report |
| POST | `/v1/component-bom/documents/import` | `source_file_id`, `project_id` | `bom_document_id`, `version_id`, report |
| GET | `/v1/component-bom/documents/{id}` | path id | 单据头 |
| GET | `/v1/component-bom/versions/{id}/lines` | query filter | 行项列表 |
| PATCH | `/v1/component-bom/lines/{id}` | 行项字段 patch | 更新后的行项 |
| POST | `/v1/component-bom/versions/{id}/parse-names` | version id | token report |
| POST | `/v1/component-bom/versions/{id}/validate` | version id | validation report |
| POST | `/v1/component-bom/versions/{id}/calculate-weights` | version id | weight report |
| POST | `/v1/component-bom/versions/{id}/submit-review` | comment | review task |
| POST | `/v1/component-bom/versions/{id}/approve` | comment | approved version |
| POST | `/v1/component-bom/versions/{id}/issue` | release note | issued version |
| POST | `/v1/component-bom/versions/{id}/exports` | `xlsx/pdf/archive` | export job |

### 26.2 查询 API

| Endpoint | 用途 |
|---|---|
| `/v1/component-bom/sjg157/categories?section=A.3&q=钢柱` | 类目搜索 |
| `/v1/component-bom/naming-rules?component_type=Beam` | 查询命名规则 |
| `/v1/component-bom/lines/{id}/tokens` | 查看构件名称 token |
| `/v1/component-bom/lines/{id}/validations` | 查看行级校验 |
| `/v1/component-bom/versions/{id}/diff?compare_to={version_id}` | 版本差异 |
| `/v1/component-bom/versions/{id}/downstream-usage` | 下游引用 |

### 26.3 AsyncAPI 事件

| 事件 | 触发 |
|---|---|
| `component_bom.source_file.uploaded` | 源文件上传 |
| `component_bom.import.completed` | 导入完成 |
| `component_bom.validation.completed` | 校验完成 |
| `component_bom.weight.completed` | 重量计算完成 |
| `component_bom.version.submitted` | 提交复核 |
| `component_bom.version.approved` | 审批通过 |
| `component_bom.version.issued` | 发布 |
| `component_bom.export.completed` | 导出完成 |

事件进入 NATS JetStream 或等价事件总线,同时写审计表。

---

## 27. BOM 前端工作台落地

### 27.1 路由

| 路由 | 页面 |
|---|---|
| `/app/modules/standard_library/component-bom/catalog` | SJG157 类目、命名规则、材料等级、型钢规格库 |
| `/app/modules/detailed_design/component-bom` | 构件物料清单主工作台 |
| `/app/modules/detailed_design/component-bom/{documentId}` | 单据详情 |
| `/app/modules/detailed_design/component-bom/{documentId}/versions/{versionId}` | 版本行项编辑 |
| `/app/modules/digital_archive/component-bom/{versionId}` | 归档查看 |

### 27.2 主界面布局

| 区域 | 内容 |
|---|---|
| 顶部工具条 | 项目、版本状态、导入、校验、重量计算、提交复核、发布、导出 |
| 单据头 | 公司、项目、日期、NO、申请部门、申请人、编制、审核、批准 |
| A-Q 表格 | 全字段编辑、冻结列、筛选、排序、批量粘贴、行级状态标记 |
| 左侧来源 | 源 XLSX、图纸、IFC、历史版本 |
| 右侧面板 | token、校验、重量、变更、审批、审计 |
| 底部状态 | 合计数量、合计重量、错误数、警告数、保存状态 |

### 27.3 表格列定义

| 列 | 控件 |
|---|---|
| 类目名称 | SJG157 搜索选择器 |
| 编码 | 自动写入,允许有权限人员手动修正 |
| 构件名称 | 命名规则输入框 + token 解析 |
| 截面尺寸 | 文本输入 + 规格库匹配 |
| 长度 | 数值输入,单位 mm |
| 位置 | 位置字典或自由文本 |
| 材料等级 | 材料等级选择器 |
| 规格型号 | 自动组合或人工确认 |
| 图号 | CDE 图纸选择器 |
| 数量 | 数值输入 |
| 重量 | 计算建议 + 人工确认 |

### 27.4 前端文件

| 文件 | 内容 |
|---|---|
| `03-frontend/lib/component-bom-types.ts` | DTO、状态、规则、表格列类型 |
| `03-frontend/lib/component-bom-api-client.ts` | REST API client |
| `03-frontend/components/component-bom/ComponentBomWorkbench.tsx` | 主工作台 |
| `03-frontend/components/component-bom/ComponentBomGrid.tsx` | A-Q 表格 |
| `03-frontend/components/component-bom/SjgCategoryPicker.tsx` | SJG157 搜索 |
| `03-frontend/components/component-bom/ComponentNameTokenPanel.tsx` | token 面板 |
| `03-frontend/components/component-bom/ComponentBomValidationPanel.tsx` | 校验面板 |
| `03-frontend/components/component-bom/WeightCalculationPanel.tsx` | 重量计算 |
| `03-frontend/components/component-bom/ComponentBomReviewPanel.tsx` | 审批 |
| `03-frontend/components/component-bom/ComponentBomExportPanel.tsx` | 导出 |

---

## 28. BOM Agent 落地

### 28.1 Agent 与工具

| Agent | 调用工具 | 输出表 |
|---|---|---|
| `SJG157ImportAgent` | `xlsx_read`, `category_upsert` | `sjg157_categories` |
| `NamingRuleImportAgent` | `xlsx_read`, `naming_rule_upsert` | `naming_rule_sets`, `naming_rules` |
| `ComponentBomImportAgent` | `xlsx_read`, `bom_upsert` | `bom_documents`, `bom_versions`, `bom_lines` |
| `ComponentNameParserAgent` | `name_parse`, `rule_lookup` | `component_name_tokens` |
| `CategoryCodeLinkAgent` | `category_search`, `category_match` | `line_validation_results` |
| `ComponentBomValidationAgent` | `validation_rules_run` | `line_validation_results` |
| `WeightCalculationAgent` | `section_parse`, `weight_formula_run` | `weight_calculation_results` |
| `ComponentBomReviewAgent` | `validation_summary`, `diff_summary` | review report |
| `ComponentBomExportAgent` | `xlsx_write`, `pdf_render`, `archive_pack` | `export_jobs` |

### 28.2 AI 门禁链

```text
Planner
  -> Generator
  -> Evaluator
  -> RuleChecker
  -> SchemaValidator
  -> Approver
```

每个 Agent 输出必须带:

| 字段 | 含义 |
|---|---|
| `input_refs` | 源文件、版本、行项、规则 |
| `tool_calls` | 实际调用的工具和参数 |
| `output_refs` | 写入的表、文件、报告 |
| `confidence` | 置信度 |
| `requires_human_approval` | 是否需要人工确认 |
| `audit_event_id` | 审计事件 |

### 28.3 ModelRouter

| 任务 | 首选模型路线 | 说明 |
|---|---|---|
| XLSX 结构读取 | 规则/代码工具 | 不走大模型 |
| 构件名称 token 解析 | 规则解析器 | 不走大模型 |
| 类目模糊匹配 | 本地 embedding + 规则 | 模型只用于候选排序 |
| 校验说明生成 | 小模型或外部模型 | 输出必须引用规则编号 |
| 修复建议 | 小模型 + RuleChecker | 需要人工确认 |
| 审核报告 | 外部高质量模型可选 | 必须经过 Evaluator 和 Approver |

---

## 29. BOM 权限、安全与审计

### 29.1 角色权限

| 角色 | 权限 |
|---|---|
| `component_bom.viewer` | 查看已发布版本 |
| `component_bom.editor` | 编辑草稿 |
| `component_bom.validator` | 运行校验和重量计算 |
| `component_bom.reviewer` | 复核并退回 |
| `component_bom.approver` | 批准和发布 |
| `component_bom.admin` | 管理规则、字典、导入配置 |

### 29.2 RLS 策略

```sql
ALTER TABLE component_bom.bom_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bom.bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_bom.bom_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bom_documents
ON component_bom.bom_documents
USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_bom_lines
ON component_bom.bom_lines
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 29.3 审计事件

| 动作 | 审计字段 |
|---|---|
| 上传 | 用户、文件名、SHA256、大小、来源路径 |
| 导入 | 批次、行数、错误数、警告数 |
| 编辑 | 行 ID、字段、旧值、新值、原因 |
| 校验 | 规则版本、结果、阻断项 |
| 重量计算 | 公式、参数、结果、确认人 |
| 审批 | 角色、意见、签审动作 |
| 发布 | 版本、发布说明、下游可见性 |
| 导出 | 格式、文件 ID、校验摘要 |

---

## 30. BOM 测试与验收

### 30.1 Fixture

| Fixture | 来源 |
|---|---|
| `fixtures/component_bom/sjg157-2024.xlsx` | `/home/insome/下载/建筑工程信息模型语义字典编码表_SJG157-2024.xlsx` |
| `fixtures/component_bom/naming-rules-v1.xlsx` | `/home/insome/下载/装配式钢结构建筑构件标准化命名规则V1.0.xlsx` |
| `fixtures/component_bom/ying-she-mei-ju-bom.xlsx` | `/home/insome/下载/应舍美居_构件物料清单.xlsx` |

### 30.2 后端测试

| 测试 | 验收 |
|---|---|
| `test_import_sjg157_categories` | 导入 5678 条索引,A.3 为 3411 条构件类目 |
| `test_import_naming_rules` | 8 个 Sheet 全部入库 |
| `test_import_component_bom` | 14 条数据行、合计 470 |
| `test_parse_component_name` | `Column_Main_H200X200X8X12_L4200_F1_V0` 拆 6 个 token |
| `test_validate_sample_errors` | 输出行 1、4、6、10、14 的问题 |
| `test_weight_h_profile` | H 型钢重量公式可复算 |
| `test_version_diff` | 修改行项后产生差异记录 |
| `test_issue_requires_approval` | 未审批版本发布失败 |

### 30.3 前端测试

| 测试 | 验收 |
|---|---|
| 工作台打开 | `/app/modules/detailed_design/component-bom` 加载列表 |
| 导入文件 | 上传 XLSX 后出现导入报告 |
| 表格渲染 | A-Q 字段完整显示 |
| 类目选择 | 选择类目名称后编码自动写入 |
| token 面板 | 点击构件名称显示解析 token |
| 校验面板 | 错误和警告按行显示 |
| 重量面板 | 显示计算建议和确认按钮 |
| 审批流 | 提交、退回、批准、发布状态正确 |
| 导出 | issued 版本导出 Excel |

### 30.4 生产验收

| 验收项 | 标准 |
|---|---|
| 数据完整性 | 源 Excel、导入数据、导出 Excel 行项一致 |
| 可追溯 | 每一行能追溯到源文件、Sheet、行号、单元格范围 |
| 可校验 | 每一行有校验状态和规则版本 |
| 可审批 | 每个发布版本有审批记录 |
| 可下游引用 | 造价、采购、生产、施工可按 `bom_version_id` 读取 |
| 可归档 | 归档包包含源文件、发布 Excel、PDF、校验报告、审计 JSON |

---

## 31. BOM 分阶段实施计划

### 31.1 第 1 阶段: 数据底座

| 任务 | 文件 |
|---|---|
| 创建 schema 和表 | `04-backend/migrations/20260608000001_component_bom_schema.sql` |
| 定义 Rust DTO | `04-backend/harness-core/src/component_bom_types.rs` |
| 定义 API contract | `04-backend/harness-core/src/component_bom_api.rs` |
| 建 fixture | `04-backend/tests/fixtures/component_bom/` |

验收: 数据库迁移通过,fixture 可导入,核心表可查询。

### 31.2 第 2 阶段: 导入与校验

| 任务 | 文件 |
|---|---|
| XLSX reader | `06-workers/architoken_workers/component_bom_xlsx_reader.py` |
| SJG157 importer | `06-workers/architoken_workers/sjg157_importer.py` |
| 命名规则 importer | `06-workers/architoken_workers/component_naming_rule_importer.py` |
| BOM importer | `06-workers/architoken_workers/component_bom_importer.py` |
| 校验器 | `06-workers/architoken_workers/component_bom_validator.py` |

验收: 三个 Excel 文件可完整入库,样表问题可自动输出。

### 31.3 第 3 阶段: API 与工作台

| 任务 | 文件 |
|---|---|
| Service | `04-backend/harness-core/src/component_bom_service.rs` |
| REST handlers | `04-backend/gateway/src/routes/component_bom.rs` |
| TS types | `03-frontend/lib/component-bom-types.ts` |
| API client | `03-frontend/lib/component-bom-api-client.ts` |
| 工作台组件 | `03-frontend/components/component-bom/` |

验收: 浏览器可完成导入、编辑、校验、审批、导出。

### 31.4 第 4 阶段: 下游贯通

| 模块 | 接入点 |
|---|---|
| `quantity_costing` | 读取 issued BOM 生成工程量和成本行 |
| `material_logistics` | 读取 issued BOM 生成采购计划和批次 |
| `production_manufacturing` | 读取 issued BOM 生成工单和下料单 |
| `construction_management` | 读取 issued BOM 生成安装清单 |
| `digital_archive` | 归档发布文件和审计链 |

验收: 同一个 `bom_version_id` 可以贯通造价、采购、生产、施工、档案。

### 31.5 第 5 阶段: Agent 增强

| 任务 | 输出 |
|---|---|
| 类目候选推荐 | 类目搜索候选和匹配分 |
| 构件命名建议 | 按命名规则生成构件名称 |
| 重量计算解释 | 输出公式、参数、结果 |
| 审核报告 | 汇总阻断项、警告项、修改建议 |
| 变更影响分析 | 说明数量、重量、采购、生产影响 |

验收: Agent 输出均可追溯到规则、工具调用和人工审批记录。

---

## 32. 全产品生产级验收矩阵

本节用于判断 ArchIToken 是否能进入真实生产。没有通过本矩阵,只能算原型、演示或内部工具。

### 32.1 总体验收

| 维度 | 生产级要求 | 验收证据 | 阻断条件 |
|---|---|---|---|
| 业务闭环 | 客户需求 -> 项目计划 -> 方案 -> 深化 -> 构件物料 BOM -> 造价 -> 采购 -> 生产 -> 施工 -> 档案 -> 财务可串联。 | 同一 `project_id` 下的对象、文件、审批、事件和归档包。 | 只能在单模块内操作,下游无法追溯上游。 |
| 数据真源 | PostgreSQL、CDE/ObjectStore、VectorStore、EventStore 分工明确。 | 表结构、对象版本、文件版本、事件 outbox、索引任务。 | VectorStore、浏览器缓存、Excel 副本或 AI 记忆承担真源。 |
| 权限审计 | RBAC/RLS/审批矩阵/审计事件覆盖关键对象。 | 登录、写入、审批、Agent、运维和导出审计。 | 任一关键写操作无操作者、原因、时间、旧值新值。 |
| AI 门禁 | AI 输出必须经过 Planner、Generator、Evaluator、RuleChecker、SchemaValidator、Approver。 | `agent_runs`, `agent_tool_calls`, `rule_results`, `approval_tasks`。 | AI 直接写发布态、采购、生产、施工或财务数据。 |
| 文件能力 | Excel/Word/PPT/PDF/DWG/DXF/IFC/图片/代码均有源文件、版本、预览或受控 worker。 | 上传、解析、派生、回写、导出和失败降级记录。 | 用截图或派生文件冒充源文件能力。 |
| 备份恢复 | 数据库、对象、审计、归档、JumpServer 录像有快照和离线备份。 | 恢复演练记录、备份清单、校验 hash。 | 只有在线单盘或只靠人工复制。 |
| 部署运行 | 开发、测试、生产环境分离,配置、密钥、日志和版本可追溯。 | Docker/K8s/GitOps/环境变量/发布记录。 | 直接 SSH 改生产容器且无审计。 |
| 合规边界 | 专业输出标注角色、标准、依据、状态和审批人。 | 标准族库、规则登记、审批记录。 | AI 输出被标成可施工、可报审、可验收或可入账。 |

### 32.2 16 模块成熟度验收

| 模块 | L2 内部生产力必须具备 | L3 商业试点必须具备 | 验收对象 |
|---|---|---|---|
| `personal_center` | 待办、审批、最近文件、通知 | 风险汇总、跨项目工作负载 | `approval_tasks`, `personal_work_items` |
| `marketing_service` | 客户、需求、会议纪要、报价草稿 | 客户确认、商机转项目、需求版本 | `customer_requirements`, `meeting_records` |
| `planning_management` | 项目、WBS、里程碑、责任矩阵 | 资源冲突、风险、变更影响 | `projects`, `wbs_items`, `risk_registers` |
| `concept_design` | 方案对象、客户确认、文件关联 | 多方案比较、方案变更传递 | `concept_variants`, `concept_acceptance` |
| `standard_library` | SJG157、命名规则、材料/规格基础库 | 标准版本、条文、规则映射 | `standards`, `rules`, `component_templates` |
| `detailed_design` | 图纸/模型/CDE、构件物料 BOM | IFC/DWG/PDF 关联、规则校验 | `drawing_packages`, `bom_versions` |
| `quantity_costing` | 从发布 BOM 生成 BOQ 草稿 | 成本测算、变更影响、报价审批 | `boq_items`, `cost_breakdowns` |
| `material_logistics` | 从发布 BOM 生成采购需求 | 供应商、批次、到货、签收 | `purchase_orders`, `shipment_batches` |
| `production_manufacturing` | 工单、下料、质检、包装 | 产线状态、质量追溯、发运批次 | `work_orders`, `qc_records` |
| `construction_management` | 施工任务、照片、日志、验收 | 整改闭环、班组、质量安全 | `site_tasks`, `acceptance_records` |
| `digital_twin` | IFC/GLB/点云/IoT 作为证据层 | 资产状态、告警、维保 | `twin_assets`, `iot_events` |
| `digital_archive` | 源文件、审批、审计、归档包 | 长期保存、检索、证据导出 | `archive_packages`, `retention_policies` |
| `finance_management` | 合同、预算、付款、发票台账 | 凭证、结算、审计证据 | `contracts`, `payments`, `vouchers` |
| `human_resources` | 组织、人员、班组、资质 | 工时、绩效、培训、权限联动 | `employees`, `crews`, `certificates` |
| `ai_center` | ModelRouter、ToolRouter、Agent、成本 | 多模型路由、提示审计、失败降级 | `model_routes`, `agent_runs` |
| `settings_center` | 租户、账号、角色、权限、审批矩阵 | 数据字典、系统参数、策略版本 | `tenants`, `roles`, `approval_matrices` |

### 32.3 用户规模验收

| 阶段 | 用户规模 | 部署形态 | 必须达成 | 不允许 |
|---|---:|---|---|---|
| 内部试点 | 30-100 | 办公室服务器 + NAS | BOM、CDE、审批、Agent 草稿、备份审计 | 对外承诺 SLA |
| 商业试点 | 1000 | 办公室 + 云/托管补充 | 独立生产环境、监控告警、恢复演练 | 数据库和对象存储单点无备份 |
| 区域生产 | 1 万 | 云/IDC K8s + 对象存储 + WAF/CDN | 多副本、限流、灰度、日志审计 | 放在办公室单机公网服务 |
| 平台运营 | 10 万 | 多可用区、多副本、灾备 | SLA、容量压测、SOC、合规审计 | 手工运维和无变更审批 |

---

## 33. 对标与超越策略

ArchIToken 不靠口号超越大厂,只靠可验证闭环建立优势。

| 对标对象 | 大厂强项 | ArchIToken 不硬碰的边界 | ArchIToken 必须证明的差异化 |
|---|---|---|---|
| 广联达 | 造价、施工、行业客户和计价生态 | 不复制全国定额和完整算量软件 | BOM/BOQ/采购/生产/施工/档案的开放证据链和 AI 审计。 |
| 华东院/大型设计院数字平台 | 专业设计流程、项目经验、标准体系 | 不冒充注册人员专业判断 | 轻量团队也能把需求、文件、BOM、审批、Agent 和归档跑成可追溯闭环。 |
| Revit / Tekla | 建模、深化、插件生态 | 不复刻桌面建模内核 | 通过 IFC/DWG/PDF/Excel/适配器接入成果,把数据变成可审计业务对象。 |
| PKPM / 结构软件 | 结构计算和审查规则 | 不替代结构计算与审图责任 | 接入计算书、校核报告、构件数据和审批证据,形成下游制造施工闭环。 |
| Siemens / 运维平台 | 楼宇运维和资产生态 | 不做楼控全栈 | 先做施工交付、竣工档案、构件证据和轻量数字孪生。 |

### 33.1 可对外声明边界

| 可以声明 | 不能声明 |
|---|---|
| 在开放数据、AI 审计、私有化部署、BOM 到施工归档闭环上形成差异化。 | 全面替代或全面超越广联达、华东院、Revit、Tekla、PKPM。 |
| 对接主流 CAD/BIM/Office/PDF 文件和外部系统输出。 | 原生支持某私有格式,但没有授权、适配器和测试证据。 |
| AI 生成待复核草稿、校验报告、风险提醒和结构化建议。 | AI 自动生成可施工、可报审、可签章、可入账结论。 |

### 33.2 证明路线

| 证明项 | 最小证据 | 目标证据 |
|---|---|---|
| 重钢构件物料 BOM | 三个 Excel 源文件导入、校验、审批、发布 | 发布 BOM 生成 BOQ、采购、工单、施工清单、归档包 |
| AI 可控 | Agent 输入、工具、模型、输出、规则、审批可查 | 失败重试、成本统计、提示注入防护、人工复核闭环 |
| 开放 CDE | 源文件、版本、派生、审计齐全 | IFC/DWG/PDF/Office/图片/代码多格式真实工作台 |
| 私有化 | 两台服务器 + NAS 可运行 L2 | 云/IDC K8s 可运行 L3/L4 |
| 管理闭环 | 项目、计划、BOM、审批可回跳 | 经营日报可追溯到文件、对象、责任人和成本 |

---

## 34. 等保、安全与数据治理落地

### 34.1 数据分类

| 数据级别 | 示例 | 存储 | 控制 |
|---|---|---|---|
| P0 公开 | 产品说明、公开标准索引 | CDE/Public bucket | 版本和来源记录 |
| P1 内部 | 项目计划、普通会议纪要、非敏感文档 | PostgreSQL + ObjectStore | 登录、角色、审计 |
| P2 受限 | 合同、报价、BOM、供应商、设计文件 | 加密卷/对象存储、RLS | 项目权限、审批、下载审计 |
| P3 敏感 | 财务、个人信息、账号密钥、运维录像 | 独立加密、最小权限、离线备份 | MFA、JumpServer、双人审批、脱敏 |
| P4 高敏 | 私钥、生产凭据、监管材料 | Secret 管理、HSM/离线 | 禁止明文落盘,访问全审计 |

### 34.2 等保基础控制到系统对象

| 控制 | 系统对象 | 实施动作 | 验收 |
|---|---|---|---|
| 身份鉴别 | `users`, `sessions`, JumpServer | MFA、强密码、会话过期、运维统一入口 | 登录和运维会话可审计 |
| 访问控制 | `roles`, `permissions`, RLS | 角色、项目、模块、对象、工具权限 | 越权 API 返回拒绝并写审计 |
| 安全审计 | `audit_events`, `agent_runs`, `file_versions` | 业务写入、文件、审批、AI、运维全记录 | 任一对象可回放变更链 |
| 边界防护 | 防火墙、VLAN、NetworkPolicy | 内外网、办公、服务器、存储、管理分区 | 访客/办公不能访问 NAS 管理面 |
| 入侵防范 | EDR、主机基线、镜像扫描 | 最小端口、补丁、镜像漏洞扫描 | 高危漏洞阻断发布 |
| 备份恢复 | `db-backup`, `archive-package` | ZFS 快照、数据库备份、离线盘轮换 | 每月至少一次恢复演练 |
| 安全运维 | JumpServer、GitOps | 禁止直接改生产,生产变更走审批 | 变更单与部署记录一致 |

### 34.3 AI 安全门槛

| 风险 | 控制 | 阻断标准 |
|---|---|---|
| 提示注入 | ToolRouter 限权、上下文隔离、输出 Schema | 模型要求越权读文件或执行工具时阻断 |
| 数据泄露 | P2/P3 数据脱敏、模型路由策略 | 敏感数据不得发往未批准外部模型 |
| 幻觉结论 | RuleChecker、来源引用、人工审批 | 无来源的合规/施工/财务结论阻断 |
| 成本失控 | 模型配额、任务队列、成本事件 | 超预算任务暂停并通知审批人 |
| 自动破坏 | 写操作只通过受控 API | Agent 不得直接删除、覆盖、发布或付款 |

---

## 35. 开发实施 Backlog

### 35.1 P0 必须先做

| 序号 | 交付物 | 代码位置 | 当前状态 | 下一步验收 |
|---:|---|---|---|---|
| 1 | Module Registry 与 16 模块 API | `04-backend`, `03-frontend` | 16 模块真源已同步到文档、前端 registry 和运行时能力；`finance_hr` 仅历史 alias。 | 跑 `/v1/modules`、前端模块入口和 OpenAPI contract,确认 16 个 active module 一致。 |
| 2 | CDE 文件真源 | `04-backend`, `03-frontend`, `06-workers` | `module_files`、local-files API、native-open/commit、IFC/RVT/SKP/3DM 派生入口和 CDE 文件触发器桥已出现。 | 上传/编辑/提交真实文件,验证 source bytes、checksum、version、operation run、event、audit、graph 全链。 |
| 3 | 权限/RLS/审计 | `04-backend/migrations`, Gateway, Database Manager | BOM import、module operation、运维归档、备份恢复表均启用 RLS；`module_operation_runs` 会写 event/audit/graph。 | 用非 superuser 运行 RLS 负例,并跑 `smoke-module-operation-runtime.sh`。 |
| 4 | 构件物料 BOM schema | `04-backend/migrations` | `component_bom_database_bridge` 和 `component_bom_import_contract` 已覆盖 BOM 文档、版本、行、源行、导入批次、命名规则、类目引用、校验问题。 | 在真实 PostgreSQL 执行迁移并查询 `heavy_steel_database_bridge_status` 与 import tables。 |
| 5 | BOM 导入/校验 Worker | `06-workers` | `component_bom` worker、engine policy、CLI dispatch 和 Python tests 已补齐；源文件存在时可解析 5678/41/14/135/470。 | 跑 `06-workers/tests/test_component_bom_worker.py`,保留 artifact 输出和校验报告。 |
| 6 | BOM 工作台 | `03-frontend/components/ComponentBomWorkbench.tsx`, `03-frontend/lib/component-bom.ts` | 已有 PanUI 工作台、清单/校验/源表视图、行编辑、导入/校验/审批/发布/导出状态机和 Vitest 合同。 | 接入真实 Gateway/Database Manager 写入,并用 Playwright 检查表格、移动端和审计事件。 |
| 7 | Agent Registry/ModelRouter/ToolRouter | `04-backend`, `04-backend/agent-orchestrator`, `06-workers` | OpenAPI 已覆盖 generation、skills、MCP tools、knowledge-sources; worker CLI 有 adapter isolation; AI 仍需保持门禁链。 | 跑生成 job 从 Plan/Run/Review/Approve 到 artifact/approval/audit 的端到端合同测试。 |
| 8 | JumpServer 与日志归档 | `04-backend/migrations`, `04-backend/scripts` | operations bastion/log archive schema、readiness view 和 smoke 脚本已补齐;本地 PostgreSQL 已真实跑通。 | 接真实 JumpServer/Teleport 会话 artifact,并保留归档对象 hash 与 manifest。 |
| 9 | 备份恢复脚本 | `04-backend/migrations`, `04-backend/scripts` | backup policy/run、restore drill、verification items、P0 readiness view 和 PostgreSQL 临时库恢复脚本已补齐;本地已完成 `pg_dump`/`pg_restore` 演练。 | 扩展 ObjectStore、config、audit logs 恢复演练。 |
| 10 | CI/CD 门禁 | GitHub Actions / 本地脚本 | `smoke-p0-production-gates.sh`、frontend e2e、workers pytest 和 P0 CDE/operations/DR GitHub Actions job 已接入;tag release 镜像发布依赖同一 P0 gate。 | 提交后由 GitHub Actions 在干净环境验证;生产发布前必须保留 CI run 和 smoke 输出证据。 |
| 11 | buildingSMART/openBIM 证据门禁 | `04-backend/harness-core`, `06-workers`, `docs/OPENBIM_STANDARD_BASELINE.md` | review/claim 两级证据门禁、`openbim_evidence` worker、官方 Validate 自检收紧和单元测试已补齐。 | 用真实项目 IFC+IDS+bSDD+BCF+IDM 跑全链样本、跑 OpenCDE/API contract,并上传 buildingSMART 官方 certification/conformance 报告。 |

### 35.2 P1 商业试点补齐

| 模块 | 必补能力 | 验收 |
|---|---|---|
| 计划管理 | WBS、里程碑、责任矩阵、变更 | BOM 变更能触发计划影响项 |
| 方案设计 | 方案版本、客户确认、文件关联 | 客户确认记录能进入档案 |
| 计量造价 | 发布 BOM -> BOQ/成本草稿 | 每个 BOQ 行有 `source_bom_line_id` |
| 材料物流 | 发布 BOM -> 采购需求/批次 | 采购单可追溯到 BOM 版本 |
| 生产制造 | 发布 BOM -> 工单/质检 | 工单可追溯构件、图纸和材料 |
| 施工管理 | 工单/构件 -> 现场验收 | 照片、整改、验收进入归档 |
| 数字档案 | 源文件、审批、审计归档包 | 项目归档包可导出和校验 hash |
| 财务管理 | 合同、付款、发票、凭证 | 付款不得绕过合同和审批 |

---

## 36. 测试、质量与发布门禁

| 测试层 | 内容 | 最小命令/证据 | 发布门槛 |
|---|---|---|---|
| 单元测试 | DTO、规则、解析器、权限函数 | Rust/Python/TS 单测 | P0 代码覆盖核心分支 |
| 数据库测试 | migration、RLS、约束、幂等 | 空库迁移 + fixture 导入 | 迁移可重复执行或有回滚说明 |
| Worker 测试 | Excel/PDF/IFC/DWG/图片解析 | fixture 输入输出报告 | 失败必须有错误对象和审计 |
| API 测试 | REST/SSE/gRPC/MCP | OpenAPI contract test | 破坏性变更必须版本化 |
| 前端测试 | 模块工作台、BOM 表格、审批面板 | Playwright 截图和交互 | 关键页面无空白、无重叠、可操作 |
| Agent 测试 | Planner 到 Approver 全链 | agent run fixture | 任何发布态输出必须有审批 |
| 安全测试 | 越权、注入、密钥、上传 | 权限测试和扫描报告 | 高危不允许发布 |
| 恢复演练 | 数据库、对象、审计恢复 | 恢复记录和 hash 校验 | 未演练不能进入 L3 |

### 36.1 发布状态

| 状态 | 含义 | 允许范围 |
|---|---|---|
| `dev_draft` | 开发草稿 | 本地和开发环境 |
| `internal_alpha` | 内部试用 | 30 人团队,非关键生产 |
| `controlled_beta` | 受控试点 | 指定项目,有备份和审批 |
| `production_l2` | 内部生产力 | 公司内部真实数据 |
| `production_l3` | 商业试点 | 客户项目,有限 SLA |
| `production_l4` | 规模生产 | 公网高并发和多租户 SLA |

---

## 37. 运维、监控、备份与恢复

### 37.1 监控指标

| 对象 | 指标 | 告警阈值 |
|---|---|---|
| PostgreSQL | 连接数、慢查询、复制/备份、磁盘、锁等待 | 连接 >80%,磁盘 >75%,备份失败 |
| ObjectStore/NAS | 容量、快照、校验、SMART、ZFS scrub | 容量 >75%,坏盘,校验错误 |
| Gateway | P95/P99 延迟、错误率、限流 | 5xx >1%,P95 超基线 |
| Agent | 任务队列、失败率、成本、超时 | 失败率 >5%,成本超预算 |
| Worker | 转换失败、队列积压、CPU/RAM/IO | 积压超过 SLA |
| 安全 | 登录失败、越权、异常下载、运维会话 | 异常访问立即告警 |
| 备份 | 完成时间、校验 hash、恢复演练 | 任一关键备份失败 |

### 37.2 备份策略

| 数据 | RPO | RTO | 策略 |
|---|---:|---:|---|
| PostgreSQL 业务库 | 24 小时内,关键表可提高到 1 小时 | 4-8 小时 | 每日全备 + WAL/增量 + NAS + 离线盘 |
| CDE/ObjectStore | 24 小时 | 8-24 小时 | ZFS 快照 + 归档包 + 离线盘 |
| 审计/JumpServer | 24 小时 | 24 小时 | 热日志本机,冷日志 NAS,每周离线 |
| 配置/密钥 | 变更即备份 | 4 小时 | GitOps + Secret 备份 + 双人保管 |
| 代码与镜像 | 每次发布 | 4 小时 | Git tag、镜像仓库、SBOM |

### 37.3 故障演练

| 演练 | 频率 | 成功标准 |
|---|---|---|
| 数据库恢复 | 每月 | 能恢复到指定时间点并通过校验查询 |
| NAS 坏盘 | 每季度 | RAID5/RAIDZ1 降级可读,替盘重建完成 |
| 勒索场景 | 每季度 | 只读快照和离线盘可恢复关键归档 |
| 服务器宕机 | 每季度 | `srv-01` 或 `srv-02` 故障有降级方案 |
| 权限事故 | 每季度 | 能定位操作者、对象、时间、影响范围 |

---

## 38. 硬件预算与扩容决策门

| 决策点 | 当前结论 | 触发后续采购的证据 |
|---|---|---|
| 是否一台服务器全跑 | 只允许 L1/L2 临时合并,不作为商业生产方案 | CPU/RAM/IO 监控显示长期低负载且业务可接受单点 |
| 是否立即买 6 台 CPU 服务器 | 不按高配 HA 生产包采购；可按十页汇报版六节点轻量试点包复核 | 需要拆分 CDE、NAS、Worker、应用、审计故障域,且确认 2 x 676X + 4 x 658X、每台至少 64GB ECC RDIMM、不含 HA 的边界 |
| 是否立即买 BIM GPU 加速卡 | 买 2 张 RTX PRO 6000D 84GB 服务器版显卡,显卡小计 ¥136,000 | 用于 BIM/IFC/STEP/STL/USDZ/OpenUSD 派生、模型导图、构件 BOM、局部推理和渲染加速；上架前必须验收机箱、PCIe、供电、风道、驱动和温度监控 |
| 是否立即买完整 GPU 生产服务器 | 暂不按完整 GPU/HA 生产包采购 | 如果 2 张 GPU 卡无法落到现有/拟采服务器平台,或双卡 1200W 供电与风道不满足,再追加 GPU 合规服务器和机房级预算 |
| 是否升级 NAS 内存 | 优先二期补到 4 x 64GB | ZFS ARC 命中率低、对象存储/快照/校验影响业务 |
| 是否补满 8 盘 | 二期按增长补 | CDE/归档容量超过 60%,并完成离线备份策略 |
| 是否上万兆公网 | 一期双千兆,二期评估 10Gbps | 真实上行、远程协作、客户访问压测超过千兆能力 |
| 是否迁云/IDC | L3/L4 必须评估 | 外部客户 SLA、1 万用户、公网高并发、多租户隔离要求出现 |

---

## 39. 风险清单与管理决策

| 风险 | 影响 | 当前控制 | 管理层必须决策 |
|---|---|---|---|
| 范围过大 | 16 模块同时深做会拖垮 3 人开发 | P0 聚焦 BOM、CDE、审批、Agent、审计 | 是否先以重钢构件物料 BOM 到生产施工闭环作为唯一示范链 |
| 数据质量差 | AI 和下游自动化会放大错误 | 源文件追溯、校验、人工审批 | 是否强制所有项目文件进入 CDE 后再流转 |
| 专业责任风险 | AI 输出被误用为施工/报审结论 | 输出状态、角色、标准、审批 | 谁是各专业复核和批准责任人 |
| 预算错配 | GPU 卡、服务器和 HA 混在一个预算口径里会挤占软件落地 | CPU 基础包、BIM GPU 专项、GPU/HA 生产包分账；GPU 卡不能替代 OpenBIM 校验/认证证据 | 是否确认 CPU+GPU 已确认口径和追加 GPU 服务器触发条件 |
| 安全事故 | 合同、财务、设计、个人信息泄露 | MFA、JumpServer、RLS、备份、审计 | 是否要求所有外部模型调用默认脱敏 |
| 竞品误判 | 和大厂硬碰单点功能导致失败 | 做开放闭环和适配器生态 | 对外叙事是否禁止全面替代/全面超越表述 |
| 交付不可验收 | 架构文档无法变成软件 | 每项落到表、API、Worker、前端、测试 | 是否按 P0 Backlog 验收付款/排期 |
