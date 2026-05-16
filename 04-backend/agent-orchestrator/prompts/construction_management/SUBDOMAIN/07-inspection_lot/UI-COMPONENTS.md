# 07-inspection_lot · UI-COMPONENTS

---

## 1. 验收树(核心)

### `<AcceptanceTree />`
- 路径: `/projects/[id]/acceptance-tree`
- 左 · 四级树 · 每节点带 verdict 徽章(灰/绿/红)
- 右 · `<BIMViewer />` 按选中节点聚焦
- 顶部 · 进度条:全项目的 lot_pass / lot_total

### `<LotDetailPane />`
- 选中批 · 右侧弹详情
- 主控表 + 一般表 · 直接编辑
- 关联的测试报告 / 照片留痕 侧边栏

## 2. 评定表单

### `<MainControlChecklist />`
- 左 · 主控清单 · 每项:名称 · 标号 · 条款 · verdict 开关
- 右 · 支撑证据拖拽(报告 / 照片 · 从 06-testing 拉取)
- 提交前:显示"整批预测 verdict" · 让施工方自知

### `<GeneralItemProgress />`
- 一般项目逐条:sample_size / pass_count / pass_rate 实时计算
- 橙色警告:pass_rate < 0.80

## 3. 批划分

### `<LotBoundaryAdvisorDialog />`
- 输入 sub_item
- LLM 输出 3 种粒度(coarse / medium / fine)· 每种建议若干批
- 用户选中 + 编辑 · 一键创建

## 4. 聚合仪表盘

### `<SubPartRollupDashboard />`
- 按分部显示:批数 / 合格率 / 整改中 / 进度
- 八大分部横条图

### `<ProjectAcceptanceSummary />`
- 项目卡片:总批 N · 已 accepted M · 累计合格率 X%

## 5. 状态

- 状态色:pending 灰 · pass 绿 · fail 红 · accepted 蓝
- 色盲模式:同时使用 icon(⏳ / ✓ / ✗ / ⭐)

## 6. 性能

- 大项目 · 验收树节点 1000+ · 虚拟化
- BIM 联动节流 · 选中树节点 300ms 后才聚焦

---

version: 0.1.0 · 2026-04-23
