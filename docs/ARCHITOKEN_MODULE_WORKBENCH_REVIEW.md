# ArchIToken · 模块工作台审阅记录

**状态**: implemented frontend review · full-width interactive pass · file/lifecycle operations  
**范围**: `/app/modules`, `/app/modules/[moduleId]`, frontend fixtures, mock backend adapter and mock handlers  

---

## 1. 审阅结论

本轮把 ArchIToken 前端模块入口从展示型页面升级为可操作工作台:

- 11 个模块全部进入 active registry。
- 每个模块有独立详情路由。
- URL `moduleId` 与显示模块已统一,左侧模块点击跳转到 `/app/modules/{moduleId}`。
- `/app/modules` 使用默认模块和平台总览,`/app/modules/[moduleId]` 使用 URL 驱动选中模块。
- `production_manufacturing` 是 active 模块 ID。
- `manufacturing` 与 `fabrication` 只作为 legacy alias 归一化入口。
- 每个模块包含概览、子域能力、输入、输出、交付物、流程状态、AI 门禁、任务、审批、风险、上下游关系、文件类型和可视化区域。
- 交付物按钮通过 mock action handlers 改变 UI 状态。
- 每个模块新增专属业务运行面板,功能卡片和业务操作都会改变 UI 状态或写入审计。
- 每个模块新增文件/文件夹工作区,左键可打开,右键 12 项操作具备真实前端状态变化。
- 新增生命周期事务、审批流和状态机,状态迁移由 typed mock backend adapter 统一执行。
- 全局浮动 `ArchIToken AI` 支持折叠、展开、停靠、聊天抽屉、AI 主页、作品展示、能力标签、模块建议和快捷操作。
- 平台已统一为全局设计系统: 默认 `wechat_light` 白绿业务主题,并可切换 `industrial_dark`、`cockpit_blue`;数字孪生不再固定深色壳,主体面板和业务交互区跟随全局主题,仅中央模型画布保留专业高对比能力。

---

## 2. 关键修正

| 问题 | 处理 |
|---|---|
| `/app/modules` 只像展示页 | 改为全宽 `ModuleWorkbenchShell`,包含导航、搜索、详情、审计面板和 AI 助手 |
| 模块只能看卡片 | 新增 `/app/modules/[moduleId]` 动态详情路由 |
| `/app/modules/marketing_service` 可能显示其他模块 | 移除内部 selected state 作为真源,改为 URL `moduleId` 驱动当前模块 |
| 大屏左右空白过大 | 移除窄 `max-width` 容器,桌面端使用三栏 `100vw` 平台布局 |
| 旧 `manufacturing` active ID | 改为 `production_manufacturing`,保留 alias |
| 操作按钮无响应风险 | 新增 `module-actions.ts`,所有按钮有状态变化 |
| 模块功能只是文字描述 | 新增 `module-operations.ts` 与 `ModuleOperationalPanel`,每个模块有专属功能卡和可点击操作 |
| 文件管理只是展示 | 新增 `module-file-system.ts`、`ModuleFileExplorer`、右键菜单、预览抽屉、属性面板和操作弹窗 |
| 缺少生命周期事务 | 新增 `module-lifecycle.ts`、`LifecycleTransactionPanel`、`ApprovalWorkflowPanel`、`StateMachinePanel` |
| UI 操作散落在组件内 | 新增 `ModuleBackendAdapter` 与 `MockModuleBackendAdapter`,文件/事务/审批统一通过 adapter |
| 缺少全局 AI 客服 | 新增 `FloatingAIAssistant` 与 `ai-assistant-profile.ts`,并支持贴边停靠和聊天抽屉 |
| UI 风格割裂风险 | 新增 `theme-registry.ts`、`ThemeProvider`、`ThemeSwitcher`,统一 Shell、导航、文件系统、抽屉、审批、生命周期和 AI 助手的主题 token |
| AI 门禁链不完整 | 新增 `AgentGateTimeline` 展示六段门禁 |
| 标准族库、材料物流、生产制造、施工监理、数字孪生深度不足 | 在 `module-registry.ts` 中扩展子域、文件类型、数据对象和可视化层 |

## 2.2 文件/文件夹系统审阅

| 能力 | 状态 |
|---|---|
| 每个模块独立 mock 文件树 | 已实现 |
| 文件夹左键打开子目录 | 已实现 |
| 文件左键打开预览抽屉 | 已实现 |
| 文件夹双击进入目录 | 已实现 |
| 文件双击完整查看 | 已实现 |
| 右键打开 | 已实现 |
| 右键新建 | 已实现 |
| 右键查看 | 已实现 |
| 右键上传 | 已实现 |
| 右键下载 | 已实现,生成下载任务 |
| 右键移动 | 已实现,可选择目标文件夹 |
| 右键复制 | 已实现,写入 clipboard state |
| 右键粘贴 | 已实现,创建副本 |
| 右键分享 | 已实现,生成 mock share link |
| 右键删除 | 已实现,标记 `soft_deleted` |
| 右键属性 | 已实现 |
| 右键重命名 | 已实现 |
| 文件审计事件 | 已实现 |

## 2.3 生命周期与审批审阅

| 能力 | 状态 |
|---|---|
| `ModuleTransaction` 合同 | 已实现 |
| 默认事务 | 每个模块至少 1 个 |
| 状态机 | 覆盖 draft/submitted/generating/evaluating/rule_checking/schema_validating/pending_approval/approved/archived/rejected/blocked |
| 事件 | 覆盖 create/submit/generate/evaluate/rule_check/validate_schema/request_approval/approve/reject/archive/reopen/block/resolve_blocker |
| 审批面板 | 已实现审批人、状态、意见、通过、驳回、退回 |
| typed backend adapter | 已实现 `ModuleBackendAdapter` 与 `MockModuleBackendAdapter` |
| 审计事件 | 文件、事务、审批操作均写入 |

---

## 2.1 专属模块交互审阅

| 模块 | 已实现交互 |
|---|---|
| 市场客服 | 客户线索、咨询对话、需求采集、报价草案、跟进任务、客户画像;生成需求摘要、报价草案和跟进任务 |
| 方案设计 | 场地条件、方案草图、风格选型、指标分析、初步模型;生成方案、规范评估和展示包 |
| 标准族库 | 标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库;检索规范、生成族库、校核构件、发布版本 |
| 深化设计 | IFC 模型、DWG 图纸、节点深化、结构连接、管线协调、碰撞检查;生成深化模型、图纸和 BCF |
| 计量造价 | 工程量、BOQ、清单、成本测算、价格库、变更估算;生成 BOQ、造价和变更影响 |
| 材料物流 | 库存状态、采购计划、下料单和物流签收状态可点击切换 |
| 生产制造 | 工单状态、CNC 文件生成、质检状态和发运批次可点击切换 |
| 施工监理 | 安全问题创建、整改闭环、日志生成、AR/360/扫描记录选择 |
| 数字孪生 | 构件树选择、图层开关、进度播放/暂停、质量/安全/成本 overlay、视角切换、快照导出 |
| 数字档案 | 归档包生成、完整性校验、档案导出 |
| 设置中心 | 配置更新、权限模拟、设置快照生成 |

---

## 3. 未接后端边界

当前实现是前端 typed fixtures + mock action handlers。

未做:

- 未修改 `.github/workflows/**`
- 未修改 `04-backend/**`
- 未修改 `05-infra/**`
- 未修改数据库 migration
- 未修改 Docker/K8s
- 未修改 Python Agent
- 未修改 Rust backend
- 未继续追 License / Python / Security CI

后续接入真实后端时,应把 mock action 映射到:

- `ModuleBackendAdapter` 的真实 OpenAPI client 实现
- WorkflowRouter command
- Module Schema validation
- Artifact lifecycle table
- Audit Log
- AsyncAPI event

---

## 4. 验收点

| 验收项 | 状态 |
|---|---|
| 11 个模块均可点击进入 | 已实现 |
| 每个模块有详情页 | 已实现 |
| URL 与显示模块一致 | 已实现 |
| 全宽三栏平台布局 | 已实现 |
| 生产制造 active ID 为 `production_manufacturing` | 已实现 |
| legacy alias 兼容 `manufacturing` / `fabrication` | 已实现 |
| 按钮具备 mock 状态变化 | 已实现 |
| 文件/文件夹 12 个右键操作 | 已实现 |
| 左键打开/查看文件或文件夹 | 已实现 |
| 生命周期事务/审批/状态机 | 已实现 |
| UI 操作经 typed adapter | 已实现 |
| 功能卡片和 artifact 可点击查看详情 | 已实现 |
| 数字孪生保持驾驶舱风格 | 已实现 |
| 全局浮动 AI 客服 / AI 主页 | 已实现,默认折叠并支持停靠/聊天抽屉 |
| AI 门禁链完整 | 已实现 |
| standard_library 全量子域 | 已实现 |
| material_logistics 全量子域 | 已实现 |
| production_manufacturing 全量子域 | 已实现 |
| construction_supervision 全量子域 | 已实现 |
| digital_twin WebGPU / fallback / 多源数据 / 图层 | 已实现 |

---

## 5. 后续建议

1. 增加 `/v1/modules` OpenAPI 合同,但本轮不修改后端。
2. 将 `module-registry.ts` 替换为后端 Module Schema 生成类型。
3. 将 `module-actions.ts` 的 mock handlers 替换为 WorkflowRouter client。
4. 为数字孪生接入真实 WebGPU capability detection 和 3DGS loader。
5. 将审计面板接入后端 append-only audit log。

---

## 6. 2026-04-28 复审结论

本轮复审后已把模块页从展示界面推进为文件驱动业务工作台:

| 验收项 | 复审状态 |
|---|---|
| 左侧侧栏过宽 | 已收敛为 72px 默认 rail,可展开到 220px |
| 右侧 selected module / audit 常驻占位 | 已改为审计抽屉,默认不占主工作区 |
| 数字孪生上方通用信息区突兀 | 已移除,数字孪生在统一 Shell 主工作区内嵌入 `DigitalTwinWorkbench` 画布 |
| 本地文件上传 | 已通过 Next.js API route 落地到 `.architoken/uploads` |
| 系统内查看 | 已由 `UniversalFileViewer` 按类型渲染 |
| 上传驱动生命周期 | 已通过 `uploadLocalFile` 生成文件节点、事务、Schema 校验、待审批和审计 |
| 普通模块视觉 | 已转为统一主题化文件管理工作台,默认白绿业务主题 |
| 数字孪生视觉 | 使用统一 Shell 和 `--arch-twin-*` token;白绿主题下主体面板白绿化,工业深色/蓝色驾驶舱通过全局主题切换进入,数据源以主题化 dock 接入 |

当前仍是前端 local runtime + mock adapter。生产化时应把 `LocalFileRuntime` 替换为 Rust API、`ObjectStore`、`TransactionStore` 和 `StorageRouter`,但 UI 与 adapter contract 不应再回退到纯展示卡片。
