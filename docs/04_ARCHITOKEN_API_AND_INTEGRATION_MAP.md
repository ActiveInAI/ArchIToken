# ArchIToken API 与集成地图

本文档描述前端重构、第三方系统、AI Agent、外接知识库和数字孪生如何调用 ArchIToken。OpenAPI 是 HTTP 合同真源，前端重做不得改变后端合同方向。

## 0. API 原则

- `baseUrl`：开发环境建议 `http://localhost:<gateway-port>`，生产环境由 API Gateway 暴露统一域名和版本前缀。
- API 版本：当前主路径为 `/v1`；破坏性变更必须开新版本或提供兼容字段。
- 模块标识：所有模块能力使用 `module_id`；active id 只允许 14 个标准模块。
- 错误格式：所有失败返回统一 `ErrorResponse`，至少包含 `code`、`message`、可选 `details`、`requestId`。
- 分页格式：列表接口使用 `limit`、`cursor` query，响应包含 `pageInfo.hasNextPage` 和 `pageInfo.nextCursor`。
- 第三方调用：不得依赖前端内部状态；通过 OpenAPI、SDK、OAuth/API key、审计和幂等键接入。

## 1. 前端重构调用规则

- 前端只通过生成的 TypeScript SDK 和 `ModuleBackendAdapter` 调用后端。
- `SessionModuleBackendAdapter` 仅用于本地会话开发和测试；生产必须切换到真实 HTTP adapter。
- UI 组件只能消费 adapter 返回的文件、事务、审批、审计数据，不直接构造后端私有字段。
- 所有 mutation 后刷新对应列表或使用事件流同步；不能把本地 optimistic 状态当作后端事实。
- 数字孪生 UI 读取场景元数据、对象存储 URL、图层、IoT 时间序列和快照，不读取后端内部文件路径。

## 2. OpenAPI endpoint 总表

| 能力 | Endpoint | 用途 | 前端/第三方使用方式 |
| --- | --- | --- | --- |
| 健康检查 | `GET /healthz` | 进程存活检查 | 部署和监控调用 |
| 就绪检查 | `GET /readyz` | 依赖就绪检查 | 部署和监控调用 |
| 模块列表 | `GET /v1/modules` | 返回 14 个 active 模块 | 前端导航、第三方发现能力 |
| 模块详情 | `GET /v1/modules/{module_id}` | 返回模块元数据 | 页面初始化、权限和能力判断 |
| 模块文件列表 | `GET /v1/modules/{module_id}/files` | 按模块列文件，支持 parentId/status/kind/limit/cursor | 文件树、第三方同步 |
| 创建模块文件 | `POST /v1/modules/{module_id}/files` | 创建文件或目录元数据，支持 source checksum | 上传前建档、生成文件登记 |
| 文件详情 | `GET /v1/files/{file_id}` | 读取文件节点 | 打开属性面板 |
| 更新文件 | `PATCH /v1/files/{file_id}` | 重命名、状态、元数据更新 | 文件管理 |
| 文件元数据 | `GET /v1/files/{file_id}/metadata` | 读取 metadata | 属性面板和第三方校验 |
| 读取内容 | `GET /v1/files/{file_id}/content` | 开发本地 content adapter | 小文本合同验证；大文件用 ObjectStore |
| 写入内容 | `PUT /v1/files/{file_id}/content` | 开发本地 content adapter | 合同验证；生产使用 ObjectStore |
| 移动文件 | `POST /v1/files/{file_id}/move` | 改变 parentId | 文件树操作 |
| 复制文件 | `POST /v1/files/{file_id}/copy` | 复制到目标目录 | 模板复用 |
| 分享文件 | `POST /v1/files/{file_id}/share` | 创建分享结果 | 第三方或业主分享 |
| 回收文件 | `POST /v1/files/{file_id}/trash` | 软删除 | 回收站和审计 |
| 事务列表 | `GET /v1/transactions` | 按 module_id/status/limit/cursor 查生命周期事务 | 工作台列表、第三方跟踪 |
| 创建事务 | `POST /v1/transactions` | 创建模块生命周期事务 | 提交业务动作 |
| 事务详情 | `GET /v1/transactions/{transaction_id}` | 读取状态和上下文 | 状态页 |
| 状态迁移 | `POST /v1/transactions/{transaction_id}/transition` | 执行合法状态迁移 | 工作流推进 |
| 批准 | `POST /v1/transactions/{transaction_id}/approve` | 审批通过 | 审批面板 |
| 拒绝 | `POST /v1/transactions/{transaction_id}/reject` | 审批拒绝 | 审批面板 |
| 审计列表 | `GET /v1/audit-events` | 按 module_id/target_type/target_id/actor/limit/cursor 查询 | 审计面板、合规导出 |
| 创建生成任务 | `POST /v1/generation/jobs` | 提交多模态生成/互转任务 | 前端、第三方、Agent 创建 job |
| 生成任务详情 | `GET /v1/generation/jobs/{job_id}` | 查询计划、状态、评估、审批 | 工作台和第三方轮询 |
| 批准生成任务 | `POST /v1/generation/jobs/{job_id}/approve` | 批准 draft artifact 成为 approved | 审批面板 |
| 拒绝生成任务 | `POST /v1/generation/jobs/{job_id}/reject` | 拒绝生成结果并记录原因 | 审批面板和 debug |
| 生成产物列表 | `GET /v1/generation/jobs/{job_id}/artifacts` | 返回输入、preview、draft、approved、archived artifact | 文件系统、导出、第三方下载 |
| Harness 调用 | `POST /v1/harness/invoke` | 低层 harness 能力调用 | 内部调试和受控扩展 |

## 3. ModuleBackendAdapter 合同映射

| Adapter 方法 | 后端合同 |
| --- | --- |
| `initializeModule(moduleId)` | `GET /v1/modules/{module_id}` |
| `listFiles(moduleId, query)` | `GET /v1/modules/{module_id}/files` |
| `createFile(moduleId, payload)` | `POST /v1/modules/{module_id}/files` |
| `openFile(fileId)` | `GET /v1/files/{file_id}` |
| `renameFile(fileId, name)` | `PATCH /v1/files/{file_id}` |
| `moveFile(fileId, parentId)` | `POST /v1/files/{file_id}/move` |
| `copyFile(fileId, targetParentId)` | `POST /v1/files/{file_id}/copy` |
| `shareFile(fileId, payload)` | `POST /v1/files/{file_id}/share` |
| `deleteFile(fileId)` | `POST /v1/files/{file_id}/trash` |
| `getProperties(fileId)` | `GET /v1/files/{file_id}/metadata` |
| `createTransaction(payload)` | `POST /v1/transactions` |
| `listTransactions(query)` | `GET /v1/transactions` |
| `transitionTransaction(id, payload)` | `POST /v1/transactions/{transaction_id}/transition` |
| `approveTransaction(id, payload)` | `POST /v1/transactions/{transaction_id}/approve` |
| `rejectTransaction(id, payload)` | `POST /v1/transactions/{transaction_id}/reject` |
| `listAuditEvents(query)` | `GET /v1/audit-events` |

## 4. 文件 API 规则

- `parentId` 为空表示模块根目录。
- `kind` 区分 file、folder、model、drawing、document、media、dataset、archive 等合同类型。
- `status` 表示 active、draft、reviewing、approved、archived、trashed 等文件生命周期状态。
- content API 当前只用于开发小文本合同验证；模型、点云、视频、3DGS、压缩包生产环境必须通过 ObjectStore。
- 生产 ObjectStore 返回 presigned URL、object key、content hash、MIME、size、version，不改变文件元数据 API。

## 5. 生命周期 / 审批 / 审计规则

- Lifecycle API 通过 TransactionStore 边界运行；生产已接 PostgreSQL 持久化，状态机与开发内存实现保持同一套合法 transition。
- 事务状态只能通过合法 transition 前进；非法 transition 返回 409 typed error。
- approve/reject 生成 ModuleApproval，并写 AuditEvent。
- AuditEvent 字段使用 camelCase，至少包含 moduleId、targetType、targetId、action、actor、createdAt、metadata。
- 审计列表支持按模块、目标类型、目标 ID、actor 过滤，满足合规导出和问题追踪。

## 6. AI Agent API 与 WorkflowRouter

- Agent 请求必须包含 `module_id`、task_type、input artifact、权限上下文和期望输出 schema。
- WorkflowRouter 负责选择 RAG 知识库、MCP tool、OpenRouter provider、本地推理或规则引擎。
- Agent 输出必须包含结构化结果、引用、评估结果、审计 ID。
- Generator 输出不能直接写入业务最终态；必须经过 Evaluator、rule checker、schema validator 或人工审批。
- AI 调用产生的文件、事务、审批建议和知识引用全部写入 AuditEvent。

## 7. 多模态生成 API 设计

- `POST /v1/generation/jobs`：请求体包含 `module_id`、`generation_type`、`input_artifacts`、`target_artifact_type`、`constraints`、`workflow_policy`、`approval_required`、`metadata`。
- `GET /v1/generation/jobs/{job_id}`：返回 job 状态、Planner 输出、当前 step、Evaluator 结果、RuleChecker 结果、SchemaValidator 结果、approval 状态和 audit id。
- `POST /v1/generation/jobs/{job_id}/approve`：把合格 draft artifact 标记为 approved，写 ModuleApproval、ModuleTransaction、AuditEvent。
- `POST /v1/generation/jobs/{job_id}/reject`：记录拒绝原因、进入 rejected 或 debugging，不删除原 artifact。
- `GET /v1/generation/jobs/{job_id}/artifacts`：返回输入、输出、preview、draft、approved、archived artifact 列表和 ObjectStore 引用。
- 生成 BIM / CAD / 数字孪生时，artifact status 必须显式为 preview、draft、approved、archived 之一。

## 8. Skill / MCP / Agent / Model Router 调用链

- 调用链：Client -> Generation API -> WorkflowRouter -> Planner -> Skill Registry -> MCP Tool Registry -> Model Router -> Tool Sandbox -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver -> File/Lifecycle/Audit。
- assistant：负责交互和任务解释，不直接写 approved artifact。
- openclaw：作为可插拔工程执行层，必须通过 Skill Registry 声明 schema、权限和 sandbox。
- model：由 Model Router 按隐私、成本、延迟、license 和能力选择。
- skill：封装 CAD/PDF/BIM/twin/export 等工程能力，必须有 test fixtures 和 debug report。
- agent：负责 plan、memory、RAG、tool call 编排，但每次 action 都写 audit trail。
- MCP：提供标准、族库、价格、模型、图纸、IoT、生成、评估、校验、debug 等工具。

## 9. 输入输出 artifact schema

| 字段 | 说明 |
| --- | --- |
| `artifactId` | 全局唯一产物 ID |
| `moduleId` | 14 个 active `module_id` 之一 |
| `artifactType` | text、image、video、document、spreadsheet、pdf、ppt、mindmap、flowchart、gantt、floorplan、cad、bim、pointcloud、digitalTwin、lightweightScene、sceneTiles、glb、lod、propertyIndex、elementIdentityMap |
| `status` | preview、draft、approved、archived、rejected、blocked |
| `objectUri` | ObjectStore 引用或开发小文本 content 引用 |
| `mimeType` | 标准 MIME |
| `schemaRef` | JSON Schema、IFC Schema、CAD layer schema、twin scene schema 或表格 schema |
| `version` | artifact 版本 |
| `hash` | 内容 hash |
| `metadata` | `geometryFormat`、`propertyIndexFormat`、`elementIdNamespace`、`viewerAdapterHint`、尺寸、页数、图层、坐标系、构件数量、时长、帧率、模型版本等 |
| `permissionScope` | tenant/project/module/resource 权限范围 |
| `auditId` | 创建或更新该产物的 AuditEvent |

## 10. 前端 / 第三方调用流程

1. 调用 `POST /v1/generation/jobs`，提交输入 artifact、目标类型和约束。
2. 调用 `GET /v1/generation/jobs/{job_id}` 轮询 queued、planning、generating、evaluating、rule_checking、schema_validating、pending_approval。
3. 调用 `GET /v1/generation/jobs/{job_id}/artifacts` 读取 preview 或 draft 产物，并通过文件 API 展示或下载。
4. 审批人调用 approve/reject；通过后 artifact 进入 approved，文件系统、生命周期事务和审计同步更新。
5. 第三方系统只保存 artifact id、version、hash 和 object URI，不复制后端内部状态。

## 11. WebGPU / 数字孪生数据接口

- 前端 WebGPU 渲染不直接依赖后端内部模型结构，只读取 scene metadata、layer list、object URI、tile manifest、snapshot。
- BIM / CAD / point cloud / 3DGS 大文件存 ObjectStore，API 返回授权 URL 和元数据。
- IoT / 运维数据通过 TimeSeriesStore adapter 查询，和模型构件通过 GraphStore 绑定。
- 数字孪生快照必须有版本、坐标系、来源模型、生成时间、审批状态和审计事件。

## 12. 外部系统集成地图

| 系统 | 集成方向 | 关键合同 |
| --- | --- | --- |
| 微信 / 小程序 | 客户咨询、审批通知、文件分享 | API Gateway、OAuth、share token、AuditEvent |
| 支付 | 设计订金、阶段款、采购付款 | Payment adapter、订单状态、审计、财务权限 |
| ERP / MES | 采购、库存、工单、生产进度 | material_logistics、production_manufacturing、webhook、idempotency key |
| BIM / CAD | IFC/DWG/DXF/BCF 导入导出 | ObjectStore、model metadata、Schema validation |
| 对象存储 | 大文件、模型、视频、归档包 | ObjectStore adapter、presigned URL、hash、retention |
| 模型推理 | 云端或本地 AI 模型 | WorkflowRouter、provider policy、AgentRun |
| RAG | 标准、族库、案例、价格、工法检索 | KnowledgeDocument、VectorStore、Full-text、GraphStore |
| OpenRouter / 本地推理 | 外部模型和本地模型路由 | provider adapter、成本策略、隐私策略、审计 |
| 多模态生成工具 | 文本/图片/视频/CAD/PDF/BIM/twin 互转 | Skill Registry、MCP Tool Registry、GenerationJob、Artifact schema |

## 13. 第三方调用验收

- 第三方只凭 OpenAPI 和鉴权信息即可列模块、操作文件、推进事务、读取审计。
- 错误、分页、ID、时间字段、枚举值稳定。
- module_id 输入只接受 active module id。
- 任何跨系统 mutation 都能通过 AuditEvent 找到调用方、目标对象、时间和结果。
- 第三方可提交多模态生成任务，但不能绕过 Planner、Evaluator、RuleChecker、SchemaValidator、Approver。

## 14. Phase 3 Registry-First API 底座

- `GET/POST /v1/skills`、`GET/PATCH /v1/skills/{skill_id}`、`POST /approve`、`POST /disable`：Skill Registry 只登记 schema、version、license policy、sandbox policy、fixtures、owner 和 production route 状态；未审批或 forbidden license skill 不进入生产路由。
- `GET/POST /v1/mcp-tools`、`GET/PATCH /v1/mcp-tools/{tool_id}`、`POST /approve`、`POST /disable`：MCP Tool Registry 只登记 permission scope、timeout、rate limit、input/output schema 和 audit policy；当前不启动真实 MCP server。
- `GET/POST /v1/knowledge-sources`、`GET/PATCH /v1/knowledge-sources/{source_id}`、`POST /ingest`、`POST /approve`、`POST /disable`：Knowledge Source Registry 登记来源、license、version、refresh policy、permission policy、audit policy、index binding、citation policy；外部抓取和索引由联网 worker 执行。
- GenerationJob run 会产出 `ArtifactRef`、`ArtifactStorageBinding`、`ArtifactMetadata`、`ArtifactVersion`；生产合同保持 `ObjectStore`、`TransactionStore`、`EventStore` 边界，不改变前端和第三方调用合同。
- 前端重做只调用 OpenAPI 生成 SDK，不依赖内部 Rust service；第三方系统同样通过 `baseUrl + bearer token + module_id + pagination + ErrorResponse` 调用。

## 15. BIM 轻量化与 ViewerAdapter 合同

- ArchIToken 吸收 OptRapid3d/葛兰岱尔类能力的方式是开放 contract，不复制 `OptRapid3dLoader.js`，不引入其 EXE/SDK，不把专有 EULA 软件作为核心依赖。
- Artifact schema 支持 `geometryArtifact`、`propertyIndexArtifact`、`elementIdentityMap`、`sceneTileArtifact`、`lodArtifact`、`sourceArtifact`、`previewArtifact` 七类角色，并用 `geometryFormat`、`propertyIndexFormat`、`elementIdNamespace`、`viewerAdapterHint` 标明能力边界。
- ViewerAdapter 命令：`loadArtifact`、`unloadArtifact`、`pick`、`setColor`、`setVisible`、`setOpacity`、`isolate`、`clearIsolation`、`offset`、`clearOffset`、`rotate`、`clearRotate`、`zoomTo`、`snapshot`、`exportImage`、`dispose`。
- 每个 viewer command 必须生成或关联 AuditEvent；前端实现可以选 Three.js、R3F、WebGPU、3D Tiles、IFC、Gaussian Splat adapter，但不得绕过后端 artifact、权限、审批、审计合同。
- 轻量化 pipeline modes：`model_to_lightweight_scene`、`bim_to_scene_tiles`、`cad_to_scene_tiles`、`ifc_to_glb`、`ifc_to_3dtiles`、`glb_optimize`、`mesh_simplify`、`mesh_draco_compress`、`mesh_meshopt_compress`、`scene_lod_generate`、`model_property_index_generate`、`element_identity_map_generate`、`digital_twin_scene_generate`。
