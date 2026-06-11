# ArchIToken 架构评审 Gate

**日期**: 2026-06-10  
**对象**: ArchIToken 10 页架构评审版与全产品应用 / BOM / 数据库 / Agent / Workflow / 技术架构文档  
**结论**: 可进入内部架构评审；不得声明 buildingSMART 官方认证、不得声明商业生产 HA/SLA 就绪。

---

## 1. 总体判定

| 评审项 | 当前判定 | 通过边界 | 阻断边界 |
|---|---|---|---|
| 产品定位 | 条件通过 | AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS，非 Revit/Tekla/广联达替代品。 | 不得宣传全面替代或全面超越成熟单点产品。 |
| OpenBIM 标准栈 | 条件通过 | CDE、IFC、IDM、IDS、BCF、bSDD、Validate、SJG157 职责已分层。 | 无官方 certification/conformance evidence 时 `mayClaimBuildingSmartOpenBim=false`。 |
| AI 正向设计 | 条件通过 | AI 只生成需求参数、工程模型草稿、图纸/BOM/报价草稿。 | 不得输出可施工、可报审、可验收、可签章结论。 |
| 工程对象模型 | 条件通过 | 区分 Category、Family/Type、Instance、IFC Entity、Pset、关系、版本。 | 无构件实例、属性集、分类、版本和审计不得派生 BOM/QTO/图纸。 |
| BOM/QTO/MTO/BOQ | 条件通过 | QTO、MTO、BOM、BOQ、PBOM、MBOM 作为不同业务视图。 | 不得用一个 Excel 表替代计量、材料、采购、加工和施工视图。 |
| 数据库控制面 | 条件通过 | PostgreSQL 管对象链、调度链、证据链、审计链；CDE/ObjectStore 管源文件。 | Vector/Search/浏览器缓存不得作为事实真源。 |
| 16 模块架构 | 条件通过 | Registry-based 16 模块并列，共用 Workbench、CDE、审批、审计、AI 面板。 | 不得退化为 16 个孤立页面或硬编码 Enum。 |
| 200 Agent 集群 | 条件通过 | Agent 是岗位能力、Registry、工具权限和队列任务目录。 | 不是 200 个常驻 GPU 进程；不得自动审批、付款、发布或破坏性 SQL。 |
| 技术架构 | 条件通过 | 前端、Gateway、数据库、CDE、Worker、Router、观测与运维边界已明确。 | 业务逻辑不得直连供应商 API 或数据库；Worker 产物不得当真源。 |
| 硬件与预算 | 内部 L2 通过 | 6 台 CPU 服务器 + BIM GPU A/B 方案可支撑内部试点。 | 未形成商业生产 HA/SLA；京东锁价、GPU 上架、风道、质保和 UPS 等证据待补。 |

---

## 2. 必须保留的评审结论

| 结论 | 说明 |
|---|---|
| `ready_for_architecture_review=true` | 当前材料可用于内部架构评审，讨论对象、边界、门禁、证据和未决项。 |
| `ready_for_openbim_review=false` | 真实 IFC+IDS+bSDD+BCF+IDM 全链样本、官方 Validate、API 合同和认证证据未齐。 |
| `mayClaimBuildingSmartOpenBim=false` | 未取得 buildingSMART 官方认证或一致性报告前，禁止任何对外认证声明。 |
| `ready_for_l2_internal_pilot=true` | 可作为 30 人内部生产力和 100/1000 用户试点的架构预算讨论基础。 |
| `ready_for_l3_commercial_production=false` | 缺正式 HA、SLA、云/IDC、灾备、压测、安全合规和客户项目验收证据。 |

---

## 3. 评审证据清单

| 证据域 | 必须证据 | 当前状态 |
|---|---|---|
| 真源文档 | `ARCHITOKEN-SOURCE-OF-TRUTH.md`、`CONSTITUTION.md`、`MODULES.md`、`OPENBIM_STANDARD_BASELINE.md` | 已引用 |
| OpenBIM | IFC ingest、IDS validation、bSDD URI、BCF package、IDM manifest、Validate report | 架构定义已补，真实样本待补 |
| 本地化 | SJG 157-2024 语义字典、本地编码、IFC/bSDD 双挂接策略 | 架构定义已补，导入证据待补 |
| 模型对象 | `model_element`、`element_type`、`property_set`、`drawing_view`、`bom_line` 回跳 | 架构定义已补，Schema/迁移待验 |
| BOM/计量 | QTO、MTO、BOM、BOQ、PBOM、MBOM、计量规则、价格证据 | 架构定义已补，真实样本待补 |
| 数据库 | migration、RLS 负例、OpenAPI/AsyncAPI、备份恢复、审计事件 | 需继续跑端到端证据 |
| Agent | Registry、ToolRouter、ModelRouter、operation_queue、resource_lock、agent_run | 架构定义已补，队列/权限/负例待验 |
| 硬件 | SKU、单价截图、captured_at、供应商、质保、GPU 风道、温控、UPS | 配置口径已补，京东实时锁价待补 |
| 安全运维 | JumpServer、MFA、RLS、审计、备份恢复、日志归档 | 架构定义已补，演练报告待补 |

---

## 4. 下一轮必须补的交付物

| 优先级 | 交付物 | 验收口径 |
|---:|---|---|
| P0 | 真实项目 IFC+IDS+bSDD+BCF+IDM 样本包 | 生成 `openbim_full_chain_sample_report.json`，且每项能回跳 CDE 文件和审计事件。 |
| P0 | 官方 Validate 服务/CLI 证据 | 生成 `buildingsmart_validate_report.json`，记录工具、版本、输入文件、结果和失败项。 |
| P0 | 数据库 migration + RLS 负例 | 迁移可在空库执行；非授权用户读写敏感项目对象必须失败并写审计。 |
| P0 | BOM/QTO/MTO/BOQ 真实样本 | 任意 BOM 行能回跳构件实例、图纸视图、计量规则、价格证据和审批状态。 |
| P0 | Agent 端到端门禁 | Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 全链可回放。 |
| P1 | 京东实时锁价证据 | 每个硬件 SKU 记录截图、URL、captured_at、供应商、质保和替代方案。 |
| P1 | GPU/BIM 节点上架验收 | PCIe、供电、风道、驱动、CUDA/渲染/温控 smoke 全通过。 |
| P1 | 备份恢复演练 | PostgreSQL、CDE/ObjectStore、审计日志至少一次恢复成功并校验 hash。 |

---

## 5. 对外表述边界

| 可以说 | 不能说 |
|---|---|
| ArchIToken 正在构建 AEC AI-Native + OpenBIM CDE Workflow OS。 | 已获得 buildingSMART 官方认证。 |
| 当前架构支持 CDE、IFC、IDS、BCF、bSDD、Validate 和 SJG157 本地化映射的受控设计。 | 已完成 buildingSMART 官方全量一致性认证。 |
| AI 可辅助生成工程模型草稿、图纸/BOM/报价草稿，并进入人工复核。 | AI 自动生成可施工、可报审、可验收、可签章结果。 |
| 6 台 CPU 服务器 + BIM GPU 方案可支撑内部试点讨论。 | 已具备商业生产 HA/SLA、10 万用户公网能力。 |

