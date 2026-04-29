# ArchIToken 完整需求总表

本文档是 ArchIToken 后续开发的需求真源。前端会重做，后端 API 必须保持前端无关、OpenAPI 可生成 SDK、可供第三方系统稳定调用。

## 0. 合同边界

- 标准模块只允许使用 11 个 active `module_id`：`marketing_service`、`concept_design`、`standard_library`、`detailed_design`、`quantity_costing`、`material_logistics`、`production_manufacturing`、`construction_supervision`、`digital_twin`、`digital_archive`、`settings_center`。
- `manufacturing`、`fabrication` 只能作为 legacy alias 归一到 `production_manufacturing`，不能作为新接口、数据模型或页面主模块名。
- 后端合同必须围绕 `module_id`、文件、生命周期、审批、审计、AI Agent、知识库能力设计，不绑定任何前端组件状态。
- 文件内容当前可用 in-memory stub 开发合同；生产必须切换到 ObjectStore，并保留相同 API 语义。
- 生命周期和审计当前可用 in-memory preview 验证合同；生产必须切换到 TransactionStore / EventStore，并保留同一状态机和审计字段。

## 1. 平台级需求

- 用户与权限：平台管理员、项目负责人、业主、设计人员、成本人员、采购物流、生产制造、施工监理、档案人员、AI 运维人员按模块和项目授权访问。
- 数据对象：Module、ModuleFile、ModuleTransaction、ModuleApproval、AuditEvent、KnowledgeDocument、AgentRun、WorkflowRoute。
- 文件能力：按模块列目录、创建、上传、读取元数据、读取内容、写入内容、移动、复制、分享、回收站、归档。
- 生命周期能力：创建事务、提交、生成、评估、规则校验、Schema 校验、申请审批、批准、拒绝、归档、阻塞、解除阻塞。
- 审批能力：每个模块定义审批点，审批记录必须包含决策、审批人、意见、时间、关联事务和审计事件。
- 审计能力：文件、生命周期、审批、AI 生成、知识库调用、外部集成都必须写入 append-only AuditEvent。
- AI 能力：AI 只能通过 WorkflowRouter、RAG、MCP tool 和明确的 Agent API 工作；生成器和评估器必须分离。
- AI Native Multimodal Engineering Generation & Conversion Engine：文字、图片、视频、CAD、PDF、BIM、数字孪生和导出互转是 P0/P1 级工程能力，不是展示功能。
- 接口能力：OpenAPI 是 HTTP 合同真源，前端和第三方都通过同一合同接入；SDK 由 OpenAPI 生成，不允许私有 UI-only API。
- 验收能力：每个模块必须有 API contract test、状态机 test、权限 test、审计 test、RAG 引用 test、前端 adapter test。

## 2. AI Native Multimodal Engineering Generation & Conversion Engine

该能力是 ArchIToken P0/P1 级核心引擎，必须通过后端 API、WorkflowRouter、Skill Registry、MCP Tool Registry、StorageRouter 暴露。前端可以重做，第三方前端、外部系统和 AI Agent 都必须能通过同一合同提交 generation job、读取 artifact、审批结果和审计事件。

### 2.1 工程范式

- 执行链路：Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver。
- 角色分离：Generator != Evaluator；assistant、openclaw、model、skill、agent、MCP tool 都只能在 WorkflowRouter 授权后执行。
- 工程闭环：Plan -> Action -> Review -> Test -> Debug -> Report 是每个生成任务的最小开发规范。
- 上下文能力：plan、memory、RAG、knowledge base、active learning / active review 只能作为受控输入，不能绕过审批写入最终事实。
- 运行环境：multimodal pipeline 必须在 tool sandbox 中执行，所有输入、输出、模型版本、prompt、tool call、review、test、debug 都写 audit trail。
- 数据要求：每类输入/输出都有 schema、metadata、version、permission、hash、source、artifact status 和可追溯 AuditEvent。
- 状态要求：生成 BIM、CAD、数字孪生必须区分 preview、draft、approved、archived；approved 之前不得作为生产事实。

### 2.2 完整能力矩阵

| 类别 | 能力 | 输入 | 输出和文件类型 | Agent / Skill | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| 文字生成 | 文字生成图片 | prompt、参考标准、风格约束 | `.png`、`.jpg`、metadata | visual generator | 图片进入文件系统，含 prompt、模型版本、评估结果和审批 |
| 文字生成 | 文字生成文档 | brief、RAG 引用、模板 | `.md`、`.docx`、`.pdf` | document generator | 文档段落可追溯引用，Schema 校验通过 |
| 文字生成 | 文字生成表格 | BOQ prompt、价格库、字段 schema | `.xlsx`、`.csv`、`.json` | table generator | 表头、数据类型、来源和版本可验证 |
| 文字生成 | 文字生成 PDF | 文档 schema、模板、签章规则 | `.pdf`、`.pdfa` | pdf generator | PDF 元数据、hash、权限和归档策略完整 |
| 文字生成 | 文字生成 PPT | 大纲、图片、图表数据 | `.pptx`、`.pdf` | presentation generator | 每页有来源、版本和导出记录 |
| 文字生成 | 文字生成思维导图 | 需求文本、模块关系 | `.json`、`.svg`、`.png` | mindmap generator | 节点 schema、边关系和审计完整 |
| 文字生成 | 文字生成流程图 | 业务流程、审批规则 | `.json`、`.svg`、`.png` | flowchart generator | 节点、状态、转移规则可导入 WorkflowRouter |
| 文字生成 | 文字生成甘特图 | 任务、工期、依赖 | `.json`、`.xlsx`、`.svg` | schedule generator | 依赖关系、关键路径和审批状态可追踪 |
| 文字生成 | 文字生成户型图 | 房屋需求、面积、约束 | `.svg`、`.dxf`、`.pdf` | floorplan generator | 尺寸、房间、约束和规则校验通过 |
| 文字生成 | 文字生成 CAD 图纸 | 设计 brief、标准、户型图 | `.dwg`、`.dxf`、`.pdf` | cad generator | 图层、比例、坐标、版本和 preview/draft 状态完整 |
| 文字生成 | 文字生成 BIM 模型 | 设计 brief、构件族、规则包 | `.ifc`、`.glb`、`.json` | bim generator | IFC schema、构件参数、规则校验和评估报告完整 |
| 文字生成 | 文字生成数字孪生 | 场景需求、BIM、IoT schema | `.json`、`.glb`、`.spz` | twin generator | 场景、图层、设备绑定、状态和审批完整 |
| 图片生成 | 图片生成视频 | 图片、镜头脚本、时长 | `.mp4`、`.webm` | video generator | 视频元数据、帧来源、版权和审批记录完整 |
| 图片生成 | 图片生成 PDF 图纸 | 图片、比例尺、标注规则 | `.pdf` | drawing pdf generator | 标注、尺寸、比例和来源可复核 |
| 图片生成 | 图片生成 CAD 图纸 | 图片、边缘/尺寸识别、标准 | `.dxf`、`.dwg` | image-to-cad skill | 图层、闭合轮廓、尺寸误差和人工 review 记录完整 |
| 图片生成 | 图片生成 BIM 模型 | 图片、多视角约束、构件库 | `.ifc`、`.glb` | image-to-bim skill | 构件识别置信度、人工校正和 schema 校验完整 |
| 图片生成 | 图片生成数字孪生 | 图片、空间位姿、模型引用 | `.json`、`.glb`、`.spz` | image-to-twin skill | 场景对齐、坐标、图层和审批状态完整 |
| 视频生成 | 视频生成 BIM 模型 | 视频帧、相机轨迹、构件库 | `.ifc`、`.glb` | video-to-bim skill | 抽帧、重建、置信度、Evaluator 报告完整 |
| 视频生成 | 视频生成数字孪生 | 视频、时空定位、IoT 绑定 | `.json`、`.glb`、`.spz` | video-to-twin skill | 时间轴、空间对齐、设备绑定和审计完整 |
| 视频生成 | 视频生成点云模型 | 视频、相机参数、尺度约束 | `.ply`、`.las`、`.e57` | video-to-pointcloud skill | 点云密度、坐标系、误差报告和来源完整 |
| CAD / PDF 图纸生成 | CAD 图纸生成 BIM 模型 | `.dwg`、`.dxf`、图层规则 | `.ifc`、`.glb` | cad-to-bim skill | 图层映射、构件生成、IFC 校验和人工 review 完整 |
| CAD / PDF 图纸生成 | CAD 图纸生成数字孪生 | CAD、空间坐标、设备表 | `.json`、`.glb` | cad-to-twin skill | 场景图层、坐标系、设备绑定和审批完整 |
| CAD / PDF 图纸生成 | PDF 图纸生成 BIM 模型 | PDF 图纸、OCR、尺寸规则 | `.ifc`、`.glb` | pdf-to-bim skill | OCR 来源、尺寸校正、构件置信度和 schema 校验完整 |
| CAD / PDF 图纸生成 | PDF 图纸生成数字孪生 | PDF 图纸、空间标注、设备表 | `.json`、`.glb` | pdf-to-twin skill | 图纸页、空间映射、图层和审计完整 |
| 导出能力 | 图纸导出图片 | CAD/PDF 图纸、视口 | `.png`、`.jpg` | drawing export skill | 分辨率、比例、页码和 hash 完整 |
| 导出能力 | 图纸导出 PDF | CAD 图纸、图框、签章 | `.pdf`、`.pdfa` | drawing pdf export skill | 图框、签章、版本和归档策略完整 |
| 导出能力 | 模型导出表格 | BIM 模型、字段 schema | `.xlsx`、`.csv`、`.json` | model table export skill | 构件清单可追溯到模型 element id |
| 导出能力 | 模型导出图纸 | BIM 模型、视图、标注规则 | `.dwg`、`.dxf`、`.pdf` | model drawing export skill | 图纸视图、标注、比例和审批完整 |
| 导出能力 | 模型导出图片 | BIM / twin 场景、相机视角 | `.png`、`.jpg` | model image export skill | 视角、图层、渲染参数和审计完整 |

### 2.3 统一输入输出合同

- 输入 artifact：`artifact_id`、`artifact_type`、`module_id`、`object_uri`、`mime_type`、`schema_ref`、`version`、`hash`、`permission_scope`、`source_audit_id`。
- 输出 artifact：`artifact_id`、`generation_job_id`、`artifact_type`、`status`、`object_uri`、`preview_uri`、`metadata`、`schema_validation`、`evaluation_report`、`approval_id`。
- 任务状态：queued、planning、generating、evaluating、rule_checking、schema_validating、pending_approval、approved、rejected、debugging、archived。
- 每个生成结果必须进入模块文件系统，绑定生命周期事务，触发审批，写入 audit trail。

## 3. 11 个模块需求

### 3.1 市场客服 `marketing_service`

- 用户角色：业主、销售、客服、项目负责人、客服主管。
- 输入：客户咨询、房屋信息、现场照片、预算、交付时间、偏好、联系方式、授权同意。
- 输出：客户画像、需求 brief、初步报价、线索评分、转方案设计交接包、市场客服 token。
- 核心功能：多渠道线索登记、需求问卷、会话摘要、预算区间判断、跟进计划、方案设计交接。
- 文件类型：`.pdf`、`.docx`、`.xlsx`、`.jpg`、`.png`、`.mp3`、`.json`。
- 审批：客户授权确认、初步报价确认、转方案设计确认。
- 状态机：draft -> submitted -> generating -> evaluating -> pending_approval -> approved / rejected -> archived。
- AI 能力：对话摘要、需求抽取、预算风险提示、初步报价草案、客户异议分类、下一步动作建议。
- 多模态生成/互转调用：文字生成文档、文字生成 PDF、文字生成表格、文字生成图片、文字生成思维导图，用于需求 brief、报价草案、客户沟通图和线索分析。
- 接口需求：客户需求文件 API、线索事务 API、报价审批 API、跟进审计 API、RAG 查询历史案例。
- 验收标准：客户输入可生成结构化需求；报价和转交必须留痕；第三方 CRM 可通过 API 创建线索和读取状态。

### 3.2 方案设计 `concept_design`

- 用户角色：业主、建筑设计师、室内设计师、可视化设计师、项目负责人。
- 输入：市场客服 brief、场地约束、标准族库、案例库、预算边界、客户偏好。
- 输出：概念方案、风格板、空间布局、初步 IFC / GLB、渲染图、方案设计 token。
- 核心功能：方案草案生成、平面布局、风格选择、空间指标校验、客户评审、转深化设计。
- 文件类型：`.pdf`、`.png`、`.jpg`、`.mp4`、`.ifc`、`.glb`、`.json`。
- 审批：方案内部评审、客户确认、转深化设计确认。
- 状态机：draft -> submitted -> generating -> evaluating -> rule_checking -> pending_approval -> approved / rejected -> archived。
- AI 能力：布局建议、风格方案生成、案例检索、规则冲突提示、客户反馈归纳。
- 多模态生成/互转调用：文字生成户型图、文字生成图片、文字生成 CAD 图纸、文字生成 BIM 模型、文字生成数字孪生、图片生成 BIM 模型，用于方案 preview 和客户评审。
- 接口需求：方案文件 API、方案事务 API、客户审批 API、标准族库 RAG、数字孪生预览数据接口。
- 验收标准：方案可被客户确认或拒绝；确认后的输出可被深化设计直接引用；所有 AI 结论有来源引用。

### 3.3 标准族库 `standard_library`

- 用户角色：标准工程师、BIM 族库工程师、材料管理员、平台管理员、AI 工程师。
- 输入：国家和地方标准、企业规范、构件族、材料属性、施工工法、质量规则。
- 输出：标准条文索引、族库包、材质库、规则包、Schema、标准族库 token。
- 核心功能：标准版本管理、族库发布、构件参数校验、规则包发布、RAG 索引、MCP tool 暴露。
- 文件类型：`.pdf`、`.md`、`.json`、`.yaml`、`.ifc`、`.rfa`、`.glb`、`.dwg`、`.dxf`、`.xlsx`。
- 审批：标准版本发布、族库发布、规则包发布、废止版本确认。
- 状态机：draft -> submitted -> schema_validating -> rule_checking -> pending_approval -> approved / rejected -> archived。
- AI 能力：标准条文检索、构件匹配、参数补全、冲突条文检测、规则解释。
- 多模态生成/互转调用：文字生成文档、文字生成流程图、模型导出表格、模型导出图纸，用于规则包、族库说明、构件清单和校验报告。
- 接口需求：知识库 ingestion API、族库文件 API、规则包版本 API、MCP tool registry、审计 API。
- 验收标准：任一标准或构件都有版本、来源、权限、审计；Agent 调用必须返回引用和版本号。

### 3.4 深化设计 `detailed_design`

- 用户角色：BIM 工程师、结构工程师、机电工程师、设计负责人、校审人员。
- 输入：方案设计输出、标准族库、项目约束、业主确认记录、材料和构件规则。
- 输出：IFC4.3 模型、施工图、碰撞报告、BCF 问题、深化设计 token。
- 核心功能：模型深化、构件参数化、碰撞检查、图纸生成、BCF 闭环、转计量造价和生产制造。
- 文件类型：`.ifc`、`.ids`、`.bcf`、`.dwg`、`.dxf`、`.pdf`、`.step`、`.glb`、`.json`。
- 审批：模型发布、图纸校审、BCF 关闭、转生产制造确认。
- 状态机：draft -> submitted -> generating -> evaluating -> rule_checking -> schema_validating -> pending_approval -> approved / rejected -> archived。
- AI 能力：模型问题检测、图纸说明生成、BCF 分类、构件规则校验、设计变更影响分析。
- 多模态生成/互转调用：CAD 图纸生成 BIM 模型、PDF 图纸生成 BIM 模型、文字生成 CAD 图纸、模型导出图纸、模型导出图片，用于深化模型和施工图闭环。
- 接口需求：模型文件 API、Schema 校验 API、BCF 文件 API、规则评估 API、数字孪生预览接口。
- 验收标准：深化模型可被造价、生产、施工复用；校审和 BCF 闭环全部可审计。

### 3.5 计量造价 `quantity_costing`

- 用户角色：造价工程师、项目负责人、采购、财务、业主代表。
- 输入：深化模型、构件清单、材料价格库、工法库、历史项目造价。
- 输出：BOQ、预算书、成本基线、变更测算、计量造价 token。
- 核心功能：模型算量、清单映射、价格匹配、成本风险分析、变更对比、转材料物流。
- 文件类型：`.xlsx`、`.csv`、`.pdf`、`.ifc`、`.json`。
- 审批：BOQ 确认、预算基线确认、变更测算确认。
- 状态机：draft -> submitted -> generating -> evaluating -> rule_checking -> pending_approval -> approved / rejected -> archived。
- AI 能力：清单自动归类、价格异常检测、成本解释、变更影响总结、采购建议。
- 多模态生成/互转调用：模型导出表格、文字生成表格、文字生成 PDF、文字生成甘特图，用于 BOQ、预算书、变更测算和成本计划。
- 接口需求：BOQ 文件 API、造价事务 API、价格库 RAG、审批 API、ERP 预算集成。
- 验收标准：BOQ 条目可追溯到模型构件和价格来源；变更前后差异可复核。

### 3.6 材料物流 `material_logistics`

- 用户角色：采购、仓库、供应商、物流、现场收货员、项目负责人。
- 输入：BOQ、生产计划、供应商库、库存、物流计划、现场需求。
- 输出：采购计划、采购订单、物流批次、收货记录、材料物流 token。
- 核心功能：采购拆分、供应商比价、到货计划、扫码收货、库存同步、异常处理。
- 文件类型：`.xlsx`、`.csv`、`.pdf`、`.jpg`、`.png`、`.json`、`.qr`。
- 审批：供应商选择、采购订单、到货验收、异常索赔。
- 状态机：draft -> submitted -> evaluating -> pending_approval -> approved / rejected -> archived。
- AI 能力：供应商推荐、价格异常识别、到货风险预测、材料替代建议。
- 多模态生成/互转调用：文字生成表格、文字生成 PDF、文字生成甘特图、图纸导出 PDF，用于采购计划、物流排程、收货清单和供应商交付包。
- 接口需求：采购文件 API、物流事务 API、供应商/材料库 RAG、ERP/WMS 集成、审计 API。
- 验收标准：材料来源、批次、收货、使用位置可追踪；第三方供应商系统可按 API 对接。

### 3.7 生产制造 `production_manufacturing`

- 用户角色：生产计划、工厂负责人、CNC 操作员、质检、MES/ERP 集成方、发运人员。
- 输入：深化模型、构件清单、材料计划、标准工艺、设备能力。
- 输出：生产工单、CNC 包、加工图、质检记录、发运包、生产制造 token。
- 核心功能：工单拆分、CNC 文件管理、加工进度、质量检验、发运交接、生产异常闭环。
- 文件类型：`.ifc`、`.nc`、`.dxf`、`.step`、`.xlsx`、`.pdf`、`.jpg`、`.json`。
- 审批：工单发布、CNC 包确认、工厂质检、发运确认。
- 状态机：draft -> submitted -> generating -> evaluating -> rule_checking -> pending_approval -> approved / rejected -> archived。
- AI 能力：工单拆分建议、加工风险提示、质检缺陷识别、设备排程建议。
- 多模态生成/互转调用：模型导出图纸、模型导出表格、CAD 图纸生成 BIM 模型、图纸导出 PDF、模型导出图片，用于工单、CNC 包、加工图和质检图。
- 接口需求：生产文件 API、工单事务 API、审批 API、MES/ERP 集成、设备数据接口、审计 API。
- 验收标准：`production_manufacturing` 是唯一生产制造主 ID；legacy alias 只能归一；工单和 CNC 包可追溯到设计构件。

### 3.8 施工监理 `construction_supervision`

- 用户角色：监理、施工负责人、安全员、质检员、业主代表、项目负责人。
- 输入：深化图纸、生产发运、材料批次、施工工法、安全质量规则。
- 输出：施工日志、验收记录、整改单、影像证据、施工监理 token。
- 核心功能：现场记录、工序验收、隐蔽工程验收、安全质量检查、整改闭环、转数字孪生。
- 文件类型：`.pdf`、`.jpg`、`.png`、`.mp4`、`.e57`、`.las`、`.ply`、`.bcf`、`.ifc`、`.json`。
- 审批：施工方案、隐蔽工程、质量验收、安全整改、竣工确认。
- 状态机：draft -> submitted -> evaluating -> rule_checking -> pending_approval -> approved / rejected -> blocked -> archived。
- AI 能力：安全隐患识别、质量缺陷分类、整改建议、现场记录摘要、工法匹配。
- 多模态生成/互转调用：图片生成 PDF 图纸、视频生成点云模型、视频生成 BIM 模型、文字生成 PDF、图片生成数字孪生，用于现场证据、整改报告和实景复核。
- 接口需求：现场文件 API、验收事务 API、整改审批 API、IoT/影像集成、审计 API。
- 验收标准：每个验收结论都有证据文件、人员、时间、位置和审计记录。

### 3.9 数字孪生 `digital_twin`

- 用户角色：数字孪生工程师、BIM 工程师、运维人员、项目负责人、业主。
- 输入：竣工模型、现场影像、点云、IoT 数据、设备台账、施工验收记录。
- 输出：数字孪生场景、3DGS / Gaussian Splat、模型叠加层、运维数据视图、数字孪生 token。
- 核心功能：模型融合、点云/影像管理、WebGPU 渲染数据、IoT 绑定、状态快照、运维联动。
- 文件类型：`.ifc`、`.glb`、`.gltf`、`.spz`、`.ply`、`.e57`、`.las`、`.mp4`、`.jpg`、`.json`。
- 审批：孪生快照发布、运维视图发布、数据绑定确认。
- 状态机：draft -> submitted -> generating -> evaluating -> schema_validating -> pending_approval -> approved / rejected -> archived。
- AI 能力：模型对齐建议、异常设备解释、空间问答、隐患定位、快照摘要。
- 多模态生成/互转调用：BIM 模型生成数字孪生、CAD 图纸生成数字孪生、PDF 图纸生成数字孪生、视频生成数字孪生、模型导出图片，用于场景生成、图层融合和快照输出。
- 接口需求：数字孪生文件 API、ObjectStore 地址 API、场景元数据 API、TimeSeriesStore 集成、WebGPU 数据接口。
- 验收标准：前端重做后仍可通过同一 API 加载场景、图层、快照和设备数据。

### 3.10 数字档案 `digital_archive`

- 用户角色：档案管理员、业主、项目负责人、合规人员、运维人员。
- 输入：全模块审批结果、竣工资料、模型、合同、验收记录、孪生快照。
- 输出：归档包、移交清单、保管期限索引、电子签章记录、数字档案 token。
- 核心功能：归档目录、资料完整性检查、电子签章、移交包生成、长期检索、合规审计。
- 文件类型：`.pdf`、`.pdfa`、`.ifc`、`.glb`、`.zip`、`.xlsx`、`.mp4`、`.json`。
- 审批：归档完整性确认、业主移交、销毁或延期保管确认。
- 状态机：draft -> submitted -> schema_validating -> rule_checking -> pending_approval -> approved / rejected -> archived。
- AI 能力：缺件检查、档案摘要、检索问答、保管期限提示、合规风险提示。
- 多模态生成/互转调用：文字生成 PDF、图纸导出 PDF、模型导出表格、模型导出图片、文字生成文档，用于归档包、移交清单、验收摘要和长期保存副本。
- 接口需求：归档文件 API、归档事务 API、审计 API、全文检索、对象存储归档策略。
- 验收标准：归档包可下载、可验证、可审计；长期检索不依赖前端内部状态。

### 3.11 设置中心 `settings_center`

- 用户角色：平台管理员、安全管理员、AI 工程师、租户管理员、运维人员。
- 输入：组织架构、角色权限、模型路由、存储配置、外部系统凭据、合规策略。
- 输出：RBAC 策略、WorkflowRouter 规则、AI provider 配置、StorageRouter 配置、设置中心 token。
- 核心功能：租户管理、用户角色、模块启停、权限策略、AI 路由、知识库连接、审计策略。
- 文件类型：`.yaml`、`.json`、`.md`、`.csv`。
- 审批：权限策略发布、AI 路由发布、外部集成启用、存储策略变更。
- 状态机：draft -> submitted -> evaluating -> pending_approval -> approved / rejected -> archived。
- AI 能力：策略冲突检测、权限风险提示、路由成本建议、审计异常归因。
- 多模态生成/互转调用：文字生成流程图、文字生成思维导图、文字生成文档、文字生成表格，用于权限策略、模型路由、Skill Registry 和 MCP Tool Registry 配置说明。
- 接口需求：配置 API、权限 API、Agent provider API、MCP registry API、审计 API。
- 验收标准：所有平台级变更有审批和审计；配置变更可回滚；第三方集成凭据不暴露给前端。
