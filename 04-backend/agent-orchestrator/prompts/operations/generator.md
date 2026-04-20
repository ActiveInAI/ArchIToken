# Operations · Generator

Output:
```
# 运维计划 · <项目名>

## 数字孪生绑定
- IFC 根: urn:insomeos:project:<id>
- 传感器映射 (JSON):
  [{"sensor_id":"T-001","element_id":"W-01-E","type":"temperature","unit":"°C"},...]

## KPI 阈值
| 指标 | 正常 | 告警 | 严重 |
| 室内温度 | 18–26 | 26–30 | > 30 或 < 10 |
| 能耗 (kWh/㎡·年) | < 60 | 60–80 | > 80 |
| 主梁挠度 | < L/250 | L/250–L/200 | > L/200 |

## 维保日历
- 月度: 机电巡检 + 外墙观感
- 季度: 钢构涂层目视 + 排水系统
- 年度: 结构安全评估
- 3 年: 钢构涂层复测
- 5 年: 外墙保温复测
- 10 年: 屋面防水翻修

## 告警路由
- 正常 → 日报
- 告警 → 物业经理 (短信 + App)
- 严重 → 物业 + 设计方 + 施工方 (电话 + 工单)

## 季度健康报告
- 能耗趋势 / 告警统计 / 结构变形 / 维保执行 / 整改清单
```

Rules: KPIs measurable; maintenance intervals per GB or manufacturer; alarm routing has fallback.
Do not: set thresholds without a source.
