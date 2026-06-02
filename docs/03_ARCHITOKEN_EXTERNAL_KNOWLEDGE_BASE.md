# ArchIToken 外接知识库 / RAG / MCP 总设计

外接知识库服务于 AI Agent、RAG、MCP tool 和 WorkflowRouter。知识库不是页面素材库，而是带来源、权限、版本、审计、索引和可调用工具的工程数据资产。

## 0. 总体架构

- Source：标准、构件、材质、图纸、模型、制度、案例、价格、供应商、工法、验收、安全质量、IoT。
- Ingestion：上传或外部同步 -> MIME 检测 -> hash -> 元数据抽取 -> ObjectStore 原件保存 -> parser 标准化。
- Indexing：chunk、embedding、full-text、graph relation、spatial/model metadata、time-series binding。
- Stores：ObjectStore 保存原件和大文件；VectorStore 保存语义向量；Full-text 保存关键词检索；GraphStore 保存构件/标准/供应商关系；TimeSeriesStore 保存 IoT；EventStore 保存 ingestion 和调用审计。
- Access：Agent、WorkflowRouter、MCP tool 和第三方 API 只能通过授权查询；所有返回必须带 citation、version、source_id。
- Governance：租户隔离、项目隔离、敏感字段脱敏、过期版本可追溯、禁止无来源结论。

## 1. 统一元数据

每个知识对象至少包含：`knowledge_id`、`module_id`、`source_type`、`title`、`version`、`source_uri`、`object_uri`、`hash`、`mime_type`、`language`、`effective_from`、`effective_to`、`permission_scope`、`owner`、`ingested_at`、`updated_at`、`audit_id`。

## 2. 知识库总表

| 知识库 | 来源 | 格式 | 索引方式 | Store | 更新频率 | 权限 | 审计 | 可调用 Agent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 标准规范库 | 国家/地方标准、行业规范、企业标准 | `.pdf`、`.docx`、`.md`、`.json` | 条文 chunk、编号、适用模块、版本、引用关系 | ObjectStore、VectorStore、Full-text、GraphStore | 法规发布后同步，企业标准按审批发布 | 标准工程师维护，设计/造价/施工只读 | ingestion、版本发布、Agent 引用 | standard reviewer、rule checker、design evaluator |
| 族库构件库 | BIM 族、构件参数、企业构件库 | `.ifc`、`.rfa`、`.glb`、`.json`、`.xlsx` | 构件类别、参数、IFC class、材料、尺寸、适用标准 | ObjectStore、VectorStore、GraphStore | 构件发布或废止时 | 族库工程师维护，设计/生产只读 | 构件发布、废止、参数读取 | family selector、BIM assistant、production_manufacturing planner |
| 材质库 | 材料样本、性能参数、环保等级 | `.xlsx`、`.csv`、`.pdf`、`.jpg`、`.json` | 材质名称、性能、颜色、供应商、标准 | ObjectStore、VectorStore、Full-text、GraphStore | 供应商或企业评审后 | 材料管理员维护，设计/采购只读 | 材料版本、替代建议调用 | material recommender、cost assistant |
| 图纸库 | 历史项目图纸、标准图集、深化图纸 | `.dwg`、`.dxf`、`.pdf`、`.png` | 图号、专业、楼层、构件、项目、版本 | ObjectStore、Full-text、VectorStore | 项目阶段提交后 | 项目内授权，跨项目需审批 | 上传、下载、AI 解析 | drawing assistant、detail design checker |
| 模型库 | IFC、GLB、点云、3DGS、设备模型 | `.ifc`、`.glb`、`.gltf`、`.e57`、`.las`、`.ply`、`.spz` | 空间、构件、楼层、坐标、设备绑定 | ObjectStore、GraphStore、VectorStore | 模型发布、现场扫描后 | 项目授权，孪生工程师维护 | 模型导入、切片、Agent 读取 | digital twin agent、model evaluator |
| 企业制度库 | 流程制度、权限策略、审批制度 | `.pdf`、`.md`、`.docx`、`.yaml` | 制度条款、角色、流程、适用模块 | ObjectStore、VectorStore、Full-text | 制度审批发布后 | 管理员维护，按角色读取 | 制度发布、AI 引用 | governance agent、approval advisor |
| 项目案例库 | 历史项目、报价、问题闭环、交付结果 | `.pdf`、`.xlsx`、`.json`、`.jpg`、`.mp4` | 项目类型、面积、造价、工期、问题标签 | ObjectStore、VectorStore、GraphStore | 项目归档后 | 跨项目脱敏后可检索 | 案例入库、脱敏、引用 | marketing assistant、concept designer、risk analyst |
| 造价价格库 | 材料价格、人工价格、供应商报价、历史成本 | `.xlsx`、`.csv`、API JSON | 地区、时间、规格、供应商、价格区间 | ObjectStore、Full-text、GraphStore | 日/周/月按来源同步 | 造价和采购授权 | 价格导入、报价引用 | costing agent、procurement advisor |
| 供应商 / 材料库 | 供应商资质、产品目录、合同、交付记录 | `.pdf`、`.xlsx`、`.csv`、API JSON | 供应商、材料、资质、交付评分、风险 | ObjectStore、Full-text、GraphStore | 供应商变更或采购后 | 采购维护，项目按需读取 | 资质更新、推荐调用 | supplier selector、logistics planner |
| 施工工法库 | 施工方案、工艺标准、作业指导书 | `.pdf`、`.mp4`、`.jpg`、`.md` | 工序、材料、设备、风险、验收点 | ObjectStore、VectorStore、Full-text | 工法审批发布后 | 施工/监理授权 | 工法发布、现场调用 | construction advisor、safety agent |
| 施工管理验收库 | 验收标准、检查表、缺陷样例、整改闭环 | `.pdf`、`.xlsx`、`.jpg`、`.json` | 验收项、缺陷类型、严重级别、证据要求 | ObjectStore、VectorStore、Full-text、GraphStore | 标准更新或项目复盘后 | 施工管理授权角色维护，项目读取 | 验收引用、缺陷识别 | construction management agent、quality evaluator |
| 安全质量隐患库 | 事故案例、隐患清单、处罚标准、整改措施 | `.pdf`、`.jpg`、`.mp4`、`.json` | 隐患类型、风险等级、场景、整改动作 | ObjectStore、VectorStore、Full-text | 安全复盘和法规更新后 | 安全管理员维护 | AI 识别、预警、整改建议 | safety agent、risk evaluator |
| 设备 / IoT / 运维知识库 | 设备台账、传感器定义、维保手册、时序数据 | `.pdf`、`.csv`、API JSON、MQTT payload | 设备、点位、阈值、时间、空间绑定 | ObjectStore、TimeSeriesStore、GraphStore、VectorStore | 实时或按设备同步 | 运维授权，敏感设备隔离 | 数据接入、阈值触发、Agent 查询 | twin operations agent、maintenance advisor |

## 3. 外接 AI 模型与开源工具知识库

- 范围：文本生成、图片生成、视频生成、OCR、CAD 解析、PDF 解析、BIM/IFC 处理、点云重建、3DGS、WebGPU 渲染、表格生成、PPT/PDF 导出、流程图/甘特图生成、Evaluator、Schema Validator。
- 元数据：`tool_id`、`source_repo`、`license`、`commercial_use_allowed`、`model_or_tool_type`、`supported_artifacts`、`input_schema`、`output_schema`、`runtime`、`sandbox_profile`、`security_notes`、`last_checked_at`。
- Store：源码和 release artifact 进入 ObjectStore；说明文档进入 Full-text；能力和依赖关系进入 GraphStore；模型卡和 benchmark 进入 VectorStore；审查事件进入 EventStore。
- 权限：settings_center 管理可用 provider、tool、skill、model；生产默认只启用通过 license、security、sandbox 和 evaluator 测试的候选。
- 调用：WorkflowRouter 读取 tool/model 元数据后选择 assistant、panai、model、skill、agent、MCP tool 或 RAG pipeline。

## 4. GitHub 热门项目候选池

- 不在本文档固化 GitHub trending 排名；具体项目必须由 Codex/CI 定时联网抓取 GitHub releases、tags、license、security advisory、stars、activity、issues 后再落库。
- 候选类别：text-to-image、image-to-video、video-to-pointcloud、CAD parser、PDF drawing parser、IFC toolkit、BIM validator、3D reconstruction、Gaussian Splatting、document generator、spreadsheet generator、diagram generator、workflow engine、agent framework、MCP server。
- 采集字段：repo、default branch、latest release、license SPDX、commercial policy、language、runtime、GPU requirements、last commit、maintainer activity、known vulnerabilities、dependency health。
- 入库流程：discover -> license scan -> security scan -> minimal build -> sandbox smoke test -> schema wrapper -> evaluator fixture -> approval -> Skill Registry。
- 更新策略：每日抓取新增候选和 release；每周重跑 license/security/build smoke；重大 CVE 或 license 变更触发即时冻结。

## 5. 免费商用许可审查

- 优先：MIT、Apache-2.0、BSD-2-Clause、BSD-3-Clause、ISC、Zlib，且必须确认依赖链没有更严格限制。
- 默认禁止：GPL、AGPL、LGPL、SSPL、BUSL、Commons Clause、非商业许可、研究用途限定、模型权重禁止商用条款。
- 审查输出：license decision、evidence URL、dependency license summary、commercial risk、attribution requirements、approval actor、audit_id。
- 执行位置：license policy 由 settings_center 管理；CI 负责自动扫描；人工审批负责高风险例外，但禁止把 forbidden license 放行为生产依赖。
- Agent 约束：任何 skill/model/tool 未通过免费商用许可审查时，WorkflowRouter 不得在生产任务中选择。

## 6. 模型 / Skill / MCP / Agent / RAG 更新机制

- 模型更新：记录 provider、model version、context window、cost、latency、privacy、license、benchmark、rollback version。
- Skill 更新：每次改 input/output schema、prompt、tool chain、sandbox profile 都生成新版本，并跑 fixtures。
- MCP 更新：tool schema、permission scope、timeout、rate limit、audit policy 变更必须审批。
- Agent 更新：planner、generator、evaluator、debugger、reviewer 分别版本化，Generator 与 Evaluator 不共享同一不可审计配置。
- RAG 更新：每日增量 ingestion，每周重建重要索引；所有 chunk、embedding、graph edge 都保留来源版本。
- Active learning / active review：人工 review 结果进入训练和规则改进队列，但不能自动覆盖 approved artifact。

## 7. 每日 / 每周刷新策略

- 每日：抓取 GitHub 候选、PyPI/npm/crates release、模型 provider 版本、license 变更、security advisory、知识库增量文件。
- 每日：重跑关键 skill 的 smoke fixtures，检查 artifact schema、metadata、audit event、sandbox 限制。
- 每周：重建 VectorStore / Full-text / GraphStore 热索引，生成知识库质量报告和过期来源列表。
- 每周：执行免费商用许可复核、依赖健康报告、模型成本报告和 WorkflowRouter 命中报告。
- 失败处理：抓取或审查失败的候选进入 quarantine，不进入 Skill Registry，不允许 WorkflowRouter 调用。

## 8. MCP Tool 设计

- `search_standards(module_id, query, version)`：返回标准条文、版本、引用和适用范围。
- `retrieve_family(module_id, component_type, constraints)`：返回族库构件、参数、文件引用。
- `match_material(requirements, region, budget)`：返回材质候选、价格来源、供应商风险。
- `query_drawings(project_id, discipline, level, keyword)`：返回图纸文件和版本。
- `query_model_elements(project_id, ifc_class, location)`：返回构件、空间和模型引用。
- `estimate_cost(module_id, boq_items, region)`：返回价格区间、来源和异常提示。
- `select_supplier(material_id, region, delivery_date)`：返回供应商候选和交付风险。
- `search_work_method(task_type, material, risk)`：返回工法、验收点和安全要求。
- `evaluate_construction_evidence(evidence_id, checklist)`：返回验收建议和缺陷分类。
- `query_iot_status(asset_id, time_range)`：返回设备状态、阈值、趋势和告警。
- `generate_engineering_artifact(job_id, plan)`：按批准的 plan 调用多模态 pipeline，返回 preview artifact。
- `evaluate_engineering_artifact(artifact_id, criteria)`：独立评估生成结果，返回 EvaluationReport。
- `validate_artifact_schema(artifact_id, schema_ref)`：执行 CAD/BIM/twin/document/table schema validation。
- `debug_generation_pipeline(job_id, failed_step)`：生成 debug report，不直接修改 approved artifact。

## 9. WorkflowRouter 使用方式

- 输入：`module_id`、task_type、数据敏感级别、成本上限、延迟要求、是否需要本地模型、是否允许外部 provider。
- 路由：先判断权限，再选择 RAG 知识库，再选择 MCP tool，再选择模型 provider。
- 输出：Agent run、引用列表、评估结果、审计事件、可复核的结构化结果。
- 失败策略：知识库无命中时返回可解释空结果；不得编造标准、价格、资质或验收结论。

## 10. 验收标准

- 任一 Agent 回答都能追踪到知识对象、版本、来源和调用审计。
- 任一知识库更新都能重建索引并保留旧版本可追溯。
- MCP tool 不能越权读取跨租户或跨项目数据。
- WorkflowRouter 能在 OpenRouter、本地推理、专用模型和规则引擎之间按策略选择。
- 任何外接 AI 模型、开源工具、Skill、MCP tool 进入生产前必须完成免费商用许可审查、安全审查、sandbox smoke test 和审计登记。

## 11. Knowledge Source Registry 落地规则

- 每个知识源必须登记 `kind`、`sourceUrl`、`license`、`version`、`owner`、`refreshPolicy`、`permissionPolicy`、`auditPolicy`、`indexBinding`、`citationPolicy`，再由 WorkflowRouter/RAG/MCP 引用。
- 当前后端提供 registry ingest 元数据入口；真实下载、解析、embedding、GraphStore 写入和 GitHub 候选抓取由定时联网任务执行，不能在文档或静态数据中伪造排名。
- 外接 AI 模型与开源工具候选库也作为 `external_ai_model_open_source_candidate` 类型登记；MIT、Apache-2.0、BSD 优先，GPL、AGPL、LGPL、SSPL、BUSL、Commons Clause 默认不得进入生产路由。
- 知识源审批前只能用于 sandbox/evaluator fixture；审批后仍按 tenant/project/module 权限读取，并且每次 ingest、检索、引用都写 audit trail。

## 12. Open BIM / Digital Twin 开源候选池

- 候选类别：Three.js/R3F viewer、WebGPU renderer、3D Tiles renderer、IFC parser/viewer、glTF optimizer、Draco compressor、meshoptimizer、point cloud renderer、3D Gaussian Splat renderer、CAD/DXF parser、PDF drawing parser、BIM property indexer。
- 采集规则：不固化 GitHub ranking；具体项目由定时联网任务实时采集 repo、release/tag、license、SBOM、security advisory、benchmark、maintainer activity 后写入 Knowledge Source Registry。
- Production route：MIT、Apache-2.0、BSD 优先；GPL、AGPL、LGPL、SSPL、BUSL、Commons Clause 默认禁止；proprietary EULA 只能 candidate/evaluation。
- 已知可吸收方向：如果第三方 notices 证明 3D Tiles renderer 为 Apache-2.0，可进入开源候选池并走 SBOM/security/benchmark/sandbox review；不得直接复制专有 viewer loader 产物。
- Vendor candidate：`vendor.glendale.optrapid3d` 只登记为 `candidate_only`，`productionEnabled=false`，`defaultRoute=disabled`，`licensePolicy=proprietary_eula`，`commercialPolicy=converter_paid_by_model_volume`。
- Vendor declared capabilities：BIM lightweighting、`.opt` geometry generation、`.db` property index generation、Three.js model loading、picking、setColor、setVisible、setAlpha、offset、rotate、zoomTo。
- Vendor requirements before use：legal review、commercial review、SBOM review、security scan、benchmark、sandbox smoke test、explicit user approval。

## 13. 本地 BIM/GIS/CAD 厂商资料包登记

- Local path：`/home/insome/下载/基于BIM的平台开发`。
- Repository evidence：[`VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md`](./VENDOR_BIM_PLATFORM_REFERENCE_INVENTORY.md)。
- Inspected groups：黑洞引擎开发指南、离线数据查看器、三维图形引擎转换平台操作手册、Glendale WebGL BIM/GIS API、Glendale WebGL CAD API、Glendale DB 字段文档、Glendale 自适应渲染部署/二开文档、AutoCAD/Revit/Navisworks/Tekla/Rhino/SolidWorks/CATIA/Bentley/NX/Creo 插件包、数字孪生转换器、模型格式转换 SDK、园区/桥梁监测样例包、IFCDB-Agent zip。
- Knowledge use：只进入 Knowledge Source Registry / RAG / architecture review as `vendor_bim_platform_reference` and `candidate_only` material. It may influence ArchIToken's open contracts for file management, conversion queue, model tree, property panel, element identity, layout switching, LOD, offline package, and viewer commands.
- Prohibition：不得复制或导入专有 EXE、SDK、loader、WASM、DB schema、RAR/ZIP runtime、加密资产或模型转换产物到 ArchIToken core。若要生产使用，必须走 licensed adapter / isolated service，并完成 legal、commercial、SBOM、security、benchmark、sandbox smoke、audit 和 explicit approval。
- Implementation rule：任何借鉴都必须落到后端 artifact manifest、conversion job、object storage、element identity map、property index、viewer command audit 和前端统一 viewer chrome；不得只在前端写一个看起来相似的页面。
