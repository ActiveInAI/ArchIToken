# 10-bim_integration · UI-COMPONENTS

---

## 1. 核心 3D 渲染

### `<BIMViewer />`
- Three.js r184 + IfcJS / web-ifc
- 核心控件:视点 · 剖切 · 选择 · 尺寸量测 · 楼层过滤 · 高亮
- 外部 API:`select(guids: string[])` · `highlight(guids, color)` · `filterBy(fn)`

### `<ModelVersionSwitcher />`
- 下拉切换 · v1 / v2 / v3 / as-built
- 对比模式:左右分栏两版本 · 差异高亮

## 2. 碰撞

### `<ClashReportList />`
- 表格 · 按 severity 分色
- 点击跳 `<BIMViewer />` · 自动高亮两元素

### `<ClashDetectLauncher />`
- 按钮 · 触发 detect + triage
- 进度条 · 结果列表

## 3. 4D / 5D

### `<FourDTimeline />` (核心)
- 时间轴(日 · 周 · 月)
- 拖拽时间滑块 · BIM 按工序进度切片
- 未开始(灰)· 进行中(黄)· 已完(绿)· 延期(红)

### `<FiveDCostHeatmap />`
- 按日期切片 · BIM 构件颜色表示"累计产值占比"
- 同时联动 `<EVMDashboard />`(01-progress)

## 4. CDE

### `<CDEStatusBadge />`
- 模型版本 · 显示 WIP / Shared / Published / Archive
- 状态切换权限控制

## 5. 性能

- 大模型(> 1GB IFC · 10000+ elements)· 分块 glTF · Level-of-detail
- 移动端 · 只渲染简化 glTF(删除细节 < 10mm)
- OPFS 缓存 · `@utooland/opfs-project v0.2.8`

---

version: 0.1.0 · 2026-04-23
