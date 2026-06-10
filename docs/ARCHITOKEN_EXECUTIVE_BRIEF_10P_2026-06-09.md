# 1. ArchIToken 是 OpenBIM CDE Workflow OS

核心不是再造 BIM/CAD/造价工具，而是把项目共享信息环境、开放工程模型、机器可读交付要求、模型校验、议题协同和业务审批接入工程控制链。

> OpenBIM 不是一条箭头流水线。ArchIToken 以 CDE 管项目共享信息环境、版本、状态、权限、审批和审计；以 IFC 管开放模型数据结构；以 IDS 管机器可读交付要求；以 BCF 管模型议题协同；以 bSDD 管开放语义字典；以 Validate 管 IFC/IDS/企业规则校验；以 SJG157 管本地标准类目映射，SJG157 不和 bSDD 合并命名。

- 项目信息环境: CDE
- 模型 Schema: IFC
- 交付要求: IDS
- 议题协同: BCF
- 开放语义字典: bSDD
- 模型校验: Validate

- 主视觉: archive / CDE / 项目共享信息环境：文件、模型、图纸、BOM、校验报告、议题、权限、版本、状态、审批和审计
- IFC: 职责：开放模型 Schema|对象：空间、构件、几何、属性集、关系、分类引用|落库：ifc_model、model_element
- IDS: 职责：机器可读交付要求|对象：实体、分类、属性、材料、数量、阶段约束|输出：校验需求集
- BCF: 职责：模型议题协同|对象：topic、viewpoint、comment、文档引用、责任人、状态|输出：整改闭环
- bSDD: 职责：开放语义字典|对象：术语、分类、属性、单位、值域、URI|边界：不替代 SJG157
- Validate: 职责：模型校验|依据：IFC Schema、IDS、语义映射、企业规则|输出：校验结果
- SJG157: 职责：本地标准映射|对象：建筑、空间、构件、系统类目和编码|边界：不和 bSDD 合并命名

- 系统边界: 不替代 Revit/Tekla/广联达/ERP；承接其模型、图纸、清单和业务结果。
- 模型主线: 文字需求只生成模型草稿；图纸、构件 BOM、算量、工单都从模型派生。
- 控制层价值: 把信息容器、IFC 对象、语义字典、交付要求、校验结果、BCF 议题和审批事件统一到对象链。

**汇报重点**: 投资人一句话：ArchIToken 用 CDE + OpenBIM + Workflow + Agent，把工程企业的模型和业务流程变成可计算、可追溯、可复用的 AI-Native 生产系统。

---

# 2. 文字生成工程模型，模型导出图纸和构件 BOM

ArchIToken 的主线是把客服对话、客户文字、会议、合同、照片和现场条件转成需求参数与构件约束，生成工程模型并输出 IFC、STL、STEP、USDZ、OpenUSD 等开放格式，再由模型派生施工图、加工图、构件 BOM、算量、材料需求、报价、采购、生产、施工和验收对象。

> 正向链路：客服/客户文字/会议/合同/现场条件 -> 需求参数 -> 构件库/材料库/连接约束 -> 工程模型 -> IFC/STL/STEP/USDZ/OpenUSD -> 模型导出施工图/加工图 -> 模型导出构件 BOM -> BOM 驱动算量、材料和客服报价 -> 采购/生产/施工/验收/归档。

- 需求到模型: AI
- 施工/加工: 图纸
- 模型导出: BOM
- 算量/材料/报价: 业务

- 客服/客户输入: 输入：客服对话、客户文字、会议纪要、合同、照片、现场条件|处理：抽取空间、功能、尺寸、预算、工期和风险|输出：demand_item
- 需求参数: 输入：demand_item|处理：标准、边界、荷载、材料、位置参数化|输出：requirement_parameter
- 构件约束: 输入：标准构件库、材料库、连接规则|处理：匹配可生产构件|输出：component_constraint
- 工程模型: 输入：参数和构件约束|处理：生成几何、属性、关系、空间定位|输出：IFC/STL/STEP/USDZ/OpenUSD、model_element、property_set
- 施工/加工图: 输入：model_element|处理：平立剖、节点、加工尺寸、孔位、连接、图号、标注|输出：construction_drawing、fabrication_drawing
- 模型出 BOM: 输入：model_element 属性|处理：类目、编码、尺寸、数量、单重、总重、损耗|输出：bom_line
- 算量/材料/报价: 输入：BOM、图纸、工程量规则、材料价格|处理：BOQ、材料需求、损耗、税费、报价版本|输出：boq_item、material_requisition、quote_line
- 采购生产施工: 输入：BOM、图纸、材料需求、工单|处理：采购、排产、下料、质检、安装、整改、复验|输出：purchase_request、work_order、acceptance_record

- AI 只到草稿: AI 可生成需求参数、模型、图纸、BOM 和报价草稿，发布必须走校验、专业复核和审批。
- 模型是根: 图纸、BOM、BOQ、工单必须回跳到 model_element_id。
- 业务闭环: 客服报价、材料采购、生产排产、现场施工都消费已发布 BOM 和图纸，不复制第二真源。

**汇报重点**: 验收口径：任意一个报价项、采购件、加工件、工单或验收点，都能追到需求、模型构件、图纸页、BOM 行、Validate 结果、审批记录和 Agent 调用。

---

# 3. 模型构件 = 几何信息 + 属性信息 + 关系

版本不是单独业务主线，而是模型、构件、图纸、BOM、规则和审批对象的属性。工程结论必须落到模型构件对象上。

> model_element 必须同时保存几何、属性、空间位置、构件关系、分类编码、材料规格、状态和版本属性；图纸和构件 BOM 都从这些对象派生。

- 几何信息: Geometry
- 属性信息: Property
- 构件关系: Relation
- 对象属性: Version

- 主视觉: model_element / 构件对象
- 几何: 字段：轴线、截面、长度、孔洞、连接点、朝向|来源：生成模型/IFC/OpenUSD
- 属性: 字段：材料、等级、规格、状态、重量、阶段、责任人|版本：对象属性
- 分类: 字段：SJG157、本地构件类目、企业材料类目、bSDD URI|作用：命名和检索
- 位置: 字段：楼层、轴网、空间、构件组、安装面|作用：施工和验收定位
- 图纸引用: 字段：drawing_sheet_id、detail_id、图号、视图|作用：模型出图回跳
- BOM 引用: 字段：bom_document_id、bom_line_id、数量、重量|作用：采购和算量
- 校验: 依据：IFC Schema、IDS、企业 Rule、SchemaValidator|输出：validation_result
- 版本证据: 字段：source_file、hash、audit_event、approval_id|作用：追责和复现

- 正向设计: 先形成模型构件对象，再从对象派生图纸、BOM 和算量。
- 按模施工: 现场工单、安装位置、验收项必须引用模型构件。
- 按模验收: 验收照片、整改、复验和归档必须回挂模型构件。

**汇报重点**: 核心判断：ArchIToken 的工程对象不是 Excel 行，也不是聊天文本，而是带几何、属性、关系、版本属性和审计证据的模型构件。

---

# 4. OpenBIM 标准栈：信息容器、模型、语义、要求、校验、议题协同

CDE 是项目共享信息环境和管理过程，不是普通网盘；buildingSMART 的 IFC、IDS、BCF、bSDD、Validate 与本地 SJG157 映射围绕同一项目信息容器协同，而不是互相替代。

> ArchIToken 的专业落地：CDE 负责文档、模型、元数据、版本、状态、权限、审批和审计；IFC 表达开放工程模型；IDS 声明机器可读交付要求；BCF 管理模型议题、视点、评论、责任、复核和关闭；bSDD 提供开放分类和属性语义；SJG157 作为本地标准库映射到构件类目和编码；Validate 输出模型与规则校验结果。

- 信息环境: CDE
- 模型 Schema: IFC
- 交付规范: IDS
- 议题协同: BCF
- 开放语义服务: bSDD
- 模型校验: Validate

- 主视觉: archive / CDE 信息环境 / 项目协同的受控空间：信息容器、文档版本、模型交付包、状态、元数据、权限、审批和审计
- IFC: 角色：开放模型数据结构|对象：IfcProject、空间层级、构件、几何、属性集、关系|输出：可交换 IFC
- IDS: 角色：信息交付规范|对象：阶段、角色、构件类型、属性要求|输出：机器可读校验条件
- BCF: 角色：议题协同|对象：topic、viewpoint、comment、document reference、责任和关闭|输出：整改闭环
- bSDD: 角色：开放语义服务|对象：术语、分类、属性、单位、值域、URI|输出：语义引用
- Validate: 角色：校验服务|依据：IFC Schema、IDS、语义映射、企业规则|输出：问题清单和报告
- SJG157: 角色：本地标准库|对象：建筑、空间、构件、系统类目和编码|输出：本地分类映射

- CDE 不是网盘: 对象存储只保存字节；CDE 还要管理容器状态、元数据、版本、权限、审批、分发和审计。
- 标准不是业务流程: IFC、IDS、BCF、bSDD、Validate 是互操作能力，真正的业务流程由 Workflow 和审批矩阵控制。
- 证据门禁: IDS、Validate、bSDD、BCF、IDM、审批审计和全链样本齐全后才进入 OpenBIM review。

**汇报重点**: OpenBIM 验收：一个 Published 交付包必须能回跳到 CDE、IFC、IDS、BCF、bSDD、SJG157、Validate 和审批审计；没有官方 certification/conformance evidence 时 mayClaimBuildingSmartOpenBim 仍为 false。

---

# 5. BOM 是模型导出的构件物料清单，驱动算量、材料和报价

BOM 字段必须贴合当前 Excel 样表、构件命名规则和 SJG157 语义字典；每一行都要能回跳模型构件，并被算量、材料、客服报价、采购、生产和施工复用。

> 核心字段：类目名称、SJG 编码、构件名称、截面尺寸、长度、位置、材料等级、规格型号、图号、层次、单位、数量、单重、总重、备注；来源是 model_element 和 property_set，下游生成 BOQ、材料需求、报价行、采购需求、生产工单和施工验收点。

- 类目编码: SJG157
- 命名规则: 构件名称
- 属性计算: 重量
- 模型出图关联: 图号

- 主视觉: model / 模型构件 / 字段：model_element_id、SJG 类目、构件名称、截面、长度、位置、材料等级|来源：IFC/STL/STEP/USDZ/OpenUSD 工程模型与属性集|计算：数量、单重、总重、损耗、图纸引用|门禁：无模型构件、无分类、无重量、无图纸引用不得发布
- 现有 Excel: 来源：应舍美居构件物料清单|用途：字段样板和历史数据导入|门禁：必须映射到模型构件
- 标准字典: 来源：SJG157、构件命名规则、企业材料库、bSDD 引用|用途：类目、编码、命名、材料和值域

- 构件 BOM: 落库：bom_document、bom_version、bom_line|字段：类目、编码、尺寸、数量、重量、图号
- 算量/材料: 落库：boq_item、material_requisition|作用：按模型尺寸、损耗和材料规则算量、汇总、请购
- 报价/生产: 落库：quote_line、purchase_request、work_order|作用：客服报价、采购、加工、排产和施工发料

- 算量应用: BOM 行进入 BOQ 时必须携带模型构件、图纸页、规则版本、损耗、价格来源和审批状态。
- 材料应用: 材料需求按规格、材质、供应商、交期、库存和损耗归并，不能直接用客服口径下单。
- 报价应用: 客服报价从已校验 BOM/BOQ 生成报价版本，变更必须形成差异、原因和审批记录。

**汇报重点**: BOM 验收：任意一行构件 BOM 能回跳到 IFC 构件、属性集、施工/加工图、分类字典、算量规则、材料需求、报价版本、校验报告和审批记录。

---

# 6. 数据库按 OpenBIM 对象链建模

PostgreSQL 保存业务对象和状态，ObjectStore/CDE 保存源文件和派生文件，EventStore/Outbox 记录动作事实。

> 禁止把搜索索引、向量库、导出 Excel 或 AI 记忆当真源；工程结论必须能从项目、CDE 文件、模型、构件、图纸、BOM、校验和审计事件重建。

- 项目: project_id
- 源文件: cde_doc_id
- 模型构件: element_id
- 审计: audit_id

- core.projects: 主键：project_id|职责：客户、合同、阶段、状态、责任矩阵|事件：project_created/updated
- cde.documents: 主键：cde_doc_id|职责：源文件、派生文件、状态、版本、hash|状态：WIP/Shared/Published/Archived
- openbim.ifc_models: 主键：ifc_model_id|职责：IFC 文件、Schema、导入状态、校验批次|引用：cde_doc_id
- design.model_elements: 主键：model_element_id|职责：几何、属性、位置、构件关系|引用：ifc_model_id
- openbim.property_sets: 主键：property_id|职责：Pset、属性名、单位、值域、来源|引用：model_element_id
- openbim.ids_specs: 主键：ids_spec_id|职责：交付阶段、对象类型、属性要求|输出：校验任务
- openbim.validation_results: 主键：validation_id|职责：Schema/IDS/Rule 校验结果|输出：通过、失败、修复建议
- openbim.bcf_issues: 主键：bcf_topic_id|职责：视点、评论、责任人、状态、关闭证据|引用：model_element_id
- component_bom.bom_lines: 主键：bom_line_id|职责：构件编码、尺寸、数量、重量、图号|引用：source_model_element_id

- 主外键链: project -> cde_document -> ifc_model -> model_element -> drawing_sheet / bom_line。
- 写入设计: Gateway 事务写业务表和 outbox；Worker 不绕过审批写真源。
- 读取设计: 下游只读取 Published/Issued 模型、图纸和 BOM。

**汇报重点**: 数据库验收：任意生产工单都能回跳到 CDE 源文件、IFC 模型、模型构件、图纸页、BOM 行、IDS 校验、BCF 问题和审计事件。

---

# 7. 16 个模块围绕同一条模型数据链协同

模块不是孤岛，也不是 16 个落地页；它们共用同一套工程对象、CDE、审批、审计、AI 面板和操作队列。

> 模块分工：市场客服收集需求并生成报价草稿，设计模块生成工程模型并输出 IFC/STL/STEP/USDZ/OpenUSD，CDE 管交付容器、版本、状态和审计，模型派生施工图、加工图和构件 BOM，BOM 驱动算量、材料、采购、生产、施工、结算和归档证据。

- 模块注册: Registry
- 统一工作台: Workbench
- 对象契约: Contract
- 事件同步: Event

- 客服需求与报价: 模块：市场客服、项目计划|输入：客户文字、会议、合同、现场条件|输出：需求项、报价草稿、WBS、里程碑
- AI 正向设计: 模块：方案设计、深化设计、数字孪生|输出：IFC/STL/STEP/USDZ/OpenUSD、构件对象、属性集
- OpenBIM CDE: 模块：数字档案、标准库、设置治理|能力：CDE、IFC、IDS、BCF、bSDD、Validate、SJG157
- 图纸/BOM/算量: 模块：构件物料 BOM、计量造价|输出：施工图、加工图、BOM、BOQ、报价行、成本差异
- 材料采购生产: 模块：材料物流、生产制造|输出：材料需求、采购单、到料、工单、质检、包装、发运
- 施工验收归档: 模块：施工管理、数字档案、财务/人力|输出：施工日志、验收、整改、结算、员工工时和归档证据

- 统一工作台: 文件区、对象列表、详情面板、生命周期、审批、审计、AI。
- 跨模块引用: 引用对象 ID 和版本，不复制数据。
- 模块验收: 每个模块必须明确输入、输出、状态机、权限和审计事件。

**汇报重点**: 应用架构验收：一个项目从客服需求、AI 模型、IFC、施工/加工图、BOM、算量、报价、采购、生产、施工、结算和归档，必须在同一个 project_id 与对象链上闭环。

---

# 8. 面向业务和员工岗位的 Agent 集群

每个员工在统一工作台拥有岗位 Copilot；200 个 Agent 是 Registry、策略、工具权限和队列任务目录，不是 200 个常驻 GPU 进程。

> 设备分工：srv-01 存 Agent Registry/权限/状态；srv-05 调度队列；srv-04 跑文本、表格、报价、采购、财务、人力等通用 Agent；srv-03 跑 BIM/IFC/STL/STEP/USDZ/OpenUSD、视觉、渲染和本地大模型任务；srv-02 存 CDE/Artifact；srv-06 写审计。

- P0 关键 Agent: 24-32
- 商业试点: 80-120
- 成熟生产: 160-200
- 上岗规则: 8条

- 客服需求 Agent: 服务：客服/销售|输入：微信、电话纪要、合同、图片、现场条件|工具：OCR、会议纪要、合同条款抽取|输出：需求项、预算边界、报价草稿|门禁：无来源文件和客户确认不得进入建模
- 设计建模 Agent: 服务：方案/深化/BIM 工程师|输入：需求参数、构件库、材料库、连接规则|工具：GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD exporter|输出：工程模型草稿、model_element|门禁：不能直接发布
- 图纸/BOM Agent: 服务：深化设计、加工技术|输入：已校验模型、图纸模板、BOM 字段规则|工具：drawing_export、fabrication_drawing_export、model_export_bom|输出：施工图、加工图、bom_line|门禁：每行必须回跳模型构件
- 算量报价 Agent: 服务：造价、客服报价|输入：BOM、图纸、工程量规则、价格库、税费规则|工具：boq_calc、quote_builder、change_compare|输出：BOQ、报价版本、差异清单|门禁：价格和规则缺失只能出待确认项
- 材料采购 Agent: 服务：材料、采购、仓库|输入：BOM、库存、供应商、交期、损耗|工具：material_rollup、supplier_match、purchase_request|输出：材料需求、请购草稿、到料风险|门禁：不能直接下单或付款
- 生产施工档案 Agent: 服务：生产、质检、施工、档案、人力|输入：图纸、BOM、工单、照片、验收项、员工工时|工具：work_order_split、qc_check、archive_pack|输出：工单、整改、验收、归档包|门禁：未关闭问题阻断归档

- 数量口径: 先做 24-32 个关键 Agent，跑通真实工程链；商业试点扩到 80-120，成熟生产再到 160-200。
- 上岗规则: 每个 Agent 必须有岗位、输入、输出、工具、模型路由、规则校验、人工审批和审计证据。
- 设备口径: srv-05 负责任务调度；srv-04 处理通用 CPU Agent；srv-03 处理工程模型/GPU Agent；Agent 输出统一写回 CDE、数据库和审计。

**汇报重点**: AI 员工 = 岗位身份 + 权限边界 + 工作队列 + 工具集 + 模型路由 + 规则校验 + 审批链 + 审计记录；任何工程、采购、付款、施工和归档结论必须人工审批。

---

# 9. 技术栈围绕 OpenBIM 运行时、CDE 和 Worker 拆分

前端负责统一工作台和工程编辑视图，后端负责事务、权限和状态机，CAD/BIM/Office/PDF/AI Worker 负责解析、建模、派生、校验和证据包。

> 技术边界：业务逻辑不得直连模型供应商，不得绕过 Gateway 写数据库，不得把 Worker 生成物当真源；写回模型或发布施工图、加工图、BOM、BOQ 和报价必须经 Validate、专业复核和审批。

- 工作台: Next.js
- CDE、IFC、IDS、BCF: OpenBIM
- Gateway: Rust
- 模型/图纸/BOM: Workers

- 前端工作台: 技术：Next.js、React、Monaco、WebGPU|职责：统一工作台、对象面板、审批、AI 面板、工程视图|边界：不写真源
- 模型运行时: 技术：OpenEngineeringEditor、PanAEC、GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD|职责：工程模型、构件对象、视图、派生预览
- 业务 API: 技术：Rust Gateway、Harness Core、ToolRouter|职责：事务、权限、状态机、服务契约、工具门禁
- 数据真源: 技术：PostgreSQL、ObjectStore/CDE、Outbox、VectorStore|职责：对象链、文件、事件、检索和审计
- Worker 集群: 技术：Office/PDF/CAD/BIM/IFC/IDS/Validate/BCF/Drawing/BOM/BOQ/Quote Worker|职责：解析、建模、转换、校验、导图、导 BOM、算量、报价、证据包
- 部署运维: 技术：Docker、K8s、OpenTelemetry、GitOps、JumpServer|职责：发布、日志、指标、备份、恢复、审计

- API 设计: 模块通过服务契约访问，不互相直连库表。
- 事件设计: 事务内写 outbox，Worker 消费后写派生物和状态。
- 观测设计: 一次建模、导图、导 BOM 和审批调用必须可追踪。

**汇报重点**: 技术架构验收：输入一段客户需求后，能看到参数化、工程模型草稿、IFC/STL/STEP/USDZ/OpenUSD 导出、IDS 校验、施工/加工图草稿、BOM 草稿、BOQ/报价草稿、BCF 问题、审批事件和前端状态同步。

---

# 10. 6 台 CPU 服务器 + BIM GPU 双方案

一期 CPU 核心物料先支撑 30 人内部生产力和 100/1000 用户试点；NAS 机箱 ¥3,000，每台线材/散热/小配件 ¥1,000，关键节点可按实际需要升到 256GB 或选 Xeon 696X。

> 部署设计：srv-01 跑 CDE/API/数据库；srv-02 跑 NAS/备份/CDE 文件；srv-03 跑 BIM/IFC/STEP/STL/USDZ/OpenUSD 模型派生并承接 GPU 方案 A 或 B；srv-04 跑 CI/通用 Worker；srv-05 跑应用/API/任务队列和 200 个 Agent 调度；srv-06 跑 JumpServer/日志/审计/监控。CPU 基线为 2 x Xeon 676X + 4 x Xeon 658X；696X 单价 ¥50,000，按需求升级关键节点。

- CPU 服务器: 6台
- 676X / 658X: 2+4
- CPU 核心物料: ¥340,700
- ¥50,000/颗: 696X

- CPU/内存口径: 基线 2 台 676X + 4 台 658X，核心物料 ¥340,700；srv-01/srv-03 可升 696X，每台 +¥24,650；关键节点升 256GB 需 +¥40,500/台。
- 机箱/电源/配件: BIM 用长城黑匣子 15 + 3200W；NAS 用热插拔机箱 ¥3,000 + 2 个服务器电源；其它节点机箱/电源各 ¥1,000；每台小配件 ¥1,000。
- GPU/预算口径: GPU A ¥136,000、CPU+GPU A ¥476,700；GPU B ¥144,000、CPU+GPU B ¥484,700；两台 676X 都升 696X 后 CPU 核心为 ¥390,000。

**汇报重点**: 硬件结论：一期用 6 台 CPU 服务器拆分 CDE、数据库、NAS、Worker、应用队列、200 个 Agent 调度、堡垒机、日志和备份；BIM GPU 按 A/B 双方案择一采购，必须通过服务器机箱、PCIe、供电、风道、驱动、质保和温度监控验收。