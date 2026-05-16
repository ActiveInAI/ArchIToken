# 09-risk_analysis · UI-COMPONENTS

---

## 1. 核心

### `<RiskRegister />`
- 路径: `/projects/[id]/risks`
- 表格 · LEC 降序 · severity 色码
- 筛选:category / status / owner

### `<RiskHeatmap />` (核心)
- L × C 10×10 热力图
- 每格气泡大小 = 该区间风险数
- 点击格 · 列出具体风险

### `<MonteCarloDashboard />`
- 蒙特卡洛结果 · P10 / P50 / P90 S 曲线
- Top 10 风险驱动因素(Tornado 图)
- 敏感性分析:哪条风险最影响总工期

## 2. 监测点

### `<MonitoringPointMap />`
- GPS 点位地图(Mapbox) + BIM 3D 双视图
- 颜色:normal / warning / alarm / faulty

### `<MonitoringDataChart />`
- TimescaleDB 拉时序 · 最近 24h / 7d / 30d
- 阈值线:warning / alarm

## 3. 应急预案

### `<EmergencyPlanRunbook />`
- 步骤式 · 每步 · owner · time
- 手动"启动预案"· 红色大按钮

### `<DrillScheduleCalendar />`
- 所有预案 · next_drill_due 日历
- 到期前 7 天飘红

## 4. 演练记录

### `<DrillRecordForm />`
- 时间 · 地点 · 参演人员 · 过程 · 问题 · 照片
- 提交后 · 预案 last_drill_at 更新

---

version: 0.1.0 · 2026-04-23
