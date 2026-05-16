# 09-risk_analysis · generator

---

## 硬约束

1. L/E/C 建议值必须给理由 · 不凭感觉
2. 预案步骤 · 每步 time_minutes(不可"立即")
3. 联系方式 · 只用 input 里给的(本项目特定电话)· 不编

## 输出 · register_risk

```json
{
  "version":"0.1.0",
  "risk_no_suggestion":"JP-RISK-2026-0015",
  "title":"雨季山洪停工",
  "category":"weather",
  "description":"5-6 月贵州雨季 · 锦屏山区暴雨易引发山洪 · 冲击施工现场 · 造成 1-3 日停工",
  "likelihood_suggestion":{"value":6,"reason":"锦屏过去 5 年 · 雨季暴雨年均 3 次 · 比 5/10 频率略高"},
  "exposure_suggestion":{"value":6,"reason":"山区项目持续暴露 · 但非全年 · 雨季 2 个月"},
  "consequence_suggestion":{"value":15,"reason":"1-3 日停工 + 设备淋雨 · 经济影响 ¥3-5 万 · 无人身伤害"},
  "lec_score_computed":540,
  "severity":"critical",
  "treatment_suggestion":"mitigate",
  "controls_suggestion":[
    {"type":"engineering","measure":"现场排水沟 · 雨污分流 · 基坑周边加高"},
    {"type":"monitoring","measure":"气象监测点 + 水位传感器(warning 30mm/h · alarm 50mm/h)"},
    {"type":"administrative","measure":"暴雨黄色预警 · 自检 · 红色预警 · 停工撤离"}
  ],
  "residual_estimates":{"likelihood":3,"exposure":6,"consequence":10,"lec":180}
}
```

## 输出 · draft_plan

```json
{
  "version":"0.1.0",
  "plan_no":"JP-EP-2026-0003",
  "title":"雨季山洪应急预案",
  "scenario":"山洪 + 暴雨",
  "trigger_conditions":[
    {"source":"monitoring_point","point_id":"<MP-0008>","threshold":"alarm (雨量 50mm/h)"},
    {"source":"weather_bureau","condition":"暴雨红色预警"}
  ],
  "procedures":[
    {"step":1,"action":"监测或预警触发 · 值班员立即广播全场","owner":"安全员","time_minutes":1},
    {"step":2,"action":"停止所有基坑 / 高处 / 吊装作业","owner":"施工负责人","time_minutes":5},
    {"step":3,"action":"工人撤至 A 区集合点(东北高地)","owner":"班组长","time_minutes":10},
    {"step":4,"action":"清点人数 · 上报 + 联系外援(如需)","owner":"项目经理","time_minutes":15},
    {"step":5,"action":"现场设备保护(塔吊回转零位 · 电源总闸断)","owner":"机电工长","time_minutes":20},
    {"step":6,"action":"持续监测 · 安全阈值恢复后 · 检查现场 · 方可复工","owner":"监理","time_minutes":120}
  ],
  "emergency_contacts":[
    {"role":"119 火警","number":"119"},
    {"role":"120 急救","number":"120"},
    {"role":"锦屏县防汛办","number":"input.provided"},
    {"role":"监理总监 张工","number":"input.provided"},
    {"role":"当地电网抢修","number":"input.provided"}
  ],
  "muster_point_suggestion":"A 区东北高地 · GPS (26.xxxx, 109.xxxx)",
  "drill_frequency_days":180
}
```

---

version: 0.1.0 · 2026-04-23
