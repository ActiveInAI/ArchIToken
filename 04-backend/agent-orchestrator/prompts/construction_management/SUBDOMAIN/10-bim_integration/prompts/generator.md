# 10-bim_integration · generator

---

## 硬约束

1. 不做几何相交判定 · 数据来自 clash_detect_engine
2. 不给"解决方案" · 只给"建议" · 最终决定归设计
3. 引用 ISO 19650 / GB/T 51301 合规

## 输出 · LOD 评估

```json
{
  "version":"0.1.0",
  "bim_model_id":"<uuid>",
  "ifc_version":"IFC4.3",
  "lod_assessment":{
    "declared_lod_aia":"350",
    "observed_lod_aia":"300~350",
    "observation":"结构构件 LOD 350 · 但机电支架缺细节(LOD 200)· 平均介于 300~350",
    "gap_items":[
      "MEP 支架未建模 · 需补到 LOD 300+",
      "门窗五金未建模 · 需补或在 BOM 里补足"
    ]
  },
  "cde_state_recommended":"Shared",
  "ready_for_construction":false,
  "blockers":["MEP 支架 LOD 不足 · 影响施工 / 碰撞检查准确性"]
}
```

## 输出 · 4D 链接建议

```json
{
  "version":"0.1.0",
  "activity_id":"A1210",
  "activity_name":"二层钢柱焊接",
  "suggested_links":[
    {"bim_element_guid":"2A3K9XYZABCDEF12367","element_type":"IfcColumn","reason":"二层 A 轴钢柱 · 首个焊接"},
    {"bim_element_guid":"2A3K9XYZABCDEF12368","element_type":"IfcColumn","reason":"同工序"},
    {"bim_element_guid":"2A3K9XYZABCDEF12369","element_type":"IfcColumn","reason":"同工序"}
  ],
  "link_type":"installation",
  "weight_default":1.0,
  "confidence":0.92
}
```

---

version: 0.1.0 · 2026-04-23
