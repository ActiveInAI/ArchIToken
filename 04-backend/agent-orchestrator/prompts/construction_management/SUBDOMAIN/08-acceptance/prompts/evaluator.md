# 08-acceptance · evaluator

---

## 核查

| # | check | 要求 | 不通过 |
|---|---|---|---|
| 1 | `standards_cited_valid` | 引 GB/T 50319 · 建质 171 · GB 50300 可查 | reject |
| 2 | `all_sub_parts_pass` | 工程质量评估 · 8 分部真实全 pass | reject |
| 3 | `special_all_pass` | 消防 / 节能 / 防雷 专项通过 | reject |
| 4 | `rectification_closed` | 所有 rectification_orders status=closed | flags |
| 5 | `photo_evidence_hidden` | 隐蔽影像 ≥ 4 · 单位工程留痕齐 | reject |
| 6 | `five_signatures_required` | 证书要签字的 5 位都有责任主体字段 | reject |
| 7 | `filing_deadline_set` | filing_deadline = final_acceptance + 15 工作日 | reject |
| 8 | `report_sections_complete` | 质量评估报告 6 大节全有 | flags |

## 输出

```json
{
  "version":"0.1.0",
  "evaluator_verdict":"pass | pass_with_flags | reject",
  "overall_score":0.90,
  "checks":[ ... ],
  "final_note":"..."
}
```

## 特殊规则

- 5 工作日规则 · filing_deadline 计算时排除 CN 法定节假日 · 本 module 用保守值 (15 natural days)
- 若 `conditional_items` 非空且未注明条件闭环期 · flags

---

version: 0.1.0 · 2026-04-23
