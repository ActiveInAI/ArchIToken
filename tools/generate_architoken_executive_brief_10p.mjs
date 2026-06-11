import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("../03-frontend/node_modules/playwright");

const outHtml = resolve("docs/ARCHITOKEN_EXECUTIVE_BRIEF_10P_2026-06-09.html");
const outPdf = resolve("docs/ARCHITOKEN_EXECUTIVE_BRIEF_10P_2026-06-09.pdf");
const outMd = resolve("docs/ARCHITOKEN_EXECUTIVE_BRIEF_10P_2026-06-09.md");
const outPptx = resolve("docs/ARCHITOKEN_EXECUTIVE_BRIEF_10P_2026-06-09.pptx");

const slides = [
  {
    eyebrow: "01 / OpenBIM 总架构",
    title: "ArchIToken 是 OpenBIM CDE Workflow OS",
    subtitle: "核心不是再造 BIM/CAD/造价工具，而是把项目共享信息环境、开放工程模型、机器可读交付要求、模型校验、模型协同和业务审批接入工程控制链。",
    thesis: "OpenBIM 不是一条箭头流水线。ArchIToken 以 CDE 管项目共享信息环境、版本、状态、权限、审批和审计；以 IFC 管开放模型数据结构；以 IDS 管机器可读交付要求；以 BCF 管模型协同格式；以 bSDD 管开放语义字典；以 Validate 管 IFC/IDS/企业规则校验；以 SJG157 管深圳本地化语义字典和类目编码映射。",
    stats: [
      ["CDE", "项目信息环境"],
      ["IFC", "模型 Schema"],
      ["IDS", "交付要求"],
      ["BCF", "模型协同"],
      ["bSDD", "开放语义字典"],
      ["Validate", "模型校验"],
    ],
    visual: {
      kind: "openbim",
      center: ["archive", "CDE", "项目共享信息环境：文件、模型、图纸、BOM、校验报告、BCF 模型协同主题、权限、版本、状态、审批和审计"],
      nodes: [
        ["model", "IFC", "职责：开放模型 Schema|对象：IfcProject、空间层级、IfcElement、IfcTypeObject、IfcPropertySet、关系、分类引用|落库：ifc_model、model_element、element_type、property_set"],
        ["param", "IDS", "职责：机器可读交付要求|对象：实体、分类、属性、材料、数量、阶段约束|输出：校验需求集"],
        ["agent", "BCF", "职责：模型协同格式|对象：模型协同主题 topic、模型视点 viewpoint、评论 comment、文档引用、责任人、状态|输出：模型协同闭环"],
        ["db", "bSDD", "职责：开放语义字典|对象：术语、分类、属性、单位、值域、URI|关系：国际语义 URI，可与 SJG157 本地编码双挂接"],
        ["gateway", "Validate", "职责：模型校验|依据：IFC Schema、IDS、语义映射、企业规则|输出：校验结果"],
        ["archive", "本地化 / SJG157", "职责：深圳地方标准语义字典|依据：SJG 157-2024《建筑工程信息模型语义字典标准》|对象：建筑、空间、构件、系统、BOM 类目|关系：openBIM/IFC 语义的本地化发展继承，与 bSDD 不冲突"],
      ],
    },
    cards: [
      ["评审判定", "架构边界可通过：CDE 是受控信息环境，OpenBIM 标准栈和 Workflow/审批审计分层正确。"],
      ["已有证据", "唯一真源、OpenBIM baseline、16 模块 Registry、SJG157 本地化口径和 mayClaim=false 边界已写入文档。"],
      ["未决缺口", "缺真实项目 IFC+IDS+bSDD+BCF+IDM 全链样本、官方 Validate 证据、OpenCDE/API 合同和认证报告。"],
      ["通过门禁", "ready_for_openbim_review 只允许在 IDS、Validate、bSDD、BCF、IDM、审批审计和全链样本齐全后打开；mayClaimBuildingSmartOpenBim 仍为 false。"],
    ],
    callout: "架构结论：CDE 是受控信息环境；IFC、IDS、BCF、bSDD、Validate、SJG157 分别承担模型结构、交付要求、模型协同、语义字典、校验和本地化映射；Workflow 与审批审计决定业务状态。任何模型、图纸、BOM、计量、报价、采购和工单都必须回到同一对象链。",
  },
  {
    eyebrow: "02 / 正向设计闭环",
    title: "AI 辅助生成参数化工程模型草稿，导出开放格式和构件 BOM",
    subtitle: "ArchIToken 的主线不是“聊天生成 3D”，而是把客服对话、客户文字、会议、合同、照片和现场条件结构化为需求参数、空间/系统/构件约束、族/类型/实例映射，生成可复核的工程模型草稿，输出 IFC、STL、STEP、USDZ、OpenUSD 等开放格式，再由模型派生施工图、加工图、构件 BOM、按模计量、材料需求、报价、采购、生产、施工和验收对象。",
    thesis: "正向链路：客服/客户文字/会议/合同/现场条件 -> 需求参数 -> 空间/系统/构件约束 -> Category/Family/Type/Instance 或 IFC 对象映射 -> 工程模型草稿 -> IFC/STL/STEP/USDZ/OpenUSD 格式包 -> 施工图/加工图 -> 构件 BOM -> QTO 按模计量 -> MTO 材料提量 -> BOQ/报价 -> 采购/生产/施工/验收/归档。",
    stats: [
      ["AI", "需求到模型"],
      ["图纸", "施工/加工"],
      ["BOM", "模型导出"],
      ["业务", "算量/材料/报价"],
    ],
    visual: {
      kind: "story",
      nodes: [
        ["text", "客服/客户输入", "输入：客服对话、客户文字、会议纪要、合同、照片、现场条件|处理：抽取空间、功能、尺寸、预算、工期和风险|输出：demand_item"],
        ["param", "需求参数", "输入：demand_item|处理：标准、边界、荷载、材料、位置参数化|输出：requirement_parameter"],
        ["db", "空间/系统/构件约束", "输入：标准构件库、材料库、连接规则、族/类型模板|处理：匹配可生产构件和可交付类型|输出：component_constraint、element_type"],
        ["model", "工程模型草稿", "输入：参数、类型约束和构件实例约束|处理：生成图元/构件实例、几何、属性集、关系、空间定位|输出：IFC/STL/STEP/USDZ/OpenUSD、model_element、element_type、property_set"],
        ["drawing", "施工/加工图", "输入：model_element|处理：平立剖、节点、加工尺寸、孔位、连接、图号、标注|输出：construction_drawing、fabrication_drawing"],
        ["bom", "模型出 BOM", "输入：model_element 属性|处理：类目、编码、尺寸、数量、单重、总重、损耗|输出：bom_line"],
        ["boq", "算量/材料/报价", "输入：BOM、图纸、工程量规则、材料价格|处理：BOQ、材料需求、损耗、税费、报价版本|输出：boq_item、material_requisition、quote_line"],
        ["site", "采购生产施工", "输入：BOM、图纸、材料需求、工单|处理：采购、排产、下料、质检、安装、整改、复验|输出：purchase_request、work_order、acceptance_record"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：路线是 AI 辅助生成工程模型草稿，不是 AI 直接给施工/报审结论。"],
      ["已有证据", "链路已覆盖需求参数、族/类型/实例映射、IFC/STL/STEP/USDZ/OpenUSD、图纸、BOM、QTO/MTO/BOQ。"],
      ["未决缺口", "需要真实项目样本证明模型导出、图纸派生、BOM/QTO/MTO/BOQ 和报价版本能端到端回跳。"],
      ["通过门禁", "AI 输出默认 draft_assist 或 professional_review_required；没有专业复核、Validate 和审批不得发布图纸/BOM/报价。"],
    ],
    callout: "验收口径：任意一个报价项、采购件、加工件、工单或验收点，都能追到需求、构件实例、IFC GUID、图纸页、BOM 行、Validate 结果、审批记录和 Agent 调用。",
  },
  {
    eyebrow: "03 / 工程模型对象",
    title: "模型图元/构件实例 = 类型 + 几何 + 属性集 + 关系",
    subtitle: "不能把 Revit 的图元、族、类型、构件实例和 IFC 的对象、类型、属性集混成一个词。ArchIToken 内部以 model_element 表达可追溯实例，以 element_type/family_ref 表达类型和族定义，以 property_set 管属性。",
    thesis: "model_element 是实例对象，不是族定义；必须保存 ifc_guid 或 external_element_id、category、family_ref、type_ref、geometry_ref、property_set、relations、classification、version_state。图纸和构件 BOM 都从这些对象派生。",
    stats: [
      ["Category", "分类/图元类别"],
      ["Family/Type", "族/类型定义"],
      ["Instance", "构件实例"],
      ["Pset", "属性集"],
    ],
    visual: {
      kind: "hub",
      center: ["model_element", "图元/构件实例"],
      nodes: [
        ["model", "实例标识", "字段：model_element_id、ifc_guid、external_element_id、source_tool|作用：跨 Revit/Tekla/IFC/数据库回跳"],
        ["param", "族/类型", "字段：category、family_ref、type_ref、type_parameters|作用：区分族定义、类型参数和实例参数"],
        ["model", "几何", "字段：axis、profile、length、opening、connection_point、orientation、geometry_ref|来源：IFC/STL/STEP/USDZ/OpenUSD"],
        ["param", "属性集", "字段：Pset、材料、等级、规格、状态、重量、阶段、责任人|作用：驱动 IDS/Validate/BOM"],
        ["db", "分类", "字段：SJG157、本地构件类目、企业材料类目、bSDD URI|作用：命名和检索"],
        ["site", "空间定位", "字段：项目、楼栋、楼层、轴网、空间、构件组、安装面|作用：施工和验收定位"],
        ["drawing", "图纸引用", "字段：drawing_sheet_id、detail_id、图号、视图|作用：模型出图回跳"],
        ["bom", "BOM 引用", "字段：bom_document_id、bom_line_id、数量、重量|作用：采购和算量"],
        ["gateway", "关系/校验", "字段：host、void、aggregate、connects、depends_on|依据：IFC Schema、IDS、企业 Rule、SchemaValidator"],
        ["archive", "版本证据", "字段：source_file、hash、version_state、audit_event、approval_id|作用：追责和复现"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：模型对象已区分 Category、Family/Type、Instance、IFC Entity、Pset 和关系。"],
      ["已有证据", "model_element、element_type、property_set、classification、drawing_ref、bom_ref、version_state 字段边界已明确。"],
      ["未决缺口", "需要把字段合同落到 migration、OpenAPI/JSON Schema、导入映射和前端对象面板验收。"],
      ["通过门禁", "无 ifc_guid/external_element_id、类型定义、属性集、分类、版本证据和审计记录的构件实例不得派生图纸/BOM/QTO。"],
    ],
    callout: "核心判断：ArchIToken 的工程对象不是 Excel 行，也不是聊天文本，而是可回跳到族/类型、IFC 对象、属性集、关系、版本和审计证据的构件实例。",
  },
  {
    eyebrow: "04 / buildingSMART OpenBIM",
    title: "OpenBIM 标准栈：信息容器、模型、语义、要求、校验、模型协同",
    subtitle: "CDE 是项目共享信息环境和管理过程，不是普通网盘；buildingSMART 的 IFC、IDS、BCF、bSDD、Validate 与 SJG157 本地化语义字典围绕同一项目信息容器协同，二者不冲突。",
    thesis: "ArchIToken 的专业落地：CDE 负责文档、模型、元数据、版本、状态、权限、审批和审计；IFC 表达开放工程模型；IDS 声明机器可读交付要求；BCF 作为模型协同格式管理模型协同主题、模型视点、评论、责任、复核和关闭；bSDD 提供开放分类和属性语义；Validate 输出模型与规则校验结果；SJG 157-2024 作为深圳地方标准,把建筑工程信息模型语义字典本地化为建筑、空间、构件、系统类目和编码。",
    stats: [
      ["CDE", "信息环境"],
      ["IFC", "模型 Schema"],
      ["IDS", "交付规范"],
      ["BCF", "模型协同"],
      ["bSDD", "开放语义服务"],
      ["Validate", "模型校验"],
    ],
    visual: {
      kind: "openbim",
      center: ["archive", "CDE 信息环境", "项目协同的受控空间：信息容器、文档版本、模型交付包、状态、元数据、权限、审批和审计"],
      nodes: [
        ["model", "IFC", "角色：开放模型数据结构|对象：IfcProject、IfcSite/Building/Storey、IfcElement、IfcTypeObject、IfcPropertySet、IfcRel* 关系|输出：可交换 IFC"],
        ["param", "IDS", "角色：信息交付规范|对象：阶段、角色、实体类型、分类、属性集、材料、数量要求|输出：机器可读校验条件"],
        ["agent", "BCF", "角色：模型协同格式|对象：模型协同主题 topic、模型视点 viewpoint、评论 comment、document reference、责任和关闭|输出：模型协同闭环"],
        ["db", "bSDD", "角色：开放语义服务|对象：术语、分类、属性、单位、值域、URI|输出：国际语义引用，可与 SJG157 编码双挂接"],
        ["gateway", "Validate", "角色：校验服务|依据：IFC Schema、IDS、语义映射、企业规则|输出：问题清单和报告"],
        ["archive", "本地化 / SJG157", "角色：深圳地方标准语义字典|依据：SJG 157-2024，自 2024-04-01 实施|对象：建筑、空间、构件、系统、BOM 类目|关系：openBIM/IFC 语义的本地化发展继承"],
      ],
    },
    cards: [
      ["评审判定", "标准口径可通过；buildingSMART claim 不通过，必须保持 mayClaimBuildingSmartOpenBim=false。"],
      ["已有证据", "IFC、IDM、IDS、BCF、bSDD、Validate、SJG157、OpenCDE/API 的职责和证据路径已拆开。"],
      ["未决缺口", "缺官方 Validate 服务/CLI 配置证据、BCF/API/Dictionaries 合同测试、认证/一致性报告和真实样本包。"],
      ["通过门禁", "只能进入 ready_for_openbim_review；没有官方 certification/conformance evidence 不得对外宣称 buildingSMART openBIM 认证或全量一致。"],
    ],
    callout: "OpenBIM 验收：一个 Published 交付包必须能回跳到 CDE、IFC、IDS、BCF、bSDD、Validate、审批审计和 SJG157 本地化映射；没有官方 certification/conformance evidence 时 mayClaimBuildingSmartOpenBim 仍为 false。",
  },
  {
    eyebrow: "05 / 构件 BOM 清单",
    title: "BOM/QTO/MTO：从构件实例到计量、材料、报价、加工和施工",
    subtitle: "BOM 不是 Excel 字段表，也不是模型对象本身；它是由构件实例、类型定义、属性集、图纸视图、分类字典和计量规则共同派生的受控清单。QTO 解决按模计量，MTO 解决材料提量，BOM/BOQ/PBOM/MBOM 分别服务设计、造价、采购、制造和施工。",
    thesis: "专业链路：构件实例/IFC GUID -> 类型/族/属性集 -> 图纸视图/节点详图 -> SJG157+bSDD+材料库 -> QTO 按模计量 -> MTO 材料提量 -> 构件 BOM -> BOQ/成本 -> PBOM 采购 -> MBOM 加工 -> 工单/施工/验收。任一行必须有来源对象、计量规则、版本状态、审批证据和价格证据。",
    stats: [
      ["QTO", "按模型/图纸规则计算长度、面积、体积、重量、件数"],
      ["MTO", "按材质、规格、长度、重量、损耗和余量汇总材料"],
      ["BOM/BOQ", "BOM 管构件/材料清单；BOQ 管工程量、成本和报价"],
      ["PBOM/MBOM", "PBOM 服务采购请购；MBOM 服务工厂加工和工序"],
    ],
    visual: {
      kind: "bomChain",
      stages: [
        ["model", "01 模型对象", "model_elements, element_types, property_sets|IFC GUID、构件实例、类型参数、材料、位置、版本"],
        ["drawing", "02 图纸视图", "drawing_sheets, drawing_views, detail_refs|施工图、加工图、节点详图、图号和审签版本"],
        ["db", "03 分类与规则", "sjg157_mappings, bsdd_uri, material_specs, measure_rules|类目编码、命名、单位、计量公式和损耗"],
        ["boq", "04 QTO/MTO", "quantity_takeoffs, material_takeoffs|数量、长度、面积、体积、重量、余量、套数和损耗"],
        ["bom", "05 BOM/BOQ", "bom_documents, bom_versions, bom_lines, boq_items|构件清单、材料清单、工程量、成本和报价行"],
        ["factory", "06 下游执行", "purchase_requests, fabrication_parts, work_orders, installation_tasks|采购、下料、加工、质检、发料、安装和验收"],
      ],
      levels: [
        ["设计/构件 BOM", "按构件实例和类型汇总，服务深化设计、图纸校核和版本差异。"],
        ["MTO 材料提量", "按材质、规格、长度、重量、损耗和余量汇总，服务采购和库存。"],
        ["PBOM 采购 BOM", "按供应商、批次、交期、价格证据和库存可用量组织请购。"],
        ["MBOM 制造 BOM", "按加工件、工序、下料、焊接、涂装、防火、防腐、质检和包装组织生产。"],
      ],
      gates: [
        ["不可缺项", "source_file_id、model_element_id/ifc_guid、drawing_view_id、measure_rule_id、bom_version_id。"],
        ["发布门禁", "Validate、计量规则、专业复核、价格证据、审批状态缺一项不得下游执行。"],
        ["不能混用", "QTO/MTO/BOM/BOQ/PBOM/MBOM 是不同业务视图，不能用一个 Excel 表替代。"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：QTO、MTO、BOM、BOQ、PBOM、MBOM 已分清，不再用一个 Excel 概念覆盖。"],
      ["已有证据", "每行清单要求 source_file、model_element/IFC GUID、drawing_view、measure_rule、bom_version、price_evidence。"],
      ["未决缺口", "需要真实 Excel/IFC/DWG/PDF 样本导入、计量规则库、材料库、价格证据和审批发布测试。"],
      ["通过门禁", "缺构件实例、图纸视图、计量规则、材料规格、价格证据、Validate 或审批状态任一项，不得下发采购/加工/施工。"],
    ],
    callout: "BOM 验收：任意一行 BOM/BOQ/PBOM/MBOM 能回跳到构件实例、IFC GUID、类型定义、属性集、图纸视图、分类字典、计量规则、材料提量、价格证据、校验报告和审批记录。",
  },
  {
    eyebrow: "06 / 数据库设计",
    title: "工程数据库：对象链、调度链、证据链和审计链的控制面",
    subtitle: "PostgreSQL 管业务对象、状态机、元数据合同、模型索引、BOM/QTO/MTO/BOQ、任务调度、Agent 运行、价格证据和审计事件；CDE/ObjectStore 管源文件和交付包；VectorStore 只做可重建检索索引，不做事实真源。",
    thesis: "数据库必须回答：谁在什么项目、基于哪个源文件和 Schema、处理哪个构件实例/图纸视图/BOM/BOQ 版本、调用哪个 Agent/Worker、占用什么 CPU/GPU/NAS 资源、采用哪个价格证据和 Validate/审批结果，最终写入哪个交付对象和审计事件。",
    stats: [
      ["Core", "租户、项目、对象版本、权限、RLS 和责任人"],
      ["OpenBIM", "IFC、IDS、BCF、bSDD、SJG157、Validate 证据"],
      ["Workflow", "workflow_run、approval_task、operation_queue、resource_lock"],
      ["Evidence", "price_evidence、supplier_quote、BCF、Validate、audit_event"],
    ],
    visual: {
      kind: "dataArchitecture",
      layers: [
        ["对象/权限", "tenants, projects, modules, business_objects, object_versions, rbac_policies", "统一对象 ID、版本、状态、责任人和权限；禁止模块复制第二真源。"],
        ["CDE 文件/归档", "module_files, file_versions, object_store_objects, archive_packages", "保存源文件、checksum、派生包、归档包；HTML/PDF/截图不是源格式真源。"],
        ["元数据/Schema", "metadata_objects, metadata_fields, schema_versions, field_dictionary, lineage_edges", "字段、单位、必填、标准来源、SJG157/bSDD、Schema 版本和对象血缘。"],
        ["OpenBIM/计量", "ifc_models, model_elements, element_types, property_sets, drawing_views, quantity_takeoffs, material_takeoffs", "IFC GUID、构件实例、类型、属性集、图纸视图、QTO/MTO 回跳。"],
        ["BOM/造价/执行", "bom_documents, bom_versions, bom_lines, boq_items, quote_lines, purchase_requests, fabrication_parts, work_orders", "BOM、BOQ、报价、采购、加工、施工和验收全部引用对象版本。"],
        ["流程/Agent/证据", "workflow_runs, approval_tasks, operation_queue, resource_locks, agent_runs, price_evidence, validation_results, bcf_topics, audit_events", "调度、限流、Agent、价格、Validate、BCF 模型协同、审批和审计可回放。"],
      ],
      rules: [
        ["事务边界", "业务写入只能走 Gateway；事务内写业务表、audit_events、event_outbox，Worker 异步消费。"],
        ["元数据边界", "前端表格、导入模板、Agent 输出、API Schema 和报表必须引用同一 schema_version。"],
        ["索引边界", "VectorStore/Search 只保存可重建索引；不得把向量、缓存或浏览器本地保存当事实真源。"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：数据库已定位为对象链、调度链、证据链和审计链的控制面，不是 BOM 表。"],
      ["已有证据", "核心表域覆盖 object_versions、schema_versions、operation_queue、resource_locks、agent_runs、price_evidence、validation_results、audit_events。"],
      ["未决缺口", "需要迁移脚本、RLS 负例、OpenAPI/AsyncAPI 合同、容量快照、备份恢复和价格证据 fixture。"],
      ["通过门禁", "业务写入只能走 Gateway；Vector/Search/浏览器缓存不得做事实真源；Agent/Worker 结果必须带 schema_version、object_version 和 audit_event。"],
    ],
    callout: "数据库验收：任意报价、采购、模型派生、BOM/QTO/MTO/BOQ、工单或 Agent 输出，都能回跳到来源文件、对象版本、Schema、workflow_run、operation_queue、resource_lock、agent_run、price_evidence、Validate/BCF 和 audit_event。",
  },
  {
    eyebrow: "07 / 模块应用架构",
    title: "16 个模块围绕同一条模型数据链协同",
    subtitle: "模块不是孤岛，也不是 16 个落地页；它们共用同一套工程对象、CDE、审批、审计、AI 面板和操作队列。",
    thesis: "模块分工：市场客服收集需求并生成报价草稿，设计模块生成类型定义、构件实例和工程模型并输出 IFC/STL/STEP/USDZ/OpenUSD，CDE 管交付容器、版本、状态和审计，构件实例派生施工图、加工图和构件 BOM，BOM 驱动算量、材料、采购、生产、施工、结算和归档证据。",
    stats: [
      ["Registry", "模块注册"],
      ["Workbench", "统一工作台"],
      ["Contract", "对象契约"],
      ["Event", "事件同步"],
    ],
    visual: {
      kind: "zones",
      nodes: [
        ["text", "客服需求与报价", "模块：市场客服、项目计划|输入：客户文字、会议、合同、现场条件|输出：需求项、报价草稿、WBS、里程碑"],
        ["model", "AI 正向设计", "模块：方案设计、深化设计、数字孪生|输出：类型定义、构件实例、IFC/STL/STEP/USDZ/OpenUSD、属性集"],
        ["archive", "OpenBIM CDE", "模块：数字档案、标准库、设置治理|能力：CDE、IFC、IDS、BCF、bSDD、Validate、SJG157"],
        ["bom", "图纸/BOM/计量", "模块：构件物料 BOM、计量造价|输出：施工图、加工图、BOM、BOQ、报价行、成本差异"],
        ["factory", "材料采购生产", "模块：材料物流、生产制造|输出：材料需求、采购单、到料、工单、质检、包装、发运"],
        ["site", "施工验收归档", "模块：施工管理、数字档案、财务/人力|输出：施工日志、验收、整改、结算、员工工时和归档证据"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：16 模块并列 Registry 架构成立，不能退化成 16 个孤立页面或营销入口。"],
      ["已有证据", "MODULES.md 已定义 16 个 active module，统一 Workbench、CDE、审批、审计、AI 面板和操作队列。"],
      ["未决缺口", "每个模块还需补齐输入/输出对象、状态机、权限、专业角色、规则库、Schema 和端到端测试。"],
      ["通过门禁", "新增模块必须走 Registry；不得硬编码 Enum；不得绕过对象版本、CDE 文件、approval_task 和 audit_event。"],
    ],
    callout: "应用架构验收：一个项目从客户需求、合同/会议文件、工程模型草稿、IFC/STL/STEP/USDZ/OpenUSD、施工/加工图、BOM、QTO/MTO/BOQ、商务报价、采购、生产、施工、结算和归档，必须在同一个 project_id、object_id、version_id 与 audit_event 上闭环。",
  },
  {
    eyebrow: "08 / 员工智能体集群",
    title: "面向业务和员工岗位的 Agent 集群",
    subtitle: "每个员工在统一工作台拥有岗位 Copilot；200 个 Agent 是 Registry、策略、工具权限和队列任务目录，不是 200 个常驻 GPU 进程。",
    thesis: "设备分工：srv-01 存 Agent Registry/权限/状态；srv-05 调度队列；srv-04 跑文本、表格、报价、采购、财务、人力等通用 Agent；srv-03 跑 BIM/IFC/STL/STEP/USDZ/OpenUSD、视觉、渲染和本地大模型任务；srv-02 存 CDE/Artifact；srv-06 写审计。",
    stats: [
      ["24-32", "P0 关键 Agent"],
      ["80-120", "商业试点"],
      ["160-200", "成熟生产"],
      ["8条", "上岗规则"],
    ],
    visual: {
      kind: "agents",
      nodes: [
        ["agent", "客服需求 Agent", "服务：客服/销售|输入：微信、电话纪要、合同、图片、现场条件|工具：OCR、会议纪要、合同条款抽取|输出：需求项、预算边界、报价草稿|门禁：无来源文件和客户确认不得进入建模"],
        ["model", "设计建模 Agent", "服务：方案/深化/BIM 工程师|输入：需求参数、构件库、材料库、连接规则|工具：GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD exporter|输出：类型定义、构件实例、工程模型草稿|门禁：不能直接发布"],
        ["drawing", "图纸/BOM Agent", "服务：深化设计、加工技术|输入：已校验模型、图纸模板、BOM 字段规则|工具：drawing_export、fabrication_drawing_export、model_export_bom|输出：施工图、加工图、bom_line|门禁：每行必须回跳构件实例、图纸视图和属性集"],
        ["boq", "计量报价 Agent", "服务：造价、商务报价、经营负责人|输入：BOM、图纸、工程量规则、价格库、税费规则|工具：boq_calc、quote_builder、change_compare|输出：BOQ、报价版本、差异清单|门禁：价格和规则缺失只能出待确认项"],
        ["factory", "采购/生产/施工 Agent", "服务：材料、采购、生产、施工、档案|输入：BOM、库存、供应商、图纸、工单、照片|工具：purchase_request、work_order_split、qc_check、archive_pack|输出：请购草稿、工单、整改、验收、归档包|门禁：不能直接下单、付款或关闭未复核问题"],
        ["db", "协同/调度/数据库 Agent", "服务：项目经理、DBA、系统管理员、采购/造价|组成：CollaborationCoordinator、SchedulingOrchestrator、DatabaseSteward、MetadataGovernance、PriceEvidence|输入：workflow、operation_queue、metadata、capacity、price_evidence|输出：待办重排、限流、Schema/索引建议、价格锁价缺口|门禁：不得自动审批或执行破坏性 SQL"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：200 个 Agent 是 Registry/任务目录/权限边界，不是 200 个常驻进程。"],
      ["已有证据", "已分为岗位 Copilot、业务 Agent、协同调度/数据库 Agent、BIM/GPU Agent，并映射 srv-01/03/04/05/06。"],
      ["未决缺口", "需要 Agent Registry、工具权限、队列隔离、资源锁、失败补偿、成本预算、提示注入防护和负例测试。"],
      ["通过门禁", "固定链路 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver；Agent 不得自动审批、付款、发布或执行破坏性 SQL。"],
    ],
    callout: "AI 员工 = 岗位身份 + 权限边界 + 工作队列 + 工具集 + 模型路由 + 规则校验 + SchemaValidator + 审批链 + 审计记录。200 个 Agent 是注册目录和队列能力，不是 200 个常驻进程；任何工程、采购、付款、施工和归档结论必须人工审批。",
  },
  {
    eyebrow: "09 / 技术架构",
    title: "技术栈围绕 OpenBIM 运行时、CDE 和 Worker 拆分",
    subtitle: "前端负责统一工作台和工程编辑视图，后端负责事务、权限和状态机，CAD/BIM/Office/PDF/AI Worker 负责解析、建模、派生、校验和证据包。",
    thesis: "技术边界：业务逻辑不得直连模型供应商，不得绕过 Gateway 写数据库，不得把 Worker 生成物当真源；写回模型或发布施工图、加工图、BOM、BOQ 和报价必须经 Validate、专业复核和审批。",
    stats: [
      ["Next.js", "工作台"],
      ["OpenBIM", "CDE、IFC、IDS、BCF"],
      ["Rust", "Gateway"],
      ["Workers", "模型/图纸/BOM"],
    ],
    visual: {
      kind: "stack",
      nodes: [
        ["drawing", "前端工作台", "技术：Next.js、React、Monaco、WebGPU|职责：统一工作台、对象面板、审批、AI 面板、工程视图|边界：不写真源"],
        ["model", "模型运行时", "技术：OpenEngineeringEditor、PanAEC、GeometryRouter、IFC/STL/STEP/USDZ/OpenUSD|职责：类型定义、构件实例、IFC 对象、属性集、视图、派生预览"],
        ["gateway", "业务 API", "技术：Rust Gateway、Harness Core、ToolRouter|职责：事务、权限、状态机、服务契约、工具门禁"],
        ["db", "数据真源", "技术：PostgreSQL、ObjectStore/CDE、Outbox、VectorStore|职责：对象链、文件、事件、检索和审计"],
        ["factory", "Worker 集群", "技术：Office/PDF/CAD/BIM/IFC/IDS/Validate/BCF/Drawing/BOM/BOQ/Quote Worker|职责：解析、建模、转换、校验、导图、导 BOM、按模计量、报价、证据包"],
        ["archive", "部署运维", "技术：Docker、K8s、OpenTelemetry、GitOps、JumpServer|职责：发布、日志、指标、备份、恢复、审计"],
      ],
    },
    cards: [
      ["评审判定", "条件通过：前端、Gateway、数据库、CDE、Worker、Router、观测和运维边界正确。"],
      ["已有证据", "已定义 Next.js 工作台、Rust Gateway、PostgreSQL/ObjectStore/CDE、Worker 集群、ModelRouter/ToolRouter/GeometryRouter。"],
      ["未决缺口", "需要 OpenAPI/AsyncAPI、Worker artifact 合同、E2E smoke、GPU/CUDA/IFC worker 证据和发布门禁 CI。"],
      ["通过门禁", "业务逻辑不得直连模型供应商或数据库；Worker 生成物不得当真源；发布态必须经 Validate、专业复核和审批。"],
    ],
    callout: "技术架构验收：输入一段客户需求后，能看到需求参数、对象版本、工程模型草稿、IFC/STL/STEP/USDZ/OpenUSD 导出、IDS/Validate 校验、施工/加工图草稿、BOM/QTO/MTO/BOQ/报价草稿、BCF 模型协同主题、审批事件、审计事件和前端状态同步。",
  },
  {
    eyebrow: "10 / 硬件与落地预算",
    title: "6 台 CPU 服务器 + BIM GPU 双方案",
    subtitle: "一期 CPU 核心物料先支撑 30 人内部生产力和 100/1000 用户试点；NAS 机箱 ¥3,000，每台线材/散热/小配件 ¥1,000，关键节点可按实际需要升到 256GB 或选 Xeon 696X。",
    thesis: "部署设计：srv-01 跑 CDE/API/数据库；srv-02 跑 NAS/备份/CDE 文件；srv-03 跑 BIM/IFC/STEP/STL/USDZ/OpenUSD 模型派生并承接 GPU 方案 A 或 B；srv-04 跑 CI/通用 Worker；srv-05 跑应用/API/任务队列和 200 个 Agent 调度；srv-06 跑 JumpServer/日志/审计/监控。CPU 基线为 2 x Xeon 676X + 4 x Xeon 658X；696X 单价 ¥50,000，按需求升级关键节点。",
    stats: [
      ["6台", "CPU 服务器"],
      ["2+4", "676X / 658X"],
      ["¥340,700", "CPU 核心物料"],
      ["696X", "¥50,000/颗"],
    ],
    visual: {
      kind: "hardwareBom",
      servers: [
        {
          name: "srv-01 CDE/API/数据库",
          role: "PostgreSQL、Gateway、CDE 元数据、Outbox、ModelRouter",
          subtotal: "核心物料 ¥58,450",
          rows: [
            ["面向类型", "核心数据与服务入口节点"],
            ["工作内容", "CDE 元数据、API Gateway、PostgreSQL、Outbox、ModelRouter、权限、审计事件"],
            ["CPU", "Intel Xeon 676X x1，¥25,350；可按需升 Xeon 696X，¥50,000，差价 +¥24,650"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；W890，LGA4710-2，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500；扩容到 4 x 64GB = 256GB"],
            ["系统盘", "Samsung PM9A3 960GB x2，¥8,600，RAID1/镜像"],
            ["机箱", "服务器机箱 x1，¥1,000"],
            ["电源", "服务器电源 x1，¥1,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
          ],
        },
        {
          name: "srv-02 NAS/备份/CDE 文件",
          role: "CDE 文件、IFC/图纸/BOM 派生物、数据库备份、离线归档",
          subtotal: "核心物料 ¥83,200",
          rows: [
            ["面向类型", "NAS、备份、CDE 文件节点"],
            ["工作内容", "CDE 源文件、IFC/STL/STEP/USDZ/OpenUSD、图纸、BOM 派生物、数据库备份、离线归档"],
            ["CPU", "Intel Xeon 658X x1，¥17,500"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；LGA4710-2，W890，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500；后续补到 4 x 64GB = 256GB"],
            ["系统盘", "Samsung PM9A3 960GB x2，¥8,600"],
            ["数据盘", "Toshiba MG11 22TB x4，¥7,400/块，小计 ¥29,600；RAID5 原始 88TB，可用约 66TB"],
            ["机箱/电源", "热插拔 NAS 机箱 ¥3,000；长城服务器电源 x2，¥1,000/个，小计 ¥2,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
          ],
        },
        {
          name: "srv-03 BIM/IFC/模型派生",
          role: "IFC/STL/STEP/USDZ/OpenUSD 导出、模型导图、构件 BOM、Validate Worker",
          subtotal: "核心物料 ¥58,650",
          rows: [
            ["面向类型", "BIM、IFC、开放格式模型派生节点"],
            ["工作内容", "模型生成草稿、IFC/STL/STEP/USDZ/OpenUSD 导出、模型导出图纸、模型导出构件 BOM、Validate 校验"],
            ["CPU", "Intel Xeon 676X x1，¥25,350；可按需升 Xeon 696X，¥50,000，差价 +¥24,650"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；W890，LGA4710-2，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500；按并发扩到 128GB/256GB"],
            ["系统盘", "英睿达/美光 T710 Pro 4TB x1，¥4,800；非关键 Worker 可不用企业级 SSD"],
            ["GPU", "方案A：RTX PRO 6000D 84GB x2，¥136,000；方案B：RTX 5090 32GB 双宽涡轮 x4，¥144,000"],
            ["机箱", "长城黑匣子 15 x1，¥2,000"],
            ["电源", "长城黑匣子 3200W ATX3.1 x1，¥4,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
            ["输出边界", "只生成草稿和派生物，正式产物写回 CDE/NAS，经审批发布"],
          ],
        },
        {
          name: "srv-04 CI/通用 Worker",
          role: "Office/PDF/CAD 解析、批量导入、Schema 校验、测试库、任务执行",
          subtotal: "核心物料 ¥46,800",
          rows: [
            ["面向类型", "CI、通用解析和批处理节点"],
            ["工作内容", "Office/PDF/CAD 解析、批量导入、Schema 校验、CI、测试数据库、任务执行"],
            ["CPU", "Intel Xeon 658X x1，¥17,500"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；W890，LGA4710-2，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500；按并发扩到 128GB"],
            ["系统盘", "英睿达/美光 T710 Pro 4TB x1，¥4,800"],
            ["机箱", "服务器机箱 x1，¥1,000"],
            ["电源", "服务器电源 x1，¥1,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
            ["输出边界", "Worker 不直接写真源库，结果经 Gateway 入库"],
          ],
        },
        {
          name: "srv-05 App/API/队列",
          role: "应用服务、API、任务队列、缓存、Search/Vector 辅助服务",
          subtotal: "核心物料 ¥46,800",
          rows: [
            ["面向类型", "应用、API、任务队列节点"],
            ["工作内容", "模块应用服务、内部 API、任务队列、缓存、Search/Vector 辅助服务、试点入口"],
            ["CPU", "Intel Xeon 658X x1，¥17,500"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；W890，LGA4710-2，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500；按访问量扩到 128GB"],
            ["系统盘", "英睿达/美光 T710 Pro 4TB x1，¥4,800"],
            ["机箱", "服务器机箱 x1，¥1,000"],
            ["电源", "服务器电源 x1，¥1,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
            ["定位", "承接业务流量和队列；与数据库、NAS 分离"],
          ],
        },
        {
          name: "srv-06 JumpServer/日志/审计",
          role: "开源 JumpServer、堡垒机、日志、监控、备份校验、只读审计",
          subtotal: "核心物料 ¥46,800",
          rows: [
            ["面向类型", "堡垒机、日志、审计和监控节点"],
            ["工作内容", "开源 JumpServer、运维入口、日志、监控、备份校验、只读审计、审计报表"],
            ["CPU", "Intel Xeon 658X x1，¥17,500"],
            ["主板", "技嘉 MW94-RP0 x1，¥8,000；W890，LGA4710-2，板载 2 x 10GbE"],
            ["内存", "64GB ECC RDIMM x1，¥13,500"],
            ["系统盘", "英睿达/美光 T710 Pro 4TB x1，¥4,800"],
            ["机箱", "服务器机箱 x1，¥1,000"],
            ["电源", "服务器电源 x1，¥1,000"],
            ["配件", "硬盘线/转接线/散热膏/风扇等，¥1,000"],
            ["隔离", "与生产库、NAS 分离；只开堡垒入口和审计出口"],
          ],
        },
      ],
    },
    cards: [
      ["评审判定", "只通过内部 L2 试点预算；不通过商业生产 HA/SLA 预算。GPU、696X、256GB/512GB 都必须按容量证据触发。"],
      ["已有证据", "6 台 CPU 服务器、NAS/BIM/Worker/API/审计分工、GPU A/B、NAS 热插拔、BIM 3200W 电源、配件和 696X 选项已定义。"],
      ["未决缺口", "网络/安全/UPS/机柜/布线、防火墙、交换机、GPU 上架风道、质保和京东实时截图锁价证据仍未齐。"],
      ["通过门禁", "采购前必须有 SKU、单价截图、captured_at、供应商、质保、替代方案；512GB 只在 PostgreSQL/ZFS/BIM/GPU worker 容量快照持续逼近 256GB 后触发。"],
    ],
    callout: "硬件结论：一期用 6 台 CPU 服务器拆分 CDE、数据库、NAS、Worker、应用队列、200 个 Agent 调度、堡垒机、日志和备份；BIM GPU 按 A/B 双方案择一采购，必须通过服务器机箱、PCIe、供电、风道、驱动、质保和温度监控验收。",
  },
];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTable(rows) {
  return `<table>${rows
    .map((row, index) => `<tr>${row.map((cell) => `<${index === 0 ? "th" : "td"}>${esc(cell)}</${index === 0 ? "th" : "td"}>`).join("")}</tr>`)
    .join("")}</table>`;
}

function renderGrid(items) {
  return `<div class="grid">${items
    .map(([title, body]) => `<div class="card"><b>${esc(title)}</b><p>${esc(body)}</p></div>`)
    .join("")}</div>`;
}

function renderMetrics(items) {
  return `<div class="metrics">${items
    .map(([value, label, note]) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span><small>${esc(note)}</small></div>`)
    .join("")}</div>`;
}

function renderBlocks(items) {
  return `<div class="blocks">${items
    .map(([title, body]) => `<div class="block"><b>${esc(title)}</b><p>${esc(body)}</p></div>`)
    .join("")}</div>`;
}

function renderFlow(items) {
  return `<div class="flow">${items
    .map((item, index) => `<div class="flow-step"><span>${String(index + 1).padStart(2, "0")}</span><b>${esc(item)}</b></div>`)
    .join("")}</div>`;
}

function renderLanes(items) {
  return `<div class="lanes">${items
    .map(([title, body]) => `<div class="lane"><span>${esc(title)}</span><p>${esc(body)}</p></div>`)
    .join("")}</div>`;
}

function renderTimeline(items) {
  return `<div class="timeline">${items
    .map(([title, body]) => `<div class="step"><b>${esc(title)}</b><p>${esc(body)}</p></div>`)
    .join("")}</div>`;
}

function glyph(type) {
  const icons = {
    text: `<svg viewBox="0 0 64 64"><path d="M12 14h40v26H25L14 50V40h-2z"/><path d="M20 23h24M20 31h18"/></svg>`,
    param: `<svg viewBox="0 0 64 64"><path d="M14 18h36M14 32h36M14 46h36"/><circle cx="25" cy="18" r="5"/><circle cx="42" cy="32" r="5"/><circle cx="31" cy="46" r="5"/></svg>`,
    plan: `<svg viewBox="0 0 64 64"><path d="M13 13h38v38H13z"/><path d="M13 27h38M27 13v38M39 13v14M27 39h24"/><path d="M18 18h5v5h-5zM43 33h5v5h-5z"/></svg>`,
    model: `<svg viewBox="0 0 64 64"><path d="M32 8 52 20v24L32 56 12 44V20z"/><path d="M32 8v24m0 24V32M12 20l20 12 20-12M12 44l20-12 20 12"/></svg>`,
    drawing: `<svg viewBox="0 0 64 64"><path d="M16 8h25l9 9v39H16z"/><path d="M41 8v10h9M22 27h20M22 36h14M22 45h22"/><path d="M40 30l8 8"/></svg>`,
    bom: `<svg viewBox="0 0 64 64"><path d="M14 10h36v44H14z"/><path d="M22 20h20M22 30h20M22 40h20"/><path d="M18 19h1M18 29h1M18 39h1"/></svg>`,
    boq: `<svg viewBox="0 0 64 64"><path d="M18 8h28v48H18z"/><path d="M24 16h16v8H24z"/><path d="M24 33h4M32 33h4M40 33h4M24 42h4M32 42h4M40 42h4"/></svg>`,
    factory: `<svg viewBox="0 0 64 64"><path d="M10 52h44V28L40 36V26L26 36V24L10 35z"/><path d="M16 42h8M30 42h8M44 42h4"/><path d="M48 16h6v36h-6z"/></svg>`,
    site: `<svg viewBox="0 0 64 64"><path d="M12 52h40M18 52V18h7v34M25 23h24M49 23v22"/><path d="M32 23l-7 8M40 23l-7 8M49 45l-5 7"/><path d="M15 18h13"/></svg>`,
    archive: `<svg viewBox="0 0 64 64"><path d="M10 20h18l5 6h21v26H10z"/><path d="M10 26h44"/><path d="M32 33l6 5-6 9-6-9z"/></svg>`,
    excel: `<svg viewBox="0 0 64 64"><path d="M16 8h32v48H16z"/><path d="M22 18h20M22 28h20M22 38h20M22 48h20M31 18v30"/><path d="m23 23 8 10m0-10-8 10"/></svg>`,
    db: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="16" rx="20" ry="8"/><path d="M12 16v30c0 4 9 8 20 8s20-4 20-8V16"/><path d="M12 31c0 4 9 8 20 8s20-4 20-8"/></svg>`,
    agent: `<svg viewBox="0 0 64 64"><path d="M18 24h28a8 8 0 0 1 8 8v10a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V32a8 8 0 0 1 8-8z"/><path d="M32 24V12"/><circle cx="24" cy="37" r="4"/><circle cx="40" cy="37" r="4"/><path d="M26 47h12"/></svg>`,
    gateway: `<svg viewBox="0 0 64 64"><path d="M18 30h28v24H18z"/><path d="M24 30v-8a8 8 0 0 1 16 0v8"/><path d="M32 39v7"/><circle cx="32" cy="38" r="3"/></svg>`,
    server: `<svg viewBox="0 0 64 64"><path d="M14 8h36v48H14z"/><path d="M18 16h28M18 28h28M18 40h28"/><circle cx="24" cy="22" r="2"/><circle cx="24" cy="34" r="2"/><circle cx="24" cy="46" r="2"/></svg>`,
    backup: `<svg viewBox="0 0 64 64"><path d="M14 14h36v36H14z"/><path d="M22 14v14h20V14"/><path d="M23 40h18"/><path d="M32 30v14m-6-6 6 6 6-6"/></svg>`,
  };
  return `<span class="glyph">${icons[type] || icons.model}</span>`;
}

function renderStats(items) {
  return `<div class="stats stats-${items.length}">${items
    .map(([value, label]) => `<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`)
    .join("")}</div>`;
}

function renderNodeBody(body) {
  const text = String(body);
  if (!text.includes("|")) return `<span>${esc(text)}</span>`;
  return `<span class="node-lines">${text
    .split("|")
    .map((part) => {
      const [label, ...rest] = part.split("：");
      if (rest.length === 0) return `<em>${esc(part.trim())}</em>`;
      return `<em><strong>${esc(label.trim())}</strong>${esc(rest.join("：").trim())}</em>`;
    })
    .join("")}</span>`;
}

function renderCards(items) {
  return `<div class="mini-cards mini-cards-${items.length}">${items
    .map(([title, body]) => `<div class="mini-card"><b>${esc(title)}</b><span>${esc(body)}</span></div>`)
    .join("")}</div>`;
}

function renderVisualNode([icon, title, body], index = 0) {
  return `<div class="vnode" style="--n:${index}">${glyph(icon)}<b>${esc(title)}</b>${renderNodeBody(body)}</div>`;
}

function renderBomChain(visual) {
  return `<div class="visual bom-chain">
    <div class="bom-stage-row">${visual.stages
      .map(
        ([icon, title, body], index) =>
          `<section class="bom-stage" style="--n:${index}">${glyph(icon)}<b>${esc(title)}</b>${renderNodeBody(body)}</section>`,
      )
      .join("")}</div>
    <div class="bom-level-row">${visual.levels
      .map(([title, body]) => `<section class="bom-level"><b>${esc(title)}</b><span>${esc(body)}</span></section>`)
      .join("")}</div>
    <div class="bom-gate-row">${visual.gates
      .map(([title, body]) => `<section class="bom-gate"><b>${esc(title)}</b><span>${esc(body)}</span></section>`)
      .join("")}</div>
  </div>`;
}

function renderDataArchitecture(visual) {
  return `<div class="visual data-architecture">
    <div class="data-layers">${visual.layers
      .map(
        ([title, tables, duty], index) =>
          `<section class="data-layer" style="--n:${index}"><b>${esc(title)}</b><code>${esc(tables)}</code><span>${esc(duty)}</span></section>`,
      )
      .join("")}</div>
    <div class="data-rules">${visual.rules
      .map(([title, body]) => `<section class="data-rule"><b>${esc(title)}</b><span>${esc(body)}</span></section>`)
      .join("")}</div>
  </div>`;
}

function renderVisual(slide) {
  const visual = slide.visual;
  if (!visual) return "";
  if (visual.kind === "openbim") {
    return `<div class="visual openbim-map">
      <div class="openbim-center">${glyph(visual.center[0])}<b>${esc(visual.center[1])}</b><span>${esc(visual.center[2])}</span></div>
      <div class="openbim-nodes">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>
    </div>`;
  }
  if (visual.kind === "hub") {
    return `<div class="visual hub">
      <div class="hub-core">${glyph("model")}<b>${esc(visual.center[0])}</b><span>${esc(visual.center[1])}</span></div>
      <div class="hub-nodes">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>
    </div>`;
  }
  if (visual.kind === "fork") {
    return `<div class="visual fork">
      <div class="fork-side">${visual.left.map((node, index) => renderVisualNode(node, index)).join("")}</div>
      <div class="fork-core">${renderVisualNode(visual.center)}</div>
      <div class="fork-side">${visual.right.map((node, index) => renderVisualNode(node, index)).join("")}</div>
    </div>`;
  }
  if (visual.kind === "bomChain") {
    return renderBomChain(visual);
  }
  if (visual.kind === "dataArchitecture") {
    return renderDataArchitecture(visual);
  }
  if (visual.kind === "schema") {
    return `<div class="visual schema-map">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  if (visual.kind === "zones") {
    return `<div class="visual zones-map">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  if (visual.kind === "gates" || visual.kind === "agents") {
    return `<div class="visual gateflow ${visual.kind}">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  if (visual.kind === "stack") {
    return `<div class="visual stack-map">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  if (visual.kind === "hardwareBom") {
    return `<div class="visual hardware-bom">${visual.servers
      .map(
        (server) => `<section class="server-bom">
          <header><b>${esc(server.name)}</b><span>${esc(server.role)}</span><strong>${esc(server.subtotal)}</strong></header>
          <table>${server.rows
            .map(([item, spec]) => `<tr><th>${esc(item)}</th><td>${esc(spec)}</td></tr>`)
            .join("")}</table>
        </section>`,
      )
      .join("")}</div>`;
  }
  if (visual.kind === "hardware") {
    return `<div class="visual hardware-map">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  if (visual.kind === "roadmap") {
    return `<div class="visual roadmap-map">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
  }
  return `<div class="visual storyboard">${visual.nodes.map((node, index) => renderVisualNode(node, index)).join("")}</div>`;
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ArchIToken 10页架构评审版</title>
<style>
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #02020a; color: #edf7ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", Arial, sans-serif; }
.slide {
  width: 13.333in; height: 7.5in; page-break-after: always; padding: .27in .34in .23in .36in;
  position: relative; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; gap: .12in;
  background:
    radial-gradient(circle at 1px 1px, rgba(0, 209, 255, .20) 1px, transparent 1.7px) 0 0 / 18px 18px,
    linear-gradient(90deg, rgba(0, 209, 255, .06) 0 1px, transparent 1px 54px),
    linear-gradient(0deg, rgba(255, 79, 216, .050) 0 1px, transparent 1px 54px),
    radial-gradient(circle at 12% 16%, rgba(0, 209, 255, .18), transparent 22%),
    radial-gradient(circle at 86% 18%, rgba(255, 79, 216, .14), transparent 20%),
    linear-gradient(180deg, #050713 0%, #02030a 68%, #020209 100%);
  border-top: .045in solid transparent;
  border-image: linear-gradient(90deg, #00d1ff, #9d4edd, #ff4fd8, #ffcc66) 1;
}
.slide:before {
  content: ""; position: absolute; inset: .20in .28in .48in; pointer-events: none;
  border: 1px solid rgba(124, 222, 255, .18);
  border-radius: 2px;
  background:
    linear-gradient(90deg, rgba(0, 209, 255, .10), transparent 28%, transparent 72%, rgba(255, 79, 216, .12)),
    repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 1px, transparent 1px 9px);
  opacity: .70;
}
.slide:after {
  content: "0" attr(data-page); position: absolute; right: .36in; bottom: .28in; color: rgba(157, 78, 221, .18);
  font-size: 42px; font-weight: 900; line-height: 1; letter-spacing: .08em;
}
.holo { display: none; }
.head { position: relative; z-index: 1; border-bottom: 1px solid rgba(124, 222, 255, .36); padding-bottom: .085in; max-width: 12.05in; }
.head:after {
  content: ""; position: absolute; left: 0; bottom: -2px; width: 3.4in; height: 3px;
  background: linear-gradient(90deg, #00d1ff, #9d4edd, rgba(255,79,216,0));
  box-shadow: 0 0 18px rgba(0, 224, 255, .30), 0 0 26px rgba(157, 78, 221, .16);
}
.eyebrow {
  display: inline-block; padding: .030in .105in; border-radius: 7px; background: linear-gradient(90deg, rgba(0,224,255,.16), rgba(157,78,221,.15));
  color: #dff8ff; border: 1px solid rgba(124, 222, 255, .44);
  font-size: 10.6px; font-weight: 900; letter-spacing: .03em;
  box-shadow: 0 0 18px rgba(0, 224, 255, .12);
}
h1 { margin: .045in 0 0; font-size: 32px; line-height: 1.04; letter-spacing: 0; color: #f7fbff; font-weight: 950; text-shadow: 0 0 18px rgba(0, 224, 255, .20), 0 0 26px rgba(157, 78, 221, .12); }
.subtitle { margin: .048in 0 0; color: #b5c7d9; font-size: 12.5px; line-height: 1.34; max-width: 12.15in; font-weight: 540; }
.body { min-height: 0; display: grid; align-content: start; gap: .09in; position: relative; z-index: 1; }
.thesis {
  background: linear-gradient(90deg, rgba(255, 204, 102, .18), rgba(10, 8, 20, .76)); color: #fff1c7; border: 1px solid rgba(255, 204, 102, .52); border-left: .080in solid #ffcc66;
  border-radius: 7px; padding: .066in .12in; font-size: 12.7px; line-height: 1.32; font-weight: 840;
  box-shadow: 0 0 20px rgba(255, 204, 102, .08), inset 0 0 18px rgba(255, 204, 102, .035);
}
ul { margin: .02in 0 0 .18in; padding: 0; font-size: 11.7px; line-height: 1.30; color: #e3f8ff; }
li { margin: .03in 0; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: .09in; }
.metric {
  position: relative; border: 1px solid rgba(124, 222, 255, .26); background: linear-gradient(180deg, rgba(13, 17, 36, .76), rgba(5, 7, 18, .84));
  border-radius: 10px; padding: .064in .085in; min-height: .61in;
  box-shadow: inset 0 0 24px rgba(0, 224, 255, .035), 0 0 18px rgba(157, 78, 221, .07);
}
.metric:before { content: ""; position: absolute; left: .075in; right: .075in; top: 0; height: 2px; background: linear-gradient(90deg, #00e0ff, #9d4edd, transparent); opacity: .88; }
.metric strong { display: block; color: #ff5d8f; font-size: 25px; line-height: 1; font-weight: 950; text-shadow: 0 0 14px rgba(255, 93, 143, .18); }
.metric:nth-child(2n) strong { color: #00d1ff; text-shadow: 0 0 12px rgba(0, 209, 255, .22); }
.metric:nth-child(3n) strong { color: #ffcc66; text-shadow: 0 0 12px rgba(255, 204, 102, .20); }
.metric span { display: block; margin-top: .032in; font-size: 11.3px; font-weight: 900; color: #effff5; }
.metric small { display: block; margin-top: .018in; font-size: 9.7px; color: #98abc0; }
.grid, .blocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: .085in; }
.card, .block {
  position: relative; border: 1px solid rgba(124, 222, 255, .24); background: rgba(8, 11, 26, .72); border-radius: 10px;
  padding: .075in .095in .075in .16in; min-height: .61in; box-shadow: inset 0 0 18px rgba(101, 231, 255, .025);
}
.card:before, .block:before {
  content: ""; position: absolute; left: 0; top: .075in; bottom: .075in; width: 3px; border-radius: 2px;
  background: linear-gradient(180deg, #00d1ff, #9d4edd, rgba(255, 79, 216, .22));
  box-shadow: 0 0 12px rgba(0, 224, 255, .22);
}
.card b, .block b { display: block; color: #65e7ff; font-size: 11.8px; margin-bottom: .028in; font-weight: 950; }
.card p, .block p { margin: 0; font-size: 10.0px; line-height: 1.27; color: #dcecff; }
.flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: .075in; }
.flow-step {
  position: relative; border: 1px solid rgba(124, 222, 255, .26); background: rgba(7, 9, 23, .76); border-radius: 8px; padding: .060in .075in;
  min-height: .48in; box-shadow: inset 0 0 12px rgba(0, 224, 255, .025);
}
.flow-step span {
  display: inline-block; background: rgba(157, 78, 221, .16); color: #e7d8ff; border: 1px solid rgba(157, 78, 221, .45); border-radius: 5px; padding: .010in .050in;
  font-size: 9.3px; font-weight: 950;
}
.flow-step b { display: block; margin-top: .025in; font-size: 10.4px; color: #effff5; font-weight: 900; }
.flow-step:not(:last-child):after { content: "→"; position: absolute; right: -.065in; top: 50%; transform: translateY(-50%); color: #ff4fd8; font-weight: 950; }
table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid rgba(124, 222, 255, .26); border-radius: 8px; font-size: 9.55px; line-height: 1.24; color: #edf7ff; background: rgba(3, 6, 18, .86); }
th, td { border-right: 1px solid rgba(124, 222, 255, .13); border-bottom: 1px solid rgba(124, 222, 255, .12); padding: .044in .055in; vertical-align: top; }
th:last-child, td:last-child { border-right: 0; }
tr:last-child td { border-bottom: 0; }
th { background: linear-gradient(90deg, rgba(0, 224, 255, .14), rgba(157, 78, 221, .12)); color: #dff8ff; font-weight: 950; }
td { background: rgba(7, 10, 24, .62); }
.lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: .075in; }
.lane { border-left: 4px solid #9d4edd; background: rgba(8, 11, 26, .68); padding: .050in .075in; border-radius: 8px; border-top: 1px solid rgba(124, 222, 255, .16); border-right: 1px solid rgba(124, 222, 255, .16); border-bottom: 1px solid rgba(124, 222, 255, .16); }
.lane span { display: block; color: #c7a2ff; font-weight: 900; font-size: 11px; }
.lane p { margin: .020in 0 0; font-size: 9.0px; line-height: 1.18; color: #dcecff; }
.timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: .075in .085in; }
.step { border: 1px solid rgba(124, 222, 255, .24); border-radius: 8px; padding: .060in .075in; background: rgba(8, 11, 26, .72); min-height: .50in; box-shadow: inset 0 0 12px rgba(157, 78, 221, .035); }
.step b { display: inline-block; color: #dff8ff; background: rgba(0, 224, 255, .10); border: 1px solid rgba(124, 222, 255, .34); border-radius: 5px; padding: .010in .055in; font-size: 10px; }
.step p { margin: .028in 0 0; font-size: 9.55px; line-height: 1.22; color: #dcecff; }
.callout {
  border: 1px solid rgba(255, 79, 216, .36); background: linear-gradient(90deg, rgba(255, 79, 216, .13), rgba(0, 209, 255, .08), rgba(7, 9, 23, .88)); color: #fff7ff; border-radius: 8px; padding: .060in .10in;
  font-size: 11.4px; line-height: 1.28; font-weight: 900;
  box-shadow: 0 0 18px rgba(0, 209, 255, .08), inset 0 0 18px rgba(255, 79, 216, .035);
}
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .075in; }
.stat {
  min-height: .44in; border: 1px solid rgba(101, 231, 255, .28); border-radius: 9px; padding: .050in .075in;
  background: linear-gradient(180deg, rgba(0, 209, 255, .08), rgba(8, 9, 28, .78));
  box-shadow: inset 0 0 20px rgba(0, 209, 255, .035), 0 0 22px rgba(157, 78, 221, .08);
}
.stat strong { display: block; color: #ff5d8f; font-size: 22px; line-height: .95; font-weight: 950; text-shadow: 0 0 16px rgba(255, 93, 143, .24); }
.stat:nth-child(2) strong { color: #00d1ff; text-shadow: 0 0 16px rgba(0, 209, 255, .24); }
.stat:nth-child(3) strong { color: #ffcc66; text-shadow: 0 0 16px rgba(255, 204, 102, .20); }
.stat:nth-child(4) strong { color: #c7a2ff; text-shadow: 0 0 16px rgba(157, 78, 221, .26); }
.stat span { display: block; color: #dcecff; font-size: 10.6px; font-weight: 850; margin-top: .025in; }
.visual {
  position: relative; min-height: 2.72in; border: 1px solid rgba(101, 231, 255, .22); border-radius: 12px;
  background:
    radial-gradient(circle at 2px 2px, rgba(255, 255, 255, .11) 1px, transparent 1.6px) 0 0 / 16px 16px,
    linear-gradient(90deg, rgba(0, 209, 255, .045) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 79, 216, .040) 0 1px, transparent 1px 34px),
    rgba(2, 4, 16, .88);
  box-shadow: inset 0 0 30px rgba(0, 209, 255, .035), 6px 6px 0 rgba(255, 79, 216, .10);
  overflow: hidden; padding: .10in;
}
.visual:before {
  content: ""; position: absolute; inset: .08in; border: 1px solid rgba(255, 255, 255, .07); border-radius: 8px; pointer-events: none;
}
.glyph { display: grid; place-items: center; width: .45in; height: .45in; color: currentColor; flex: 0 0 auto; }
.glyph svg { width: 100%; height: 100%; stroke: currentColor; fill: none; stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 7px currentColor); }
.vnode {
  position: relative; color: #65e7ff; border: 1px solid rgba(101, 231, 255, .28); border-radius: 12px; padding: .075in .085in;
  background:
    linear-gradient(135deg, rgba(255,255,255,.050) 0 1px, transparent 1px 10px),
    rgba(3, 5, 16, .94);
  box-shadow: 3px 3px 0 rgba(0, 209, 255, .08), inset 0 0 18px rgba(255, 255, 255, .020);
}
.vnode:nth-child(2n) { color: #ffcc66; border-color: rgba(255, 204, 102, .28); box-shadow: 0 0 20px rgba(255, 204, 102, .06); }
.vnode:nth-child(3n) { color: #ff5d8f; border-color: rgba(255, 93, 143, .28); box-shadow: 0 0 20px rgba(255, 93, 143, .06); }
.vnode:nth-child(4n) { color: #c7a2ff; border-color: rgba(199, 162, 255, .28); box-shadow: 0 0 20px rgba(157, 78, 221, .07); }
.vnode b { display: block; margin-top: .035in; color: #f5fbff; font-size: 13px; line-height: 1.04; font-weight: 950; text-shadow: 0 0 10px rgba(255,255,255,.10); }
.vnode span { display: block; margin-top: .025in; color: #aec4d8; font-size: 9.2px; line-height: 1.20; font-weight: 680; }
.hub { display: grid; grid-template-columns: 2.35in 1fr; gap: .12in; align-items: stretch; }
.hub-core {
  display: grid; place-items: center; align-content: center; text-align: center; color: #ffcc66;
  border: 1px solid rgba(255, 204, 102, .36); border-radius: 16px;
  background: radial-gradient(circle, rgba(255, 204, 102, .18), rgba(157, 78, 221, .12) 52%, rgba(0, 209, 255, .06));
  box-shadow: inset 0 0 46px rgba(255, 204, 102, .08), 0 0 34px rgba(157, 78, 221, .16);
}
.hub-core .glyph { width: .78in; height: .78in; }
.hub-core b { color: #fff7dd; font-size: 18px; margin-top: .06in; }
.hub-core span { color: #d5c8ff; font-size: 10px; margin-top: .035in; }
.hub-nodes { display: grid; grid-template-columns: repeat(4, 1fr); gap: .075in; }
.storyboard { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); gap: .075in; }
.storyboard .vnode:not(:last-child):after, .gateflow .vnode:not(:last-child):after, .roadmap-map .vnode:not(:last-child):after {
  content: "→"; position: absolute; right: -.060in; top: 50%; transform: translateY(-50%); color: #ff4fd8; font-size: 18px; font-weight: 950; z-index: 2;
}
.fork { display: grid; grid-template-columns: 1.9in 1fr 2.35in; gap: .12in; align-items: center; }
.fork-side { display: grid; gap: .09in; }
.fork-side .vnode { min-height: .83in; }
.fork-core .vnode { min-height: 2.08in; display: grid; place-items: center; align-content: center; text-align: center; border-color: rgba(255, 204, 102, .45); }
.fork-core .glyph { width: .82in; height: .82in; }
.schema-map { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); gap: .075in; }
.schema-map .vnode:after { content: ""; position: absolute; right: -.075in; top: 50%; width: .075in; height: 1px; background: rgba(255, 79, 216, .55); }
.zones-map { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: .095in; }
.zones-map .vnode { min-height: 1.05in; padding: .10in; }
.gateflow, .agents { display: grid; grid-template-columns: repeat(6, 1fr); gap: .075in; align-items: stretch; }
.gateflow .vnode { min-height: 2.35in; display: grid; align-content: center; text-align: center; }
.gateflow .glyph { justify-self: center; width: .58in; height: .58in; }
.stack-map { display: grid; grid-template-columns: repeat(2, 1fr); gap: .075in; }
.stack-map .vnode { display: flex; align-items: center; gap: .08in; min-height: .74in; }
.stack-map .vnode b, .stack-map .vnode span { margin-top: 0; }
.hardware-map { display: grid; grid-template-columns: repeat(4, 1fr); gap: .085in; }
.hardware-map .vnode { min-height: 2.25in; display: grid; align-content: center; text-align: center; }
.hardware-map .glyph { justify-self: center; width: .70in; height: .70in; }
.roadmap-map { display: grid; grid-template-columns: repeat(6, 1fr); gap: .065in; }
.roadmap-map .vnode { min-height: 2.35in; display: grid; align-content: center; text-align: center; }
.roadmap-map .glyph { justify-self: center; width: .56in; height: .56in; }
.mini-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: .075in; }
.mini-card {
  border: 1px solid rgba(199, 162, 255, .24); border-radius: 9px; padding: .060in .08in;
  background: linear-gradient(180deg, rgba(157, 78, 221, .10), rgba(8, 9, 28, .72));
  min-height: .48in;
}
.mini-card b { display: block; color: #ffcc66; font-size: 10.8px; font-weight: 950; margin-bottom: .020in; }
.mini-card span { display: block; color: #dcecff; font-size: 9.2px; line-height: 1.20; }
.foot { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; color: #8094ad; font-size: 8.8px; border-top: 1px solid rgba(124, 222, 255, .16); padding-top: .052in; position: relative; z-index: 1; }
.page { color: #65e7ff; font-weight: 950; justify-self: center; }
.foot .spacer { min-width: 1px; }

/* Light comic investor infographic override. */
body { background: #dfeaf0; color: #101a2f; }
.slide {
  color: #101a2f;
  border-top: .035in solid #0b2b4a;
  border-image: none;
  background:
    linear-gradient(90deg, rgba(35, 74, 102, .10) 0 1px, transparent 1px 32px),
    linear-gradient(0deg, rgba(35, 74, 102, .10) 0 1px, transparent 1px 32px),
    radial-gradient(circle at 88% 10%, rgba(0, 122, 150, .10), transparent 24%),
    #f7fbfb;
}
.slide:before {
  inset: .18in .28in .46in;
  border: 2px solid rgba(13, 35, 58, .20);
  border-radius: 14px;
  background:
    repeating-linear-gradient(135deg, rgba(13, 35, 58, .030) 0 1px, transparent 1px 11px),
    linear-gradient(180deg, rgba(255,255,255,.70), rgba(235,247,247,.52));
  opacity: 1;
}
.slide:after {
  right: .40in; bottom: .30in; color: rgba(15, 59, 91, .12);
  font-size: 34px; letter-spacing: .04em;
}
.head {
  border-bottom: 2px solid rgba(15, 59, 91, .16);
  padding-bottom: .060in;
}
.head:after {
  bottom: -3px; width: 2.4in; height: 4px;
  background: linear-gradient(90deg, #0b2b4a, #2f83a3, rgba(47,131,163,0));
  box-shadow: none;
}
.eyebrow {
  background: #0b2b4a;
  color: #fff;
  border: 2px solid #0b2b4a;
  border-radius: 8px;
  box-shadow: 3px 3px 0 rgba(13, 35, 58, .16);
  font-size: 10.8px;
}
h1 {
  color: #07172f;
  font-size: 30px;
  text-shadow: none;
}
.subtitle {
  color: #29435a;
  font-size: 12.1px;
  font-weight: 760;
}
.thesis {
  color: #07172f;
  background: #fff4bd;
  border: 2px solid #0b2b4a;
  border-left: .075in solid #f5b400;
  border-radius: 10px;
  box-shadow: 3px 3px 0 rgba(13, 35, 58, .16);
  font-size: 12px;
}
.stats { gap: .070in; }
.stat {
  background: #ffffff;
  border: 2px solid #0b2b4a;
  border-radius: 10px;
  box-shadow: 4px 4px 0 rgba(13, 35, 58, .15);
  min-height: .44in;
}
.stat strong {
  color: #d9304f;
  text-shadow: none;
  font-size: 22px;
}
.stat:nth-child(2) strong { color: #0b6f98; text-shadow: none; }
.stat:nth-child(3) strong { color: #c47b00; text-shadow: none; }
.stat:nth-child(4) strong { color: #244e8f; text-shadow: none; }
.stat span { color: #0b2b4a; font-size: 10.5px; }
.visual {
  border: 2px solid #0b2b4a;
  border-radius: 12px;
  background:
    radial-gradient(circle at 2px 2px, rgba(11, 43, 74, .12) 1.2px, transparent 1.9px) 0 0 / 18px 18px,
    linear-gradient(180deg, #ffffff, #eef8f9);
  box-shadow: 5px 5px 0 rgba(13, 35, 58, .14);
}
.visual:before {
  inset: .07in;
  border: 1px dashed rgba(11, 43, 74, .18);
  border-radius: 8px;
}
.glyph { color: inherit; }
.glyph svg {
  stroke: #0b2b4a;
  filter: none;
}
.vnode {
  color: #0b6f98;
  background: #ffffff;
  border: 2px solid #0b2b4a;
  border-radius: 12px;
  box-shadow: 4px 4px 0 rgba(13, 35, 58, .13);
}
.vnode:nth-child(2n) { color: #c47b00; border-color: #0b2b4a; box-shadow: 4px 4px 0 rgba(13, 35, 58, .13); }
.vnode:nth-child(3n) { color: #d9304f; border-color: #0b2b4a; box-shadow: 4px 4px 0 rgba(13, 35, 58, .13); }
.vnode:nth-child(4n) { color: #244e8f; border-color: #0b2b4a; box-shadow: 4px 4px 0 rgba(13, 35, 58, .13); }
.vnode b {
  color: #07172f;
  text-shadow: none;
  font-size: 13px;
}
.vnode span {
  color: #324b62;
  font-weight: 780;
}
.hub-core {
  color: #244e8f;
  background: #eff6ff;
  border: 2px solid #0b2b4a;
  box-shadow: 4px 4px 0 rgba(13, 35, 58, .13);
}
.hub-core b { color: #07172f; }
.hub-core span { color: #324b62; }
.storyboard .vnode:not(:last-child):after, .gateflow .vnode:not(:last-child):after, .roadmap-map .vnode:not(:last-child):after {
  color: #d9304f;
  text-shadow: 1px 1px 0 #fff;
}
.fork-core .vnode { border-color: #0b2b4a; background: #fff9df; }
.schema-map .vnode:after { background: rgba(11, 43, 74, .50); }
.mini-card {
  background: #ffffff;
  border: 2px solid #0b2b4a;
  border-radius: 10px;
  box-shadow: 3px 3px 0 rgba(13, 35, 58, .13);
}
.mini-card b {
  color: #0b6f98;
  font-size: 10.8px;
}
.mini-card span {
  color: #29435a;
  font-weight: 720;
}
.callout {
  color: #07172f;
  background: #e7f5ec;
  border: 2px solid #0b2b4a;
  border-left: .075in solid #1d8d58;
  border-radius: 10px;
  box-shadow: 3px 3px 0 rgba(13, 35, 58, .15);
  font-size: 11.1px;
}
.foot {
  color: #486176;
  border-top: 1px solid rgba(11, 43, 74, .18);
}
.page {
  color: #0b2b4a;
}

/* Reference-style light infographic override: white-blue report card, bold comic sections. */
body { background: #d8e9f1; }
.slide {
  padding: .20in .26in .20in .26in;
  border-top: 0;
  background:
    radial-gradient(circle at 96% 5%, rgba(91, 170, 192, .20), transparent 18%),
    linear-gradient(90deg, rgba(33, 64, 92, .08) 0 1px, transparent 1px 30px),
    linear-gradient(0deg, rgba(33, 64, 92, .08) 0 1px, transparent 1px 30px),
    #f2f9fb;
}
.slide:before {
  inset: .13in .18in .38in;
  border: 2.5px solid #193a59;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.94), rgba(232,246,250,.84)),
    repeating-linear-gradient(135deg, rgba(18, 61, 90, .04) 0 1px, transparent 1px 10px);
}
.slide:after {
  right: .33in;
  bottom: .27in;
  color: rgba(25, 58, 89, .13);
  font-size: 42px;
  font-weight: 950;
}
.head {
  padding: .02in .04in .06in;
  border-bottom: 3px solid #d8e7ed;
}
.head:after {
  left: .04in;
  bottom: -4px;
  width: 3.1in;
  height: 5px;
  background: #193a59;
}
.eyebrow {
  background: #123b5d;
  border: 0;
  color: #fff;
  border-radius: 10px;
  padding: .040in .105in;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .18);
}
h1 {
  color: #0b1d35;
  font-size: 31.5px;
  line-height: 1.02;
  letter-spacing: 0;
}
.subtitle {
  color: #29475e;
  font-size: 12.4px;
  line-height: 1.22;
  font-weight: 780;
}
.body {
  gap: .075in;
  padding: 0 .02in;
}
.thesis {
  border: 2.5px solid #193a59;
  border-left: .085in solid #f2b42b;
  background: #fff4bf;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .16);
  font-size: 12.2px;
  line-height: 1.22;
  padding: .055in .10in;
}
.stats {
  gap: .060in;
}
.stat {
  position: relative;
  min-height: .46in;
  padding: .050in .085in .050in;
  border: 2.5px solid #193a59;
  background: #fff;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .16);
}
.stat:after {
  content: "";
  position: absolute;
  left: .08in;
  right: .08in;
  bottom: .045in;
  height: 4px;
  border-radius: 3px;
  background: rgba(91, 170, 192, .20);
}
.stat strong {
  font-size: 23px;
  line-height: .9;
}
.stat span {
  font-size: 10.2px;
  line-height: 1.05;
}
.visual {
  min-height: 3.05in;
  border: 2.5px solid #193a59;
  border-radius: 16px;
  padding: .09in;
  background:
    radial-gradient(circle at 2px 2px, rgba(25, 58, 89, .13) 1.1px, transparent 1.9px) 0 0 / 18px 18px,
    linear-gradient(180deg, #ffffff, #edf8fb);
  box-shadow: 5px 5px 0 rgba(25, 58, 89, .15);
}
.visual:before {
  inset: .055in;
  border: 1.5px dashed rgba(25, 58, 89, .20);
}
.vnode {
  display: grid;
  grid-template-columns: .50in 1fr;
  align-items: center;
  column-gap: .075in;
  padding: .070in .082in;
  border: 2.5px solid #193a59;
  background: #fff;
  border-radius: 12px;
  box-shadow: 3.5px 3.5px 0 rgba(25, 58, 89, .14);
}
.vnode .glyph {
  grid-row: span 2;
}
.glyph {
  width: .46in;
  height: .46in;
  color: #193a59;
}
.glyph svg {
  stroke: #193a59;
  stroke-width: 3.8;
}
.vnode b {
  margin: 0;
  color: #07172f;
  font-size: 13.4px;
  line-height: 1.05;
}
.vnode span {
  margin: .012in 0 0;
  color: #304f68;
  font-size: 9.5px;
  line-height: 1.12;
  font-weight: 780;
}
.vnode .node-lines {
  display: grid;
  gap: .014in;
  margin-top: .026in;
}
.vnode .node-lines em {
  display: block;
  font-style: normal;
  color: #304f68;
}
.vnode .node-lines strong {
  color: #0b2b4a;
  font-weight: 950;
  margin-right: .020in;
}
.vnode:nth-child(1), .stat:nth-child(1) { color: #d9304f; background: #fff7f7; }
.vnode:nth-child(2), .stat:nth-child(2) { color: #0b74a5; background: #f2fbff; }
.vnode:nth-child(3), .stat:nth-child(3) { color: #c47b00; background: #fff9e4; }
.vnode:nth-child(4), .stat:nth-child(4) { color: #25589f; background: #f2f6ff; }
.vnode:nth-child(5) { color: #1a7e58; background: #f2fff8; }
.vnode:nth-child(6) { color: #bd6b2a; background: #fff6ed; }
.vnode:nth-child(7) { color: #6c4fc8; background: #f7f2ff; }
.vnode:nth-child(8) { color: #23516f; background: #f6fbff; }
.openbim-map {
  display: grid;
  grid-template-columns: 2.55in 1fr;
  gap: .080in;
  align-items: stretch;
}
.openbim-center {
  display: grid;
  align-content: center;
  justify-items: center;
  text-align: center;
  padding: .13in .12in;
  border: 2.5px solid #193a59;
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 28%, #ffffff 0 19%, #d8eef7 20% 100%);
  box-shadow: 4px 4px 0 rgba(25, 58, 89, .15);
}
.openbim-center .glyph {
  width: .74in;
  height: .74in;
}
.openbim-center b {
  display: block;
  margin-top: .055in;
  color: #07172f;
  font-size: 19px;
  line-height: 1.04;
  font-weight: 950;
}
.openbim-center span {
  display: block;
  max-width: 2.15in;
  margin-top: .040in;
  color: #304f68;
  font-size: 9.7px;
  line-height: 1.18;
  font-weight: 780;
}
.openbim-nodes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: .064in;
}
.openbim-nodes .vnode {
  min-height: 1.17in;
}
.bom-chain {
  display: grid;
  grid-template-rows: 1.50in .66in .48in;
  gap: .058in;
}
.bom-stage-row,
.bom-level-row,
.bom-gate-row {
  position: relative;
  z-index: 1;
  display: grid;
  gap: .052in;
}
.bom-stage-row { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); }
.bom-level-row { grid-template-columns: repeat(4, 1fr); }
.bom-gate-row { grid-template-columns: repeat(3, 1fr); }
.bom-stage,
.bom-level,
.bom-gate,
.data-layer,
.data-rule {
  position: relative;
  border: 2.5px solid #193a59;
  border-radius: 12px;
  background: #fff;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .14);
}
.bom-stage {
  display: grid;
  grid-template-columns: .35in 1fr;
  grid-template-rows: auto 1fr;
  align-content: start;
  column-gap: .055in;
  padding: .050in .060in;
}
.bom-stage:nth-child(1) { background: #fff7f7; }
.bom-stage:nth-child(2) { background: #f2fbff; }
.bom-stage:nth-child(3) { background: #fff9e4; }
.bom-stage:nth-child(4) { background: #f2f6ff; }
.bom-stage:nth-child(5) { background: #f2fff8; }
.bom-stage:nth-child(6) { background: #fff6ed; }
.bom-stage:not(:last-child):after {
  content: "";
  position: absolute;
  right: -.030in;
  top: 50%;
  width: .030in;
  height: 2px;
  background: #d9304f;
  z-index: 2;
}
.bom-stage .glyph {
  grid-row: span 2;
  width: .30in;
  height: .30in;
}
.bom-stage b,
.bom-level b,
.bom-gate b,
.data-layer b,
.data-rule b {
  display: block;
  color: #07172f;
  font-weight: 950;
}
.bom-stage b {
  font-size: 11.3px;
  line-height: 1.04;
}
.bom-stage span,
.bom-level span,
.bom-gate span,
.data-layer span,
.data-rule span {
  display: block;
  color: #304f68;
  font-weight: 760;
}
.bom-stage .node-lines {
  display: grid;
  gap: .012in;
  margin-top: .024in;
}
.bom-stage .node-lines em {
  display: block;
  font-style: normal;
  font-size: 7.75px;
  line-height: 1.08;
  color: #304f68;
}
.bom-stage .node-lines strong {
  display: block;
  color: #0b2b4a;
  font-size: 7.70px;
  line-height: 1.05;
  margin: 0 0 .006in;
}
.bom-level {
  padding: .052in .060in;
  border-left-width: .070in;
  border-left-color: #2f9b67;
}
.bom-level:nth-child(2) { border-left-color: #e4a12a; }
.bom-level:nth-child(3) { border-left-color: #25589f; }
.bom-level:nth-child(4) { border-left-color: #d9304f; }
.bom-level b {
  font-size: 10.8px;
  line-height: 1.05;
}
.bom-level span {
  margin-top: .022in;
  font-size: 8.5px;
  line-height: 1.10;
}
.bom-gate {
  padding: .048in .060in;
  background: #f6fbff;
}
.bom-gate b {
  font-size: 10.0px;
  line-height: 1.02;
  color: #0b2b4a;
}
.bom-gate span {
  margin-top: .016in;
  font-size: 8.0px;
  line-height: 1.08;
}
.data-architecture {
  display: grid;
  grid-template-columns: 1fr 2.55in;
  gap: .060in;
  padding: .080in;
}
.data-layers {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: repeat(6, 1fr);
  gap: .043in;
}
.data-layer {
  display: grid;
  grid-template-columns: 1.28in 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  gap: .016in .070in;
  min-height: .395in;
  padding: .044in .060in;
}
.data-layer:nth-child(1) { background: #fff7f7; }
.data-layer:nth-child(2) { background: #f2fbff; }
.data-layer:nth-child(3) { background: #fff9e4; }
.data-layer:nth-child(4) { background: #f2f6ff; }
.data-layer:nth-child(5) { background: #f2fff8; }
.data-layer:nth-child(6) { background: #fff6ed; }
.data-layer:nth-child(7) { background: #f7f2ff; }
.data-layer b {
  grid-row: 1 / 3;
  font-size: 10.8px;
  line-height: 1.02;
}
.data-layer code {
  grid-column: 2;
  color: #193a59;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 7.85px;
  line-height: 1.10;
  font-weight: 850;
  white-space: normal;
}
.data-layer span {
  grid-column: 2;
  font-size: 8.05px;
  line-height: 1.10;
}
.data-rules {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: .045in;
}
.data-rule {
  padding: .065in .070in;
  background: #fff;
  border-left-width: .070in;
  border-left-color: #d9304f;
}
.data-rule:nth-child(2) { border-left-color: #e4a12a; }
.data-rule:nth-child(3) { border-left-color: #2f9b67; }
.data-rule b {
  font-size: 10.6px;
  line-height: 1.04;
}
.data-rule span {
  margin-top: .026in;
  font-size: 8.0px;
  line-height: 1.12;
}
.hub {
  grid-template-columns: 2.15in 1fr;
}
.hub-core {
  border: 2.5px solid #193a59;
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 30%, #ffffff 0 24%, #dff0fb 25% 100%);
  box-shadow: 4px 4px 0 rgba(25, 58, 89, .14);
}
.hub-core .glyph {
  width: .80in;
  height: .80in;
}
.hub-core b {
  color: #07172f;
  font-size: 19px;
}
.hub-core span {
  color: #304f68;
  font-weight: 780;
}
.hub-nodes,
.storyboard,
.schema-map {
  gap: .070in;
}
.storyboard .vnode:not(:last-child):after,
.gateflow .vnode:not(:last-child):after,
.roadmap-map .vnode:not(:last-child):after {
  color: #d9304f;
  font-size: 19px;
  right: -.056in;
}
.fork {
  grid-template-columns: 1.85in 1fr 2.15in;
  gap: .095in;
}
.fork-core .vnode {
  display: grid;
  grid-template-columns: 1fr;
  text-align: center;
  min-height: 2.25in;
  background: #fff7cf;
}
.fork-core .glyph {
  justify-self: center;
  width: .84in;
  height: .84in;
}
.gateflow,
.agents,
.roadmap-map {
  gap: .060in;
}
.gateflow .vnode,
.hardware-map .vnode,
.roadmap-map .vnode {
  display: grid;
  grid-template-columns: 1fr;
  justify-items: start;
  text-align: left;
  align-content: start;
  min-height: 2.40in;
}
.gateflow .glyph,
.hardware-map .glyph,
.roadmap-map .glyph {
  width: .46in;
  height: .46in;
}
.hardware-bom {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: .048in;
  min-height: 3.05in;
}
.server-bom {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 1.18in;
  border: 2.5px solid #193a59;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .14);
}
.server-bom:nth-child(1) { background: #fff7f7; }
.server-bom:nth-child(2) { background: #f2fbff; }
.server-bom:nth-child(3) { background: #fff9e4; }
.server-bom:nth-child(4) { background: #f2f6ff; }
.server-bom header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .020in .050in;
  align-items: start;
  padding: .042in .055in .034in;
  border-bottom: 2px solid rgba(25, 58, 89, .22);
}
.server-bom header b {
  color: #07172f;
  font-size: 10.4px;
  line-height: 1.04;
  font-weight: 950;
}
.server-bom header span {
  grid-column: 1 / -1;
  color: #29475e;
  font-size: 6.9px;
  line-height: 1.08;
  font-weight: 760;
}
.server-bom header strong {
  color: #d9304f;
  font-size: 8.1px;
  line-height: 1.02;
  white-space: nowrap;
}
.server-bom table {
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 5.75px;
  line-height: 1.03;
}
.server-bom th,
.server-bom td {
  padding: .017in .030in;
  border-color: rgba(25, 58, 89, .14);
  background: rgba(255, 255, 255, .52);
}
.server-bom th {
  width: .35in;
  color: #0b2b4a;
  font-weight: 950;
  white-space: nowrap;
}
.server-bom td {
  color: #20384f;
  font-weight: 720;
}
.stack-map .vnode,
.zones-map .vnode {
  min-height: .82in;
}
.mini-cards {
  gap: .060in;
}
.mini-card {
  position: relative;
  min-height: .50in;
  border: 2.5px solid #193a59;
  background: #fff;
  border-radius: 12px;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .14);
  padding: .06in .08in .06in .14in;
}
.mini-card:before {
  content: "";
  position: absolute;
  left: .060in;
  top: .075in;
  bottom: .075in;
  width: 5px;
  border-radius: 4px;
  background: #5baac0;
}
.mini-card:nth-child(2):before { background: #e4a12a; }
.mini-card:nth-child(3):before { background: #d9304f; }
.mini-card:nth-child(4):before { background: #2f9b67; }
.mini-card b {
  color: #0b2b4a;
  font-size: 11.1px;
}
.mini-card span {
  color: #2d4c65;
  font-size: 9.55px;
  line-height: 1.14;
}
.mini-cards-4 {
  grid-template-columns: repeat(4, 1fr);
  gap: .045in;
}
.mini-cards-4 .mini-card {
  min-height: .46in;
  padding: .050in .060in .050in .125in;
}
.mini-cards-4 .mini-card b {
  font-size: 10px;
}
.mini-cards-4 .mini-card span {
  font-size: 8.45px;
  line-height: 1.10;
}
.callout {
  border: 2.5px solid #193a59;
  border-left: .085in solid #2f9b67;
  background: #eafff2;
  color: #07172f;
  box-shadow: 3px 3px 0 rgba(25, 58, 89, .15);
  font-size: 11.3px;
  line-height: 1.16;
  padding: .055in .10in;
}
.stats.stats-6 {
  grid-template-columns: repeat(6, 1fr);
}
.stats.stats-6 .stat {
  padding: .044in .055in .048in;
}
.stats.stats-6 .stat strong {
  font-size: 19px;
}
.stats.stats-6 .stat span {
  font-size: 9.4px;
}
.gateflow .vnode b,
.agents .vnode b {
  font-size: 11.2px;
}
.gateflow .vnode span,
.agents .vnode span {
  font-size: 7.9px;
  line-height: 1.08;
}
.foot {
  padding: .038in .06in 0;
  color: #486176;
}
.edit-toolbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(235, 247, 250, .96);
  border-bottom: 2px solid #193a59;
  box-shadow: 0 8px 24px rgba(25, 58, 89, .18);
  font-size: 13px;
}
.edit-toolbar strong { color: #0b1d35; margin-right: 12px; }
.edit-toolbar button {
  appearance: none;
  border: 2px solid #193a59;
  border-radius: 10px;
  background: #fff;
  color: #0b1d35;
  padding: 6px 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 2px 2px 0 rgba(25, 58, 89, .16);
}
.edit-toolbar button.primary { background: #123b5d; color: #fff; }
.deck[contenteditable="true"] { outline: none; }
.deck[contenteditable="true"] .slide:hover { box-shadow: 0 18px 54px rgba(25,58,89,.22), inset 0 0 0 3px rgba(47,131,163,.10); }
@media print { .edit-toolbar { display: none !important; } }
@media screen { body { display: grid; gap: 18px; justify-content: center; padding: 0 18px 18px; } .slide { box-shadow: 0 18px 54px rgba(25,58,89,.24); } .deck { display: grid; gap: 18px; } }

/* Professional technical report override. */
:root {
  --ink: #142338;
  --muted: #506276;
  --line: #c8d3de;
  --line-strong: #738699;
  --panel: #ffffff;
  --panel-soft: #f6f8fb;
  --accent: #0f6f78;
  --accent-2: #9a6b18;
  --accent-3: #315f9a;
  --risk: #a33a3a;
}
body {
  background: #e9eef3;
  color: var(--ink);
}
.slide {
  padding: .22in .30in .20in;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-top: 0;
  color: var(--ink);
}
.slide:before {
  inset: .14in .18in .40in;
  border: 1px solid #aebdca;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,251,253,.92));
  opacity: 1;
}
.slide:after {
  color: rgba(49, 95, 154, .08);
  font-size: 38px;
  right: .35in;
  bottom: .28in;
  letter-spacing: 0;
}
.head {
  padding: .02in .04in .055in;
  border-bottom: 1px solid #d7e0e8;
}
.head:after {
  left: .04in;
  bottom: -2px;
  height: 2px;
  width: 3.05in;
  background: var(--accent);
  box-shadow: none;
}
.eyebrow {
  background: #18314f;
  color: #fff;
  border: 0;
  border-radius: 4px;
  box-shadow: none;
  padding: .032in .090in;
  font-size: 10px;
  letter-spacing: .02em;
}
h1 {
  color: #10243d;
  font-size: 31px;
  line-height: 1.03;
  font-weight: 900;
  text-shadow: none;
}
.subtitle {
  color: #43566a;
  font-size: 12px;
  line-height: 1.24;
  font-weight: 650;
}
.body {
  gap: .070in;
  padding: 0 .01in;
}
.thesis {
  border: 1px solid #b8c6d2;
  border-left: .050in solid var(--accent-2);
  background: #fff8e6;
  color: #1c2b3a;
  border-radius: 6px;
  box-shadow: none;
  font-size: 11.7px;
  line-height: 1.23;
  padding: .055in .090in;
}
.stat {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  box-shadow: none;
  min-height: .50in;
  padding: .046in .070in .052in;
}
.stat:after {
  height: 2px;
  left: .070in;
  right: .070in;
  bottom: .040in;
  background: #dce7ee;
}
.stat strong {
  color: #18314f;
  text-shadow: none;
  font-size: 18px;
  line-height: 1.02;
}
.stat:nth-child(2) strong { color: var(--accent); }
.stat:nth-child(3) strong { color: var(--accent-2); }
.stat:nth-child(4) strong { color: var(--accent-3); }
.stat:nth-child(5) strong { color: #68707a; }
.stat:nth-child(6) strong { color: var(--risk); }
.stat span {
  color: var(--muted);
  font-size: 8.7px;
  font-weight: 650;
  line-height: 1.14;
  overflow-wrap: anywhere;
}
.visual {
  border: 1px solid #9fb0bf;
  border-radius: 8px;
  background: #f8fafc;
  box-shadow: none;
  padding: .085in;
}
.visual:before {
  display: none;
}
.openbim-center,
.hub-core,
.fork-core .vnode,
.vnode,
.mini-card,
.bom-stage,
.bom-level,
.bom-gate,
.data-layer,
.data-rule,
.server-bom {
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: none;
}
.openbim-center { background: #eef5f7; }
.vnode,
.mini-card,
.bom-stage,
.bom-level,
.bom-gate,
.data-layer,
.data-rule,
.server-bom {
  background: #fff;
}
.vnode:nth-child(2),
.stat:nth-child(2),
.bom-stage:nth-child(2),
.data-layer:nth-child(2),
.server-bom:nth-child(2) {
  background: #f5f9fb;
  color: var(--accent);
}
.vnode:nth-child(3),
.stat:nth-child(3),
.bom-stage:nth-child(3),
.data-layer:nth-child(3),
.server-bom:nth-child(3) {
  background: #fffaf0;
  color: var(--accent-2);
}
.vnode:nth-child(4),
.stat:nth-child(4),
.bom-stage:nth-child(4),
.data-layer:nth-child(4),
.server-bom:nth-child(4) {
  background: #f5f7fb;
  color: var(--accent-3);
}
.vnode:nth-child(5),
.bom-stage:nth-child(5),
.data-layer:nth-child(5),
.server-bom:nth-child(5) {
  background: #f6faf7;
  color: #2c6a4b;
}
.vnode:nth-child(6),
.bom-stage:nth-child(6),
.data-layer:nth-child(6),
.server-bom:nth-child(6) {
  background: #fff8f4;
  color: #7f4b2e;
}
.glyph {
  color: #27425f;
}
.glyph svg {
  stroke: #27425f;
  stroke-width: 3.0;
  filter: none;
}
.vnode b,
.openbim-center b,
.hub-core b,
.bom-stage b,
.bom-level b,
.bom-gate b,
.data-layer b,
.data-rule b,
.server-bom header b,
.mini-card b {
  color: #132942;
  font-weight: 850;
  text-shadow: none;
}
.vnode span,
.openbim-center span,
.hub-core span,
.bom-stage span,
.bom-level span,
.bom-gate span,
.data-layer span,
.data-rule span,
.server-bom td,
.mini-card span {
  color: #455a70;
  font-weight: 620;
}
.vnode .node-lines strong,
.bom-stage .node-lines strong {
  color: #18314f;
  font-weight: 800;
}
.vnode .node-lines em,
.bom-stage .node-lines em {
  color: #455a70;
}
.bom-stage:not(:last-child):after {
  background: #8193a5;
}
.bom-level,
.data-rule {
  border-left-width: .045in;
}
.bom-level { border-left-color: var(--accent); }
.bom-level:nth-child(2) { border-left-color: var(--accent-2); }
.bom-level:nth-child(3) { border-left-color: var(--accent-3); }
.bom-level:nth-child(4) { border-left-color: var(--risk); }
.data-rule { border-left-color: var(--risk); }
.data-rule:nth-child(2) { border-left-color: var(--accent-2); }
.data-rule:nth-child(3) { border-left-color: var(--accent); }
.mini-card {
  padding: .058in .075in .058in .115in;
  background: #fff;
}
.mini-card:before {
  left: .050in;
  top: .070in;
  bottom: .070in;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}
.mini-card:nth-child(2):before { background: var(--accent-2); }
.mini-card:nth-child(3):before { background: var(--risk); }
.callout {
  border: 1px solid #b8c6d2;
  border-left: .050in solid var(--accent);
  background: #f0f7f5;
  color: #173047;
  border-radius: 6px;
  box-shadow: none;
  font-size: 11px;
}
.foot {
  color: #66788a;
  border-top: 1px solid #dde5ec;
}
.page {
  color: #18314f;
}
.edit-toolbar {
  position: static;
  top: auto;
  background: rgba(247, 250, 252, .97);
  border-bottom: 1px solid #b7c6d4;
  box-shadow: 0 8px 20px rgba(31, 49, 68, .10);
}
.edit-toolbar button {
  border: 1px solid #9fb0bf;
  border-radius: 6px;
  box-shadow: none;
  font-weight: 800;
}
.edit-toolbar button.primary {
  background: #18314f;
  border-color: #18314f;
}
.deck[contenteditable="true"] .slide:hover {
  box-shadow: 0 12px 30px rgba(31, 49, 68, .16);
}
@media screen {
  body { background: #e9eef3; }
  .slide { box-shadow: 0 12px 30px rgba(31, 49, 68, .14); }
}

/* Architecture review layout refinement: reduce card borders inside diagrams. */
.stats {
  gap: .045in;
}
.stat {
  border: 0;
  border-bottom: 1px solid #dbe4ec;
  border-radius: 0;
  background: transparent;
  min-height: .42in;
  padding: .040in .060in .046in;
}
.stat:after {
  display: none;
}
.stat:nth-child(n) {
  background: transparent;
}
.visual {
  border: 1px solid #c3cfda;
  background: #fbfcfe;
  border-radius: 6px;
  padding: .070in;
}
.openbim-center,
.hub-core,
.fork-core .vnode {
  border: 0;
  border-right: 1px solid #dbe4ec;
  border-radius: 0;
  background: #f5f8fa;
  box-shadow: none;
}
.openbim-center {
  padding: .080in .090in;
}
.openbim-nodes,
.hub-nodes,
.schema-map,
.zones-map,
.stack-map,
.gateflow,
.storyboard,
.roadmap-map,
.hardware-map {
  gap: .045in;
}
.vnode,
.mini-card,
.bom-stage,
.bom-level,
.bom-gate,
.data-layer,
.data-rule {
  border: 0 !important;
  border-left: 3px solid #d2dde6 !important;
  border-bottom: 1px solid #e1e8ef !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
.vnode:nth-child(n),
.mini-card:nth-child(n),
.bom-stage:nth-child(n),
.bom-level:nth-child(n),
.bom-gate:nth-child(n),
.data-layer:nth-child(n),
.data-rule:nth-child(n) {
  background: transparent !important;
}
.vnode:nth-child(2n),
.mini-card:nth-child(2n),
.bom-stage:nth-child(2n),
.bom-level:nth-child(2n),
.bom-gate:nth-child(2n),
.data-layer:nth-child(2n),
.data-rule:nth-child(2n) {
  border-left-color: var(--accent) !important;
}
.vnode:nth-child(3n),
.mini-card:nth-child(3n),
.bom-stage:nth-child(3n),
.bom-level:nth-child(3n),
.bom-gate:nth-child(3n),
.data-layer:nth-child(3n),
.data-rule:nth-child(3n) {
  border-left-color: var(--accent-2) !important;
}
.vnode:nth-child(4n),
.mini-card:nth-child(4n),
.bom-stage:nth-child(4n),
.bom-level:nth-child(4n),
.bom-gate:nth-child(4n),
.data-layer:nth-child(4n),
.data-rule:nth-child(4n) {
  border-left-color: var(--accent-3) !important;
}
.vnode {
  padding: .056in .068in .058in .085in;
  min-height: .70in;
}
.openbim-nodes .vnode {
  min-height: .74in;
}
.schema-map .vnode,
.zones-map .vnode,
.stack-map .vnode,
.gateflow .vnode,
.storyboard .vnode,
.roadmap-map .vnode,
.hardware-map .vnode {
  min-height: .56in;
}
.mini-card,
.bom-level,
.bom-gate,
.data-rule {
  padding: .050in .065in .050in .085in;
}
.mini-card:before {
  display: none;
}
.bom-stage {
  padding: .052in .065in .054in .085in;
}
.data-layer {
  padding: .042in .060in .044in .082in;
}
.data-layer code {
  color: #24435f;
}
.bom-stage:not(:last-child):after {
  width: .045in;
  height: 1px;
  right: -.045in;
  background: #b9c6d2;
}
.glyph {
  width: .30in;
  height: .30in;
}
.openbim-center .glyph,
.hub-core .glyph {
  width: .50in;
  height: .50in;
}
.server-bom {
  border: 1px solid #c8d3de;
  border-radius: 4px;
  background: #fff;
}

/* Tabular engineering-grid refinement: match the full architecture document. */
:root {
  --grid-line: #d6e0d9;
  --grid-head: #eef5f0;
  --grid-soft: #f8fbf9;
  --grid-ink: #163044;
  --grid-muted: #516879;
}
.slide {
  background: #fff;
}
.slide:before {
  border-color: #c7d3dc;
  background: #fff;
}
.head {
  border-bottom-color: #dce5de;
}
.head:after {
  width: 3.75in;
  height: 2px;
  background: #0f7c80;
}
.subtitle {
  color: #40576a;
}
.thesis,
.callout {
  border: 1px solid var(--grid-line);
  border-left: 4px solid #9a6b18;
  border-radius: 4px;
  background: #fff9e8;
  box-shadow: none;
}
.callout {
  border-left-color: #0f7c80;
  background: #f2faf7;
}
.stats {
  gap: 0 !important;
  border: 1px solid var(--grid-line);
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}
.stat {
  border: 0 !important;
  border-right: 1px solid var(--grid-line) !important;
  border-radius: 0 !important;
  background: var(--grid-head) !important;
  min-height: .43in;
  padding: .038in .060in .040in;
}
.stat:last-child {
  border-right: 0 !important;
}
.stat strong {
  color: #1b4f68;
  font-size: 17px;
  line-height: 1.02;
}
.stat span {
  color: #4b6171;
  font-size: 8.4px;
  line-height: 1.10;
}
.visual {
  border: 1px solid var(--grid-line) !important;
  border-radius: 4px !important;
  background: #fff !important;
  padding: 0 !important;
  overflow: hidden;
}
.openbim-map,
.hub,
.fork,
.bom-chain,
.data-architecture {
  gap: 0 !important;
}
.openbim-nodes,
.hub-nodes,
.schema-map,
.zones-map,
.stack-map,
.gateflow,
.storyboard,
.roadmap-map,
.hardware-map,
.bom-stage-row,
.bom-level-row,
.bom-gate-row,
.data-layers,
.data-rules,
.mini-cards {
  gap: 0 !important;
}
.openbim-center,
.hub-core,
.fork-core .vnode {
  border: 0 !important;
  border-right: 1px solid var(--grid-line) !important;
  border-radius: 0 !important;
  background: var(--grid-soft) !important;
}
.vnode,
.mini-card,
.bom-stage,
.bom-level,
.bom-gate,
.data-layer,
.data-rule {
  border: 0 !important;
  border-right: 1px solid var(--grid-line) !important;
  border-bottom: 1px solid var(--grid-line) !important;
  border-left: 0 !important;
  border-radius: 0 !important;
  background: #fff !important;
  box-shadow: none !important;
}
.vnode:nth-child(n),
.mini-card:nth-child(n),
.bom-stage:nth-child(n),
.bom-level:nth-child(n),
.bom-gate:nth-child(n),
.data-layer:nth-child(n),
.data-rule:nth-child(n) {
  background: #fff !important;
  color: var(--grid-ink) !important;
}
.vnode b,
.openbim-center b,
.hub-core b,
.bom-stage b,
.bom-level b,
.bom-gate b,
.data-layer b,
.data-rule b,
.mini-card b {
  color: var(--grid-ink) !important;
  font-weight: 850;
}
.vnode span,
.openbim-center span,
.hub-core span,
.bom-stage span,
.bom-level span,
.bom-gate span,
.data-layer span,
.data-rule span,
.mini-card span {
  color: var(--grid-muted) !important;
  font-weight: 620;
}
.vnode .node-lines strong,
.bom-stage .node-lines strong {
  color: #2c5267 !important;
}
.vnode .node-lines em,
.bom-stage .node-lines em {
  color: #4e6576 !important;
}
.openbim-center {
  padding: .070in .075in;
}
.vnode {
  min-height: .64in;
  padding: .052in .060in;
}
.openbim-nodes .vnode {
  min-height: .72in;
}
.hub-core {
  padding: .070in .075in;
}
.schema-map .vnode,
.zones-map .vnode,
.stack-map .vnode,
.gateflow .vnode,
.storyboard .vnode,
.roadmap-map .vnode,
.hardware-map .vnode {
  min-height: .52in;
}
.bom-chain {
  min-height: 2.37in !important;
  grid-template-rows: 1.32in .55in .50in !important;
}
.bom-stage-row {
  grid-template-rows: repeat(2, minmax(.52in, auto)) !important;
}
.bom-level-row,
.bom-gate-row {
  grid-template-rows: auto !important;
}
.bom-stage,
.bom-level,
.bom-gate,
.mini-card,
.data-layer,
.data-rule {
  padding: .044in .055in;
}
.bom-stage:not(:last-child):after,
.schema-map .vnode:after,
.storyboard .vnode:not(:last-child):after,
.gateflow .vnode:not(:last-child):after,
.roadmap-map .vnode:not(:last-child):after {
  display: none !important;
}
.bom-level,
.data-rule,
.mini-card {
  border-left: 0 !important;
}
.mini-card:before {
  display: none !important;
}
.data-architecture {
  grid-template-columns: 1fr 2.55in;
}
.data-layer {
  min-height: .375in;
}
.data-layer code {
  color: #214b5e;
}
.server-bom {
  border: 0;
  border-right: 1px solid var(--grid-line);
  border-bottom: 1px solid var(--grid-line);
  border-radius: 0;
}
.server-bom header {
  background: var(--grid-head);
  border-bottom: 1px solid var(--grid-line);
}
.server-bom table {
  border-top: 0;
}
.server-bom th,
.server-bom td {
  border-color: var(--grid-line);
}
</style>
</head>
<body>
<div class="edit-toolbar" contenteditable="false">
  <strong>ArchIToken 10 页架构评审版 · 可编辑 HTML</strong>
  <button class="primary" id="saveLocal">保存到浏览器</button>
  <button id="exportHtml">导出 HTML</button>
  <button id="restoreLocal">恢复已保存</button>
  <button id="clearLocal">清除本地保存</button>
</div>
<main class="deck" contenteditable="true" spellcheck="false">
${slides
  .map((slide, index) => `<section class="slide" data-page="${String(index + 1).padStart(2, "0")}">
  <div class="head"><div class="eyebrow">${esc(slide.eyebrow)}</div><h1>${esc(slide.title)}</h1><p class="subtitle">${esc(slide.subtitle)}</p></div>
  <div class="body">
    ${slide.thesis ? `<div class="thesis">${esc(slide.thesis)}</div>` : ""}
    ${slide.stats ? renderStats(slide.stats) : ""}
    ${renderVisual(slide)}
    ${slide.cards ? renderCards(slide.cards) : ""}
    <div class="callout">${esc(slide.callout)}</div>
  </div>
  <div class="foot"><span>ArchIToken · 2026-06-09 · 架构评审版</span><span class="page">${index + 1} / ${slides.length}</span><span class="spacer" aria-hidden="true"></span></div>
</section>`)
  .join("\n")}
</main>
<script>
const STORAGE_KEY = "architoken-executive-brief-10p-2026-06-09-v14-grid-layout";
const deck = document.querySelector(".deck");
document.getElementById("saveLocal").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, deck.innerHTML);
});
document.getElementById("restoreLocal").addEventListener("click", () => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value) deck.innerHTML = value;
});
document.getElementById("clearLocal").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
});
document.getElementById("exportHtml").addEventListener("click", () => {
  const html = "<!doctype html>\\n" + document.documentElement.outerHTML;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ARCHITOKEN_EXECUTIVE_BRIEF_10P_2026-06-09_EDITED.html";
  a.click();
  URL.revokeObjectURL(url);
});
</script>
</body>
</html>`;

const markdown = slides
  .map((slide, index) => {
    const lines = [`# ${index + 1}. ${slide.title}`, "", slide.subtitle, ""];
    if (slide.points) lines.push(...slide.points.map((point) => `- ${point}`), "");
    if (slide.grid) lines.push(...slide.grid.map(([title, body]) => `- ${title}: ${body}`), "");
    if (slide.thesis) lines.push(`> ${slide.thesis}`, "");
    if (slide.stats) lines.push(...slide.stats.map(([value, label]) => `- ${label}: ${value}`), "");
    if (slide.visual) {
      if (slide.visual.center) lines.push(`- 主视觉: ${slide.visual.center.join(" / ")}`);
      if (slide.visual.nodes) lines.push(...slide.visual.nodes.map(([, title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.stages) lines.push(...slide.visual.stages.map(([, title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.levels) lines.push(...slide.visual.levels.map(([title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.gates) lines.push(...slide.visual.gates.map(([title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.layers) lines.push(...slide.visual.layers.map(([title, tables, duty]) => `- ${title}: ${tables} / ${duty}`), "");
      if (slide.visual.rules) lines.push(...slide.visual.rules.map(([title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.left) lines.push(...slide.visual.left.map(([, title, body]) => `- ${title}: ${body}`), "");
      if (slide.visual.right) lines.push(...slide.visual.right.map(([, title, body]) => `- ${title}: ${body}`), "");
    }
    if (slide.cards) lines.push(...slide.cards.map(([title, body]) => `- ${title}: ${body}`), "");
    if (slide.metrics) lines.push(...slide.metrics.map(([value, label, note]) => `- ${label}: ${value} (${note})`), "");
    if (slide.blocks) lines.push(...slide.blocks.map(([title, body]) => `- ${title}: ${body}`), "");
    if (slide.flow) lines.push(`- 流程: ${slide.flow.join(" -> ")}`, "");
    if (slide.table) {
      const [head, ...body] = slide.table;
      lines.push(`| ${head.join(" | ")} |`);
      lines.push(`| ${head.map(() => "---").join(" | ")} |`);
      lines.push(...body.map((row) => `| ${row.join(" | ")} |`), "");
    }
    if (slide.lanes) lines.push(...slide.lanes.map(([title, body]) => `- ${title}: ${body}`), "");
    if (slide.timeline) lines.push(...slide.timeline.map(([title, body]) => `- ${title}: ${body}`), "");
    lines.push(`**汇报重点**: ${slide.callout}`);
    return lines.join("\n");
  })
  .join("\n\n---\n\n");

writeFileSync(outHtml, html, "utf8");
writeFileSync(outMd, markdown, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`file://${outHtml}`, { waitUntil: "load" });
await page.pdf({
  path: outPdf,
  width: "13.333in",
  height: "7.5in",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

const tmpRoot = resolve("/tmp/architoken-executive-brief-pptx");
rmSync(tmpRoot, { recursive: true, force: true });
for (const dir of [
  "_rels",
  "docProps",
  "ppt/_rels",
  "ppt/slides/_rels",
  "ppt/slides",
  "ppt/slideLayouts/_rels",
  "ppt/slideLayouts",
  "ppt/slideMasters/_rels",
  "ppt/slideMasters",
  "ppt/theme",
  "ppt/media",
]) {
  mkdirSync(resolve(tmpRoot, dir), { recursive: true });
}

for (let i = 0; i < slides.length; i += 1) {
  const shot = resolve(tmpRoot, `ppt/media/slide${i + 1}.png`);
  await page.locator(".slide").nth(i).screenshot({ path: shot });
}
await browser.close();

const slideCx = 12192000;
const slideCy = 6858000;
const relNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const pNs = "http://schemas.openxmlformats.org/presentationml/2006/main";
const aNs = "http://schemas.openxmlformats.org/drawingml/2006/main";
const rNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function writePptxFile(name, content) {
  writeFileSync(resolve(tmpRoot, name), content, "utf8");
}

writePptxFile(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n  ")}
</Types>`,
);

writePptxFile(
  "_rels/.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${relNs}">
  <Relationship Id="rId1" Type="${rNs}/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="${relNs}/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="${rNs}/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
);

writePptxFile(
  "docProps/core.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>ArchIToken 10页架构评审版</dc:title>
  <dc:creator>ArchIToken</dc:creator>
  <cp:lastModifiedBy>ArchIToken</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-06-09T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-09T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
);

writePptxFile(
  "docProps/app.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ArchIToken</Application>
  <PresentationFormat>16:9</PresentationFormat>
  <Slides>${slides.length}</Slides>
</Properties>`,
);

writePptxFile(
  "ppt/presentation.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${aNs}" xmlns:r="${rNs}" xmlns:p="${pNs}" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("\n    ")}
  </p:sldIdLst>
  <p:sldSz cx="${slideCx}" cy="${slideCy}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
);

writePptxFile(
  "ppt/_rels/presentation.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${relNs}">
  <Relationship Id="rId1" Type="${rNs}/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="${rNs}/slide" Target="slides/slide${i + 1}.xml"/>`).join("\n  ")}
</Relationships>`,
);

writePptxFile(
  "ppt/slideMasters/slideMaster1.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${aNs}" xmlns:r="${rNs}" xmlns:p="${pNs}">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`,
);

writePptxFile(
  "ppt/slideMasters/_rels/slideMaster1.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${relNs}">
  <Relationship Id="rId1" Type="${rNs}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="${rNs}/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
);

writePptxFile(
  "ppt/slideLayouts/slideLayout1.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${aNs}" xmlns:r="${rNs}" xmlns:p="${pNs}" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
);

writePptxFile(
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${relNs}">
  <Relationship Id="rId1" Type="${rNs}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
);

writePptxFile(
  "ppt/theme/theme1.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${aNs}" name="ArchIToken">
  <a:themeElements>
    <a:clrScheme name="ArchIToken"><a:dk1><a:srgbClr val="15231B"/></a:dk1><a:lt1><a:srgbClr val="FBFDFB"/></a:lt1><a:dk2><a:srgbClr val="506057"/></a:dk2><a:lt2><a:srgbClr val="EEF7F2"/></a:lt2><a:accent1><a:srgbClr val="07C160"/></a:accent1><a:accent2><a:srgbClr val="08733A"/></a:accent2><a:accent3><a:srgbClr val="D9E5DE"/></a:accent3><a:accent4><a:srgbClr val="ECFFF3"/></a:accent4><a:accent5><a:srgbClr val="9EDBB7"/></a:accent5><a:accent6><a:srgbClr val="113E25"/></a:accent6><a:hlink><a:srgbClr val="08733A"/></a:hlink><a:folHlink><a:srgbClr val="08733A"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="ArchIToken"><a:majorFont><a:latin typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="ArchIToken"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`,
);

for (let i = 0; i < slides.length; i += 1) {
  writePptxFile(
    `ppt/slides/slide${i + 1}.xml`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${aNs}" xmlns:r="${rNs}" xmlns:p="${pNs}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="2" name="slide${i + 1}.png"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideCx}" cy="${slideCy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`,
  );
  writePptxFile(
    `ppt/slides/_rels/slide${i + 1}.xml.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${relNs}">
  <Relationship Id="rId1" Type="${rNs}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="${rNs}/image" Target="../media/slide${i + 1}.png"/>
</Relationships>`,
  );
}

rmSync(outPptx, { force: true });
const zipResult = spawnSync("zip", ["-qr", outPptx, "."], { cwd: tmpRoot, encoding: "utf8" });
if (zipResult.status !== 0) {
  throw new Error(zipResult.stderr || "zip failed");
}

console.log(outHtml);
console.log(outPdf);
console.log(outMd);
console.log(outPptx);
