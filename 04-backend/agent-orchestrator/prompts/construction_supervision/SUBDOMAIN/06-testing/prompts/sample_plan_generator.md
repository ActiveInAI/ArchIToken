# 06-testing · sample_plan_generator

**角色**: 按 GB 规范自动生成取样计划 · 子域特定。
**输出**: 每检验批 / 每材料 的抽样频率 + 数量 + 方法。

## 输入

```json
{
  "project_id":"uuid",
  "inspection_lots":[
    {"id":"...","sub_item_code":"结构混凝土","sub_item_name":"二层梁柱","material":"C30 混凝土","volume_m3":42.5},
    {"id":"...","sub_item_code":"钢筋","sub_item_name":"HRB400","tonnage_t":5.8}
  ],
  "applicable_standards":["GB 50300-2013","GB 50204-2015","GB 50205-2020"]
}
```

## 硬约束

1. **不凭记忆给频率数值**。必须查 standard_library 里的条款(或模板化存在本 prompt 的"规则表")。
2. 频率 ≥ 规范最小要求(不容减)· 允许加严。
3. 单项目 · 同材料 · 不同批次 · 独立抽样(不合并)。

## 固定规则表(来自 GB 规范 · 应入 standard_library)

| 材料 | 抽样规则 | 依据 |
|---|---|---|
| C30 及以下 混凝土 | 每 100m³ · 或 不足 100m³ 每次连续浇筑 · 取 1 组标养试块 (3 块) | GB 50204-2015 §7.4.1 |
| C30 及以下 混凝土 | 每楼层 · 连续浇筑 ≥ 1 组同条件养护试块 | GB 50204-2015 §7.4.2 |
| HRB400 钢筋 | 每 60t · 不足 60t 视为一批 · 各项目抽 2 根 | GB 50204-2015 §5.2.1 |
| Q355B 钢材 | 按炉批号 · 每炉批抽 1 组 | GB 50205-2020 §4.2.3 |
| 二级焊缝 UT | 按焊缝长度每 50m 抽 10% 且不少于 1 处 | GB 50205-2020 §7.2.4 |
| 一级焊缝 UT | 100% | 同 |
| 水泥 | 每 200t · 或 不足 200t · 抽 1 组 | GB/T 1346 |
| 防水卷材 | 每 1000 m² · 抽 1 组(抗拉强度 + 不透水) | GB 50208-2011 §4 |
| 外墙保温板 | 每 1000 m² · 抽 1 组(导热系数 + 密度) | GB 50411-2019 §4 |

## 输出

```json
{
  "version":"0.1.0",
  "generated_at":"ISO-8601",
  "plan_by_lot":[
    {
      "lot_id":"<id>",
      "material":"C30 混凝土",
      "volume_m3":42.5,
      "sampling_rules_cited":["GB 50204-2015 §7.4.1","GB 50204-2015 §7.4.2"],
      "required_samples":[
        {"type":"standard_cured","group_count":1,"per_group":3,"when":"开盘连续浇筑"},
        {"type":"site_cured","group_count":1,"per_group":3,"when":"同条件"}
      ],
      "planned_dates":[
        {"date":"2026-05-20","type":"standard_cured","sample_count":3},
        {"date":"2026-05-20","type":"site_cured","sample_count":3}
      ]
    },
    {
      "lot_id":"<id>",
      "material":"HRB400 钢筋",
      "tonnage_t":5.8,
      "sampling_rules_cited":["GB 50204-2015 §5.2.1"],
      "required_samples":[
        {"type":"tensile","count":2,"when":"进场后 · 浇筑前"},
        {"type":"bend","count":2,"when":"进场后 · 浇筑前"}
      ]
    }
  ],
  "total_samples":10,
  "estimated_lab_cost_cny":3800,
  "warnings":[]
}
```

## 反模式

- ❌ "根据规范取样"(不给频率)
- ❌ 把"建议频率 20%"写 30% (加严合规 · 降严违法)
- ❌ 合并不同批次的抽样(必须分别)

---

version: 0.1.0 · 2026-04-23
