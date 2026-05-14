# ArchIToken · 平台功能全景图

**状态**: frontend operational map · full-width workbench · file operations · lifecycle state machine
**范围**: 14 modules workbench, typed fixtures, mock backend adapter, mock actions

---

## 1. 平台入口

`/app/modules` 是 ArchIToken 当前前端平台入口。它提供:

- 左侧 14 模块紧凑 rail,默认 `72px`,可展开到 `220px`
- 顶部工具栏、搜索、上传、新建、视图切换和主题切换
- 主模块详情区
- 右侧详情、审批、生命周期、AI 建议和本地审计抽屉,默认收起
- 右下角全局浮动 `ArchIToken AI`
- 每个模块独立详情路由 `/app/modules/[moduleId]`
- 每个模块独立 mock 文件树、右键菜单、预览抽屉、属性面板
- 生命周期事务、审批流、状态机与审计事件

当前未接真实后端 API,但所有交付物、文件、事务与审批操作都通过 typed mock backend adapter 或 typed mock action handler 驱动,点击后会改变状态并写入审计面板。

布局与主题要求:

- 桌面端铺满 `100vw`: 左侧紧凑 rail、中间主业务功能区、右侧按需抽屉。
- 移动端模块导航横向滚动,AI 助手展开为底部抽屉。
- 左侧模块点击必须跳转到 `/app/modules/{moduleId}`。
- URL 中的 `moduleId` 是当前显示模块的唯一真源。
- 业务主区采用“对象树/文件夹 + 列表/业务面板 + 详情/审批/审计”结构。
- 主题由 `ThemeProvider`、`theme-registry.ts` 和 `ThemeSwitcher` 统一管理,持久化到 `localStorage.architoken_theme`。
- 默认主题是 `wechat_light` 白绿业务;`industrial_dark` 与 `cockpit_blue` 是平台级可切换主题,不是模块级硬编码外壳。
- `digital_twin` 与其他模块共用同一 Shell、文件系统、抽屉、审批、生命周期、Adapter 和 AI 助手;`wechat_light` 下数字孪生主体、指标、项目树、监控、门禁和功能坞也必须白绿化,仅中央模型画布可按可视化对比需求保留专业高对比背景。

---

## 2. 14 模块业务链

```text
marketing_service
  -> concept_design
  -> detailed_design
  -> quantity_costing
  -> material_logistics
  -> production_manufacturing
  -> construction_supervision
  -> digital_twin
  -> digital_archive

standard_library supplies rules, families, templates, materials, drawings and models.
settings_center supplies tenant, RBAC, router, SLA, schema and audit policy.
```

---

## 3. 模块清单

| order | id | 业务能力 |
|---:|---|---|
| 1 | `marketing_service` | 客户线索、需求访谈、立项资料 |
| 2 | `concept_design` | 多方案生成、效果表达、可建造性初筛 |
| 3 | `standard_library` | 标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库 |
| 4 | `detailed_design` | IFC/MBD、施工图、节点详图、碰撞审查、属性完整性 |
| 5 | `quantity_costing` | MTO、BOQ、BOM、价格快照、变更影响 |
| 6 | `material_logistics` | 库存、供应商、价格、询比价、采购、下料、包装、装车、物流、到货、堆放、签收、批次追踪 |
| 7 | `production_manufacturing` | 生产计划、工序路线、下料优化、CNC、焊接、涂装、质检、排产、MES/ERP、构件编码、发运、返工 |
| 8 | `construction_supervision` | 施工方案、进度、质量、安全、日志、AR、360、扫描、倾斜摄影、无人机、机器人、IoT、影像对比、整改、竣工 |
| 9 | `digital_twin` | WebGPU 优先、Three.js fallback、IFC/GLB/点云/360/扫描/倾斜摄影、构件树、进度、质量/安全/成本图层 |
| 10 | `digital_archive` | 合同、图纸、模型、检测、签章、长期留存、企业文宣 |
| 11 | `settings_center` | 租户、RBAC、模型路由、SLA、Schema、规则版本、审计 |

---

## 3.1 模块真实交互清单

| id | 模块专属交互 |
|---|---|
| `marketing_service` | 客户线索、咨询对话、需求采集、报价草案、跟进任务、客户画像;支持生成需求摘要、生成报价草案、创建跟进任务 |
| `concept_design` | 场地条件、方案草图、风格选型、指标分析、初步模型;支持生成方案、评估规范、生成展示包 |
| `standard_library` | 标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库;支持检索规范、生成族库、校核构件、发布版本 |
| `detailed_design` | IFC 模型、DWG 图纸、节点深化、结构连接、管线协调、碰撞检查;支持生成深化模型、生成图纸、运行碰撞检查 |
| `quantity_costing` | 工程量、BOQ、清单、成本测算、价格库、变更估算;支持生成 BOQ、生成造价、评估变更影响 |
| `material_logistics` | 材料库存、供应商、价格、询价/比价、采购计划、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收、批次追踪;支持库存状态、采购计划、下料单、物流签收状态切换 |
| `production_manufacturing` | 生产计划、工序路线、下料优化、CNC/数控文件、焊接、喷涂/防腐/防火、质检、工厂排产、MES/ERP、构件编码、包装发运、返工处理;支持工单状态、CNC 文件生成、质检状态、发运批次 |
| `construction_supervision` | 施工方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机、建筑机器人、IoT、影像对比、整改闭环、竣工资料;支持安全问题创建、整改闭环、日志生成、AR/360/扫描记录选择 |
| `digital_twin` | WebGPU、Three.js fallback、IFC/GLB/点云/360/三维扫描/倾斜摄影、构件树、图层管理、进度对比、质量/安全/成本叠加、视角切换、模型状态、IoT 状态;支持构件选择、图层开关、进度播放、overlay 切换、快照导出 |
| `digital_archive` | 项目档案、图纸档案、模型档案、审批记录、施工日志、质量安全记录、竣工资料、版本链;支持生成归档包、校验完整性、导出档案 |
| `settings_center` | 租户设置、模块开关、用户角色、权限策略、模型路由、存储适配器、审计策略;支持更新配置、模拟权限、生成设置快照 |

---

## 4. AI 生成链

所有模块共享同一工程门禁链:

```text
Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
```

含义:

- `Planner`: 拆解任务、选择输入、建立执行路径。
- `Generator`: 生成方案、模型、清单、报告或业务单据。
- `Evaluator`: 独立评估输出质量,不得自评。
- `RuleChecker`: 按规范、企业规则、工程约束做确定性校核。
- `SchemaValidator`: 校验 JSON Schema、IFC Schema 和 Module Schema。
- `Approver`: 执行人工或自动最终门禁。

---

## 5. 交付物操作

| action | UI 按钮 | 当前 mock 状态 |
|---|---|---|
| `generate` | 生成 | artifact -> `generated` |
| `evaluate` | 评估 | artifact -> `evaluated` |
| `rule_check` | 校核 | artifact -> `rule_checked` |
| `schema_validate` | Schema | artifact -> `schema_validated` |
| `approve` | 审批 | artifact -> `approved` |
| `archive` | 归档 | artifact -> `archived` |

这些 action 后续应映射到 WorkflowRouter command、Audit Log 和 AsyncAPI event。

## 5.1 文件/文件夹系统

每个模块都有自己的 mock 文件树,节点包括文件夹和文件。节点字段覆盖 `id`、`name`、`type`、`moduleId`、`parentId`、`size`、`mimeType`、`status`、`version`、`owner`、`updatedAt`、`tags`、`permissions` 和 `auditTrail`。

左键单击:

- 文件夹: 打开并显示子目录。
- 文件: 打开预览抽屉。

双击:

- 文件夹: 进入目录。
- 文件: 进入完整查看模式。

右键菜单完整覆盖:

| 操作 | 当前前端行为 |
|---|---|
| 打开 | 文件夹进入目录,文件打开预览 |
| 新建 | 创建 mock 文件夹或文件 |
| 查看 | 打开预览抽屉 |
| 上传 | 创建 `uploaded` 状态文件 |
| 下载 | 创建下载任务并写入审计 |
| 移动 | 选择目标文件夹并修改 `parentId` |
| 复制 | 写入 clipboard state |
| 粘贴 | 在当前目录创建副本 |
| 分享 | 生成 mock share link |
| 删除 | 标记 `soft_deleted` |
| 属性 | 打开属性面板 |
| 重命名 | 更新名称、版本和审计 |

## 5.2 生命周期、审批与状态机

每个模块至少提供一个默认事务。状态机覆盖:

```text
draft, submitted, generating, evaluating, rule_checking,
schema_validating, pending_approval, approved, archived,
rejected, blocked
```

事件覆盖:

```text
create, submit, generate, evaluate, rule_check, validate_schema,
request_approval, approve, reject, archive, reopen, block, resolve_blocker
```

审批面板显示审批人、状态、意见,并提供通过、驳回、退回修改。状态迁移由 `ModuleBackendAdapter` 统一执行,便于未来替换为真实 OpenAPI client。

---

## 6. 前端文件映射

| 文件 | 作用 |
|---|---|
| `03-frontend/lib/module-registry.ts` | 14 模块 typed registry 与 Module Schema fixture |
| `03-frontend/lib/module-actions.ts` | mock action handlers |
| `03-frontend/lib/business-workflow.ts` | runtime state helper |
| `03-frontend/lib/module-operations.ts` | 14 模块专属功能和业务操作 fixtures |
| `03-frontend/lib/module-file-system.ts` | 14 模块 mock 文件树与文件节点合同 |
| `03-frontend/lib/module-lifecycle.ts` | 生命周期事务、审批和状态机合同 |
| `03-frontend/lib/module-backend-adapter.ts` | `ModuleBackendAdapter` 与 `MockModuleBackendAdapter` |
| `03-frontend/lib/ai-assistant-profile.ts` | `ArchIToken AI` profile、作品、能力标签和模块建议 |
| `03-frontend/components/ModuleWorkbenchShell.tsx` | 平台总壳 |
| `03-frontend/components/ModuleDetailWorkbench.tsx` | 单模块详情 |
| `03-frontend/components/ModuleOperationalPanel.tsx` | 模块专属业务运行面板 |
| `03-frontend/components/ModuleFileExplorer.tsx` | 文件树、文件列表、右键菜单、预览、属性和文件任务 |
| `03-frontend/components/FileContextMenu.tsx` | 12 项右键菜单 |
| `03-frontend/components/FilePreviewDrawer.tsx` | 预览抽屉和完整查看 |
| `03-frontend/components/FilePropertiesPanel.tsx` | 属性、权限、分享链接和审计轨迹 |
| `03-frontend/components/FileOperationDialog.tsx` | 新建、上传、移动、分享、删除、重命名弹窗 |
| `03-frontend/components/LifecycleTransactionPanel.tsx` | 生命周期事务与状态迁移 |
| `03-frontend/components/ApprovalWorkflowPanel.tsx` | 审批流 |
| `03-frontend/components/StateMachinePanel.tsx` | 状态机可视化 |
| `03-frontend/components/ArtifactBoard.tsx` | 交付物操作 |
| `03-frontend/components/AgentGateTimeline.tsx` | AI 门禁链 |
| `03-frontend/components/ModuleRelationshipMap.tsx` | 上下游关系 |
| `03-frontend/components/FloatingAIAssistant.tsx` | 全局 AI 客服 / AI 主页 |
| `03-frontend/app/app/modules/page.tsx` | 总入口 |
| `03-frontend/app/app/modules/[moduleId]/page.tsx` | 动态详情路由 |

---

## 6.1 全局 AI 助手

`ArchIToken AI` 提供:

- 折叠态: AI 头像、在线状态、未读数。
- 展开态: AI 名称、等级认证、AEC 角色、作品展示、能力标签、上下文建议、快捷操作、聊天消息区。
- 主页态: 类 xChat / TikTok profile 风格的认证、等级、作品数量、最近作品、服务能力、关注/收藏/复制链接 mock 按钮。
- 当前模块建议: 根据 active `moduleId` 展示模块相关生成、校核、审批和风险建议。
- 避让策略: 默认折叠贴边,展开后支持左/右停靠,聊天入口使用独立抽屉,面板内部滚动且不超过视口高度。
- 快捷操作: 绑定当前模块,点击后写入当前模块审计事件。

---

## 7. 后续对接点

前端已为以下后端接口预留边界:

- `GET /v1/modules`
- `GET /v1/modules/{module_id}`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:generate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:evaluate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:rule-check`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:schema-validate`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:approve`
- `POST /v1/modules/{module_id}/artifacts/{artifact_id}:archive`
- `GET /v1/modules/{module_id}/files`
- `POST /v1/modules/{module_id}/files`
- `POST /v1/modules/{module_id}/files/{file_id}:move`
- `POST /v1/modules/{module_id}/files/{file_id}:share`
- `POST /v1/modules/{module_id}/transactions/{transaction_id}:transition`
- `POST /v1/modules/{module_id}/transactions/{transaction_id}:approve`
- `POST /v1/modules/{module_id}/transactions/{transaction_id}:reject`

当前不修改 OpenAPI、后端、数据库或 CI。

---

## 8. 2026-04-28 Local File Runtime Map

本轮新增本地文件 runtime,把文件上传、查看、生命周期、审批和审计串成当前前端主线:

| 能力 | 当前实现 | 后续生产映射 |
|---|---|---|
| 上传入口 | `LocalFileUploader` 拖拽/选择文件 | Rust upload API / object multipart |
| API route | `/api/local-files/upload` | `/v1/files:upload` |
| 文件读取 | `/api/local-files/{fileId}` | ObjectStore signed stream |
| 元数据读取 | `/api/local-files/{fileId}/metadata` | TransactionStore + ObjectStore metadata |
| 保存位置 | `03-frontend/.architoken/uploads/` | `ObjectStore` capability |
| 索引文件 | `03-frontend/.architoken/uploads/index.json` | `TransactionStore` / metadata table |
| 模块绑定 | `moduleId` 写入 `LocalFileMetadata` | `module_id` foreign key |
| 生命周期 | `upload -> schema_validating -> pending_approval` | WorkflowRouter command |
| 审计 | `ModuleAuditEvent` 会话级记录 | append-only audit log / AsyncAPI event |

所有模块继续采用统一 Shell、统一设计 token 和同一套文件/生命周期/审批/审计能力。默认 `wechat_light` 白绿业务主题适用于普通模块与数字孪生全主体;数字孪生的指标卡、左侧项目树、右侧监控、门禁摘要、功能模块坞、文件 dock、按钮、标签、边框、文字和背景均由 `--arch-twin-*` token 控制。中央模型画布可保留专业高对比背景,并通过数据源 dock 接收 IFC、GLB、点云、360、三维扫描、倾斜摄影和 WebGPU 快照。
