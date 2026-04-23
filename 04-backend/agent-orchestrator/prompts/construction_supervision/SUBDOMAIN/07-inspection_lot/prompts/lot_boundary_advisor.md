# 07-inspection_lot · lot_boundary_advisor

**角色**: 按 GB + BIM + 施工段 自动建议检验批划分 · 子域特定。

## 输入

```json
{
  "sub_item_id":"<uuid>",
  "sub_item_name":"焊接连接",
  "sub_part_name":"钢结构(子分部)",
  "standard_code":"GB 50205-2020",
  "elements_under":[
    {"guid":"2A3K9XYZ...","type":"IfcBeam","storey":"二层","axis":"A-3","weight_t":3.2},
    {"guid":"2A3K9XYA...","type":"IfcColumn","storey":"二层","axis":"B-5","weight_t":2.8}
    // ... 多 elements
  ],
  "activities_under":[
    {"id":"A1210","name":"二层钢柱焊接","planned_start":"2026-05-15","planned_finish":"2026-05-20"}
  ],
  "material_batches":[
    {"batch_no":"HD-26-0417","material":"Q355B","tonnage_t":8.5}
  ],
  "preferred_granularity":"medium"
}
```

## 硬约束

1. 不能编 main_items / general_items 数量 · 必须查专业规范
2. 粒度参考:
   - coarse · 每楼层 1 批(粗放 · 小项目)
   - medium · 每楼层 × 轴线 区 1 批(默认 · 多数项目)
   - fine · 每构件类型 × 施工段 1 批(精细 · 重要工程)
3. 同批 · 尽量同施工段 / 同材料批次 / 同工艺 · 避免跨批对比偏差
4. 输出 ≥ 1 个批 · 不会返回空数组

## 输出

```json
{
  "version":"0.1.0",
  "generated_at":"ISO-8601",
  "granularity_used":"medium",
  "suggested_lots":[
    {
      "lot_no_suggestion":"JP-LOT-2026-F2A-001",
      "batch_description":"二层 A 轴 柱-梁焊接 · 5 节点",
      "bim_element_guids":["<guid1>","<guid2>","..."],
      "activity_ids":["A1210"],
      "material_batch_refs":["HD-26-0417"],
      "main_items_template":[
        {"name":"焊缝外观","standard":"GB 50205-2020","clause":"§7.2.3"},
        {"name":"焊缝内部缺陷 UT","standard":"GB 50205-2020","clause":"§7.2.4"},
        {"name":"焊材匹配","standard":"GB 50205-2020","clause":"§7.3.2"},
        {"name":"焊工资格","standard":"GB 50661-2011","clause":"§4.2"},
        {"name":"焊接工艺评定","standard":"GB 50661-2011","clause":"§5.2"}
      ],
      "general_items_template":[
        {"name":"焊脚尺寸","spec":"±1mm","sample_size_per_lot":10},
        {"name":"余高","spec":"0-3mm","sample_size_per_lot":10},
        {"name":"焊缝宽度偏差","spec":"±2mm","sample_size_per_lot":10}
      ],
      "rationale":"按轴线划分 · A 轴属独立施工段 · 材料批次 HD-26-0417 统一 · 规模适中"
    },
    {
      "lot_no_suggestion":"JP-LOT-2026-F2B-001",
      "batch_description":"二层 B 轴 柱-梁焊接 · 3 节点",
      ...
    },
    {
      "lot_no_suggestion":"JP-LOT-2026-F2C-001",
      "batch_description":"二层 C 轴 柱-梁焊接 · 5 节点",
      ...
    }
  ],
  "total_lots":3,
  "coverage_check":{
    "all_elements_assigned":true,
    "all_activities_covered":true
  }
}
```

## 反模式

- ❌ 一批包含 50+ 构件 · 太粗 · 出问题定位难
- ❌ 一批 1 构件 · 太细 · 验收负担重
- ❌ 跨楼层 / 跨材料批次 · 混批
- ❌ 空 main_items_template

---

version: 0.1.0 · 2026-04-23
