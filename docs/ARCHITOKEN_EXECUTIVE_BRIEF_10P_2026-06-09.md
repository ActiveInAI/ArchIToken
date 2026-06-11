# 1. ArchIToken 是 OpenBIM CDE Workflow OS

核心不是再造 BIM/CAD/造价工具，而是把项目共享信息环境、开放工程模型、机器可读交付要求、模型校验、模型协同和业务审批接入工程控制链。

> OpenBIM 不是一条箭头流水线。ArchIToken 以 CDE 管项目共享信息环境、版本、状态、权限、审批和审计；以 IFC 管开放模型数据结构；以 IDS 管机器可读交付要求；以 BCF 管模型协同格式；以 bSDD 管开放语义字典；以 Validate 管 IFC/IDS/企业规则校验；以 SJG157 管深圳本地化语义字典和类目编码映射。

- 项目信息环境: CDE
- 模型 Schema: IFC
- 交付要求: IDS
- 模型协同: BCF
- 开放语义字典: bSDD
- 模型校验: Validate

- 主视觉: archive / CDE / 项目共享信息环境：文件、模型、图纸、BOM、校验报告、BCF 模型协同主题、权限、版本、状态、审批和审计
- IFC: 职责：开放模型 Schema|对象：IfcProject、空间层级、IfcElement、IfcTypeObject、IfcPropertySet、关系、分类引用|落库：ifc_model、model_element、element_type、property_set
- IDS: 职责：机器可读交付要求|对象：实体、分类、属性、材料、数量、阶段约束|输出：校验需求集
- BCF: 职责：模型协同格式|对象：模型协同主题 topic、模型视点 viewpoint、评论 comment、文档引用、责任人、状态|输出：模型协同闭环
- bSDD: 职责：开放语义字典|对象：术语、分类、属性、单位、值域、URI|关系：国际语义 URI，可与 SJG157 本地编码双挂接
- Validate: 职责：模型校验|依据：IFC Schema、IDS、语义映射、企业规则|输出：校验结果
- 本地化 / SJG157: 职责：深圳地方标准语义字典|依据：SJG 157-2024《建筑工程信息模型语义字典标准》|对象：建筑、空间、构件、系统、BOM 类目|关系：openBIM/IFC 语义的本地化发展继承，与 bSDD 不冲突

- 评审判定: 架构边界可通过：CDE 是受控信息环境，OpenBIM 标准栈和 Workflow/审批审计分层正确。
- 已有证据: 唯一真源、OpenBIM baseline、16 模块 Registry、SJG157 本地化口径和 mayClaim=false 边界已写入文档。
- 未决缺口: 缺真实项目 IFC+IDS+bSDD+BCF+IDM 全链样本、官方 Validate 证据、OpenCDE/API 合同和认证报告。
- 通过门禁: ready_for_openbim_review 只允许在 IDS、Validate、bSDD、BCF、IDM、审批审计和全链样本齐全后打开；mayClaimBuildingSmartOpenBim 仍为 false。

**汇报重点**: 架构结论：CDE 是受控信息环境；IFC、IDS、BCF、bSDD、Validate、SJG157 分别承担模型结构、交付要求、模型协同、语义字典、校验和本地化映射；Workflow 与审批审计决定业务状态。任何模型、图纸、BOM、计量、报价、采购和工单都必须回到同一对象链。

---

# 2. AI 辅助生成参数化工程模型草稿，导出开放格式和构件 BOM

ArchIToken 的主线不是“聊天生成 3D”，而是把客服对话、客户文字、会议、合同、照片和现场条件结构化为需求参数、空间/系统/构件约束、族/类型/实例映射，生成可复核的工程模型草稿，输出 IFC、STL、STEP、USDZ、OpenUSD 等开放格式，再由模型派生施工图、加工图、构件 BOM、按模计量、材料需求、报价、采购、生产、施工和验收对象。

> 正向链路：客服/客户文字/会议/合同/现场条件 -> 需求参数 -> 空间/系统/构件约束 -> Category/Family/Type/Instance 或 IFC 对象映射 -> 工程模型草稿 -> IFC/STL/STEP/USDZ/OpenUSD 格式包 -> 施工图/加工图 -> 构件 BOM -> QTO 按模计量 -> MTO 材料提量 -> BOQ/报价 -> 采购/生产/施工/验收/归档。

- 需求到模型: AI
- 施工/加工: 图纸
- 模型导出: BOM
- 算量/材料/报价: 业务

- 客服/客户输入: 输入：客服对话、客户文字、会议纪要、合同、照片、现场条件|处理：抽取空间、功能、尺寸、预算、工期和风险|输出：demand_item
- 需求参数: 输入：demand_item|处理：标准、边界、荷载、材料、位置参数化|输出：requirement_parameter
- 空间/系统/构件约束: 输入：标准构件库、材料库、连接规则、族/类型模板|处理：匹配可生产构件和可交付类型|输出：component_constraint、element_type
- 工程模型草稿: 输入：参数、类型约束和构件实例约束|处理：生成图元/构件实例、几何、属性集、关系、空间定位|输出：IFC/STL/STEP/USDZ/OpenUSD、model_element、element_type、property_set
- 施工/加工图: 输入：model_element|处理：平立剖、节点、加工尺寸、孔位、连接、图号、标注|输出：construction_drawing、fabrication_drawing
- 模型出 BOM: 输入：model_element 属性|处理：类目、编码、尺寸、数量、单重、总重、损耗|输出：bom_line
- 算量/材料/报价: 输入：BOM、图纸、工程量规则、材料价格|处理：BOQ、材料需求、损耗、税费、报价版本|输出：boq_item、material_requisition、quote_line
- 采购生产施工: 输入：BOM、图纸、材料需求、工单|处理：采购、排产、下料、质检、安装、整改、复验|输出：purchase_request、work_order、acceptance_record

- 评审判定: 条件通过：路线是 AI 辅助生成工程模型草稿，不是 AI 直接给施工/报审结论。
- 已有证据: 链路已覆盖需求参数、族/类型/实例映射、IFC/STL/STEP/USDZ/OpenUSD、图纸、BOM、QTO/MTO/BOQ。
- 未决缺口: 需要真实项目样本证明模型导出、图纸派生、BOM/QTO/MTO/BOQ 和报价版本能端到端回跳。
- 通过门禁: AI 输出默认 draft_assist 或 professional_review_required；没有专业复核、Validate 和审批不得发布图纸/BOM/报价。

**汇报重点**: 验收口径：任意一个报价项、采购件、加工件、工单或验收点，都能追到需求、构件实例、IFC GUID、图纸页、BOM 行、Validate 结果、审批记录和 Agent 调用。

---

# 3. 模型图元/构件实例 = 类型 + 几何 + 属性集 + 关系

不能把 Revit 的图元、族、类型、构件实例和 IFC 的对象、类型、属性集混成一个词。ArchIToken 内部以 model_element 表达可追溯实例，以 element_type/family_ref 表达类型和族定义，以 property_set 管属性。

> model_element 是实例对象，不是族定义；必须保存 ifc_guid 或 external_element_id、category、family_ref、type_ref、geometry_ref、property_set、relations、classification、version_state。图纸和构件 BOM 都从这些对象派生。

- 分类/图元类别: Category
- 族/类型定义: Family/Type
- 构件实例: Instance
- 属性集: Pset

- 主视觉: model_element / 图元/构件实例
- 实例标识: 字段：model_element_id、ifc_guid、external_element_id、source_tool|作用：跨 Revit/Tekla/IFC/数据库回跳
- 族/类型: 字段：category、family_ref、type_ref、type_parameters|作用：区分族定义、类型参数和实例参数
- 几何: 字段：axis、profile、length、opening、connection_point、orientation、geometry_ref|来源：IFC/STL/STEP/USDZ/OpenUSD
- 属性集: 字段：Pset、材料、等级、规格、状态、重量、阶段、责任人|作用：驱动 IDS/Validate/BOM
- 分类: 字段：SJG157、本地构件类目、企业材料类目、bSDD URI|作用：命名和检索
- 空间定位: 字段：项目、楼栋、楼层、轴网、空间、构件组、安装面|作用：施工和验收定位
- 图纸引用: 字段：drawing_sheet_id、detail_id、图号、视图|作用：模型出图回跳
- BOM 引用: 字段：bom_document_id、bom_line_id、数量、重量|作用：采购和算量
- 关系/校验: 字段：host、void、aggregate、connects、depends_on|依据：IFC Schema、IDS、企业 Rule、SchemaValidator
- 版本证据: 字段：source_file、hash、version_state、audit_event、approval_id|作用：追责和复现

- 评审判定: 条件通过：模型对象已区分 Category、Family/Type、Instance、IFC Entity、Pset 和关系。
- 已有证据: model_element、element_type、property_set、classification、drawing_ref、bom_ref、version_state 字段边界已明确。
- 未决缺口: 需要把字段合同落到 migration、OpenAPI/JSON Schema、导入映射和前端对象面板验收。
- 通过门禁: 无 ifc_guid/external_element_id、类型定义、属性集、分类、版本证据和审计记录的构件实例不得派生图纸/BOM/QTO。

**汇报重点**: 核心判断：ArchIToken 的工程对象不是 Excel 行，也不是聊天文本，而是可回跳到族/类型、IFC 对象、属性集、关系、版本和审计证据的构件实例。

---

# 4. OpenBIM 标准栈：信息容器、模型、语义、要求、校验、模型协同

CDE 是项目共享信息环境和管理过程，不是普通网盘；buildingSMART 的 IFC、IDS、BCF、bSDD、Validate 与 SJG157 本地化语义字典围绕同一项目信息容器协同，二者不冲突。

> ArchIToken 的专业落地：CDE 负责文档、模型、元数据、版本、状态、权限、审批和审计；IFC 表达开放工程模型；IDS 声明机器可读交付要求；BCF 作为模型协同格式管理模型协同主题、模型视点、评论、责任、复核和关闭；bSDD 提供开放分类和属性语义；Validate 输出模型与规则校验结果；SJG 157-2024 作为深圳地方标准,把建筑工程信息模型语义字典本地化为建筑、空间、构件、系统类目和编码。

- 信息环境: CDE
- 模型 Schema: IFC
- 交付规范: IDS
- 模型协同: BCF
- 开放语义服务: bSDD
- 模型校验: Validate

- 主视觉: archive / CDE 信息环境 / 项目协同的受控空间：信息容器、文档版本、模型交付包、状态、元数据、权限、审批和审计
- IFC: 角色：开放模型数据结构|对象：IfcProject、IfcSite/Building/Storey、IfcElement、IfcTypeObject、IfcPropertySet、IfcRel* 关系|输出：可交换 IFC
- IDS: 角色：信息交付规范|对象：阶段、角色、实体类型、分类、属性集、材料、数量要求|输出：机器可读校验条件
- BCF: 角色：模型协同格式|对象：模型协同主题 topic、模型视点 viewpoint、评论 comment、document reference、责任和关闭|输出：模型协同闭环
- bSDD: 角色：开放语义服务|对象：术语、分类、属性、单位、值域、URI|输出：国际语义引用，可与 SJG157 编码双挂接
- Validate: 角色：校验服务|依据：IFC Schema、IDS、语义映射、企业规则|输出：问题清单和报告
- 本地化 / SJG157: 角色：深圳地方标准语义字典|依据：SJG 157-2024，自 2024-04-01 实施|对象：建筑、空间、构件、系统、BOM 类目|关系：openBIM/IFC 语义的本地化发展继承

- 评审判定: 标准口径可通过；buildingSMART claim 不通过，必须保持 mayClaimBuildingSmartOpenBim=false。
- 已有证据: IFC、IDM、IDS、BCF、bSDD、Validate、SJG157、OpenCDE/API 的职责和证据路径已拆开。
- 未决缺口: 缺官方 Validate 服务/CLI 配置证据、BCF/API/Dictionaries 合同测试、认证/一致性报告和真实样本包。
- 通过门禁: 只能进入 ready_for_openbim_review；没有官方 certification/conformance evidence 不得对外宣称 buildingSMART openBIM 认证或全量一致。

**汇报重点**: OpenBIM 验收：一个 Published 交付包必须能回跳到 CDE、IFC、IDS、BCF、bSDD、Validate、审批审计和 SJG157 本地化映射；没有官方 certification/conformance evidence 时 mayClaimBuildingSmartOpenBim 仍为 false。

---

# 5. BOM/QTO/MTO：从构件实例到计量、材料、报价、加工和施工

BOM 不是 Excel 字段表，也不是模型对象本身；它是由构件实例、类型定义、属性集、图纸视图、分类字典和计量规则共同派生的受控清单。QTO 解决按模计量，MTO 解决材料提量，BOM/BOQ/PBOM/MBOM 分别服务设计、造价、采购、制造和施工。

> 专业链路：构件实例/IFC GUID -> 类型/族/属性集 -> 图纸视图/节点详图 -> SJG157+bSDD+材料库 -> QTO 按模计量 -> MTO 材料提量 -> 构件 BOM -> BOQ/成本 -> PBOM 采购 -> MBOM 加工 -> 工单/施工/验收。任一行必须有来源对象、计量规则、版本状态、审批证据和价格证据。

- 按模型/图纸规则计算长度、面积、体积、重量、件数: QTO
- 按材质、规格、长度、重量、损耗和余量汇总材料: MTO
- BOM 管构件/材料清单；BOQ 管工程量、成本和报价: BOM/BOQ
- PBOM 服务采购请购；MBOM 服务工厂加工和工序: PBOM/MBOM

- 01 模型对象: model_elements, element_types, property_sets|IFC GUID、构件实例、类型参数、材料、位置、版本
- 02 图纸视图: drawing_sheets, drawing_views, detail_refs|施工图、加工图、节点详图、图号和审签版本
- 03 分类与规则: sjg157_mappings, bsdd_uri, material_specs, measure_rules|类目编码、命名、单位、计量公式和损耗
- 04 QTO/MTO: quantity_takeoffs, material_takeoffs|数量、长度、面积、体积、重量、余量、套数和损耗
- 05 BOM/BOQ: bom_documents, bom_versions, bom_lines, boq_items|构件清单、材料清单、工程量、成本和报价行
- 06 下游执行: purchase_requests, fabrication_parts, work_orders, installation_tasks|采购、下料、加工、质检、发料、安装和验收

- 设计/构件 BOM: 按构件实例和类型汇总，服务深化设计、图纸校核和版本差异。
- MTO 材料提量: 按材质、规格、长度、重量、损耗和余量汇总，服务采购和库存。
- PBOM 采购 BOM: 按供应商、批次、交期、价格证据和库存可用量组织请购。
- MBOM 制造 BOM: 按加工件、工序、下料、焊接、涂装、防火、防腐、质检和包装组织生产。

- 不可缺项: source_file_id、model_element_id/ifc_guid、drawing_view_id、measure_rule_id、bom_version_id。
- 发布门禁: Validate、计量规则、专业复核、价格证据、审批状态缺一项不得下游执行。
- 不能混用: QTO/MTO/BOM/BOQ/PBOM/MBOM 是不同业务视图，不能用一个 Excel 表替代。

- 评审判定: 条件通过：QTO、MTO、BOM、BOQ、PBOM、MBOM 已分清，不再用一个 Excel 概念覆盖。
- 已有证据: 每行清单要求 source_file、model_element/IFC GUID、drawing_view、measure_rule、bom_version、price_evidence。
- 未决缺口: 需要真实 Excel/IFC/DWG/PDF 样本导入、计量规则库、材料库、价格证据和审批发布测试。
- 通过门禁: 缺构件实例、图纸视图、计量规则、材料规格、价格证据、Validate 或审批状态任一项，不得下发采购/加工/施工。

**汇报重点**: BOM 验收：任意一行 BOM/BOQ/PBOM/MBOM 能回跳到构件实例、IFC GUID、类型定义、属性集、图纸视图、分类字典、计量规则、材料提量、价格证据、校验报告和审批记录。

---

# 6. 工程数据库：对象链、调度链、证据链和审计链的控制面

PostgreSQL 管业务对象、状态机、元数据合同、模型索引、BOM/QTO/MTO/BOQ、任务调度、Agent 运行、价格证据和审计事件；CDE/ObjectStore 管源文件和交付包；VectorStore 只做可重建检索索引，不做事实真源。

> 数据库必须回答：谁在什么项目、基于哪个源文件和 Schema、处理哪个构件实例/图纸视图/BOM/BOQ 版本、调用哪个 Agent/Worker、占用什么 CPU/GPU/NAS 资源、采用哪个价格证据和 Validate/审批结果，最终写入哪个交付对象和审计事件。

- 租户、项目、对象版本、权限、RLS 和责任人: Core
- IFC、IDS、BCF、bSDD、SJG157、Validate 证据: OpenBIM
- workflow_run、approval_task、operation_queue、resource_lock: Workflow
- price_evidence、supplier_quote、BCF、Validate、audit_event: Evidence

- 对象/权限: tenants, projects, modules, business_objects, object_versions, rbac_policies / 统一对象 ID、版本、状态、责任人和权限；禁止模块复制第二真源。
- CDE 文件/归档: module_files, file_versions, object_store_objects, archive_packages / 保存源文件、checksum、派生包、归档包；HTML/PDF/截图不是源格式真源。
- 元数据/Schema: metadata_objects, metadata_fields, schema_versions, field_dictionary, lineage_edges / 字段、单位、必填、标准来源、SJG157/bSDD、Schema 版本和对象血缘。
- OpenBIM/计量: ifc_models, model_elements, element_types, property_sets, drawing_views, quantity_takeoffs, material_takeoffs / IFC GUID、构件实例、类型、属性集、图纸视图、QTO/MTO 回跳。
- BOM/造价/执行: bom_documents, bom_versions, bom_lines, boq_items, quote_lines, purchase_requests, fabrication_parts, work_orders / BOM、BOQ、报价、采购、加工、施工和验收全部引用对象版本。
- 流程/Agent/证据: workflow_runs, approval_tasks, operation_queue, resource_locks, agent_runs, price_evidence, validation_results, bcf_topics, audit_events / 调度、限流、Agent、价格、Validate、BCF 模型协同、审批和审计可回放。

- 事务边界: 业务写入只能走 Gateway；事务内写业务表、audit_events、event_outbox，Worker 异步消费。
- 元数据边界: 前端表格、导入模板、Agent 输出、API Schema 和报表必须引用同一 schema_version。
- 索引边界: VectorStore/Search 只保存可重建索引；不得把向量、缓存或浏览器本地保存当事实真源。

- 评审判定: 条件通过：数据库已定位为对象链、调度链、证据链和审计链的控制面，不是 BOM 表。
- 已有证据: 核心表域覆盖 object_versions、schema_versions、operation_queue、resource_locks、agent_runs、price_evidence、validation_results、audit_events。
- 未决缺口: 需要迁移脚本、RLS 负例、OpenAPI/AsyncAPI 合同、容量快照、备份恢复和价格证据 fixture。
- 通过门禁: 业务写入只能走 Gateway；Vector/Search/浏览器缓存不得做事实真源；Agent/Worker 结果必须带 schema_version、object_version 和 audit_event。

**汇报重点**: 数据库验收：任意报价、采购、模型派生、BOM/QTO/MTO/BOQ、工单或 Agent 输出，都能回跳到来源文件、对象版本、Schema、workflow_run、operation_queue、resource_lock、agent_run、price_evidence、Validate/BCF 和 audit_event。

---

# 7. 16 个模块围绕同一条模型数据链协同

模块不是孤岛，也不是 16 个落地页；它们共用同一套工程对象、CDE、审批、审计、AI 面板和操作队列。

> 模块分工：市场客服收集需求并生成报价草稿，设计模块生成类型定义、构件实例和工程模型并输出 IFC/STL/STEP/USDZ/OpenUSD，CDE 管交付容器、版本、状态和审计，构件实例派生施工图、加工图和构件 BOM，BOM 驱动算量、材料、采购、生产、施工、结算和归档证据。

- 模块注册: Registry
- 统一工作台: Workbench
- 对象契约: Contract
- 事件同步: Event

- 客服需求与报价: 模块：市场客服、项目计划|输入：客户文字、会议、合同、现场条件|输出：需求项、报价草稿、WBS、里程碑
- AI 正向设计: 模块：方案设计、深化设计、数字孪生|输出：类型定义、构件实例、IFC/STL/STEP/USDZ/OpenUSD、属性集
- OpenBIM CDE: 模块：数字档案、标准库、设置治理|能力：CDE、IFC、IDS、BCF、bSDD、Validate、SJG157
- 图纸/BOM/计量: 模块：构件物料 BOM、计量造价|输出：施工图、加工图、BOM、BOQ、报价行、成本差异
- 材料采购生产: 模块：材料物流、生产制造|输出：材料需求、采购单、到料、工单、质检、包装、发运
- 施工验收归档: 模块：施工管理、数字档案、财务/人力|输出：施工日志、验收、整改、结算、员工工时和归档证据

- 评审判定: 条件通过：16 模块并列 Registry 架构成立，不能退化成 16 个孤立页面或营销入口。
- 已有证据: MODULES.md 已定义 16 个 active module，统一 Workbench、CDE、审批、审计、AI 面板和操作队列。
- 未决缺口: 每个模块还需补齐输入/输出对象、状态机、权限、专业角色、规则库、Schema 和端到端测试。
- 通过门禁: 新增模块必须走 Registry；不得硬编码 Enum；不得绕过对象版本、CDE 文件、approval_task 和 audit_event。

**汇报重点**: 应用架构验收：一个项目从客户需求、合同/会议文件、工程模型草稿、IFC/STL/STEP/USDZ/OpenUSD、施工/加工图、BOM、QTO/MTO/BOQ、商务报价、采购、生产、施工、结算和归档，必须在同一个 project_id、object_id、version_id 与 audit_event 上闭环。

---

# 8. 面向业务和员工岗位的 Agent 集群

每个员工在统一工作台拥有岗位 Copilot；200 个 Agent 是 Registry、策略、工具权限和队列任务目录，不是 200 个常驻 GPU 进程。

> 设备分工：srv-01 存 Agent Registry/权限/状态；srv-05 调度队列；srv-04 跑文本、表格、报价、采购、财务、人力等通用 Agent；srv-03 跑 BIM/IFC/STL/STEP/USDZ/OpenUSD、视觉、渲染和本地大模型任务；srv-02 存 CDE/Artifact；srv-06 写审计。

- P0 关键 Agent: 24-32
- 商业试点: 80-120
- 成熟生产: 160-200
- 上岗规则: 8条

- 客服需求 Agent: 服务：客服/销售|输入：微信、电话纪要、合同、图片、现场条件|工具：OCR、会议纪要、合同条款抽取|输出：需求项、预算边界、报价草稿|门禁：无来源文件和客户确认不得进入建模
- 设计建模 Agent: 服务：方案/深化/BIM 工程师|输入：需求参数、构件库、材料库、连接规则|工具：GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD exporter|输出：类型定义、构件实例、工程模型草稿|门禁：不能直接发布
- 图纸/BOM Agent: 服务：深化设计、加工技术|输入：已校验模型、图纸模板、BOM 字段规则|工具：drawing_export、fabrication_drawing_export、model_export_bom|输出：施工图、加工图、bom_line|门禁：每行必须回跳构件实例、图纸视图和属性集
- 计量报价 Agent: 服务：造价、商务报价、经营负责人|输入：BOM、图纸、工程量规则、价格库、税费规则|工具：boq_calc、quote_builder、change_compare|输出：BOQ、报价版本、差异清单|门禁：价格和规则缺失只能出待确认项
- 采购/生产/施工 Agent: 服务：材料、采购、生产、施工、档案|输入：BOM、库存、供应商、图纸、工单、照片|工具：purchase_request、work_order_split、qc_check、archive_pack|输出：请购草稿、工单、整改、验收、归档包|门禁：不能直接下单、付款或关闭未复核问题
- 协同/调度/数据库 Agent: 服务：项目经理、DBA、系统管理员、采购/造价|组成：CollaborationCoordinator、SchedulingOrchestrator、DatabaseSteward、MetadataGovernance、PriceEvidence|输入：workflow、operation_queue、metadata、capacity、price_evidence|输出：待办重排、限流、Schema/索引建议、价格锁价缺口|门禁：不得自动审批或执行破坏性 SQL

- 评审判定: 条件通过：200 个 Agent 是 Registry/任务目录/权限边界，不是 200 个常驻进程。
- 已有证据: 已分为岗位 Copilot、业务 Agent、协同调度/数据库 Agent、BIM/GPU Agent，并映射 srv-01/03/04/05/06。
- 未决缺口: 需要 Agent Registry、工具权限、队列隔离、资源锁、失败补偿、成本预算、提示注入防护和负例测试。
- 通过门禁: 固定链路 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver；Agent 不得自动审批、付款、发布或执行破坏性 SQL。

**汇报重点**: AI 员工 = 岗位身份 + 权限边界 + 工作队列 + 工具集 + 模型路由 + 规则校验 + SchemaValidator + 审批链 + 审计记录。200 个 Agent 是注册目录和队列能力，不是 200 个常驻进程；任何工程、采购、付款、施工和归档结论必须人工审批。

---

# 9. 技术栈围绕 OpenBIM 运行时、CDE 和 Worker 拆分

前端负责统一工作台和工程编辑视图，后端负责事务、权限和状态机，CAD/BIM/Office/PDF/AI Worker 负责解析、建模、派生、校验和证据包。

> 技术边界：业务逻辑不得直连模型供应商，不得绕过 Gateway 写数据库，不得把 Worker 生成物当真源；写回模型或发布施工图、加工图、BOM、BOQ 和报价必须经 Validate、专业复核和审批。

- 工作台: Next.js
- CDE、IFC、IDS、BCF: OpenBIM
- Gateway: Rust
- 模型/图纸/BOM: Workers

- 前端工作台: 技术：Next.js、React、Monaco、WebGPU|职责：统一工作台、对象面板、审批、AI 面板、工程视图|边界：不写真源
- 模型运行时: 技术：OpenEngineeringEditor、PanAEC、GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD|职责：类型定义、构件实例、IFC 对象、属性集、视图、派生预览
- 业务 API: 技术：Rust Gateway、Harness Core、ToolRouter|职责：事务、权限、状态机、服务契约、工具门禁
- 数据真源: 技术：PostgreSQL、ObjectStore/CDE、Outbox、VectorStore|职责：对象链、文件、事件、检索和审计
- Worker 集群: 技术：Office/PDF/CAD/BIM/IFC/IDS/Validate/BCF/Drawing/BOM/BOQ/Quote Worker|职责：解析、建模、转换、校验、导图、导 BOM、按模计量、报价、证据包
- 部署运维: 技术：Docker、K8s、OpenTelemetry、GitOps、JumpServer|职责：发布、日志、指标、备份、恢复、审计

- 评审判定: 条件通过：前端、Gateway、数据库、CDE、Worker、Router、观测和运维边界正确。
- 已有证据: 已定义 Next.js 工作台、Rust Gateway、PostgreSQL/ObjectStore/CDE、Worker 集群、ModelRouter/ToolRouter/GeometryRouter。
- 未决缺口: 需要 OpenAPI/AsyncAPI、Worker artifact 合同、E2E smoke、GPU/CUDA/IFC worker 证据和发布门禁 CI。
- 通过门禁: 业务逻辑不得直连模型供应商或数据库；Worker 生成物不得当真源；发布态必须经 Validate、专业复核和审批。

**汇报重点**: 技术架构验收：输入一段客户需求后，能看到需求参数、对象版本、工程模型草稿、IFC/STL/STEP/USDZ/OpenUSD 导出、IDS/Validate 校验、施工/加工图草稿、BOM/QTO/MTO/BOQ/报价草稿、BCF 模型协同主题、审批事件、审计事件和前端状态同步。

---

# 10. 6 台 CPU 服务器 + BIM GPU 双方案

一期 CPU 核心物料先支撑 30 人内部生产力和 100/1000 用户试点；NAS 机箱 ¥3,000，每台线材/散热/小配件 ¥1,000，关键节点可按实际需要升到 256GB 或选 Xeon 696X。

> 部署设计：srv-01 跑 CDE/API/数据库；srv-02 跑 NAS/备份/CDE 文件；srv-03 跑 BIM/IFC/STEP/STL/USDZ/OpenUSD 模型派生并承接 GPU 方案 A 或 B；srv-04 跑 CI/通用 Worker；srv-05 跑应用/API/任务队列和 200 个 Agent 调度；srv-06 跑 JumpServer/日志/审计/监控。CPU 基线为 2 x Xeon 676X + 4 x Xeon 658X；696X 单价 ¥50,000，按需求升级关键节点。

- CPU 服务器: 6台
- 676X / 658X: 2+4
- CPU 核心物料: ¥340,700
- ¥50,000/颗: 696X

- 评审判定: 只通过内部 L2 试点预算；不通过商业生产 HA/SLA 预算。GPU、696X、256GB/512GB 都必须按容量证据触发。
- 已有证据: 6 台 CPU 服务器、NAS/BIM/Worker/API/审计分工、GPU A/B、NAS 热插拔、BIM 3200W 电源、配件和 696X 选项已定义。
- 未决缺口: 网络/安全/UPS/机柜/布线、防火墙、交换机、GPU 上架风道、质保和京东实时截图锁价证据仍未齐。
- 通过门禁: 采购前必须有 SKU、单价截图、captured_at、供应商、质保、替代方案；512GB 只在 PostgreSQL/ZFS/BIM/GPU worker 容量快照持续逼近 256GB 后触发。

**汇报重点**: 硬件结论：一期用 6 台 CPU 服务器拆分 CDE、数据库、NAS、Worker、应用队列、200 个 Agent 调度、堡垒机、日志和备份；BIM GPU 按 A/B 双方案择一采购，必须通过服务器机箱、PCIe、供电、风道、驱动、质保和温度监控验收。