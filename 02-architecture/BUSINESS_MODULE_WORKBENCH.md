# ArchIToken · 业务模块工作台开发契约

**文档编号**: ARCHITOKEN-BUSINESS-MODULE-WORKBENCH-V4
**所属架构**: 16 modules registry · Module Schema driven UI · file system · lifecycle state machine
**状态**: active operational frontend workbench
**适用范围**: `/app/modules` 与 `/app/modules/[moduleId]`
**产品定位**: AEC AI-Native + Harness Engineering + OpenBIM CDE Workflow OS

---

## 1. 目标

业务模块工作台从“展示卡片”升级为真正可进入、可点击、可操作、可审计的业务平台入口。

工作台必须做到:

1. `/app/modules` 是 16 个系统模块的总入口。
2. 每个模块都有独立详情路由 `/app/modules/[moduleId]`。
3. URL 中的 `moduleId` 必须驱动当前选中模块,不允许 URL 与显示模块不一致。
4. 每个模块详情包含概览、子域能力、输入、输出、交付物、流程状态、AI 门禁链、任务、审批、风险、上下游关系、文件类型和可视化区域。
5. 每个模块必须有专属业务运行面板,而不是只展示文字描述。
6. 文件、事务、审批和审计在前端工作台内必须通过 typed session adapter 执行；按钮点击必须改变状态并写入本地审计面板。
7. 每个模块必须具备会话内可操作文件/文件夹系统、右键菜单、预览抽屉、属性面板、生命周期事务、审批流和状态机。
8. 工作台是 Open CDE + Module Workflow OS 的主界面,不得按模块变成孤立大屏、营销页或单点工具复刻。

---

## 1.1 统一布局与主题契约

`/app/modules` 必须是全宽平台业务系统:

- 页面主体使用 `100vw` 自适应宽度。
- 所有模块共用 `ModuleWorkbenchShell`,不允许按模块硬编码不同整页外壳。
- 左侧业务导航默认是单列模块侧栏,模块入口以彩色图标、中文名和模块 ID 横向成组显示,不再拆成独立 icon rail 与相邻目录列。
- 模块入口不得显示 `01/02/...` 数字序号徽标;`ModuleSpec.order` 只用于 registry 排序,不作为侧栏视觉元素。
- 单列模块侧栏允许通过左上角品牌标识切换为紧凑模式;紧凑模式仍是同一列,只显示 16 个模块彩色图标,点击模块图标只能切换模块并保持紧凑,只有左上角品牌标识才能恢复展开,不得恢复旧的独立 icon rail + 目录列。
- 展开模式下点击当前已选模块不得折叠或展开子目录;模块入口只负责切换模块或保持当前模块。已展开的模块子目录必须跨模块切换保持,例如点击市场客服不得关闭个人中心已经展开的子目录。子目录文字必须与当前模块入口的标题列对齐,不得因为隐藏箭头、缩进或状态切换产生错位。
- 一级工作域目录必须在单列模块侧栏中按 registry 分组显示,不得新增横跨主工作区的顶部工作域栏。
- 模块侧栏只显示工作域分组和模块入口;`ModuleSpec.subdomains` 属于模块主工作区内部导航,不得在全局 Shell 目录列中展开。
- 主工作区不得额外追加全局面包屑或顶部目录条;路径、当前目录和功能上下文由模块自身工作区承载。
- 主工作区不得保留重复的顶部标签栏;模块标题、当前目录、文件统计、目录入口、搜索和视图切换应合并到紧凑工作台工具条。
- 中间业务功能区必须填满剩余空间,承载文件、对象、事务、审批和可视化画布。
- 右侧上下文审计、审批、生命周期和 AI 建议默认是抽屉,按需打开,不得常驻占位。
- 大屏不得被窄 `container` 或过小 `max-width` 限制。
- 窄屏时模块导航变为横向滚动,主功能区优先展示,审计面板自然下沉。
- 全局不再挂载嵌入式原生控制台 iframe;AI 能力入口必须由模块工作台内的受控操作、PanAI Host Bridge、Router、审计和审批链承载。
- 文件/审批/审计右侧面板可折叠,不得遮挡主业务区。
- 主题和字号是平台能力,不是模块硬编码。默认主题是 `huly_light`;内置 `huly_dark`、`huly_system`、`huly_spacious` 和 `huly_compact` 可切换,旧 `wechat_light`、`industrial_dark` 仅作为迁移别名读取。
- 前端设计系统统一切换为 Ant Design 生态体系。新增 UI 必须优先使用 `antd`、`@ant-design/icons`、`@ant-design/pro-components`、`@ant-design/charts`、`@ant-design/x` 或基于 Ant Design token 的封装,不得再新增第二套按钮、表格、表单、抽屉、弹窗、图标、图表或 AI 对话组件体系。
- Ant Design Pro 只能作为企业工作台参考,不得替代 ArchIToken 的 Open CDE 模块壳、16 模块 registry、文件生命周期、审批、审计和 AI 门禁结构。
- Ant Design 5 是当前生产基线;升级 Ant Design 6 必须与 ProComponents、Ant Design X 和 CI 兼容性一起迁移。
- `/app/modules/digital_twin` 必须与其它模块使用同一平台 Shell、同一 CDE 文件工作台、同一右侧业务对象/操作队列、同一抽屉、审批、生命周期和 AI 助手。模块入口不得嵌入孤立数字孪生大屏。
- 独立 `/app/digital-twin` 不再作为产品入口保留;数字孪生统一使用 `/app/modules/digital_twin`,避免 16 模块工作台和专用大屏分裂。

---

## 2. Active Module IDs

| order | id                         | 中文名   | 入口                                    |
| ----: | -------------------------- | -------- | --------------------------------------- |
|     1 | `personal_center`          | 个人中心 | `/app/modules/personal_center`          |
|     2 | `marketing_service`        | 市场客服 | `/app/modules/marketing_service`        |
|     3 | `planning_management`      | 计划管理 | `/app/modules/planning_management`      |
|     4 | `concept_design`           | 方案设计 | `/app/modules/concept_design`           |
|     5 | `standard_library`         | 标准族库 | `/app/modules/standard_library`         |
|     6 | `detailed_design`          | 深化设计 | `/app/modules/detailed_design`          |
|     7 | `quantity_costing`         | 计量造价 | `/app/modules/quantity_costing`         |
|     8 | `material_logistics`       | 材料物流 | `/app/modules/material_logistics`       |
|     9 | `production_manufacturing` | 生产制造 | `/app/modules/production_manufacturing` |
|    10 | `construction_management`  | 施工管理 | `/app/modules/construction_management`  |
|    11 | `digital_twin`             | 数字孪生 | `/app/modules/digital_twin`             |
|    12 | `digital_archive`          | 数字档案 | `/app/modules/digital_archive`          |
|    13 | `finance_management`       | 财务管理 | `/app/modules/finance_management`       |
|    14 | `human_resources`          | 人力资源 | `/app/modules/human_resources`          |
|    15 | `ai_center`                | AI中心   | `/app/modules/ai_center`                |
|    16 | `settings_center`          | 设置中心 | `/app/modules/settings_center`          |

---

## 3. 前端实现映射

| 文件                                                              | 职责                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `03-frontend/lib/module-registry.ts`                              | Module Schema fixture,定义 `ModuleSpec`、`SubdomainSpec`、`ArtifactSpec`、`WorkflowStep`、`AgentGate`、`ModuleAction` 并导出 16 模块 registry |
| `03-frontend/lib/module-actions.ts`                               | session action handlers: `generateArtifact`、`evaluateArtifact`、`runRuleCheck`、`validateSchema`、`approveArtifact`、`archiveArtifact`       |
| `03-frontend/lib/business-workflow.ts`                            | 前端 runtime state 与 action 应用辅助函数                                                                                                     |
| `03-frontend/lib/module-operations.ts`                            | 16 模块专属业务功能卡片、模块操作按钮和状态轨道                                                                                               |
| `03-frontend/lib/module-file-system.ts`                           | 16 模块 typed session file tree、文件节点、权限、审计轨迹、下载任务和分享链接                                                                 |
| `03-frontend/lib/module-lifecycle.ts`                             | `ModuleTransaction`、审批结构、状态机事件和状态迁移规则                                                                                       |
| `03-frontend/lib/module-backend-adapter.ts`                       | `ModuleBackendAdapter` 合同与 `SessionModuleBackendAdapter`,所有文件/事务操作先经 adapter                                                     |
| `03-frontend/lib/design-system-registry.ts`                       | Ant Design 生态运行包、参考包、许可证和后续开发规则                                                                                           |
| `03-frontend/lib/theme-registry.ts`                               | `huly_light`、`huly_dark`、`huly_system` 主题注册、旧主题迁移与 `architoken_theme` 存储键                                                     |
| `03-frontend/lib/font-registry.ts`                                | `huly_spacious`、`huly_compact` 字号注册与 `architoken_font` 存储键                                                                           |
| `03-frontend/lib/ant-design-theme.ts`                             | ArchIToken 主题到 Ant Design token / `ConfigProvider` 的映射                                                                                  |
| `03-frontend/lib/ai-assistant-profile.ts`                         | 全局浮动 AI 助手 profile、作品、能力标签和模块上下文建议                                                                                      |
| `03-frontend/components/ThemeProvider.tsx`                        | 全局 `data-theme`、CSS variables、Ant Design `ConfigProvider` 与中文 locale provider                                                          |
| `03-frontend/components/ThemeSwitcher.tsx`                        | 顶部工具栏主题切换器                                                                                                                          |
| `03-frontend/components/ModuleWorkbenchShell.tsx`                 | 总平台壳: 左侧模块导航、顶部搜索、主详情、右侧审计面板                                                                                        |
| `03-frontend/components/ModuleDetailWorkbench.tsx`                | 单模块详情页主体                                                                                                                              |
| `03-frontend/components/DetailedDesignSteelPlatformWorkbench.tsx` | 深化设计业务首页: 装配式钢结构 2D→3D 工作台、需求参数、2D 平面编辑、Three.js 3D 视口、BOM、worker 派生证据与 CDE 归档                         |
| `03-frontend/components/ModuleOperationalPanel.tsx`               | 模块专属功能面板:功能卡片、状态切换、专属业务交互                                                                                             |
| `03-frontend/components/ModuleFileExplorer.tsx`                   | 模块文件/文件夹业务系统: 对象树、列表、右键菜单、预览、属性、下载/分享任务                                                                    |
| `03-frontend/components/FileContextMenu.tsx`                      | 文件/文件夹右键菜单                                                                                                                           |
| `03-frontend/components/FilePreviewDrawer.tsx`                    | 文件/文件夹预览抽屉和完整查看模式                                                                                                             |
| `03-frontend/components/FilePropertiesPanel.tsx`                  | 文件属性、权限、标签、分享链接和审计轨迹                                                                                                      |
| `03-frontend/components/FileOperationDialog.tsx`                  | 新建、上传、移动、分享、删除、重命名等操作弹窗                                                                                                |
| `03-frontend/components/LifecycleTransactionPanel.tsx`            | 生命周期事务列表、创建事务和状态迁移按钮                                                                                                      |
| `03-frontend/components/ApprovalWorkflowPanel.tsx`                | 审批人、审批状态、意见、通过/驳回/退回修改                                                                                                    |
| `03-frontend/components/StateMachinePanel.tsx`                    | 状态机当前状态与后续可触发事件                                                                                                                |
| `03-frontend/components/AgentGateTimeline.tsx`                    | Planner → Generator → Evaluator → RuleChecker → SchemaValidator → Approver                                                                    |
| `03-frontend/components/ArtifactBoard.tsx`                        | 交付物列表和可点击操作按钮                                                                                                                    |
| `03-frontend/components/ModuleRelationshipMap.tsx`                | 上下游模块关系                                                                                                                                |
| `03-frontend/components/FloatingAIAssistant.tsx`                  | 右下角全局 AI 客服 / AI 助手                                                                                                                  |
| `03-frontend/app/app/modules/page.tsx`                            | 平台总入口                                                                                                                                    |
| `03-frontend/app/app/modules/[moduleId]/page.tsx`                 | 动态模块详情路由                                                                                                                              |
| `03-frontend/components/BusinessModuleWorkbench.tsx`              | 保留兼容入口,转接到新 workbench                                                                                                               |

---

## 4. 必备字段

每个 `ModuleSpec` 必须包含:

- `id`
- `order`
- `zhName`
- `enName`
- `track`
- `status`
- `summary`
- `objective`
- `subdomains`
- `inputs`
- `outputs`
- `artifacts`
- `workflowStates`
- `agentGates`
- `tasks`
- `approvals`
- `risks`
- `fileTypes`
- `visualization`
- `standards`
- `dataObjects`
- `routeHref`
- `schemaRef`

---

## 5. 操作按钮语义

| 按钮   | session handler    | 状态变化                      |
| ------ | ------------------ | ----------------------------- |
| 生成   | `generateArtifact` | `draft` → `generated`         |
| 评估   | `evaluateArtifact` | artifact → `evaluated`        |
| 校核   | `runRuleCheck`     | artifact → `rule_checked`     |
| Schema | `validateSchema`   | artifact → `schema_validated` |
| 审批   | `approveArtifact`  | artifact → `approved`         |
| 归档   | `archiveArtifact`  | artifact → `archived`         |

每次 action 必须返回:

- 更新后的 artifact
- action message
- audit event

当前 audit event 写入右侧本地审计面板。后续接入后端时,该事件应映射到 Audit Log / Workflow Event / AsyncAPI event。

---

## 5.1 模块专属交互语义

除交付物生命周期按钮外,每个模块还必须通过 `module-operations.ts` 提供至少 3 个业务操作。当前前端已覆盖:

- `marketing_service`: 生成需求摘要、生成报价草案、创建跟进任务。
- `planning_management`: 在线编制进度计划、拆解 WBS/任务、登记进度反馈、分析图表、生成预警、调整计划窗口和更新任务状态。
- `concept_design`: 生成方案、评估规范、生成展示包。
- `standard_library`: 检索规范、生成族库、校核构件、发布版本。
- `detailed_design`: 按钢平台 2D→3D 深化语义执行 AI 参数生成、2D 平面编辑、钢柱网/梁/构造柱/内墙/门窗/屋面派生、BOM 计算、worker STEP/GLTF 派生证据和待专业复核 CDE 深化包。
- `quantity_costing`: 生成 BOQ、生成造价、评估变更影响。
- `material_logistics`: 生成采购计划、生成下料单、安排物流、签收批次。
- `production_manufacturing`: 由 Paperclip v2026.517.0 接管主工作区,生成工单、生成 CNC 文件、运行质检、安排发运并同步模块内编排面板。
- `construction_management`: 生成施工日志、创建整改单、运行安全检查、归档竣工资料。
- `digital_twin`: 切换图层、选择构件、播放进度、生成孪生快照、导出模型包。
- `digital_archive`: 生成归档包、校验完整性、导出档案。
- `settings_center`: 新建人员账号、重置账号密码、维护单位岗位、调整角色权限、生成审计记录。

所有操作当前均为 typed session state,必须改变 UI 状态并写入本地审计事件。

## 5.2 文件/文件夹操作语义

每个模块必须拥有独立 session 文件树。文件和文件夹节点必须包含:

- `id`
- `name`
- `type`
- `moduleId`
- `parentId`
- `size`
- `mimeType`
- `status`
- `version`
- `owner`
- `updatedAt`
- `tags`
- `permissions`
- `auditTrail`

左键单击语义:

- `folder`: 选中文件夹,右键、Enter 或“打开”命令进入目录。
- `file`: 选中文件,右键、Enter 或“查看”命令打开预览/完整查看。

双击语义:

- `folder`: 双击名称文字进入内联重命名；双击行内空白区域进入目录。
- `file`: 双击名称文字进入内联重命名；双击行内空白区域打开完整查看。

键盘语义:

- `Enter`: 打开当前选中的文件夹或文件。
- `F2`: 重命名当前选中对象。
- `Delete`: 删除当前选中对象。
- `Ctrl+N` / `Ctrl+Shift+N`: 在当前目录新建文件或文件夹。
- `Ctrl+U`: 从本地上传文件到当前目录。
- `Ctrl+C` / `Ctrl+V`: 复制并粘贴当前选中对象。
- `F5`: 刷新当前目录。

右键菜单必须覆盖 12 个操作:

| action | 前端状态变化                         |
| ------ | ------------------------------------ |
| 打开   | 文件夹进入目录;文件打开预览          |
| 新建   | 在当前目录新增文件夹或文件节点       |
| 查看   | 打开预览抽屉或完整查看模式           |
| 上传   | 新增上传文件,状态为 `uploaded`       |
| 下载   | 写入 audit event 并生成下载任务状态  |
| 移动   | 选择目标文件夹后更新 `parentId`      |
| 复制   | 写入 clipboard state                 |
| 粘贴   | 在当前目录创建副本                   |
| 分享   | 生成分享链接并打开分享结果           |
| 删除   | 标记为 `soft_deleted`,不直接物理删除 |
| 属性   | 打开属性面板                         |
| 重命名 | 更新 `name`、版本和审计轨迹          |

所有文件操作必须通过 `ModuleBackendAdapter`,不得绕过 adapter 直接散落 `setState`。

目录布局规则:

- 平台一级目录由 `MODULE_TREE_GROUPS` 生成并渲染在单列模块侧栏,模块入口由 `moduleSpecs` 生成；新增模块时只更新 registry,Shell 自动反映。模块内部子域、文件证据和审批审计入口不得硬编码进全局 Shell 目录列。
- 模块工作台不得保留“第二列目录树 + 第三列列表”的长期占位布局。
- 左侧模块侧栏点击模块后,主业务区必须最大化承载业务主页、文件列表、对象列表和交易流程。
- 业务目录以弹出式 `DirectoryPicker` / 浮动窗口进入,支持树状浏览、搜索、新建同级目录和新建子目录。
- 弹出式目录、文件操作、条目预览和完整查看窗口默认以视口 75% 宽高自适应并居中显示;右侧审计/审批抽屉和贴边 AI 助手仍按工作台停靠语义处理。
- 目录选择完成后直接驱动主列表和面包屑;目录名称不得使用环绕底纹或卡片化装饰挤压空间。
- 业务主页中的文件区不得再单独保留“数据库文件 / 选择目录”标题行;文件统计和目录选择入口统一放入顶部工具条。
- 文件列表列宽、行高、视图密度必须可调并持久化;全局搜索必须覆盖当前模块文件、模型、审批证据和业务对象摘要。

## 5.3 文件查看器停靠工具栏与格式命令语义

完整查看模式必须把文件内容作为主画布,工具栏只能是可拖拽、可停靠、可折叠的透明小型 rail:

- 默认左侧停靠,支持拖拽到顶部、底部、左侧、右侧并自动靠边吸附。
- 停靠态默认使用单列或单行图标按钮,不得用宽文本条、顶部重复信息栏或固定空白边距挤压内容。
- 指标、属性、筛选和二级命令必须放入 hover/focus 浮层或可折叠面板,不能永久占用主查看区。
- PDF、Office、图片、音视频、文本、代码、CAD、BIM、压缩包等格式必须共用停靠行为,但命令集合按格式拆分。
- 未接入后端 worker、协作 runtime、授权 CAD/BIM adapter 或交易 adapter 的命令必须显示为受控/不可用状态,不得伪装为已完成编辑或转换。

CAD/BIM 工程编辑模式是查看器内的受控编辑例外: `OpenEngineeringEditor` 可以参考 FreeCAD / Blender 的专业软件布局,在同一 CDE 查看窗口内提供顶部菜单/工具条、左侧源文件目录树/构件树、右侧属性栏和底部状态栏。该布局只服务 DWG/DXF、IFC、OpenUSD/USDZ、3D Tiles、STEP/STP/IGES/IGS/BREP、STL/PLY/3DM/SKP/BLEND 等工程格式,不得变成模块外的独立产品入口。目录树必须来自源文件、格式 runtime、worker manifest 或可审计派生场景,属性编辑只产生受控草案;写回源文件或生成新版本必须经过 `OpenEngineeringEditor -> PanAI -> ToolRouter -> FormatAdapter/Worker/Sidecar/LicensedAdapter -> AuditTrail -> Approver`。FreeCAD / Blender 必须优先作为 ArchIToken 内嵌工程原生工作台运行: `/api/local-files/{fileId}/native-open` 创建校验和绑定的工作副本,`engineering-native-workbench` sidecar 通过 noVNC/Web UI 嵌入项目窗口,保存回 CDE 必须通过 `/native-open/commit` 导入为新版本;不得让浏览器传任意命令、直接覆盖源文件、弹出不可审计的本机桌面窗口或绕过审计审批。

格式命令集合:

| 格式族                                                         | 默认命令                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Office/PDF                                                     | 打开、下载、编辑、保存版本、导入、导出、分享、属性、字号、加粗、序号、复制、剪切、粘贴、对齐、排序、格式、协作           |
| Text/JSON/YAML/XML/HTML/MD/代码                                | 打开、下载、搜索、编辑、保存版本、复制、行号、语法/结构化预览                                                            |
| Archive/ZIP/IFCZIP/BCFZIP                                      | 打开条目、搜索、筛选、下载源包、下载条目、哈希校验、风险路径/加密状态                                                    |
| CAD/DWG/DXF                                                    | 选择、位置、坐标、图层、实体/构件、编辑、云线批注、查找、属性、视点、移动、缩放、场景、漫游、测量、导出                  |
| BIM/IFC/OpenUSD/USDZ/3D Tiles/glTF fallback/STEP/IGES/STL/点云 | 选择构件、构件树、属性、坐标、图层、视点、显隐/隔离、移动/变换、测量、剖切、漫游、场景、BOM 导出、轻量化 derivative 状态 |

这些命令最终必须映射到 `ViewerAdapter` / `ModuleBackendAdapter` / 后端 worker manifest。前端可以先提供真实查看和命令入口,但生产编辑必须写入版本、审计、权限和审批状态。

Native/source viewer rule:

- DXF/DWG 必须优先通过 MLightCAD `@mlightcad/cad-simple-viewer` 打开源文件字节,保持图层、实体、布局和命令语义。DWG 的 `@mlightcad/libredwg-web` GPL-3.0 WASM 依赖必须保留许可/隔离边界记录。ODA/LibreDWG/dwg2dxf/DWG-to-DXF adapter 只作为显式诊断、导出、校验或转换 sidecar,不能重新成为默认查看路径。IFC 优先 openBIM worker 轻量化,STEP/STP/IGES/IGS/STL 优先 OCCT/OCP/FreeCAD/mesh worker。
- PDF、图片、SVG、OpenUSD/USDZ、3D Tiles、GLB 兜底或 vector PDF 只能作为显式导出、缓存、降级或授权适配器结果,不能冒充源格式语义。
- 缺失 ODA、LibreDWG、IfcOpenShell、OCCT、FreeCAD 或类似依赖时,优先从官方 GitHub 源码编译为 sidecar;apt/snap 不可用不是停止条件。
- viewer manifest 必须暴露 source id、checksum、adapter、engine、derivative artifact、cache hit、ETag 和权限边界,使前端能区分“源格式查看”“实体派生查看”“只读降级查看”。

IFC lightweight rule:

- 首次上传 IFC 后,worker 必须生成或排队生成 OpenUSD/USDZ、3D Tiles、GLB 兜底、fragments、properties index 和 derivative manifest。
- 前端只加载轻量几何和分页属性;不得每次打开都在浏览器完整解析原始 IFC。
- API 必须支持 stream、Range、ETag/cache 和 checksum 匹配,避免重复整文件读入内存。

### 5.3.1 市场客服到方案设计数据闭环

`marketing_service` 客户资料录入必须成为结构化业务对象,并进入数据库/CDE,不能只停留在页面表单:

- 字段至少覆盖姓名、手机、地理位置级联(国家/省份/地市/区县/镇街)、建筑层数(1-5)、建筑结构、建筑面积、耐火等级、设防烈度、建筑风格、资金预算金额与币种和其它备注。
- 提交设计需求后写入 `ModuleBackendAdapter` / CDE 文件节点 / 后端数据库交易记录,并生成可审计 `lead_requirement` 对象。
- 市场客服面向用户的需求包、建筑方案比选、客户确认方案、电子合同草案和意向定金文件必须是可在线编辑的 Office/PDF 业务文档,不得把 JSON 作为主要业务文件展示;机器可读 JSON 只能作为隐藏载荷、元数据或内部接口数据。
- 业务文档必须支持模板选择和自定义模板输入;用户上传或指定的模板应进入 CDE 文件、审计链和后续文档生成上下文。
- 提交资料后必须先生成建筑方案草案,支持重新生成不同方案、切换选择方案和客户确认方案;客户确认所选方案后才进入意向定金界面。
- 客户确认方案必须生成可审计 CDE 记录,并自动生成电子合同草案;意向定金支付意向必须引用已确认方案、确认记录和合同草案,不得只依赖前端状态。
- 支付方式可包括京东、微信、抖音、支付宝、银联、信用卡、PayPal 和企业转账,但必须通过支付/财务合规 adapter,不得伪造支付成功。
- 电子合同和电子签章是默认线上流程;线下合同盖章只能作为电子流程完成后的补充归档。
- `concept_design` 必须可导入 `marketing_service` 的结构化需求,通过 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver 生成方案任务、初步模型/IFC/GLB 和审计证据。

## 5.4 生命周期事务与审批状态机

每个模块至少有 1 个默认 `ModuleTransaction`。事务字段包括:

- `id`
- `moduleId`
- `type`
- `status`
- `currentState`
- `actor`
- `createdAt`
- `updatedAt`
- `relatedFileIds`
- `relatedArtifactIds`
- `approvals`
- `auditTrail`

状态机状态:

```text
draft -> submitted -> generating -> evaluating -> rule_checking
  -> schema_validating -> pending_approval -> approved -> archived
```

异常状态:

```text
rejected, blocked
```

事件集合:

```text
create, submit, generate, evaluate, rule_check, validate_schema,
request_approval, approve, reject, archive, reopen, block, resolve_blocker
```

审批面板必须显示当前审批人、审批状态、审批意见,并提供通过、驳回、退回修改操作。所有操作写入事务审计轨迹和模块审计面板。

---

## 6. 模块扩展重点

### 6.1 `standard_library`

必须覆盖标准规范、族库构件、样板文件、材质库、图纸、模型、做法库、规则库、版本库。

### 6.2 `material_logistics`

必须覆盖材料库存、供应商、价格、询价/比价、采购计划、下料单、加工 BOM、包装、装车、物流、到货、现场堆放、签收、批次追踪。

### 6.3 `production_manufacturing`

必须覆盖生产计划、工序路线、下料优化、CNC/数控文件、焊接、喷涂/防腐/防火、质检、工厂排产、MES/ERP 对接、构件编码、包装发运、返工处理。

当前阶段允许 Paperclip v2026.517.0 完整接管 `production_manufacturing` 模块主工作区,作为 Agent 组织、issue、heartbeat、预算、运行日志和治理审批的外部进程 / 服务适配器。Paperclip 负责生产制造操作界面、任务编排和运行证据记录,但不得替代 CDE 文件系统、CNC 源文件、质检记录、MES/ERP 数据、AI 门禁链或生产负责人 / 专业责任人的审批结论。

### 6.4 `construction_management`

必须覆盖施工方案、进度、质量、安全、日志、AR、360 全景、三维扫描、倾斜摄影、无人机、建筑机器人、IoT、影像对比、整改闭环、竣工资料。

### 6.5 `digital_twin`

必须覆盖 WebGPU 优先渲染状态、NVIDIA 认证 / 支持 GPU 渲染栈证据、Three.js/WebGL 受审计 fallback 状态、IFC/GLB/点云/360/三维扫描/倾斜摄影真实源数据或明确空状态、构件树、进度对比、质量/安全/成本叠加图层。

数字孪生专属面板必须支持:

- 构件树点击选择。
- 图层开关。
- 进度播放/暂停。
- 质量/安全/成本 overlay 切换。
- 视角切换。
- 模型状态和 IoT 状态查看。
- 导出孪生快照。

---

## 6.6 PanAI 接管边界

模块工作台不得再嵌入外部原生控制台 UI:

- 不得显示伪装成 `PanAI` 的旧嵌入入口按钮。
- 不得通过同源 iframe 代理加载外部控制台页面。
- 不得为了绕开 `X-Frame-Options` 或 `frame-ancestors` 而代理第三方/旧控制台页面。
- 模块内 AI 操作只能通过受控业务动作、Router、审计事件和审批链触发，不得回退到 Harness、本地草案或前端模拟回复。
- PanAI 默认模型必须优先使用本地/私有 Hugging Face capability registry;`Ollama`、LM Studio 等仅作为显式备用适配器。不得把云端 5.4、OpenAI 或其他外部 provider 写成业务系统默认模型。
- PanAI 只能作为接管层和 Agent Runtime,所有工具调用仍必须经过 `WorkflowRouter -> ToolRouter -> ModelRouter/InferenceRouter -> CDE/AuditTrail -> Approver`。
- 配图请求只生成图像任务和提示词,并通过 `GenerationRouter` 使用 Hugging Face provider hint 或本地缓存适配器；业务聊天 UI 不持有或传递 `HF_TOKEN`。
- 没有专业来源、规范、审批或运行证据时,AI 输出只能标记为启发草案,不得标记为合规、送审、施工、验收或发布完成。

---

## 7. 后端对接边界

当前工作台的文件、事务、审批和审计 UI 使用会话态 adapter；生产路径必须替换为 OpenAPI HTTP adapter。对接边界:

- `ModuleBackendAdapter` 是前端与未来后端的替换边界。
- `SessionModuleBackendAdapter` 当前实现文件系统、事务、审批、审计的会话级状态。
- `ModuleSpec.schemaRef` 对应未来 Module Schema。
- `routeHref` 与 `/v1/modules/{module_id}` 可一一映射。
- `ModuleAction` 可映射到 WorkflowRouter command。
- `ArtifactSpec.status` 可映射到 artifact lifecycle enum 或状态表。
- audit event 可映射到 AsyncAPI 事件。

---

## 8. 验收

本工作台前端验收至少包括:

1. 16 个 active module id 完整且顺序正确。
2. 所有模块详情路由可访问。
3. URL `moduleId` 与显示模块一致。
4. 每个模块有子域、交付物、流程状态、AI 门禁、任务、审批、风险、文件类型、可视化配置和专属业务运行面板。
5. 功能卡片、模块操作、artifact 详情、交付物按钮和 AI 助手点击后会改变 UI 状态或写入审计。
6. 左键打开文件/文件夹,右键 12 个文件操作具备真实前端状态变化。
7. 生命周期事务、审批、状态机通过 `ModuleBackendAdapter` 运行。
8. 所有模块共享统一设计系统和全局主题;`/app/modules/digital_twin` 必须与其它模块保持同一 CDE 文件工作台结构。不得新增独立 `/app/digital-twin` 大屏入口来替代模块工作台。
9. 新增或改动 UI 必须遵守 `docs/FRONTEND_ANT_DESIGN_STANDARD.md`,优先使用 Ant Design 生态组件和 token,且不得绕过 `ConfigProvider` 自建平行视觉体系。
10. `npm run lint` / `npm run typecheck` / `npm test -- --run` / `npm run build` 或对应 `bun run` 命令通过。

---

## 9. 2026-04-28 文件驱动工作台落地更新

本轮工作台从“展示型模块页”调整为“文件驱动 + 生命周期驱动 + 本地上传可预览”的业务系统:

- 平台采用统一设计系统: 默认 `huly_light`,并通过 `ThemeSwitcher` 切换 `huly_dark`、`huly_system`、`huly_spacious` 和 `huly_compact`;模块/流程色使用多色 token,不再只靠蓝系表达状态。
- 普通模块与数字孪生模块共用紧凑 rail、CDE 文件系统、右侧业务对象/操作队列、抽屉、审批、生命周期、状态机、Adapter 和 AI 助手。
- `/app/modules/digital_twin` 不再嵌入独立大屏组件;它和其它模块一样显示 `ModuleFileExplorer`。独立 `/app/digital-twin` 路由已退役,数字孪生入口统一为 `/app/modules/digital_twin`。
- 本地上传通过 Next.js API route 落到 `03-frontend/.architoken/uploads/`,元数据记录在 `03-frontend/.architoken/uploads/index.json`。
- 上传文件自动写入 `ModuleBackendAdapter.uploadLocalFile`,生成模块文件节点、导入事务、Schema 校验状态、待审批状态和审计事件。
- 当前 runtime 是前端本地开发 runtime,不是最终生产存储。后续应迁移到 Rust API + `ObjectStore` + `StorageRouter` 能力层,并保持同一 adapter contract。
- `UniversalFileViewer` 支持图片、视频、音频、PDF、文本、JSON、CSV、Office 信息卡、BIM/CAD/点云/3DGS 工程文件卡、压缩包和通用文件对象。
