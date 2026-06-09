# 01-progress · UI-COMPONENTS

前端组件规划 · Next.js 16.2.6 + React 19.2.5 + TypeScript 6.0.3 + Tailwind v4.3.0。
本清单只做契约式规划 · 具体实现在 `03-frontend/app/(csr)/progress/` 下。

---

## 1. 列表视图

### `<ScheduleList />`
- 路径: `/projects/[id]/progress`
- 功能: 显示项目的所有 schedule 版本(最新在上,基线置顶标"基线")
- 主要列: version_no · name · planned_start/finish · CPI/SPI (最新快照) · is_baseline badge
- 操作: 新建 / 导入 (CSV/XER/MPP) / 锁定基线 / 查看详情
- 数据源: `GET /v1/csr/progress/schedules/{project_id}/active` + `GET /list`

### `<MilestoneList />`
- 路径: `/projects/[id]/progress/milestones`
- 功能: 合同里程碑列表 · 按 target_date 排序
- 主要列: code · name · category · target_date · actual_date · status · LD (违约金)
- 状态徽章: pending(灰) · achieved(绿) · slipped(红 · 带天数) · waived(黄)

## 2. 详情视图

### `<ScheduleGantt />` (核心)
- 路径: `/projects/[id]/progress/schedules/[scheduleId]`
- 渲染: d3.js 7.9.0 svg + virtual scroll (大计划 ~2000 工序也能丝滑)
- 层级: WBS 树 + 工序条 + 依赖箭头
- 交互: 鼠标悬停显示 early/late/actual 三套日期 · 拖拽调整时长 (权限内)
- 同步: 选中工序 → 触发 `<BIMViewer />` 高亮对应 GUID
- 颜色: 正常(蓝) · 关键(红) · 已完成(绿) · 延期(橙)

### `<ScheduleDetailDrawer />`
- 功能: 侧拉抽屉 · 显示选中工序的完整属性 + 编辑表单
- 字段: code · name · duration · dates · pct_complete · predecessors · resource_plan · bim_guids

## 3. 表单

### `<ScheduleCreateWizard />`
- 步骤:
  1. 基本信息 (name · 起止日期 · source)
  2. WBS 导入 (手动树 / 上传 CSV / 从 BIM 派生)
  3. 工序 (对每个 WBS 叶节点生成 1+ activity)
  4. 里程碑绑定
  5. 审批流预览
- 校验: Zod schema · 前端即时校验 · 后端再校验一次

### `<ActivityEditForm />`
- 编辑 activity 的所有字段
- 前驱选择器 `<PredecessorPicker />` · 支持快速搜索 activity code/name
- BIM GUID 关联 · 点击"从 BIM 模型选构件"打开 `<BIMViewer />` 多选模式

## 4. 图表 / 看板

### `<EVMDashboard />` (核心看板)
- 路径: `/projects/[id]/progress/evm`
- 卡片 1: 当期 PV · EV · AC (数字 + 趋势)
- 卡片 2: CPI · SPI (环形进度 + 阈值线 0.95)
- 图 1: 累计挣值曲线 (PV/EV/AC 三线 · TanStack Query + TanStack Chart)
- 图 2: 最近 30 日 SPI 滑动窗口
- 图 3: 预测曲线 (EAC · BAC · ETC)
- 刷新: 5 分钟自动 · 手动刷新按钮

### `<DelayTopList />`
- 路径: `/projects/[id]/progress/delays`
- 列表: Top 10 延期工序 · 按(延期天数 × WBS 权重) 排序
- 每行: activity code/name · 延期天数 · 根因摘要(AI 分析) · "触发纠偏向导"按钮

## 5. 流程向导

### `<RecoveryWizard />` (核心)
- 4 步:
  1. **识别** · 触发 `/recovery/analyze` · 显示 delay_root_cause_analyzer 结果
  2. **方案候选** · 3-5 个纠偏方案(赶工 / 并行 / 变更 / 资源追加)
  3. **影响评估** · 每个方案的 △工期 / △成本 / △风险
  4. **审批** · 选定方案 · 生成变更预案 → 跳转 12-change_order
- 流式响应 · SSE 流式呈现 LLM 产出

## 6. 可视化实用组件

### `<CPICurveSparkline />`
- 小尺寸迷你图 · 项目卡片上显示最近 14 日 SPI
- 用于项目大盘 `/dashboard`

### `<NetworkDiagram />`
- 可选 · PERT 网络图 · D3 力导向布局 · 用于方案评审

## 7. 状态管理

- 服务端状态: TanStack Query 5.99.1 (GET endpoints · staleTime 60s)
- 客户端状态: Zustand 5.0.12 (选中 activity · 视图 toggle · 过滤条件)

## 8. i18n

- zh-CN (主) · en-US (副) · 字典 `03-frontend/locales/csr/progress/zh-CN.json`
- 所有 UI 文案 · 不在 JSX 硬编码 · 走 `next-intl`

## 9. 无障碍 (a11y)

- Gantt SVG 有 aria-label + summary
- 颜色 + 形状双通道区分状态 (色盲友好)
- 键盘导航: Tab 穿过 activities · Space/Enter 选中 · Arrow 移动

## 10. 性能

- 大计划 (2000+ activities) · 启用 react-window 虚拟列表
- Gantt SVG · 按可视窗口只渲染可见 activity · canvas fallback 待评估
- 每次 snapshot 推送 · 不整屏刷 · 用 SWR 细粒度 key

---

version: 0.1.0 · 2026-04-23
