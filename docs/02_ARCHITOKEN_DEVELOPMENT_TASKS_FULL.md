# ArchIToken 完整开发任务书

本文档是 30 天开发执行真源。目标不是展示页面，而是形成稳定后端合同、可重做前端、可集成第三方、可接 AI Agent / RAG / MCP / WorkflowRouter 的工程闭环。

## 0. 开发原则

- 前端会重做，后端 API 必须稳定、前端无关、第三方可调用。
- active 模块只使用 11 个标准 `module_id`；legacy alias 只做兼容归一。
- 开发阶段依赖可用 bounded compatible ranges；CI / 发布 / 生产通过 lockfile、constraints、digest、tag 固化。
- 不降低 CI gate，不跳过 Ruff / Mypy / Pytest / Rust / OpenAPI / License / Security。
- 先合同后实现：OpenAPI、SDK、Rust domain model、contract test 必须同步推进。
- AI 生成器、评估器、规则校验器、Schema 校验器分离；每次 Agent 调用必须可审计。

## 1. 优先级总表

| 优先级 | 目标 | 必须交付 |
| --- | --- | --- |
| P0 | 可编译、可测、可调用的合同底座 | Module registry、File API、Lifecycle API、Approval API、Audit API、Generation Job API、Artifact schema、OpenAPI examples、SDK 生成、Rust contract tests |
| P1 | 可替换内存实现的生产接口 | ObjectStore adapter、TransactionStore、EventStore、RBAC、tenant isolation、Skill Registry、MCP Tool Registry、WorkflowRouter、RAG ingestion、Evaluator |
| P2 | 生产体验和生态集成 | 前端重做、WebGPU / digital twin 数据层、ERP/MES/BIM/CAD/WeChat/Pay 集成、多模态 pipeline 优化、监控告警、部署固化 |

## 2. 后端任务

- 模块注册表：固化 11 个 active `module_id`、alias normalize、模块元数据、输入输出、文件类型、审批点。
- 文件服务：实现 list/create/get/update/metadata/content/move/copy/share/trash，内存实现通过后切 ObjectStore。
- 生命周期服务：实现 transaction create/list/get/transition/approve/reject，状态机拒绝非法跳转。
- 审批服务：审批和拒绝必须写 ModuleApproval 与 AuditEvent，保留 actor/comment/timestamp。
- 审计服务：append-only，支持 module_id、target_type、target_id、actor、limit、cursor 查询。
- 错误模型：所有 API 使用统一 ErrorResponse；非法 module_id、file_id、transaction_id、transition 返回 typed error。
- 存储抽象：定义 ObjectStore、TransactionStore、EventStore、VectorStore、FullTextStore、GraphStore、TimeSeriesStore adapter 边界。
- 权限模型：项目、租户、模块、文件、事务、知识库、AI tool 级 RBAC。
- 可观测性：HTTP request id、audit correlation id、Agent run id、外部系统 request id 贯穿。

## 3. 前端重构任务

- 以生成的 TypeScript SDK 和 `ModuleBackendAdapter` 为唯一后端入口。
- 重做 UI 时不得把模块状态、文件状态、审批状态写死在组件内部。
- 文件树、生命周期、审批、审计面板全部消费后端分页 API。
- 数字孪生前端只读取场景元数据、对象存储地址、图层、快照和 TimeSeries 数据，不直接读取后端内部路径。
- 所有表单提交都走 OpenAPI request schema；前端本地类型从 SDK 或 shared schema 生成。
- Mock adapter 只用于本地开发和测试，不能成为生产数据真源。

## 4. OpenAPI / SDK 任务

- 每个 endpoint 必须有 operationId、request example、response example、400 / 404 / 409 / 500。
- 所有列表响应必须含 data 和 pageInfo；支持 limit/cursor。
- OpenAPI lint 固定使用 Redocly；SDK 生成使用 openapi-generator typescript-fetch。
- 建立 schema diff 检查，破坏性变更必须显式标记版本。
- 生成 SDK 后补 adapter contract tests，验证前端调用不依赖 mock-only 字段。

## 5. AI Agent / RAG / MCP / WorkflowRouter 任务

- WorkflowRouter：按模块、任务类型、成本、隐私、延迟选择 provider、local model、MCP tool、RAG pipeline。
- Agent API：保留任务提交、执行状态、引用来源、评估结果、审计记录。
- RAG：标准规范、族库、材质、图纸、模型、企业制度、项目案例、价格、供应商、工法、验收、安全质量、IoT 知识统一 ingestion。
- MCP：每类知识库暴露最小 tool，例如 `search_standards`、`retrieve_family`、`quote_material_price`、`query_iot_status`。
- 评估：AI 输出必须经过 Evaluator、规则校验、Schema 校验、人工审批之一或组合，不能直接成为最终事实。

## 6. AI Native Multimodal Engineering Generation & Conversion Engine 任务

- P0 mock 合同：先实现 GenerationJob、GenerationArtifact、GenerationPlan、EvaluationReport、SchemaValidationResult 的后端 API 和 in-memory mock pipeline。
- P0 Artifact：支持 text、image、video、document、spreadsheet、pdf、ppt、mindmap、flowchart、gantt、floorplan、cad、bim、pointcloud、digital_twin、exported_image。
- P0 执行链：每个 job 必须按 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 推进，并写 ModuleFile、ModuleTransaction、AuditEvent。
- P0 Skill Registry：定义 skill id、input schema、output schema、sandbox policy、license policy、model requirements、test fixtures、owner。
- P0 MCP Tool Registry：定义 tool name、capabilities、permission scope、rate limit、audit policy、timeout、input/output schema。
- P0 WorkflowRouter：按 module_id、artifact type、成本、隐私、延迟、license、工具可用性选择 assistant、openclaw、model、skill、agent、MCP tool、RAG pipeline。
- P1 真实 PoC：落地文字生成文档/表格/PDF/流程图，图片生成 PDF 图纸，CAD/PDF 图纸生成 BIM preview，模型导出表格/图纸/图片。
- P1 Evaluation：实现 evaluator、active review、rule checker、schema validator、test harness、debug report，Generator 和 Evaluator 必须使用不同 skill 或不同模型配置。
- P1 StorageRouter：生成 artifact 进入 ObjectStore，元数据进入文件系统，状态进入 TransactionStore，审计进入 EventStore。
- P2 优化：视频生成点云、视频生成数字孪生、图片生成 BIM、生产级 WebGPU twin pipeline、批量导出和性能调优。

## 7. 文件 / ObjectStore 任务

- 文件元数据由后端数据库或 TransactionStore 管理，二进制内容由 ObjectStore 管理。
- content API 在合同阶段可用 in-memory stub，生产切换为 presigned URL 或 streaming adapter。
- 文件版本、hash、MIME、大小、owner、module_id、parent_id、status 必须持久化。
- 移动、复制、分享、回收站操作必须产生审计事件。
- 大文件、模型、点云、视频、3DGS 只存对象引用，不写入关系库 blob。

## 8. 数据库 / 权限 / 审计任务

- 数据库：设计 modules、files、file_versions、transactions、approvals、audit_events、knowledge_documents、agent_runs 表。
- 生成任务：设计 generation_jobs、generation_artifacts、generation_steps、skill_invocations、evaluation_reports、schema_validation_results 表。
- 权限：tenant、project、module、resource、action 五元组授权；默认 deny。
- 审计：所有 mutation、审批、AI 调用、外部集成调用都写 append-only event。
- 合规：审计事件不可被普通 API 删除；归档和保留策略由 digital_archive 管理。
- 迁移：本阶段只设计和测试抽象，不做数据库 migration。

## 9. 测试 / CI/CD / 部署任务

- Rust：`cargo fmt --all -- --check`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo test --all-targets --all-features`、release build。
- Python agent：Python 3.14 环境执行 install、Ruff、Mypy、Pytest，不用 Python 3.12 的 requires-python 失败判断项目失败。
- OpenAPI：Redocly lint 和 SDK generation 必须在合同变更后执行。
- Frontend：重构期间保留 lint/typecheck/test/build；后端合同变更必须跑 adapter tests。
- License/Security：cargo-deny、Trivy、SARIF upload、SBOM 不允许移除或 continue-on-error。
- Multimodal：每个 pipeline fixture 必须跑 Plan -> Action -> Review -> Test -> Debug -> Report；mock pipeline 测合同，真实 PoC 测 artifact、schema、evaluator、audit。
- 部署：CI 固定 action tag、容器 digest、lockfile；开发依赖范围和生产可复现配置分离。

## 10. 30 天开发排期

| 天 | 12 小时安排 | 输出物 | 验证 |
| --- | --- | --- | --- |
| D01 | 3h 梳理合同，5h GenerationJob/Artifact schema，4h OpenAPI 草案 | 生成任务合同 | Redocly、SDK generate |
| D02 | 4h Rust job model，4h in-memory mock pipeline，4h tests | generation mock API | fmt、clippy、test |
| D03 | 4h Planner/Generator/Evaluator step，4h Audit/File/Transaction 绑定，4h tests | 生成进入文件和事务 | cargo test |
| D04 | 4h Skill Registry schema，4h MCP Tool Registry schema，4h sandbox policy | skill/tool 合同 | Redocly、contract tests |
| D05 | 5h WorkflowRouter policy，4h ModelRouter config，3h tests | 路由底座 | cargo test |
| D06 | 5h EvaluationReport，4h RuleChecker/SchemaValidator，3h debug report | 评估和调试合同 | cargo test |
| D07 | 4h approval flow，4h artifact status，4h SDK adapter | preview/draft/approved/archived | SDK generate、tests |
| D08 | 4h text->document，4h text->table，4h fixtures | 文字生成文档/表格 PoC | tests |
| D09 | 4h text->PDF，4h text->PPT，4h export fixtures | 文档导出 PoC | tests |
| D10 | 4h text->flowchart，4h text->mindmap，4h text->gantt | 图表生成 PoC | tests |
| D11 | 5h text->floorplan，4h floorplan->CAD，3h review fixtures | 户型/CAD preview | tests |
| D12 | 5h image->PDF drawing，4h image->CAD，3h evaluator | 图片到图纸 PoC | tests |
| D13 | 5h CAD/PDF->BIM preview，4h IFC schema validation，3h fixtures | 图纸到 BIM preview | tests |
| D14 | 5h model export table，4h model export drawing/image，3h file binding | 模型导出 PoC | tests |
| D15 | 4h RAG ingestion for generation，4h knowledge citation，4h tests | 生成引用知识库 | RAG tests |
| D16 | 4h MCP tool invocation，4h permission/audit，4h tests | MCP 受控调用 | tests |
| D17 | 4h active review，4h evaluator isolation，4h negative tests | Generator/Evaluator 分离 | tests |
| D18 | 4h test harness，4h debug loop，4h report artifacts | Test/Debug/Report 闭环 | tests |
| D19 | 5h license policy，4h GitHub candidate ingestion job，3h audit | 免费商用工具筛选 | policy tests |
| D20 | 5h module-specific generation mapping，4h adapter docs，3h examples | 11 模块调用矩阵 | docs + tests |
| D21 | 5h settings_center model/skill governance，4h approval policy，3h tests | 治理能力 | tests |
| D22 | 5h BIM->digital twin，4h scene metadata，3h WebGPU contract | 孪生生成 preview | SDK generate |
| D23 | 5h CAD/PDF->digital twin，4h image/video->twin，3h fixtures | 多源孪生 PoC | tests |
| D24 | 5h video->pointcloud，4h pointcloud metadata，3h evaluator | 点云 PoC | tests |
| D25 | 5h export drawing/pdf/image，4h archive binding，3h tests | 导出和归档 | tests |
| D26 | 5h third-party generation API flow，4h idempotency，3h tests | 第三方生成接入 | contract tests |
| D27 | 5h Security/License/SBOM hardening，4h CI reproducibility，3h docs | CI 固化 | CI local checks |
| D28 | 6h end-to-end generation demo，3h bugfix，3h regression | 端到端生成链 | full checks |
| D29 | 6h performance baseline，3h observability，3h release notes | 性能和监控基线 | load smoke |
| D30 | 6h acceptance run，3h risk review，3h merge prep | 合并前审查包 | full CI parity |

## 11. 验收标准

- 后端 API 可通过 OpenAPI 生成 SDK，并被前端和第三方同等调用。
- 11 个模块的文件、生命周期、审批、审计都有 contract test。
- 所有 Agent / RAG / MCP 调用都有权限、引用、审计和评估结果。
- 多模态生成与互转 job 必须产出文件、事务、审批、审计、评估报告、Schema 校验结果和 debug report。
- 前端重做不要求改后端合同；后端合同变更必须先更新 OpenAPI 和 SDK。
- License、Security、Rust、Python、Frontend、OpenAPI gate 全部保留并通过。

## 12. Phase 3 StorageRouter / Registry 任务

- P0 StorageRouter：定义 ObjectStore、TransactionStore、EventStore、VectorStore、GraphStore、TimeSeriesStore、CacheStore、AnalyticsStore trait；本阶段只实现 in-memory preview adapter，不接 DB、S3、MinIO、OSS。
- P0 Artifact persistence boundary：GenerationJob 生成结果必须有 `ArtifactRef`、`ArtifactStorageBinding`、`ArtifactMetadata`、`ArtifactVersion`，状态限定为 preview、draft、approved、archived、rejected、blocked。
- P0 联动：GenerationJob 创建 lifecycle transaction；run 后产生 artifact reference；approve/reject 同步 artifact status、ModuleTransaction、AuditEvent。
- P0 Registry：Skill、MCP Tool、Knowledge Source 都采用 registry-first，不绑定某个前端；前端重做和第三方接入只依赖 OpenAPI/SDK。
- P1 生产持久化：把 in-memory adapter 替换为 ObjectStore/TransactionStore/EventStore 实现，保持 API 字段和错误格式不变。
- P2 外部执行：真实 MCP server、模型 API、GitHub 候选抓取和知识库 ingestion 只能在 license/security/sandbox/audit 策略通过后接入。

## 13. Phase 3 BIM 轻量化 / Viewer Benchmark

- P0 合同：吸收 `.opt/.db` pipeline、拾取、设色、显隐、透明、偏移、旋转、缩放、截图、导出图片等能力为 Artifact + ViewerAdapter command，不引入专有 JS/EXE/SDK。
- P0 轻量化 modes：`model_to_lightweight_scene`、`bim_to_scene_tiles`、`cad_to_scene_tiles`、`ifc_to_glb`、`ifc_to_3dtiles`、`glb_optimize`、`mesh_simplify`、`mesh_draco_compress`、`mesh_meshopt_compress`、`scene_lod_generate`、`model_property_index_generate`、`element_identity_map_generate`、`digital_twin_scene_generate`。
- Benchmark 指标：10k elements load、100k elements load、1M elements streaming、pick latency、setColor batch latency、setVisible batch latency、LOD switch latency、memory footprint、GPU memory、DrawCall count、worker decode time、property lookup latency。
- 验收：同一模型必须能产出 geometry artifact、property index artifact、element identity map、scene tile artifact、LOD artifact；每次 viewer command 都能追溯到 audit event。
- Vendor 策略：OptRapid3d/葛兰岱尔类 proprietary EULA vendor 只能 candidate/evaluation，不默认启用 production route；开源替代优先 MIT、Apache-2.0、BSD。
