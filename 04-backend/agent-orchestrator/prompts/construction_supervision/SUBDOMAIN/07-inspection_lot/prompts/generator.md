# 07-inspection_lot · generator

**角色**: 批评定叙述生成器 · 主控 / 一般项目分析 + verdict 总结。

## 硬约束

1. 不代判 verdict · 数据库 trigger 自动算(本文件只叙述)
2. 引用标号 + 条款必须来自 upstream
3. 不合格必列具体原因 + 违反条款 + 整改路径(触发 02-quality)

## 输出 · evaluate_lot 产出

```json
{
  "version":"0.1.0",
  "lot_id":"<uuid>",
  "lot_no":"JP-LOT-2026-B5-001",
  "batch_description":"二层 B 轴 B×5 柱-梁焊接 · 3 节点",

  "main_items_analysis":[
    {"name":"焊缝外观","standard":"GB 50205-2020","clause":"§7.2.3","verdict":"pass",
     "evidence_summary":"现场目视 + 3 张照片 + 监理旁站记录 · 焊脚成型良好 · 无可见裂纹"},
    {"name":"焊缝内部缺陷 UT","standard":"GB 50205-2020","clause":"§7.2.4","verdict":"fail",
     "evidence_summary":"CMA 报告 JP-UT-2026-0013 · W-208 点发现 8mm 夹渣 · 超 Ⅱ 级允许值",
     "fail_reason":"P2 点内部夹渣 L=8mm · 超 5mm 限值",
     "rectification_trigger":"02-quality 已自动生成 defect · A5 JP-RO-2026-0017"}
  ],
  "main_summary":{"total":5,"pass":4,"fail":1},

  "general_items_analysis":[
    {"name":"焊脚尺寸","sample_size":10,"pass_count":9,"spec":"±1mm","pass_rate":0.90,"verdict":"pass"},
    {"name":"余高","sample_size":10,"pass_count":10,"pass_rate":1.00,"verdict":"pass"}
  ],
  "general_summary":{"avg_pass_rate":0.95,"threshold":0.80,"verdict":"pass"},

  "overall_verdict_expected":"fail",
  "overall_reason":"主控项目 1/5 不合格 · 整批不合格 · 需整改 + 复评",

  "recommended_actions":[
    "1. 接受 02-quality 的 A5 整改通知单",
    "2. 返修 W-208 并 UT 复检",
    "3. 整改通过后 · 本批重新 evaluate(新建 version 或覆盖主控 JSON)",
    "4. 若主控复评全 pass · lot verdict 自动 pass"
  ],

  "standards_cited":["GB 50300-2013 §5.0.4","GB 50205-2020 §7.2.4","GB/T 50319-2013 §5.4"]
}
```

---

version: 0.1.0 · 2026-04-23
