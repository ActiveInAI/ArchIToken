# 09-risk_analysis · BIM-INTEGRATION

---

## 1. 风险 3D 热力图

每个 risk_entry 可挂 bim_element_guids · `<RiskHeatmap />` 在 BIM 上显示:
- 红 · critical
- 橙 · major
- 黄 · minor
- 绿 · 无风险区

## 2. 监测点位空间映射

`risk_monitoring_points.gps` + `bim_element_guids` · 双向定位:
- IoT 告警时 · 直接在 BIM 上高亮
- 施工人员查某楼层 · 看有哪些监测点

## 3. 结构风险与构件

类别 `strain` / `tilt` / `displacement` / `vibration` 的监测点 · 通常挂到 IfcBuildingStorey / IfcBeam / IfcColumn。
用例:大跨梁下挠监测 · 传感器绑定具体 IfcBeam 的 GUID。

## 4. 气象风险

`weather` 类监测点 · 不挂具体构件 · 用 project 级 GPS。
但影响的 activities 列表 · 可能全覆盖露天工序。

## 5. 4D 模拟 · 风险注入

monte_carlo_schedule_simulator · 可把风险发生概率注入 activity duration:
- 每个 activity · 基础 duration + 相关 risks 的 expected impact
- 蒙特卡洛 10000 次 · 输出完工日期 P10/P50/P90

---

version: 0.1.0 · 2026-04-23
