# 11-compliance · generator

---

## 硬约束

1. 每条 clause 的 verdict 必须有"reason + evidence"
2. 不编法规年号(引用必须与 applicable_clauses 返回值一致)
3. archive table_of_contents 不能缺类别

## 输出 · compliance_check

```json
{
  "version":"0.1.0",
  "check_no_suggestion":"JP-CC-2026-0055",
  "target_type":"inspection_lot",
  "target_id":"<uuid>",
  "clauses_checked":[
    {
      "standard":"GB 50205-2020",
      "clause":"§7.2.4",
      "is_mandatory":true,
      "clause_text":"二级焊缝内部缺陷允许值 ≤ 5mm",
      "verdict":"violated",
      "reason":"CMA 报告 JP-UT-2026-0013 · W-208 P2 夹渣 L=8mm > 5mm",
      "evidence_refs":["<lab_report 0013>"]
    },
    {
      "standard":"GB 50300-2013",
      "clause":"§5.0.4",
      "is_mandatory":true,
      "clause_text":"主控项目须全部合格",
      "verdict":"violated",
      "reason":"上条违反直接导致本条违反"
    },
    {
      "standard":"GB 50205-2020",
      "clause":"§7.3.2",
      "is_mandatory":true,
      "clause_text":"焊材与母材匹配",
      "verdict":"compliant",
      "reason":"焊材 E50 匹配 Q355B · 合格证齐"
    }
  ],
  "mandatory_total":3,
  "mandatory_violated":2,
  "verdict":"non_compliant",
  "followup_actions":[
    {"subdomain":"02-quality","action":"已触发 A5 JP-RO-2026-0017","status":"issued"}
  ]
}
```

## 输出 · archive table_of_contents

```json
{
  "version":"0.1.0",
  "package_type":"completion",
  "table_of_contents":[
    {"section":"1. 监理资料","items_count":135,"subsections":["监理规划","监理月报","监理日志","旁站","巡视","平行检验"]},
    {"section":"2. 施工验收资料","items_count":420,"subsections":["检验批","分项","分部","单位工程","隐蔽"]},
    {"section":"3. 试验检测报告","items_count":62,"subsections":["混凝土","钢筋","焊接","节能","防水"]},
    {"section":"4. 施工方案与交底","items_count":18,"subsections":["专项方案","论证","三级交底"]},
    {"section":"5. 工程变更与签证","items_count":23,"subsections":["engineering_changes","签证","索赔"]},
    {"section":"6. 行政审批","items_count":12,"subsections":["施工许可","质监","安监","消防","节能","防雷"]},
    {"section":"7. 影像资料","items_count":4820,"subsections":["进度","质量","安全","隐蔽","竣工"]},
    {"section":"8. BIM 模型","items_count":3,"subsections":["v1 初始","v3 最终","as-built"]},
    {"section":"9. 竣工证书","items_count":1,"subsections":["JP-HC-2026-0001"]}
  ],
  "completeness_self_check":{
    "all_8_classes_present":true,
    "missing":[]
  },
  "estimated_size_mb":480,
  "estimated_retention_years":30
}
```

---

version: 0.1.0 · 2026-04-23
